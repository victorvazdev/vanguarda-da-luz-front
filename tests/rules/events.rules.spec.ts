import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import {
  addDoc,
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
import { account, asUser, asVisitor, seed, useRulesEnv } from './env';

const env = useRulesEnv();

const DAY = 86_400_000;
const future = () => new Date(Date.now() + 3 * DAY);
const past = () => new Date(Date.now() - DAY);

const content = (over: Record<string, unknown> = {}) => ({
  title: 'Raid semanal',
  startsAt: future(),
  description: '[DESCRIÇÃO DO EVENTO]',
  organizer: 'Maren',
  ...over,
});

const newEvent = (uid: string, over: Record<string, unknown> = {}) => ({
  ...content(),
  status: 'ativo',
  createdBy: uid,
  createdAt: serverTimestamp(),
  updatedAt: serverTimestamp(),
  ...over,
});

const stored = (over: Record<string, unknown> = {}) => ({
  ...content(),
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
    'users/kaelen': account('kaelen'),
    'users/brenna': account('brenna', { status: 'desativado' }),
    'events/raid': stored(),
    'events/antigo': stored({ startsAt: past() }),
    'events/cancelado': stored({ status: 'cancelado' }),
  }),
);

const guestDoc = () => ({
  game: 'forever',
  characterName: 'Lunara',
  characterSurname: 'Sombraviva',
  confirmedAt: new Date(),
});

const events = (uid: string) => collection(asUser(env(), uid), 'events');
const event = (uid: string, id: string) => doc(asUser(env(), uid), 'events', id);

describe('Ler eventos', () => {
  it('membros ativos e administradores leem e listam', async () => {
    await assertSucceeds(getDocs(events('tavia')));
    await assertSucceeds(getDoc(event('ana', 'raid')));
  });

  it('visitante, conta pendente e conta desativada também leem (calendário público)', async () => {
    await assertSucceeds(getDocs(collection(asVisitor(env()), 'events')));
    await assertSucceeds(getDoc(doc(asVisitor(env()), 'events', 'raid')));
    await assertSucceeds(getDoc(event('kaelen', 'raid')));
    await assertSucceeds(getDocs(events('brenna')));
  });
});

describe('Criar evento', () => {
  it('administrador cria evento futuro', async () => {
    await assertSucceeds(addDoc(events('ana'), newEvent('ana')));
  });

  it('membro não cria', async () => {
    await assertFails(addDoc(events('tavia'), newEvent('tavia')));
  });

  it('não aceita data e horário no passado', async () => {
    await assertFails(addDoc(events('ana'), newEvent('ana', { startsAt: past() })));
  });

  it('exige título, descrição e organizador preenchidos', async () => {
    for (const field of ['title', 'description', 'organizer']) {
      await assertFails(addDoc(events('ana'), newEvent('ana', { [field]: '   ' })));
      const missing = newEvent('ana');
      delete (missing as Record<string, unknown>)[field];
      await assertFails(addDoc(events('ana'), missing));
    }
  });

  it('limita o tamanho dos textos', async () => {
    await assertFails(addDoc(events('ana'), newEvent('ana', { title: 'x'.repeat(81) })));
    await assertFails(addDoc(events('ana'), newEvent('ana', { organizer: 'x'.repeat(41) })));
    await assertFails(addDoc(events('ana'), newEvent('ana', { description: 'x'.repeat(2001) })));
  });

  it('nasce ativo, com autor e datas do servidor, sem campos extras', async () => {
    await assertFails(addDoc(events('ana'), newEvent('ana', { status: 'cancelado' })));
    await assertFails(addDoc(events('ana'), newEvent('ana', { createdBy: 'tavia' })));
    await assertFails(addDoc(events('ana'), newEvent('ana', { createdAt: new Date() })));
    await assertFails(addDoc(events('ana'), newEvent('ana', { attendees: [] })));
  });

  it('aceita limite de confirmados de 1 a 500, e o contador nasce zerado', async () => {
    await assertSucceeds(addDoc(events('ana'), newEvent('ana', { maxAttendees: 1 })));
    await assertSucceeds(addDoc(events('ana'), newEvent('ana', { maxAttendees: 500 })));
    await assertSucceeds(addDoc(events('ana'), newEvent('ana', { attendeeCount: 0 })));
    for (const maxAttendees of [0, 501, 2.5, '40']) {
      await assertFails(addDoc(events('ana'), newEvent('ana', { maxAttendees })));
    }
    await assertFails(addDoc(events('ana'), newEvent('ana', { attendeeCount: 3 })));
  });

  it('aceita ligar ou desligar a confirmação de presença de visitantes', async () => {
    await assertSucceeds(addDoc(events('ana'), newEvent('ana', { guestsAllowed: true })));
    await assertSucceeds(addDoc(events('ana'), newEvent('ana', { guestsAllowed: false })));
    await assertFails(addDoc(events('ana'), newEvent('ana', { guestsAllowed: 'sim' })));
  });
});

describe('Editar evento', () => {
  const edit = (uid: string, id: string, over: Record<string, unknown> = {}) =>
    updateDoc(event(uid, id), {
      title: 'Raid semanal (heroico)',
      updatedAt: serverTimestamp(),
      updatedBy: uid,
      ...over,
    });

  it('administrador edita título, data, horário, descrição e organizador', async () => {
    await assertSucceeds(
      edit('ana', 'raid', {
        startsAt: new Date(Date.now() + 5 * DAY),
        description: 'Nova descrição',
        organizer: 'Dorvan',
      }),
    );
  });

  it('membro não edita', async () => {
    await assertFails(edit('tavia', 'raid'));
  });

  it('administrador altera o limite de confirmados, mas não o contador', async () => {
    await assertSucceeds(edit('ana', 'raid', { maxAttendees: 10 }));
    await assertFails(edit('ana', 'raid', { maxAttendees: 0 }));
    await assertFails(edit('ana', 'raid', { attendeeCount: 5 }));
  });

  it('administrador liga ou desliga a confirmação de presença de visitantes', async () => {
    await assertSucceeds(edit('ana', 'raid', { guestsAllowed: false }));
    await assertSucceeds(edit('ana', 'raid', { guestsAllowed: true }));
    await assertFails(edit('ana', 'raid', { guestsAllowed: 1 }));
    await assertFails(edit('tavia', 'raid', { guestsAllowed: false }));
  });

  it('não move o evento para o passado', async () => {
    await assertFails(edit('ana', 'raid', { startsAt: past() }));
  });

  it('não edita evento passado ou cancelado', async () => {
    await assertFails(edit('ana', 'antigo'));
    await assertFails(edit('ana', 'cancelado'));
  });

  it('não altera a situação nem o autor pela edição', async () => {
    await assertFails(edit('ana', 'raid', { status: 'cancelado' }));
    await assertFails(edit('ana', 'raid', { createdBy: 'tavia' }));
  });

  it('não esvazia campos obrigatórios', async () => {
    await assertFails(edit('ana', 'raid', { title: '' }));
  });
});

describe('Cancelar evento', () => {
  const cancel = (uid: string, id: string, over: Record<string, unknown> = {}) =>
    updateDoc(event(uid, id), {
      status: 'cancelado',
      cancelledAt: serverTimestamp(),
      cancelledBy: uid,
      ...over,
    });

  it('administrador cancela um evento futuro, que continua existindo', async () => {
    await assertSucceeds(cancel('ana', 'raid'));
    await assertSucceeds(getDoc(event('tavia', 'raid')));
  });

  it('membro não cancela', async () => {
    await assertFails(cancel('tavia', 'raid'));
  });

  it('não cancela evento passado nem reativa um cancelado', async () => {
    await assertFails(cancel('ana', 'antigo'));
    await assertFails(updateDoc(event('ana', 'cancelado'), { status: 'ativo' }));
  });

  it('registra quem cancelou e quando', async () => {
    await assertFails(cancel('ana', 'raid', { cancelledBy: 'tavia' }));
    await assertFails(cancel('ana', 'raid', { cancelledAt: new Date() }));
  });

  it('não muda outros campos junto com o cancelamento', async () => {
    await assertFails(cancel('ana', 'raid', { title: 'Outro' }));
  });

  it('eventos ativos não são apagados, nem pelo administrador', async () => {
    await assertFails(deleteDoc(event('ana', 'raid')));
    await assertFails(deleteDoc(event('ana', 'antigo')));
  });

  it('ninguém grava evento com ID escolhido fora das regras de criação', async () => {
    await assertFails(setDoc(event('tavia', 'novo'), newEvent('tavia')));
  });
});

describe('Excluir evento cancelado', () => {
  beforeEach(() =>
    seed(env(), {
      'events/cancelado-antigo': stored({ status: 'cancelado', startsAt: past() }),
      'events/cancelado/attendees/tavia': { confirmedAt: new Date() },
      'events/cancelado/attendees/kaelen': { confirmedAt: new Date() },
    }),
  );

  const attendee = (uid: string, id: string, who: string) =>
    doc(asUser(env(), uid), 'events', id, 'attendees', who);

  /** Evento e lista de confirmados no mesmo lote, como o app faz. */
  const removeWithAttendees = (uid: string, id: string) => {
    const db = asUser(env(), uid);
    const batch = writeBatch(db);
    batch.delete(doc(db, 'events', id, 'attendees', 'tavia'));
    batch.delete(doc(db, 'events', id, 'attendees', 'kaelen'));
    batch.delete(doc(db, 'events', id));
    return batch.commit();
  };

  it('administrador exclui o evento cancelado com a lista de confirmados', async () => {
    await assertSucceeds(removeWithAttendees('ana', 'cancelado'));
  });

  it('exclui evento cancelado mesmo depois da data', async () => {
    await assertSucceeds(deleteDoc(event('ana', 'cancelado-antigo')));
  });

  it('membro, conta pendente, desativada e visitante não excluem', async () => {
    for (const uid of ['tavia', 'kaelen', 'brenna']) {
      await assertFails(removeWithAttendees(uid, 'cancelado'));
      await assertFails(deleteDoc(event(uid, 'cancelado')));
    }
    await assertFails(deleteDoc(doc(asVisitor(env()), 'events', 'cancelado')));
  });

  it('fora da exclusão, o evento cancelado mantém a lista de confirmados', async () => {
    await assertFails(deleteDoc(attendee('ana', 'cancelado', 'tavia')));
  });

  it('presenças que sobraram de um evento já excluído podem ser apagadas pelo administrador', async () => {
    await seed(env(), { 'events/sumiu/attendees/tavia': { confirmedAt: new Date() } });
    await assertFails(deleteDoc(attendee('tavia', 'sumiu', 'tavia')));
    await assertSucceeds(deleteDoc(attendee('ana', 'sumiu', 'tavia')));
  });

  it('apaga também as presenças de visitantes no mesmo lote', async () => {
    await seed(env(), { 'events/cancelado/guests/forever:Lunara:Sombraviva': guestDoc() });
    const db = asUser(env(), 'ana');
    const batch = writeBatch(db);
    batch.delete(doc(db, 'events', 'cancelado', 'guests', 'forever:Lunara:Sombraviva'));
    batch.delete(doc(db, 'events', 'cancelado'));
    await assertSucceeds(batch.commit());
  });

  it('fora da exclusão, o evento cancelado mantém a lista de visitantes', async () => {
    await seed(env(), { 'events/cancelado/guests/forever:Lunara:Sombraviva': guestDoc() });
    await assertFails(
      deleteDoc(
        doc(asUser(env(), 'ana'), 'events', 'cancelado', 'guests', 'forever:Lunara:Sombraviva'),
      ),
    );
  });

  it('o histórico de eventos ativos que já aconteceram não é apagado', async () => {
    await seed(env(), { 'events/antigo/attendees/tavia': { confirmedAt: new Date() } });
    await assertFails(deleteDoc(attendee('ana', 'antigo', 'tavia')));
  });
});
