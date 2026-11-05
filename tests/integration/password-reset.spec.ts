import { signOut } from 'firebase/auth';
import { describe, expect, it } from 'vitest';
import {
  checkResetCode,
  requestPasswordReset,
  resetPassword,
} from '../../src/app/core/auth/password-reset';
import { signIn } from '../../src/app/core/auth/sign-in';
import { signUp } from '../../src/app/core/auth/sign-up';
import { lastResetCode, resetEmailCount, useEmulators } from './emulators';

const client = useEmulators();
const email = 'elaris@example.com';
const oldPassword = 'segredo123';
const newPassword = 'nova-senha-456';

async function registered() {
  const { auth, db } = client();
  const result = await signUp(auth, db, { username: 'Elaris', email, password: oldPassword });
  if (!result.ok) throw new Error(result.error);
  await signOut(auth);
}

describe('Recuperação de senha (Auth emulado)', () => {
  it('responde igual para e-mail cadastrado e não cadastrado; só o cadastrado recebe link', async () => {
    await registered();
    const { auth } = client();
    const known = await requestPasswordReset(auth, email);
    const unknown = await requestPasswordReset(auth, 'ninguem@example.com');
    expect(known).toEqual({ ok: true });
    expect(unknown).toEqual(known);
    expect(await resetEmailCount()).toBe(1);
  });

  it('o link identifica a conta, troca a senha e a senha antiga deixa de funcionar', async () => {
    await registered();
    const { auth, db } = client();
    await requestPasswordReset(auth, email);
    const code = await lastResetCode(email);

    expect(await checkResetCode(auth, code)).toEqual({ ok: true, email });
    expect(await resetPassword(auth, code, newPassword)).toEqual({ ok: true });

    expect(await signIn(auth, db, email, oldPassword)).toEqual({
      ok: false,
      error: 'invalid-credentials',
    });
    expect(await signIn(auth, db, email, newPassword)).toEqual({ ok: true, access: 'pending' });
  });

  it('o link só pode ser usado uma vez', async () => {
    await registered();
    const { auth } = client();
    await requestPasswordReset(auth, email);
    const code = await lastResetCode(email);
    await resetPassword(auth, code, newPassword);

    expect(await checkResetCode(auth, code)).toEqual({ ok: false, error: 'invalid-link' });
    expect(await resetPassword(auth, code, 'mais-uma-senha')).toEqual({
      ok: false,
      error: 'invalid-link',
    });
  });

  it('código inválido ou ausente é recusado', async () => {
    const { auth } = client();
    expect(await checkResetCode(auth, 'codigo-inventado')).toEqual({
      ok: false,
      error: 'invalid-link',
    });
    expect(await checkResetCode(auth, undefined)).toEqual({ ok: false, error: 'invalid-link' });
  });
});
