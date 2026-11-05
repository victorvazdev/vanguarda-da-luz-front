import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import {
  Timestamp,
  collection,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  writeBatch,
  type Firestore,
} from 'firebase/firestore';
import { beforeEach, describe, it } from 'vitest';
import { account, asUser, asVisitor, seed, useRulesEnv } from './env';

const env = useRulesEnv();

const valid = (): Record<string, unknown> => ({
  game: 'retail',
  characterName: 'Elaris',
  server: 'Azralon',
  characterClass: 'paladino',
  characterRole: 'cura',
  professions: ['alquimia', 'herborismo'],
  motivation: 'Quero participar das raids semanais.',
  rulesAccepted: true,
  status: 'pendente',
  submittedAt: serverTimestamp(),
});

const validForever = (): Record<string, unknown> => {
  const { server: _server, ...rest } = valid();
  return { ...rest, game: 'forever', characterSurname: 'Aurora', ruleset: 'jxj' };
};

const apply = (db: Firestore, uid: string, data: Record<string, unknown>) =>
  setDoc(doc(db, 'applications', uid), data);

const submittedAt = Timestamp.fromDate(new Date('2026-11-02T12:00:00Z'));
const decidedAt = Timestamp.fromDate(new Date('2026-11-03T12:00:00Z'));
const rejected = {
  ...valid(),
  submittedAt,
  status: 'recusada',
  decidedBy: 'admin',
  decidedAt,
};

beforeEach(async () => {
  await seed(env(), {
    'users/alice': account('alice', { battleTag: 'Elaris#1234' }),
    'users/bob': account('bob'),
    'users/membro': account('membro', { status: 'ativo' }),
    'users/admin': account('admin', { status: 'ativo', role: 'admin' }),
  });
});

describe('Candidatura: envio', () => {
  it('usuário pendente envia a própria candidatura', async () => {
    await assertSucceeds(apply(asUser(env(), 'alice'), 'alice', valid()));
  });

  it('visitante, outro usuário e membro ativo não enviam', async () => {
    await assertFails(apply(asVisitor(env()), 'alice', valid()));
    await assertFails(apply(asUser(env(), 'bob'), 'alice', valid()));
    await assertFails(apply(asUser(env(), 'membro'), 'membro', valid()));
  });

  it('conta desativada não envia', async () => {
    await seed(env(), { 'users/alice': account('alice', { status: 'desativado' }) });
    await assertFails(apply(asUser(env(), 'alice'), 'alice', valid()));
  });

  it('usuário pendente envia candidatura do WoW Forever (nome, sobrenome e ruleset)', async () => {
    await assertSucceeds(apply(asUser(env(), 'alice'), 'alice', validForever()));
  });

  it.each([
    ['sem jogo', { game: undefined }],
    ['jogo inválido', { game: 'classic' }],
    ['Retail com sobrenome', { characterSurname: 'Aurora' }],
    ['Retail com ruleset', { ruleset: 'normal' }],
    [
      'Retail com classe e função incompatíveis',
      { characterClass: 'mago', characterRole: 'tanque' },
    ],
  ])('recusa Retail inválido: %s', async (_name, over) => {
    const data: Record<string, unknown> = { ...valid(), ...over };
    for (const [k, v] of Object.entries(over)) if (v === undefined) delete data[k];
    await assertFails(apply(asUser(env(), 'alice'), 'alice', data));
  });

  it.each([
    ['sem sobrenome', { characterSurname: undefined }],
    ['sobrenome curto', { characterSurname: 'A' }],
    ['sem ruleset', { ruleset: undefined }],
    ['ruleset onde a guilda não está', { ruleset: 'rp' }],
    ['com servidor', { server: 'Azralon' }],
    ['classe que não existe no Forever', { characterClass: 'monge', characterRole: 'dano' }],
    ['combinação do Classic inválida', { characterClass: 'sacerdote', characterRole: 'tanque' }],
  ])('recusa Forever inválido: %s', async (_name, over) => {
    const data: Record<string, unknown> = { ...validForever(), ...over };
    for (const [k, v] of Object.entries(over)) if (v === undefined) delete data[k];
    await assertFails(apply(asUser(env(), 'alice'), 'alice', data));
  });

  describe('BattleTag', () => {
    /** Candidatura e BattleTag da conta no mesmo lote, como o app envia. */
    const applyWith = (uid: string, battleTag: unknown) => {
      const db = asUser(env(), uid);
      const batch = writeBatch(db);
      batch.update(doc(db, 'users', uid), { battleTag });
      batch.set(doc(db, 'applications', uid), valid());
      return batch.commit();
    };

    it('exige BattleTag na conta: já informado ou gravado no mesmo envio', async () => {
      await assertFails(apply(asUser(env(), 'bob'), 'bob', valid()));
      await assertSucceeds(applyWith('bob', 'Bob#1234'));
    });

    it.each(['Elaris#1234', 'Élaris2#98765', 'Abc#123456'])('aceita %s', async (battleTag) => {
      await assertSucceeds(applyWith('bob', battleTag));
    });

    it.each([
      ['vazio', ''],
      ['sem número', 'Elaris'],
      ['número curto', 'Elaris#123'],
      ['número longo', 'Elaris#1234567'],
      ['nome curto', 'El#1234'],
      ['nome longo', 'Elarisaurora1#1234'],
      ['começa com número', '1Elaris#1234'],
      ['com espaço', 'Ela ris#1234'],
      ['com símbolo', 'Ela_ris#1234'],
      ['não é texto', 1234],
    ])('recusa BattleTag %s', async (_name, battleTag) => {
      await assertFails(applyWith('bob', battleTag));
    });

    it('não grava o BattleTag na candidatura', async () => {
      await assertFails(
        apply(asUser(env(), 'alice'), 'alice', { ...valid(), battleTag: 'Elaris#1234' }),
      );
    });
  });

  describe('Profissões', () => {
    it.each([
      ['nenhuma (lista vazia)', []],
      ['uma', ['mineracao']],
      ['duas do Retail', ['joalheria', 'escrivania']],
    ])('aceita %s', async (_name, professions) => {
      await assertSucceeds(apply(asUser(env(), 'alice'), 'alice', { ...valid(), professions }));
    });

    it('aceita duas profissões do Classic no Forever', async () => {
      await assertSucceeds(
        apply(asUser(env(), 'alice'), 'alice', {
          ...validForever(),
          professions: ['ferraria', 'mineracao'],
        }),
      );
    });

    it.each([
      ['mais de duas', ['alquimia', 'herborismo', 'mineracao']],
      ['repetida', ['alquimia', 'alquimia']],
      ['inexistente', ['pesca']],
      ['secundária', ['culinaria']],
      ['não é lista', 'alquimia'],
    ])('recusa profissões: %s', async (_name, professions) => {
      await assertFails(apply(asUser(env(), 'alice'), 'alice', { ...valid(), professions }));
    });

    it('recusa no Forever profissões que só existem no Retail', async () => {
      for (const p of ['joalheria', 'escrivania']) {
        await assertFails(
          apply(asUser(env(), 'alice'), 'alice', { ...validForever(), professions: [p] }),
        );
      }
    });
  });

  it('exige aceitar as regras', async () => {
    const db = asUser(env(), 'alice');
    await assertFails(apply(db, 'alice', { ...valid(), rulesAccepted: false }));
    const { rulesAccepted: _accepted, ...without } = valid();
    await assertFails(apply(db, 'alice', without));
  });

  it.each([
    ['nome curto', { characterName: 'E' }],
    ['nome longo', { characterName: 'x'.repeat(13) }],
    ['servidor vazio', { server: '' }],
    ['classe inválida', { characterClass: 'ninja' }],
    ['função inválida', { characterRole: 'suporte' }],
    ['motivo vazio', { motivation: '' }],
    ['motivo longo', { motivation: 'x'.repeat(1001) }],
    ['já aprovada', { status: 'aprovada' }],
    ['campo extra', { decidedBy: 'alice' }],
    ['data forjada', { submittedAt }],
  ])('recusa dados inválidos: %s', async (_name, over) => {
    await assertFails(apply(asUser(env(), 'alice'), 'alice', { ...valid(), ...over }));
  });

  it('não permite nova candidatura enquanto houver outra pendente', async () => {
    const db = asUser(env(), 'alice');
    await apply(db, 'alice', valid());
    await assertFails(apply(db, 'alice', { ...valid(), characterName: 'Outro' }));
  });

  it('não permite reenviar candidatura aprovada', async () => {
    await seed(env(), { 'applications/alice': { ...rejected, status: 'aprovada' } });
    await assertFails(apply(asUser(env(), 'alice'), 'alice', { ...valid(), history: [] }));
  });
});

describe('Candidatura: reenvio após recusa', () => {
  beforeEach(async () => {
    await seed(env(), { 'applications/alice': rejected });
  });

  it('permite reenviar, preservando a decisão anterior no histórico', async () => {
    await assertSucceeds(
      apply(asUser(env(), 'alice'), 'alice', {
        ...valid(),
        history: [{ status: 'recusada', submittedAt, decidedBy: 'admin', decidedAt }],
      }),
    );
  });

  it('recusa reenvio sem histórico ou com histórico adulterado', async () => {
    const db = asUser(env(), 'alice');
    await assertFails(apply(db, 'alice', valid()));
    await assertFails(apply(db, 'alice', { ...valid(), history: [] }));
    await assertFails(
      apply(db, 'alice', {
        ...valid(),
        history: [{ status: 'aprovada', submittedAt, decidedBy: 'admin', decidedAt }],
      }),
    );
  });
});

describe('Candidatura: leitura', () => {
  beforeEach(async () => {
    await seed(env(), { 'applications/alice': { ...valid(), submittedAt } });
  });

  it('o próprio usuário lê a sua candidatura', async () => {
    await assertSucceeds(getDoc(doc(asUser(env(), 'alice'), 'applications', 'alice')));
  });

  it('outros usuários e membros não leem nem listam', async () => {
    await assertFails(getDoc(doc(asUser(env(), 'bob'), 'applications', 'alice')));
    await assertFails(getDoc(doc(asUser(env(), 'membro'), 'applications', 'alice')));
    await assertFails(getDocs(collection(asUser(env(), 'membro'), 'applications')));
  });

  it('administradores veem as candidaturas pendentes', async () => {
    const db = asUser(env(), 'admin');
    await assertSucceeds(getDoc(doc(db, 'applications', 'alice')));
    await assertSucceeds(getDocs(collection(db, 'applications')));
  });
});
