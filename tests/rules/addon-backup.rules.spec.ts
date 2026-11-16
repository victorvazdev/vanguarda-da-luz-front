// Rules do backup do addon (string VDLB1): evento criado com o ID gerado no jogo, limite de
// vagas nas edições, descrição vazia em eventos do addon, histórico, estado combinado,
// presenças guardadas e registro da última exportação (VDL1).
import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import {
  Timestamp,
  collection,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  updateDoc,
  type Firestore,
} from 'firebase/firestore';
import { beforeEach, describe, it } from 'vitest';
import { account, asUser, asVisitor, seed, useRulesEnv } from './env';

const env = useRulesEnv();

const DAY = 86_400_000;
const ID = 'G7cQx2LmP9aRt4VbN1sK';

const event = (over: Record<string, unknown> = {}) => ({
  title: 'Raid semanal',
  game: 'forever',
  startsAt: new Date(Date.now() + 3 * DAY),
  description: '[DESCRIÇÃO DO EVENTO]',
  organizer: 'Maren',
  status: 'ativo',
  createdBy: 'ana',
  createdAt: new Date('2026-11-01T12:00:00Z'),
  updatedAt: new Date('2026-11-01T12:00:00Z'),
  ...over,
});

/** Evento criado no jogo, como addon-backup.ts grava. */
const fromGame = (uid: string, over: Record<string, unknown> = {}) => ({
  title: 'Treino de PvP',
  game: 'forever',
  startsAt: Timestamp.fromMillis(Date.now() + 2 * DAY),
  description: 'Ponto de encontro em Altaforja.',
  organizer: 'Victor Vaz',
  guestsAllowed: false,
  maxAttendees: 25,
  status: 'ativo',
  attendeeCount: 0,
  source: 'addon',
  createdBy: uid,
  createdAt: serverTimestamp(),
  updatedAt: serverTimestamp(),
  ...over,
});

const history = (uid: string, over: Record<string, unknown> = {}) => ({
  text: 'VDLB1:123:abcDEF()',
  generatedAt: 1794420000,
  exportNumber: 0,
  generatedBy: 'Victor Vaz',
  appliedAt: serverTimestamp(),
  appliedBy: uid,
  appliedByName: uid,
  report: { events: [], presences: [] },
  ...over,
});

const characters = (uid: string, over: Record<string, unknown> = {}) => ({
  professions: { 'Victor Vaz': { updatedAt: 1, professions: [] } },
  itemLevels: {},
  together: { 'Victor Vaz': 3600 },
  updatedAt: serverTimestamp(),
  updatedBy: uid,
  ...over,
});

const presences = (over: Record<string, unknown> = {}) => ({
  records: { 'Maren Luz': { status: 1, updatedAt: 1794410000 } },
  startsAt: Timestamp.fromMillis(Date.now() + DAY),
  updatedAt: serverTimestamp(),
  ...over,
});

const exportRecord = (uid: string, exportNumber = 1794409200) => ({
  game: 'forever',
  exportNumber,
  generatedAt: serverTimestamp(),
  generatedBy: uid,
});

let admin: Firestore;
let member: Firestore;

beforeEach(async () => {
  await seed(env(), {
    'users/ana': account('ana', { status: 'ativo', role: 'admin' }),
    'users/tavia': account('tavia', { status: 'ativo' }),
    'members/tavia': { username: 'tavia', active: true },
    'events/raid': event({ maxAttendees: 10, attendeeCount: 5 }),
    'events/lotado': event({ maxAttendees: 3, attendeeCount: 5 }),
  });
  admin = asUser(env(), 'ana');
  member = asUser(env(), 'tavia');
});

describe('Evento criado no jogo (backup do addon)', () => {
  it('o administrador cria o evento com o ID gerado pelo addon', async () => {
    await assertSucceeds(setDoc(doc(admin, 'events', ID), fromGame('ana')));
  });

  it('aceita descrição vazia só em eventos do addon', async () => {
    await assertSucceeds(setDoc(doc(admin, 'events', ID), fromGame('ana', { description: '' })));
    const { source: _, ...siteEvent } = fromGame('ana', { description: '' });
    await assertFails(setDoc(doc(admin, 'events', 'H7cQx2LmP9aRt4VbN1sK'), siteEvent));
  });

  it('recusa ID fora do formato, outro jogo, data passada e campos faltando', async () => {
    await assertFails(setDoc(doc(admin, 'events', 'curto'), fromGame('ana')));
    await assertFails(setDoc(doc(admin, 'events', ID), fromGame('ana', { game: 'retail' })));
    await assertFails(
      setDoc(
        doc(admin, 'events', ID),
        fromGame('ana', { startsAt: Timestamp.fromMillis(Date.now() - DAY) }),
      ),
    );
    await assertFails(setDoc(doc(admin, 'events', ID), fromGame('ana', { source: 'site' })));
    await assertFails(setDoc(doc(admin, 'events', ID), fromGame('ana', { attendeeCount: 1 })));
    const { maxAttendees: _, ...noMax } = fromGame('ana');
    await assertFails(setDoc(doc(admin, 'events', ID), noMax));
  });

  it('não sobrescreve um evento existente com o mesmo ID', async () => {
    await seed(env(), { [`events/${ID}`]: event() });
    await assertFails(setDoc(doc(admin, 'events', ID), fromGame('ana')));
  });

  it('membros não criam eventos', async () => {
    await assertFails(setDoc(doc(member, 'events', ID), fromGame('tavia')));
  });

  it('a origem não muda nas edições', async () => {
    await seed(env(), { [`events/${ID}`]: { ...event(), source: 'addon', description: '' } });
    // Edição de evento do addon com descrição vazia.
    await assertSucceeds(
      updateDoc(doc(admin, 'events', ID), {
        title: 'Novo título',
        updatedAt: serverTimestamp(),
        updatedBy: 'ana',
      }),
    );
    await assertFails(
      updateDoc(doc(admin, 'events', ID), {
        source: 'site',
        updatedAt: serverTimestamp(),
        updatedBy: 'ana',
      }),
    );
  });
});

describe('Limite de vagas nas edições', () => {
  const edit = (id: string, maxAttendees: number) =>
    updateDoc(doc(admin, 'events', id), {
      maxAttendees,
      updatedAt: serverTimestamp(),
      updatedBy: 'ana',
    });

  it('o novo limite não fica abaixo dos confirmados', async () => {
    await assertFails(edit('raid', 4));
    await assertSucceeds(edit('raid', 5));
  });

  it('um evento já acima do limite continua editável sem mudar o limite', async () => {
    await assertSucceeds(
      updateDoc(doc(admin, 'events', 'lotado'), {
        title: 'Outro título',
        updatedAt: serverTimestamp(),
        updatedBy: 'ana',
      }),
    );
    await assertFails(edit('lotado', 4));
  });

  it('descrição vazia continua recusada em eventos do site', async () => {
    await assertFails(
      updateDoc(doc(admin, 'events', 'raid'), {
        description: '',
        updatedAt: serverTimestamp(),
        updatedBy: 'ana',
      }),
    );
  });
});

describe('Histórico de backups', () => {
  it('o administrador guarda o backup, uma vez, e lê o histórico', async () => {
    const ref = doc(admin, 'addonBackups', '1794420000-123');
    await assertSucceeds(setDoc(ref, history('ana')));
    await assertSucceeds(getDoc(ref));
    await assertSucceeds(getDocs(collection(admin, 'addonBackups')));
    await assertFails(setDoc(ref, history('ana', { generatedBy: 'Outro' })));
  });

  it('recusa ID, string e autoria inválidos', async () => {
    await assertFails(setDoc(doc(admin, 'addonBackups', '1-123'), history('ana')));
    await assertFails(
      setDoc(doc(admin, 'addonBackups', '1794420000-1'), history('ana', { text: 'VDLP1:1:abc' })),
    );
    await assertFails(
      setDoc(doc(admin, 'addonBackups', '1794420000-1'), history('ana', { appliedBy: 'tavia' })),
    );
    await assertFails(
      setDoc(
        doc(admin, 'addonBackups', '1794420000-1'),
        history('ana', { text: `VDLB1:1:${'a'.repeat(500_000)}` }),
      ),
    );
  });

  it('não é apagado', async () => {
    await seed(env(), { 'addonBackups/1794420000-123': { generatedAt: 1794420000 } });
    const { deleteDoc } = await import('firebase/firestore');
    await assertFails(deleteDoc(doc(admin, 'addonBackups', '1794420000-123')));
  });

  it('ninguém além de administradores lê ou grava', async () => {
    await seed(env(), { 'addonBackups/1794420000-123': { generatedAt: 1794420000 } });
    for (const db of [member, asVisitor(env())]) {
      await assertFails(getDoc(doc(db, 'addonBackups', '1794420000-123')));
      await assertFails(getDocs(collection(db, 'addonBackups')));
    }
    await assertFails(setDoc(doc(member, 'addonBackups', '1794420001-1'), history('tavia')));
  });
});

describe('Estado combinado e presenças guardadas', () => {
  it('o administrador grava e lê o estado dos personagens', async () => {
    const ref = doc(admin, 'addonState', 'characters');
    await assertSucceeds(setDoc(ref, characters('ana')));
    await assertSucceeds(setDoc(ref, characters('ana', { together: {} })));
    await assertSucceeds(getDoc(ref));
    await assertFails(setDoc(doc(admin, 'addonState', 'outro'), characters('ana')));
    await assertFails(setDoc(ref, characters('ana', { extra: 1 })));
    await assertFails(setDoc(ref, characters('ana', { together: 5 })));
  });

  it('o administrador grava e lê as presenças por evento', async () => {
    const ref = doc(admin, 'addonPresences', 'raid');
    await assertSucceeds(setDoc(ref, presences()));
    await assertSucceeds(setDoc(ref, presences({ startsAt: null })));
    await assertSucceeds(getDocs(collection(admin, 'addonPresences')));
    await assertFails(setDoc(ref, presences({ records: [] })));
  });

  it('ninguém além de administradores lê ou grava', async () => {
    await seed(env(), {
      'addonState/characters': { together: {} },
      'addonPresences/raid': { records: {} },
    });
    for (const db of [member, asVisitor(env())]) {
      await assertFails(getDoc(doc(db, 'addonState', 'characters')));
      await assertFails(getDoc(doc(db, 'addonPresences', 'raid')));
      await assertFails(getDocs(collection(db, 'addonPresences')));
    }
    await assertFails(setDoc(doc(member, 'addonState', 'characters'), characters('tavia')));
    await assertFails(setDoc(doc(member, 'addonPresences', 'raid'), presences()));
  });
});

describe('Última exportação para o addon (VDL1)', () => {
  it('o administrador registra e só aumenta o número', async () => {
    const ref = doc(admin, 'config', 'addonExport');
    await assertSucceeds(setDoc(ref, exportRecord('ana')));
    await assertSucceeds(setDoc(ref, exportRecord('ana', 1794409300)));
    await assertFails(setDoc(ref, exportRecord('ana', 1794409300)));
    await assertSucceeds(getDoc(ref));
  });

  it('ninguém além de administradores lê ou grava', async () => {
    await seed(env(), { 'config/addonExport': { exportNumber: 1 } });
    await assertFails(getDoc(doc(member, 'config', 'addonExport')));
    await assertFails(setDoc(doc(member, 'config', 'addonExport'), exportRecord('tavia')));
  });
});
