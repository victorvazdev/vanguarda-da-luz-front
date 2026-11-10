import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import { beforeEach, describe, it } from 'vitest';
import { account, asUser, presenceWithCount, seed, useRulesEnv } from './env';

const env = useRulesEnv();

const DAY = 86_400_000;
const event = (over: Record<string, unknown> = {}) => ({
  title: 'Raid semanal',
  startsAt: new Date(Date.now() + 3 * DAY),
  description: '[DESCRIÇÃO DO EVENTO]',
  organizer: 'Maren',
  status: 'ativo',
  createdBy: 'ana',
  createdAt: new Date('2026-11-01T12:00:00Z'),
  updatedAt: new Date('2026-11-01T12:00:00Z'),
  ...over,
});

beforeEach(() =>
  seed(env(), {
    'users/ana': account('ana', { status: 'ativo', role: 'admin' }),
    'users/tavia': account('tavia', { status: 'ativo' }),
    'users/dorvan': account('dorvan', { status: 'ativo' }),
    'users/kaelen': account('kaelen'),
    'users/brenna': account('brenna', { status: 'desativado' }),
    'events/raid': event(),
    'events/antigo': event({ startsAt: new Date(Date.now() - DAY) }),
    'events/cancelado': event({ status: 'cancelado' }),
    'events/raid/attendees/dorvan': { confirmedAt: new Date() },
    'events/raid/attendees/brenna': { confirmedAt: new Date() },
    'events/antigo/attendees/dorvan': { confirmedAt: new Date() },
    'events/cancelado/attendees/dorvan': { confirmedAt: new Date() },
  }),
);

const attendee = (as: string, eventId: string, uid = as) =>
  doc(asUser(env(), as), 'events', eventId, 'attendees', uid);
/** Confirma com o contador do evento (eventos semeados sem contador: passa a 1). */
const confirm = (as: string, eventId: string, data: Record<string, unknown> = {}, uid = as) =>
  presenceWithCount(
    asUser(env(), as),
    eventId,
    'attendees',
    uid,
    { confirmedAt: serverTimestamp(), ...data },
    1,
  );
/** Cancela com o contador do evento (sem contador: continua em 0). */
const cancel = (as: string, eventId: string, uid = as) =>
  presenceWithCount(asUser(env(), as), eventId, 'attendees', uid, null, 0);

describe('Confirmar presença', () => {
  it('membro confirma a própria presença em evento futuro e ativo', async () => {
    await assertSucceeds(confirm('tavia', 'raid'));
  });

  it('administrador também confirma a própria presença', async () => {
    await assertSucceeds(confirm('ana', 'raid'));
  });

  it('ninguém confirma em nome de outra pessoa', async () => {
    await assertFails(confirm('tavia', 'raid', {}, 'kaelen'));
    await assertFails(confirm('ana', 'raid', {}, 'tavia'));
  });

  it('não confirma duas vezes no mesmo evento', async () => {
    await assertFails(confirm('dorvan', 'raid'));
  });

  it('não confirma em evento passado, cancelado ou inexistente', async () => {
    await assertFails(confirm('tavia', 'antigo'));
    await assertFails(confirm('tavia', 'cancelado'));
    await assertFails(confirm('tavia', 'nao-existe'));
  });

  it('conta pendente ou desativada não confirma', async () => {
    await assertFails(confirm('kaelen', 'raid'));
    await assertFails(confirm('brenna', 'raid'));
  });

  it('registra só o horário do servidor', async () => {
    await assertFails(confirm('tavia', 'raid', { confirmedAt: new Date() }));
    await assertFails(confirm('tavia', 'raid', { characterName: 'Outro' }));
  });
});

describe('Ler presenças', () => {
  it('membro lê somente a própria presença', async () => {
    await assertSucceeds(getDoc(attendee('dorvan', 'raid')));
    await assertSucceeds(getDoc(attendee('tavia', 'raid')));
    await assertFails(getDoc(attendee('tavia', 'raid', 'dorvan')));
    await assertFails(getDocs(collection(asUser(env(), 'tavia'), 'events', 'raid', 'attendees')));
  });

  it('administrador lista os confirmados', async () => {
    await assertSucceeds(getDocs(collection(asUser(env(), 'ana'), 'events', 'raid', 'attendees')));
  });

  it('conta desativada não lê nem a própria presença', async () => {
    await assertFails(getDoc(attendee('brenna', 'raid')));
  });
});

describe('Cancelar presença', () => {
  it('membro cancela a própria presença em evento futuro e ativo', async () => {
    await assertSucceeds(cancel('dorvan', 'raid'));
  });

  it('depois de cancelar, pode confirmar de novo', async () => {
    await assertSucceeds(cancel('dorvan', 'raid'));
    await assertSucceeds(confirm('dorvan', 'raid'));
  });

  it('membro não cancela a presença de outra pessoa', async () => {
    await assertFails(cancel('tavia', 'raid', 'dorvan'));
  });

  it('administrador cancela a presença de qualquer confirmado', async () => {
    await assertSucceeds(cancel('ana', 'raid', 'dorvan'));
  });

  it('nem o administrador cancela depois que o evento começou ou foi cancelado', async () => {
    await assertFails(cancel('ana', 'antigo', 'dorvan'));
    await assertFails(cancel('ana', 'cancelado', 'dorvan'));
  });

  it('não cancela depois que o evento começou ou foi cancelado', async () => {
    await assertFails(cancel('dorvan', 'antigo'));
    await assertFails(cancel('dorvan', 'cancelado'));
  });

  it('conta desativada não altera presenças', async () => {
    await assertFails(cancel('brenna', 'raid'));
  });
});

describe('Contador e limite de confirmados', () => {
  beforeEach(() =>
    seed(env(), {
      'events/quase': event({ maxAttendees: 2, attendeeCount: 1 }),
      'events/lotado': event({ maxAttendees: 1, attendeeCount: 1 }),
      'events/lotado/attendees/dorvan': { confirmedAt: new Date() },
    }),
  );

  const db = (uid: string) => asUser(env(), uid);
  const presence = { confirmedAt: serverTimestamp() };

  it('confirma enquanto houver vaga, subindo o contador em 1', async () => {
    await assertSucceeds(
      presenceWithCount(db('tavia'), 'quase', 'attendees', 'tavia', presence, 2),
    );
  });

  it('não confirma além do limite', async () => {
    await assertFails(presenceWithCount(db('tavia'), 'lotado', 'attendees', 'tavia', presence, 2));
  });

  it('não confirma sem atualizar o contador, nem com outro valor', async () => {
    await assertFails(setDoc(attendee('tavia', 'quase'), presence));
    await assertFails(presenceWithCount(db('tavia'), 'quase', 'attendees', 'tavia', presence, 1));
    await assertFails(presenceWithCount(db('tavia'), 'raid', 'attendees', 'tavia', presence, 2));
  });

  it('o contador aponta a presença alterada', async () => {
    const d = db('tavia');
    const batch = writeBatch(d);
    batch.set(doc(d, 'events', 'quase', 'attendees', 'tavia'), presence);
    batch.update(doc(d, 'events', 'quase'), {
      attendeeCount: 2,
      lastAttendance: { kind: 'attendees', id: 'dorvan' },
    });
    await assertFails(batch.commit());
  });

  it('ninguém altera o contador sem confirmar ou cancelar uma presença', async () => {
    for (const uid of ['tavia', 'ana']) {
      await assertFails(
        updateDoc(doc(db(uid), 'events', 'lotado'), {
          attendeeCount: 0,
          lastAttendance: { kind: 'attendees', id: 'ninguem' },
        }),
      );
    }
    await assertFails(updateDoc(doc(db('ana'), 'events', 'lotado'), { attendeeCount: 0 }));
  });

  it('cancelar libera a vaga, descendo o contador em 1', async () => {
    await assertFails(deleteDoc(attendee('dorvan', 'lotado')));
    await assertFails(presenceWithCount(db('dorvan'), 'lotado', 'attendees', 'dorvan', null, 1));
    await assertSucceeds(presenceWithCount(db('dorvan'), 'lotado', 'attendees', 'dorvan', null, 0));
    await assertSucceeds(
      presenceWithCount(db('tavia'), 'lotado', 'attendees', 'tavia', presence, 1),
    );
  });
});
