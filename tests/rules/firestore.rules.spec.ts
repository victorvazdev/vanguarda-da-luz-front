import { assertFails } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { describe, it } from 'vitest';
import { asUser, asVisitor, useRulesEnv } from './env';

const env = useRulesEnv();

describe('Regras padrão', () => {
  it('nega leitura e escrita a visitantes em coleções não liberadas', async () => {
    const db = asVisitor(env());
    await assertFails(getDoc(doc(db, 'qualquer/documento')));
    await assertFails(setDoc(doc(db, 'qualquer/documento'), { a: 1 }));
  });

  it('nega leitura e escrita a usuários autenticados em coleções não liberadas', async () => {
    const db = asUser(env(), 'alice');
    await assertFails(getDoc(doc(db, 'qualquer/documento')));
    await assertFails(setDoc(doc(db, 'qualquer/documento'), { a: 1 }));
  });
});
