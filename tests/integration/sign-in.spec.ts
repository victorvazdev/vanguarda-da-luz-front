import { signOut } from 'firebase/auth';
import { describe, expect, it } from 'vitest';
import { signIn } from '../../src/app/core/auth/sign-in';
import { signUp } from '../../src/app/core/auth/sign-up';
import { adminPatch, useEmulators } from './emulators';

const client = useEmulators();
const email = 'elaris@example.com';
const password = 'segredo123';

/** Cadastra pelo fluxo real e encerra a sessão; devolve o uid. */
async function registered(): Promise<string> {
  const { auth, db } = client();
  const result = await signUp(auth, db, { username: 'Elaris', email, password });
  if (!result.ok) throw new Error(result.error);
  await signOut(auth);
  return result.uid;
}

describe('Login (Auth + Firestore emulados)', () => {
  it('conta pendente entra com perfil pendente', async () => {
    await registered();
    const { auth, db } = client();
    expect(await signIn(auth, db, email, password)).toEqual({ ok: true, access: 'pending' });
    expect(auth.currentUser?.email).toBe(email);
  });

  it('membro ativo e administrador entram com o perfil correspondente', async () => {
    const uid = await registered();
    await adminPatch(`users/${uid}`, { status: 'ativo' });
    const member = client();
    expect(await signIn(member.auth, member.db, email, password)).toEqual({
      ok: true,
      access: 'member',
    });

    await adminPatch(`users/${uid}`, { role: 'admin' });
    const admin = client();
    expect(await signIn(admin.auth, admin.db, email, password)).toEqual({
      ok: true,
      access: 'admin',
    });
  });

  it('senha errada e e-mail inexistente recebem o mesmo erro genérico', async () => {
    await registered();
    const a = client();
    const b = client();
    const wrongPassword = await signIn(a.auth, a.db, email, 'senha-errada');
    const unknownEmail = await signIn(b.auth, b.db, 'ninguem@example.com', password);
    expect(wrongPassword).toEqual({ ok: false, error: 'invalid-credentials' });
    expect(unknownEmail).toEqual(wrongPassword);
    expect(a.auth.currentUser).toBeNull();
  });

  it('conta desativada não entra: a sessão é encerrada', async () => {
    const uid = await registered();
    await adminPatch(`users/${uid}`, { status: 'desativado' });
    const { auth, db } = client();
    expect(await signIn(auth, db, email, password)).toEqual({ ok: false, error: 'disabled' });
    expect(auth.currentUser).toBeNull();
  });
});
