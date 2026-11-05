import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import {
  Timestamp,
  collection,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  updateDoc,
  writeBatch,
  type Firestore,
} from 'firebase/firestore';
import { beforeEach, describe, it } from 'vitest';
import { account, asUser, seed, useRulesEnv } from './env';

const env = useRulesEnv();
const submittedAt = Timestamp.fromDate(new Date('2026-11-02T12:00:00Z'));

const retailApp = {
  game: 'retail',
  characterName: 'Elaris',
  server: 'Azralon',
  characterClass: 'paladino',
  characterRole: 'cura',
  motivation: 'Quero raidar.',
  rulesAccepted: true,
  status: 'pendente',
  submittedAt,
};

const retailCharacter = {
  game: 'retail',
  characterName: 'Elaris',
  server: 'Azralon',
  characterClass: 'paladino',
  characterRole: 'cura',
};

/** As três escritas da aprovação, no mesmo lote. */
function approve(
  db: Firestore,
  adminUid: string,
  over: {
    member?: Record<string, unknown>;
    character?: Record<string, unknown>;
    skipUser?: boolean;
  } = {},
) {
  const batch = writeBatch(db);
  batch.update(doc(db, 'applications', 'alice'), {
    status: 'aprovada',
    decidedBy: adminUid,
    decidedAt: serverTimestamp(),
  });
  if (!over.skipUser) batch.update(doc(db, 'users', 'alice'), { status: 'ativo' });
  batch.set(doc(db, 'members', 'alice'), {
    username: 'alice',
    mainCharacter: over.character ?? retailCharacter,
    active: true,
    joinedAt: serverTimestamp(),
    approvedBy: adminUid,
    ...over.member,
  });
  return batch.commit();
}

function reject(db: Firestore, adminUid: string) {
  return updateDoc(doc(db, 'applications', 'alice'), {
    status: 'recusada',
    decidedBy: adminUid,
    decidedAt: serverTimestamp(),
  });
}

beforeEach(async () => {
  await seed(env(), {
    'users/alice': account('alice'),
    'users/membro': account('membro', { status: 'ativo' }),
    'users/admin': account('admin', { status: 'ativo', role: 'admin' }),
    'users/exadmin': account('exadmin', { status: 'desativado', role: 'admin' }),
    'applications/alice': retailApp,
  });
});

describe('Aprovar candidatura', () => {
  it('admin aprova: candidatura aprovada, conta ativa e membro com o personagem principal', async () => {
    await assertSucceeds(approve(asUser(env(), 'admin'), 'admin'));
  });

  it('aprova candidatura do WoW Forever com sobrenome e ruleset', async () => {
    const { server: _server, ...rest } = retailApp;
    await seed(env(), {
      'applications/alice': {
        ...rest,
        game: 'forever',
        characterSurname: 'Aurora',
        ruleset: 'jxj',
      },
    });
    await assertSucceeds(
      approve(asUser(env(), 'admin'), 'admin', {
        character: {
          game: 'forever',
          characterName: 'Elaris',
          characterSurname: 'Aurora',
          ruleset: 'jxj',
          characterClass: 'paladino',
          characterRole: 'cura',
        },
      }),
    );
  });

  it('membro comum, usuário pendente e admin desativado não aprovam', async () => {
    await assertFails(approve(asUser(env(), 'membro'), 'membro'));
    await assertFails(approve(asUser(env(), 'alice'), 'alice'));
    await assertFails(approve(asUser(env(), 'exadmin'), 'exadmin'));
  });

  it('exige ativar a conta no mesmo lote', async () => {
    await assertFails(approve(asUser(env(), 'admin'), 'admin', { skipUser: true }));
  });

  it('o personagem principal deve ser idêntico ao da candidatura', async () => {
    const db = asUser(env(), 'admin');
    await assertFails(
      approve(db, 'admin', { character: { ...retailCharacter, characterName: 'Outro' } }),
    );
    await assertFails(
      approve(db, 'admin', { character: { ...retailCharacter, characterRole: 'tanque' } }),
    );
    const { server: _s, ...withoutServer } = retailCharacter;
    await assertFails(approve(db, 'admin', { character: withoutServer }));
    await assertFails(
      approve(db, 'admin', { character: { ...retailCharacter, motivation: 'Quero raidar.' } }),
    );
  });

  describe('com BattleTag e profissões', () => {
    beforeEach(async () => {
      await seed(env(), {
        'applications/alice': {
          ...retailApp,
          professions: ['alquimia', 'herborismo'],
          battleTag: 'Elaris#1234',
        },
      });
    });

    it('as profissões vão para o personagem principal; o BattleTag não', async () => {
      await assertSucceeds(
        approve(asUser(env(), 'admin'), 'admin', {
          character: { ...retailCharacter, professions: ['alquimia', 'herborismo'] },
        }),
      );
    });

    it('recusa BattleTag copiado para o membro (dado privado)', async () => {
      const db = asUser(env(), 'admin');
      const character = { ...retailCharacter, professions: ['alquimia', 'herborismo'] };
      await assertFails(
        approve(db, 'admin', { character: { ...character, battleTag: 'Elaris#1234' } }),
      );
      await assertFails(approve(db, 'admin', { character, member: { battleTag: 'Elaris#1234' } }));
    });

    it('recusa profissões diferentes das da candidatura', async () => {
      const db = asUser(env(), 'admin');
      await assertFails(approve(db, 'admin', { character: retailCharacter }));
      await assertFails(
        approve(db, 'admin', { character: { ...retailCharacter, professions: ['mineracao'] } }),
      );
    });
  });

  it('candidatura antiga, sem BattleTag nem profissões, ainda pode ser aprovada', async () => {
    await assertSucceeds(approve(asUser(env(), 'admin'), 'admin'));
  });

  it('registra o administrador responsável (não outro)', async () => {
    const db = asUser(env(), 'admin');
    const batch = writeBatch(db);
    batch.update(doc(db, 'applications', 'alice'), {
      status: 'aprovada',
      decidedBy: 'outro-admin',
      decidedAt: serverTimestamp(),
    });
    batch.update(doc(db, 'users', 'alice'), { status: 'ativo' });
    batch.set(doc(db, 'members', 'alice'), {
      username: 'alice',
      mainCharacter: retailCharacter,
      active: true,
      joinedAt: serverTimestamp(),
      approvedBy: 'admin',
    });
    await assertFails(batch.commit());
  });

  it('não permite dar permissão de admin na aprovação nem alterar outros dados da conta', async () => {
    const db = asUser(env(), 'admin');
    const batch = writeBatch(db);
    batch.update(doc(db, 'applications', 'alice'), {
      status: 'aprovada',
      decidedBy: 'admin',
      decidedAt: serverTimestamp(),
    });
    batch.update(doc(db, 'users', 'alice'), { status: 'ativo', role: 'admin' });
    batch.set(doc(db, 'members', 'alice'), {
      username: 'alice',
      mainCharacter: retailCharacter,
      active: true,
      joinedAt: serverTimestamp(),
      approvedBy: 'admin',
    });
    await assertFails(batch.commit());
  });

  it('não decide candidatura que já foi avaliada', async () => {
    await seed(env(), { 'applications/alice': { ...retailApp, status: 'recusada' } });
    await assertFails(approve(asUser(env(), 'admin'), 'admin'));
    await assertFails(reject(asUser(env(), 'admin'), 'admin'));
  });

  it('não permite alterar os dados da candidatura ao decidir', async () => {
    await assertFails(
      updateDoc(doc(asUser(env(), 'admin'), 'applications', 'alice'), {
        status: 'recusada',
        decidedBy: 'admin',
        decidedAt: serverTimestamp(),
        characterName: 'Outro',
      }),
    );
  });
});

describe('Recusar candidatura', () => {
  it('admin recusa; a conta continua pendente', async () => {
    await assertSucceeds(reject(asUser(env(), 'admin'), 'admin'));
  });

  it('membro comum e o próprio usuário não recusam', async () => {
    await assertFails(reject(asUser(env(), 'membro'), 'membro'));
    await assertFails(reject(asUser(env(), 'alice'), 'alice'));
  });

  it('a recusa não pode vir com a conta ativada', async () => {
    const db = asUser(env(), 'admin');
    const batch = writeBatch(db);
    batch.update(doc(db, 'applications', 'alice'), {
      status: 'recusada',
      decidedBy: 'admin',
      decidedAt: serverTimestamp(),
    });
    batch.update(doc(db, 'users', 'alice'), { status: 'ativo' });
    await assertFails(batch.commit());
  });
});

describe('Fila de pendentes e dados de membros', () => {
  it('admin lista contas e candidaturas; membro comum não', async () => {
    await assertSucceeds(getDocs(collection(asUser(env(), 'admin'), 'users')));
    await assertSucceeds(getDocs(collection(asUser(env(), 'admin'), 'applications')));
    await assertFails(getDocs(collection(asUser(env(), 'membro'), 'users')));
  });

  it('membros ativos leem dados de membros; pendentes e visitantes não', async () => {
    await approve(asUser(env(), 'admin'), 'admin');
    await assertSucceeds(getDoc(doc(asUser(env(), 'membro'), 'members', 'alice')));
    await assertSucceeds(getDocs(collection(asUser(env(), 'membro'), 'members')));
    await seed(env(), { 'users/bob': account('bob') });
    await assertFails(getDoc(doc(asUser(env(), 'bob'), 'members', 'alice')));
  });

  it('ninguém desativa o membro sem desativar a conta', async () => {
    await approve(asUser(env(), 'admin'), 'admin');
    await assertFails(
      updateDoc(doc(asUser(env(), 'admin'), 'members', 'alice'), { active: false }),
    );
    await assertFails(
      updateDoc(doc(asUser(env(), 'alice'), 'members', 'alice'), { active: false }),
    );
  });
});
