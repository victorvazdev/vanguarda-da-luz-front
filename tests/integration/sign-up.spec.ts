import { signInWithEmailAndPassword } from 'firebase/auth';
import { describe, expect, it } from 'vitest';
import { signUp } from '../../src/app/core/auth/sign-up';
import { adminGet, authAccounts, useEmulators } from './emulators';

const client = useEmulators();
const input = { username: 'Elaris', email: 'elaris@example.com', password: 'segredo123' };

describe('Cadastro (Auth + Firestore emulados)', () => {
  it('cria a conta pendente e reserva o nome de usuário', async () => {
    const { auth, db } = client();
    const result = await signUp(auth, db, input);
    expect(result.ok).toBe(true);
    const uid = result.ok ? result.uid : '';

    const account = await adminGet(`users/${uid}`);
    expect(account).toMatchObject({
      username: 'Elaris',
      usernameKey: 'elaris',
      email: 'elaris@example.com',
      status: 'pendente',
      role: 'membro',
    });
    expect(await adminGet('usernames/elaris')).toEqual({ uid });
  });

  // O hash em si é feito pelo Firebase Auth (scrypt em produção). O emulador usa um
  // "fakeHash" legível, por isso aqui só verificamos que a senha não sai do Auth.
  it('não guarda a senha no Firestore; ela fica a cargo do Auth', async () => {
    const { auth, db } = client();
    const result = await signUp(auth, db, input);
    const account = await adminGet(`users/${result.ok ? result.uid : ''}`);
    expect(JSON.stringify(account)).not.toContain(input.password);
    expect(Object.keys(account ?? {})).not.toContain('password');
    const [stored] = await authAccounts();
    expect(stored.passwordHash).toBeTruthy();
  });

  it('bloqueia nome de usuário em uso (sem diferenciar maiúsculas) e não deixa conta órfã', async () => {
    const first = client();
    await signUp(first.auth, first.db, input);

    const second = client();
    const result = await signUp(second.auth, second.db, {
      ...input,
      username: 'ELARIS',
      email: 'outra@example.com',
    });
    expect(result).toEqual({ ok: false, error: 'username-taken' });
    expect((await authAccounts()).map((a) => a.email)).toEqual(['elaris@example.com']);
  });

  it('bloqueia e-mail em uso', async () => {
    const first = client();
    await signUp(first.auth, first.db, input);

    const second = client();
    const result = await signUp(second.auth, second.db, { ...input, username: 'Outro' });
    expect(result).toEqual({ ok: false, error: 'email-in-use' });
    expect(await adminGet('usernames/outro')).toBeNull();
  });

  it('a conta criada consegue entrar com a senha cadastrada', async () => {
    const first = client();
    await signUp(first.auth, first.db, input);
    const other = client();
    const cred = await signInWithEmailAndPassword(other.auth, input.email, input.password);
    expect(cred.user.email).toBe(input.email);
  });
});
