import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  updateDoc,
  writeBatch,
  type Firestore,
} from 'firebase/firestore';
import { describe, it } from 'vitest';
import { asUser, asVisitor, useRulesEnv } from './env';

const env = useRulesEnv();

interface AccountOverrides {
  [field: string]: unknown;
}

/** Mesmo par de escritas que o cadastro faz (nome reservado + conta pendente). */
function signUpBatch(db: Firestore, uid: string, username: string, over: AccountOverrides = {}) {
  const key = username.toLowerCase();
  const batch = writeBatch(db);
  batch.set(doc(db, 'usernames', key), { uid });
  batch.set(doc(db, 'users', uid), {
    username,
    usernameKey: key,
    email: `${uid}@example.com`,
    status: 'pendente',
    role: 'membro',
    createdAt: serverTimestamp(),
    ...over,
  });
  return batch.commit();
}

describe('Cadastro: nome de usuário e conta pendente', () => {
  it('permite criar a conta pendente junto com o nome reservado', async () => {
    await assertSucceeds(signUpBatch(asUser(env(), 'alice'), 'alice', 'Elaris'));
  });

  it('bloqueia nome de usuário já em uso, mesmo com maiúsculas diferentes', async () => {
    await signUpBatch(asUser(env(), 'alice'), 'alice', 'Elaris');
    await assertFails(signUpBatch(asUser(env(), 'bob'), 'bob', 'ELARIS'));
  });

  it('não permite criar a conta já ativa ou como admin', async () => {
    await assertFails(signUpBatch(asUser(env(), 'alice'), 'alice', 'Elaris', { status: 'ativo' }));
    await assertFails(signUpBatch(asUser(env(), 'alice'), 'alice', 'Elaris', { role: 'admin' }));
  });

  it('exige que o e-mail seja o da conta autenticada', async () => {
    await assertFails(
      signUpBatch(asUser(env(), 'alice'), 'alice', 'Elaris', { email: 'outro@example.com' }),
    );
  });

  it('não aceita campos extras nem data forjada', async () => {
    await assertFails(signUpBatch(asUser(env(), 'alice'), 'alice', 'Elaris', { extra: true }));
    await assertFails(
      signUpBatch(asUser(env(), 'alice'), 'alice', 'Elaris', { createdAt: new Date(2000, 0, 1) }),
    );
  });

  it('não aceita nome com formato inválido', async () => {
    await assertFails(signUpBatch(asUser(env(), 'alice'), 'alice', 'ab'));
    await assertFails(signUpBatch(asUser(env(), 'alice'), 'alice', 'nome com espaço'));
  });

  it('não permite reservar nome sem criar a conta, nem para outro uid', async () => {
    const db = asUser(env(), 'alice');
    const solo = writeBatch(db);
    solo.set(doc(db, 'usernames', 'elaris'), { uid: 'alice' });
    await assertFails(solo.commit());

    await assertFails(signUpBatch(db, 'bob', 'Elaris'));
  });

  it('não permite reservar um segundo nome depois do cadastro', async () => {
    const db = asUser(env(), 'alice');
    await signUpBatch(db, 'alice', 'Elaris');
    const second = writeBatch(db);
    second.set(doc(db, 'usernames', 'outro'), { uid: 'alice' });
    await assertFails(second.commit());
  });

  it('o nome de usuário pode ser consultado, mas não listado', async () => {
    await signUpBatch(asUser(env(), 'alice'), 'alice', 'Elaris');
    const visitor = asVisitor(env());
    await assertSucceeds(getDoc(doc(visitor, 'usernames', 'elaris')));
    await assertFails(getDocs(collection(visitor, 'usernames')));
  });

  it('o usuário lê a própria conta, mas não a de outros', async () => {
    await signUpBatch(asUser(env(), 'alice'), 'alice', 'Elaris');
    await assertSucceeds(getDoc(doc(asUser(env(), 'alice'), 'users', 'alice')));
    await assertFails(getDoc(doc(asUser(env(), 'bob'), 'users', 'alice')));
    await assertFails(getDoc(doc(asVisitor(env()), 'users', 'alice')));
  });

  it('o usuário não altera a própria situação nem a permissão', async () => {
    const db = asUser(env(), 'alice');
    await signUpBatch(db, 'alice', 'Elaris');
    await assertFails(updateDoc(doc(db, 'users', 'alice'), { status: 'ativo' }));
    await assertFails(updateDoc(doc(db, 'users', 'alice'), { role: 'admin' }));
  });
});
