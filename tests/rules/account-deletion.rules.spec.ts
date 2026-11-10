import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import {
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
  type Firestore,
} from 'firebase/firestore';
import { beforeEach, describe, it } from 'vitest';
import {
  account,
  asFreshUser,
  asUser,
  asVisitor,
  presenceWithCount,
  seed,
  useRulesEnv,
} from './env';

const env = useRulesEnv();

const character = {
  game: 'retail',
  characterName: 'Tavia',
  server: 'Azralon',
  characterClass: 'mago',
  characterRole: 'dano',
};

const member = (uid: string, over: Record<string, unknown> = {}) => ({
  username: uid,
  mainCharacter: character,
  active: true,
  joinedAt: new Date('2026-10-01T12:00:00Z'),
  approvedBy: 'ana',
  ...over,
});

const application = {
  ...character,
  battleTag: 'Tavia#1234',
  motivation: 'Quero entrar.',
  rulesAccepted: true,
  status: 'aprovada',
  submittedAt: new Date('2026-10-01T12:00:00Z'),
};

const day = 86_400_000;
const event = (startsInMs: number, status = 'ativo') => ({
  title: 'Raid',
  startsAt: new Date(Date.now() + startsInMs),
  description: 'Raid semanal.',
  organizer: 'Ana',
  status,
});

beforeEach(async () => {
  await seed(env(), {
    // Membro comum
    'users/tavia': account('tavia', { status: 'ativo' }),
    'usernames/tavia': { uid: 'tavia' },
    'members/tavia': member('tavia'),
    'applications/tavia': application,
    // Administradores (dois ativos)
    'users/ana': account('ana', { status: 'ativo', role: 'admin' }),
    'usernames/ana': { uid: 'ana' },
    'members/ana': member('ana'),
    'users/bia': account('bia', { status: 'ativo', role: 'admin' }),
    'usernames/bia': { uid: 'bia' },
    'members/bia': member('bia'),
    'config/admins': { activeAdminUids: ['ana', 'bia'] },
    // Conta pendente com candidatura
    'users/novo': account('novo'),
    'usernames/novo': { uid: 'novo' },
    'applications/novo': { ...application, status: 'pendente' },
    // Conta desativada
    'users/ex': account('ex', { status: 'desativado' }),
    'usernames/ex': { uid: 'ex' },
    'members/ex': member('ex', { active: false }),
    // Eventos
    'events/futuro': event(3 * day),
    'events/passado': event(-3 * day),
    'events/cancelado': event(3 * day, 'cancelado'),
    'events/futuro/attendees/tavia': { confirmedAt: new Date() },
    'events/futuro/attendees/ana': { confirmedAt: new Date() },
    'events/passado/attendees/tavia': { confirmedAt: new Date(Date.now() - 4 * day) },
  });
});

/** Etapa 1: a conta passa a "excluindo"; admin sai da lista; membro sai das listas. */
function start(
  db: Firestore,
  uid: string,
  opts: { member?: boolean; admins?: string[] | null; extra?: Record<string, unknown> } = {},
) {
  const batch = writeBatch(db);
  batch.update(doc(db, 'users', uid), {
    status: 'excluindo',
    deletionStartedAt: serverTimestamp(),
    ...opts.extra,
  });
  if (opts.member ?? true) batch.update(doc(db, 'members', uid), { active: false });
  if (opts.admins) batch.update(doc(db, 'config', 'admins'), { activeAdminUids: opts.admins });
  return batch.commit();
}

/** Etapa 3: candidatura e nome apagados, membro sem nome, conta vira registro mínimo. */
function finish(
  db: Firestore,
  uid: string,
  opts: { application?: boolean; username?: boolean; member?: boolean | 'keep-username' } = {},
) {
  const batch = writeBatch(db);
  if (opts.application ?? true) batch.delete(doc(db, 'applications', uid));
  if (opts.username ?? true) batch.delete(doc(db, 'usernames', uid));
  const m = opts.member ?? true;
  if (m === true) {
    batch.update(doc(db, 'members', uid), {
      username: deleteField(),
      deletedAt: serverTimestamp(),
    });
  } else if (m === 'keep-username') {
    batch.update(doc(db, 'members', uid), { deletedAt: serverTimestamp() });
  }
  batch.set(doc(db, 'users', uid), { status: 'excluido', deletedAt: serverTimestamp() });
  return batch.commit();
}

/** Conta já em "excluindo" (etapa 1 feita). `novo` é pendente e não tem membro. */
const deleting = (uid: string) =>
  seed(env(), {
    [`users/${uid}`]: account(uid, { status: 'excluindo', deletionStartedAt: new Date() }),
    ...(uid === 'novo' ? {} : { [`members/${uid}`]: member(uid, { active: false }) }),
  });

describe('Exclusão de conta: início', () => {
  it('membro inicia a exclusão da própria conta, saindo das listas', async () => {
    await assertSucceeds(start(asFreshUser(env(), 'tavia'), 'tavia'));
  });

  it('conta pendente inicia a exclusão (sem membro)', async () => {
    await assertSucceeds(start(asFreshUser(env(), 'novo'), 'novo', { member: false }));
  });

  it('exige nova autenticação (login recente)', async () => {
    await assertFails(start(asFreshUser(env(), 'tavia', 10 * 60), 'tavia'));
    await assertFails(start(asUser(env(), 'tavia'), 'tavia')); // sem auth_time
  });

  it('o membro precisa sair das listas no mesmo lote', async () => {
    await assertFails(start(asFreshUser(env(), 'tavia'), 'tavia', { member: false }));
  });

  it('administrador sai da lista de admins ativos no mesmo lote', async () => {
    const db = asFreshUser(env(), 'ana');
    await assertFails(start(db, 'ana'));
    await assertSucceeds(start(db, 'ana', { admins: ['bia'] }));
  });

  it('o último administrador ativo não pode excluir a conta', async () => {
    await seed(env(), { 'config/admins': { activeAdminUids: ['ana'] } });
    const db = asFreshUser(env(), 'ana');
    await assertFails(start(db, 'ana', { admins: [] }));
    await assertFails(start(db, 'ana'));
  });

  it('ninguém inicia a exclusão da conta de outra pessoa', async () => {
    await assertFails(start(asFreshUser(env(), 'novo'), 'tavia'));
    await assertFails(start(asFreshUser(env(), 'ana'), 'tavia'));
    await assertFails(start(asVisitor(env()), 'tavia'));
  });

  it('não altera outros campos nem a conta desativada', async () => {
    await assertFails(start(asFreshUser(env(), 'tavia'), 'tavia', { extra: { role: 'admin' } }));
    await assertFails(start(asFreshUser(env(), 'ex'), 'ex'));
  });

  it('não pula direto para o registro mínimo', async () => {
    await assertFails(finish(asFreshUser(env(), 'tavia'), 'tavia'));
  });
});

describe('Exclusão de conta: durante a exclusão', () => {
  beforeEach(async () => {
    await deleting('tavia');
  });

  it('perde o acesso de membro, mas cancela as próprias presenças em eventos futuros', async () => {
    const db = asFreshUser(env(), 'tavia');
    await assertFails(getDocs(collection(db, 'members')));
    await assertFails(
      setDoc(doc(db, 'events', 'cancelado', 'attendees', 'tavia'), {
        confirmedAt: serverTimestamp(),
      }),
    );
    await assertSucceeds(getDocs(collection(db, 'events')));
    await assertSucceeds(presenceWithCount(db, 'futuro', 'attendees', 'tavia', null, 0));
  });

  it('não cancela presenças de outras pessoas nem altera o histórico', async () => {
    const db = asFreshUser(env(), 'tavia');
    await assertFails(deleteDoc(doc(db, 'events', 'futuro', 'attendees', 'ana')));
    await assertFails(deleteDoc(doc(db, 'events', 'passado', 'attendees', 'tavia')));
  });

  it('conta pendente em exclusão lê o calendário público, mas não confirma presença', async () => {
    await deleting('novo');
    const db = asFreshUser(env(), 'novo');
    await assertSucceeds(getDocs(collection(db, 'events')));
    await assertFails(
      setDoc(doc(db, 'events', 'futuro', 'attendees', 'novo'), { confirmedAt: serverTimestamp() }),
    );
  });

  it('não troca nome de usuário, e-mail nem cadastra personagens', async () => {
    const db = asFreshUser(env(), 'tavia');
    const batch = writeBatch(db);
    batch.set(doc(db, 'usernames', 'tavinha'), { uid: 'tavia' });
    batch.delete(doc(db, 'usernames', 'tavia'));
    batch.update(doc(db, 'users', 'tavia'), { username: 'Tavinha', usernameKey: 'tavinha' });
    await assertFails(batch.commit());
    await assertFails(updateDoc(doc(db, 'users', 'tavia'), { email: 'outro@example.com' }));
    await assertFails(
      setDoc(doc(db, 'members', 'tavia', 'characters', 'c1'), { ...character, level: 10 }),
    );
  });

  it('não volta a ser ativa nem pendente', async () => {
    const db = asFreshUser(env(), 'tavia');
    await assertFails(updateDoc(doc(db, 'users', 'tavia'), { status: 'ativo' }));
    await assertFails(updateDoc(doc(db, 'members', 'tavia'), { active: true }));
  });

  it('administrador não aprova nem altera a conta em exclusão', async () => {
    const db = asUser(env(), 'ana');
    await assertFails(updateDoc(doc(db, 'users', 'tavia'), { status: 'desativado' }));
  });
});

describe('Exclusão de conta: conclusão', () => {
  beforeEach(async () => {
    await deleting('tavia');
  });

  it('apaga candidatura e nome de usuário e deixa somente o registro mínimo', async () => {
    await assertSucceeds(finish(asFreshUser(env(), 'tavia'), 'tavia'));
  });

  it('conta pendente: apaga a candidatura e o nome de usuário', async () => {
    await deleting('novo');
    await assertSucceeds(finish(asFreshUser(env(), 'novo'), 'novo', { member: false }));
  });

  it('exige apagar candidatura e nome de usuário e tirar o nome do membro, no mesmo lote', async () => {
    const db = asFreshUser(env(), 'tavia');
    await assertFails(finish(db, 'tavia', { application: false }));
    await assertFails(finish(db, 'tavia', { username: false }));
    await assertFails(finish(db, 'tavia', { member: 'keep-username' }));
    await assertFails(finish(db, 'tavia', { member: false }));
  });

  it('o registro mínimo não guarda dados pessoais', async () => {
    const db = asFreshUser(env(), 'tavia');
    const batch = writeBatch(db);
    batch.delete(doc(db, 'applications', 'tavia'));
    batch.delete(doc(db, 'usernames', 'tavia'));
    batch.update(doc(db, 'members', 'tavia'), {
      username: deleteField(),
      deletedAt: serverTimestamp(),
    });
    batch.set(doc(db, 'users', 'tavia'), {
      status: 'excluido',
      deletedAt: serverTimestamp(),
      email: 'tavia@example.com',
    });
    await assertFails(batch.commit());
  });

  it('exige nova autenticação', async () => {
    await assertFails(finish(asFreshUser(env(), 'tavia', 10 * 60), 'tavia'));
  });

  it('candidatura e nome de usuário não são apagados fora da conclusão', async () => {
    const db = asFreshUser(env(), 'tavia');
    await assertFails(deleteDoc(doc(db, 'applications', 'tavia')));
    await assertFails(deleteDoc(doc(db, 'usernames', 'tavia')));
    // Nem por uma conta ativa
    const ana = asFreshUser(env(), 'ana');
    await assertFails(deleteDoc(doc(ana, 'applications', 'ana')));
  });

  it('ninguém conclui a exclusão da conta de outra pessoa', async () => {
    await assertFails(finish(asFreshUser(env(), 'ana'), 'tavia'));
    await assertFails(finish(asVisitor(env()), 'tavia'));
  });

  it('administrador não apaga candidatura nem anonimiza membro de outra pessoa', async () => {
    const db = asUser(env(), 'ana');
    await assertFails(deleteDoc(doc(db, 'applications', 'tavia')));
    await assertFails(
      updateDoc(doc(db, 'members', 'tavia'), {
        username: deleteField(),
        deletedAt: serverTimestamp(),
      }),
    );
  });
});

describe('Exclusão de conta: depois de concluída', () => {
  beforeEach(async () => {
    await seed(env(), {
      'users/tavia': { status: 'excluido', deletedAt: new Date() },
      'members/tavia': {
        mainCharacter: character,
        active: false,
        joinedAt: new Date('2026-10-01T12:00:00Z'),
        approvedBy: 'ana',
        deletedAt: new Date(),
      },
    });
  });

  it('o registro mínimo não pode ser alterado nem recriado', async () => {
    const db = asFreshUser(env(), 'tavia');
    await assertFails(updateDoc(doc(db, 'users', 'tavia'), { status: 'pendente' }));
    await assertFails(setDoc(doc(db, 'users', 'tavia'), account('tavia')));
    await assertFails(deleteDoc(doc(db, 'users', 'tavia')));
    await assertFails(setDoc(doc(db, 'usernames', 'tavia2'), { uid: 'tavia' }));
  });

  it('os personagens e o histórico continuam visíveis para os membros ativos', async () => {
    const db = asUser(env(), 'ana');
    await assertSucceeds(getDoc(doc(db, 'members', 'tavia')));
    await assertSucceeds(getDocs(collection(db, 'events', 'passado', 'attendees')));
  });

  it('o membro excluído não aparece mais como ativo', async () => {
    const snap = await getDoc(doc(asUser(env(), 'ana'), 'members', 'tavia'));
    if (snap.get('active') !== false || snap.get('username') !== undefined) {
      throw new Error('membro excluído com dados pessoais ou ativo');
    }
  });
});
