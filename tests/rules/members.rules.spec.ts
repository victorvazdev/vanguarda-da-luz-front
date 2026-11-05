import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, getDoc, updateDoc, writeBatch, type Firestore } from 'firebase/firestore';
import { beforeEach, describe, it } from 'vitest';
import { account, asUser, seed, useRulesEnv } from './env';

const env = useRulesEnv();

const member = (uid: string) => ({
  username: uid,
  mainCharacter: {
    game: 'retail',
    characterName: uid,
    server: 'Azralon',
    characterClass: 'mago',
    characterRole: 'dano',
  },
  active: true,
  joinedAt: new Date('2026-10-01T12:00:00Z'),
  approvedBy: 'ana',
});

async function seedGuild(admins: string[]) {
  const docs: Record<string, Record<string, unknown>> = {
    'config/admins': { activeAdminUids: admins },
    'users/tavia': account('tavia', { status: 'ativo' }),
    'members/tavia': member('tavia'),
  };
  for (const uid of ['ana', 'bia']) {
    docs[`users/${uid}`] = account(uid, {
      status: 'ativo',
      role: admins.includes(uid) ? 'admin' : 'membro',
    });
    docs[`members/${uid}`] = member(uid);
  }
  await seed(env(), docs);
}

function setRole(db: Firestore, uid: string, role: string, admins: string[]) {
  const batch = writeBatch(db);
  batch.update(doc(db, 'users', uid), { role });
  batch.update(doc(db, 'config', 'admins'), { activeAdminUids: admins });
  return batch.commit();
}

function deactivate(db: Firestore, uid: string, admins?: string[], memberToo = true) {
  const batch = writeBatch(db);
  batch.update(doc(db, 'users', uid), { status: 'desativado' });
  if (memberToo) batch.update(doc(db, 'members', uid), { active: false });
  if (admins) batch.update(doc(db, 'config', 'admins'), { activeAdminUids: admins });
  return batch.commit();
}

describe('Alterar permissão', () => {
  beforeEach(() => seedGuild(['ana']));

  it('admin torna um membro administrador, atualizando a lista de admins', async () => {
    await assertSucceeds(setRole(asUser(env(), 'ana'), 'tavia', 'admin', ['ana', 'tavia']));
  });

  it('exige que a lista de admins acompanhe a mudança', async () => {
    const db = asUser(env(), 'ana');
    await assertFails(updateDoc(doc(db, 'users', 'tavia'), { role: 'admin' }));
    await assertFails(setRole(db, 'tavia', 'admin', ['ana']));
    await assertFails(setRole(db, 'tavia', 'admin', ['ana', 'bia']));
  });

  it('não aceita a lista com uid repetido nem duas mudanças de uma vez', async () => {
    const db = asUser(env(), 'ana');
    await assertFails(setRole(db, 'tavia', 'admin', ['ana', 'tavia', 'tavia']));
    const batch = writeBatch(db);
    batch.update(doc(db, 'users', 'tavia'), { role: 'admin' });
    batch.update(doc(db, 'users', 'bia'), { role: 'admin' });
    batch.update(doc(db, 'config', 'admins'), { activeAdminUids: ['ana', 'tavia', 'bia'] });
    await assertFails(batch.commit());
  });

  it('membro comum não altera permissões, nem a própria', async () => {
    await assertFails(setRole(asUser(env(), 'tavia'), 'tavia', 'admin', ['ana', 'tavia']));
  });

  it('não aceita permissão inválida', async () => {
    await assertFails(setRole(asUser(env(), 'ana'), 'tavia', 'dono', ['ana']));
  });

  it('impede remover a permissão do último administrador ativo', async () => {
    await assertFails(setRole(asUser(env(), 'ana'), 'ana', 'membro', []));
  });

  it('com dois admins, um pode deixar de ser admin (inclusive a si mesmo)', async () => {
    await seedGuild(['ana', 'bia']);
    await assertSucceeds(setRole(asUser(env(), 'ana'), 'ana', 'membro', ['bia']));
  });
});

describe('Desativar membro', () => {
  beforeEach(() => seedGuild(['ana']));

  it('admin desativa um membro: conta desativada e membro fora das listas', async () => {
    await assertSucceeds(deactivate(asUser(env(), 'ana'), 'tavia'));
  });

  it('exige marcar o membro como inativo no mesmo lote', async () => {
    await assertFails(deactivate(asUser(env(), 'ana'), 'tavia', undefined, false));
  });

  it('membro comum não desativa ninguém', async () => {
    await assertFails(deactivate(asUser(env(), 'tavia'), 'ana', []));
  });

  it('impede desativar o último administrador ativo', async () => {
    await assertFails(deactivate(asUser(env(), 'ana'), 'ana', []));
    await assertFails(deactivate(asUser(env(), 'ana'), 'ana'));
  });

  it('desativa um admin quando há outro, removendo-o da lista', async () => {
    await seedGuild(['ana', 'bia']);
    await assertFails(deactivate(asUser(env(), 'ana'), 'bia'));
    await assertSucceeds(deactivate(asUser(env(), 'ana'), 'bia', ['ana']));
  });

  it('conta desativada perde o acesso aos dados de membros', async () => {
    await deactivate(asUser(env(), 'ana'), 'tavia');
    await assertFails(getDoc(doc(asUser(env(), 'tavia'), 'members', 'ana')));
    // mas ainda lê a própria conta (para o site saber que está desativada)
    await assertSucceeds(getDoc(doc(asUser(env(), 'tavia'), 'users', 'tavia')));
  });

  it('admin desativado perde a permissão de administrador', async () => {
    await seedGuild(['ana', 'bia']);
    await deactivate(asUser(env(), 'ana'), 'bia', ['ana']);
    await assertFails(setRole(asUser(env(), 'bia'), 'tavia', 'admin', ['ana', 'tavia']));
  });

  it('não altera outros campos do membro', async () => {
    await deactivate(asUser(env(), 'ana'), 'tavia');
    await assertFails(
      updateDoc(doc(asUser(env(), 'ana'), 'members', 'tavia'), { username: 'outro' }),
    );
  });
});

function reactivate(db: Firestore, uid: string, role = 'membro', memberToo = true) {
  const batch = writeBatch(db);
  batch.update(doc(db, 'users', uid), { status: 'ativo', role });
  if (memberToo) batch.update(doc(db, 'members', uid), { active: true });
  return batch.commit();
}

describe('Reativar membro', () => {
  beforeEach(async () => {
    await seedGuild(['ana', 'bia']);
    await deactivate(asUser(env(), 'ana'), 'tavia');
    await deactivate(asUser(env(), 'ana'), 'bia', ['ana']);
  });

  it('admin reativa um membro: conta ativa e membro de volta às listas', async () => {
    await assertSucceeds(reactivate(asUser(env(), 'ana'), 'tavia'));
  });

  it('um ex-administrador volta como membro, nunca como admin direto', async () => {
    const db = asUser(env(), 'ana');
    await assertFails(reactivate(db, 'bia', 'admin'));
    await assertSucceeds(reactivate(db, 'bia', 'membro'));
  });

  it('exige reativar o membro no mesmo lote', async () => {
    await assertFails(reactivate(asUser(env(), 'ana'), 'tavia', 'membro', false));
    await assertFails(updateDoc(doc(asUser(env(), 'ana'), 'members', 'tavia'), { active: true }));
  });

  it('membro comum não reativa ninguém', async () => {
    await assertFails(reactivate(asUser(env(), 'tavia'), 'tavia'));
  });

  it('não "reativa" conta pendente (isso é aprovação)', async () => {
    await seed(env(), { 'users/novo': account('novo') });
    const db = asUser(env(), 'ana');
    const batch = writeBatch(db);
    batch.update(doc(db, 'users', 'novo'), { status: 'ativo', role: 'membro' });
    await assertFails(batch.commit());
  });

  it('membro reativado volta a ler os dados de membros', async () => {
    await reactivate(asUser(env(), 'ana'), 'tavia');
    await assertSucceeds(getDoc(doc(asUser(env(), 'tavia'), 'members', 'ana')));
  });
});

describe('Lista de administradores', () => {
  beforeEach(() => seedGuild(['ana']));

  it('só administradores leem; ninguém cria ou apaga', async () => {
    await assertSucceeds(getDoc(doc(asUser(env(), 'ana'), 'config', 'admins')));
    await assertFails(getDoc(doc(asUser(env(), 'tavia'), 'config', 'admins')));
  });

  it('não pode ser alterada sozinha para incluir alguém que não é admin', async () => {
    await assertFails(
      updateDoc(doc(asUser(env(), 'ana'), 'config', 'admins'), {
        activeAdminUids: ['ana', 'tavia'],
      }),
    );
  });
});
