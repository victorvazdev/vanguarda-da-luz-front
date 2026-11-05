import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { deleteDoc, doc, setDoc, updateDoc, writeBatch, type Firestore } from 'firebase/firestore';
import { beforeEach, describe, it } from 'vitest';
import { account, asUser, seed, useRulesEnv } from './env';

const env = useRulesEnv();

const fromApplication = {
  game: 'retail',
  characterName: 'Tavia',
  server: 'Azralon',
  characterClass: 'mago',
  characterRole: 'dano',
};

const retail = (over: Record<string, unknown> = {}) => ({ ...fromApplication, level: 80, ...over });
const forever = (over: Record<string, unknown> = {}) => ({
  game: 'forever',
  characterName: 'Tavia',
  characterSurname: 'Brasaluz',
  ruleset: 'jxj',
  characterClass: 'druida',
  characterRole: 'cura',
  level: 60,
  ...over,
});

beforeEach(async () => {
  await seed(env(), {
    'users/tavia': account('tavia', { status: 'ativo' }),
    'usernames/tavia': { uid: 'tavia' },
    'members/tavia': {
      username: 'tavia',
      mainCharacter: fromApplication,
      active: true,
      joinedAt: new Date('2026-10-01T12:00:00Z'),
      approvedBy: 'ana',
    },
    'users/novo': account('novo'),
    'usernames/novo': { uid: 'novo' },
    'users/ana': account('ana', { status: 'ativo', role: 'admin' }),
    'usernames/ana': { uid: 'ana' },
    'members/ana': {
      username: 'ana',
      mainCharacter: fromApplication,
      active: true,
      joinedAt: new Date('2026-10-01T12:00:00Z'),
      approvedBy: 'ana',
    },
    'users/ex': account('ex', { status: 'desativado' }),
    'usernames/ex': { uid: 'ex' },
    'members/ex': {
      username: 'ex',
      mainCharacter: fromApplication,
      active: false,
      joinedAt: new Date('2026-10-01T12:00:00Z'),
      approvedBy: 'ana',
    },
  });
});

/** Mesmo lote gravado pelo app ao salvar um personagem (e, se principal, a cópia). */
function saveCharacter(
  db: Firestore,
  uid: string,
  id: string,
  data: Record<string, unknown>,
  asMain = false,
) {
  const batch = writeBatch(db);
  batch.set(doc(db, 'members', uid, 'characters', id), data);
  if (asMain) {
    batch.update(doc(db, 'members', uid), { mainCharacter: data, mainCharacterId: id });
  }
  return batch.commit();
}

describe('Personagens do membro', () => {
  it('membro salva o principal da candidatura com nível e o torna principal', async () => {
    await assertSucceeds(saveCharacter(asUser(env(), 'tavia'), 'tavia', 'c1', retail(), true));
  });

  it('membro adiciona um personagem do WoW Forever', async () => {
    await assertSucceeds(saveCharacter(asUser(env(), 'tavia'), 'tavia', 'c2', forever()));
  });

  it('valida o nível dentro do limite de cada jogo', async () => {
    const db = asUser(env(), 'tavia');
    await assertSucceeds(saveCharacter(db, 'tavia', 'a', retail({ level: 90 })));
    await assertFails(saveCharacter(db, 'tavia', 'b', retail({ level: 91 })));
    await assertFails(saveCharacter(db, 'tavia', 'c', forever({ level: 61 })));
    await assertFails(saveCharacter(db, 'tavia', 'd', retail({ level: 0 })));
    await assertFails(saveCharacter(db, 'tavia', 'e', retail({ level: 10.5 })));
    await assertFails(saveCharacter(db, 'tavia', 'f', retail({ level: '80' })));
    const noLevel: Record<string, unknown> = retail();
    delete noLevel['level'];
    await assertFails(saveCharacter(db, 'tavia', 'g', noLevel));
  });

  it('valida classe, função e campos de cada jogo', async () => {
    const db = asUser(env(), 'tavia');
    await assertFails(saveCharacter(db, 'tavia', 'a', retail({ characterRole: 'tanque' })));
    await assertFails(saveCharacter(db, 'tavia', 'b', forever({ characterClass: 'monge' })));
    await assertFails(saveCharacter(db, 'tavia', 'c', retail({ ruleset: 'normal' })));
    await assertFails(saveCharacter(db, 'tavia', 'd', forever({ server: 'Azralon' })));
    await assertFails(saveCharacter(db, 'tavia', 'e', retail({ characterName: 'X' })));
    await assertFails(saveCharacter(db, 'tavia', 'f', retail({ extra: true })));
  });

  it('aceita profissões do jogo (até 2) e lista vazia, e recusa as inválidas', async () => {
    const db = asUser(env(), 'tavia');
    const save = (data: Record<string, unknown>) =>
      setDoc(doc(db, 'members', 'tavia', 'characters', 'alt1'), data);
    await assertSucceeds(save(retail({ professions: ['joalheria', 'mineracao'] })));
    await assertSucceeds(save(forever({ professions: [] })));
    await assertSucceeds(save(retail()));
    await assertFails(save(retail({ professions: ['alquimia', 'couraria', 'mineracao'] })));
    await assertFails(save(retail({ professions: ['alquimia', 'alquimia'] })));
    await assertFails(save(forever({ professions: ['joalheria'] })));
    await assertFails(save(retail({ professions: ['pesca'] })));
  });

  it('não edita personagens de outra pessoa', async () => {
    await assertFails(saveCharacter(asUser(env(), 'ana'), 'tavia', 'c1', retail()));
  });

  it('conta pendente ou desativada não cadastra personagens', async () => {
    await assertFails(saveCharacter(asUser(env(), 'novo'), 'novo', 'c1', retail()));
    await assertFails(saveCharacter(asUser(env(), 'ex'), 'ex', 'c1', retail()));
  });

  it('a cópia do principal precisa ser idêntica ao personagem', async () => {
    const db = asUser(env(), 'tavia');
    await saveCharacter(db, 'tavia', 'c1', retail(), true);
    // Editar o principal sem atualizar a cópia não é aceito.
    await assertFails(
      setDoc(doc(db, 'members', 'tavia', 'characters', 'c1'), retail({ level: 81 })),
    );
    await assertSucceeds(saveCharacter(db, 'tavia', 'c1', retail({ level: 81 }), true));
    // Cópia diferente do personagem gravado.
    await assertFails(
      updateDoc(doc(db, 'members', 'tavia'), {
        mainCharacter: retail({ level: 1 }),
        mainCharacterId: 'c1',
      }),
    );
    // Principal precisa ser um personagem cadastrado.
    await assertFails(
      updateDoc(doc(db, 'members', 'tavia'), { mainCharacter: retail(), mainCharacterId: 'nada' }),
    );
  });

  it('troca o principal por outro personagem cadastrado', async () => {
    const db = asUser(env(), 'tavia');
    await saveCharacter(db, 'tavia', 'c1', retail(), true);
    await saveCharacter(db, 'tavia', 'c2', forever());
    await assertSucceeds(
      updateDoc(doc(db, 'members', 'tavia'), { mainCharacter: forever(), mainCharacterId: 'c2' }),
    );
  });

  it('remove personagens, exceto o principal', async () => {
    const db = asUser(env(), 'tavia');
    await saveCharacter(db, 'tavia', 'c1', retail(), true);
    await saveCharacter(db, 'tavia', 'c2', forever());
    await assertFails(deleteDoc(doc(db, 'members', 'tavia', 'characters', 'c1')));
    await assertSucceeds(deleteDoc(doc(db, 'members', 'tavia', 'characters', 'c2')));
  });

  it('o membro não altera outros campos do membro', async () => {
    const db = asUser(env(), 'tavia');
    await assertFails(updateDoc(doc(db, 'members', 'tavia'), { active: false }));
    await assertFails(updateDoc(doc(db, 'members', 'tavia'), { approvedBy: 'tavia' }));
  });
});

/** Mesmo lote gravado pelo app ao trocar o nome de usuário. */
function rename(
  db: Firestore,
  uid: string,
  oldKey: string,
  username: string,
  opts: { freeOld?: boolean; member?: boolean; reserve?: boolean } = {},
) {
  const { freeOld = true, member = true, reserve = true } = opts;
  const key = username.toLowerCase();
  const batch = writeBatch(db);
  if (key !== oldKey) {
    if (reserve) batch.set(doc(db, 'usernames', key), { uid });
    if (freeOld) batch.delete(doc(db, 'usernames', oldKey));
  }
  batch.update(doc(db, 'users', uid), { username, usernameKey: key });
  if (member) batch.update(doc(db, 'members', uid), { username });
  return batch.commit();
}

describe('Trocar o nome de usuário', () => {
  it('membro troca o nome: reserva o novo, libera o antigo e atualiza o membro', async () => {
    await assertSucceeds(rename(asUser(env(), 'tavia'), 'tavia', 'tavia', 'Tavinha'));
  });

  it('conta pendente também troca o próprio nome', async () => {
    await assertSucceeds(
      rename(asUser(env(), 'novo'), 'novo', 'novo', 'Novato', { member: false }),
    );
  });

  it('mudar só maiúsculas e minúsculas mantém a reserva', async () => {
    await assertSucceeds(rename(asUser(env(), 'tavia'), 'tavia', 'tavia', 'Tavia'));
  });

  it('não usa um nome reservado por outra pessoa', async () => {
    await assertFails(rename(asUser(env(), 'tavia'), 'tavia', 'tavia', 'Ana'));
  });

  it('exige liberar o nome antigo, reservar o novo e atualizar o membro', async () => {
    const db = asUser(env(), 'tavia');
    await assertFails(rename(db, 'tavia', 'tavia', 'Tavinha', { freeOld: false }));
    await assertFails(rename(db, 'tavia', 'tavia', 'Tavinha', { reserve: false }));
    await assertFails(rename(db, 'tavia', 'tavia', 'Tavinha', { member: false }));
  });

  it('não aceita nome em formato inválido', async () => {
    await assertFails(rename(asUser(env(), 'tavia'), 'tavia', 'tavia', 'Tá via'));
  });

  it('o nome liberado pode ser usado por outra pessoa', async () => {
    await rename(asUser(env(), 'tavia'), 'tavia', 'tavia', 'Tavinha');
    await assertSucceeds(rename(asUser(env(), 'novo'), 'novo', 'novo', 'Tavia', { member: false }));
  });

  it('não troca o nome de outra pessoa nem libera o nome alheio', async () => {
    const db = asUser(env(), 'tavia');
    await assertFails(rename(db, 'novo', 'novo', 'Outro', { member: false }));
    await assertFails(deleteDoc(doc(db, 'usernames', 'novo')));
  });

  it('conta desativada não troca o nome', async () => {
    await assertFails(rename(asUser(env(), 'ex'), 'ex', 'ex', 'Voltei'));
  });
});

describe('Trocar o e-mail', () => {
  it('copia para a conta o e-mail confirmado no token', async () => {
    const db = asUser(env(), 'tavia');
    await assertFails(updateDoc(doc(db, 'users', 'tavia'), { email: 'outro@example.com' }));
    await seed(env(), {
      'users/tavia': account('tavia', { status: 'ativo', email: 'velho@x.com' }),
    });
    await assertSucceeds(updateDoc(doc(db, 'users', 'tavia'), { email: 'tavia@example.com' }));
  });

  it('não altera status ou permissão junto com o e-mail', async () => {
    await seed(env(), { 'users/novo': account('novo', { email: 'velho@x.com' }) });
    const db = asUser(env(), 'novo');
    await assertFails(
      updateDoc(doc(db, 'users', 'novo'), { email: 'novo@example.com', status: 'ativo' }),
    );
    await assertSucceeds(updateDoc(doc(db, 'users', 'novo'), { email: 'novo@example.com' }));
  });
});
