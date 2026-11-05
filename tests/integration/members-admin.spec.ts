import { signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { describe, expect, it } from 'vitest';
import { signIn } from '../../src/app/core/auth/sign-in';
import { signUp } from '../../src/app/core/auth/sign-up';
import { submitApplication } from '../../src/app/core/data/applications';
import {
  changeRole,
  deactivateMember,
  reactivateMember,
  watchMembers,
  type MemberRow,
} from '../../src/app/core/data/members-admin';
import { approveApplication } from '../../src/app/core/data/review';
import { adminGet, adminPatch, useEmulators, type Client } from './emulators';

const client = useEmulators();

type Person = Client & { uid: string; email: string };

async function register(username: string): Promise<Person> {
  const c = client();
  const email = `${username.toLowerCase()}@example.com`;
  const result = await signUp(c.auth, c.db, { username, email, password: 'segredo123' });
  if (!result.ok) throw new Error(result.error);
  return { ...c, uid: result.uid, email };
}

/** Primeiro admin, como no passo manual do README (inclui config/admins). */
async function firstAdmin(): Promise<Person> {
  const a = await register('Maren');
  await adminPatch(`users/${a.uid}`, { status: 'ativo', role: 'admin' });
  await adminPatch('config/admins', { activeAdminUids: [a.uid] });
  return a;
}

/** Membro aprovado pelo fluxo real. */
async function approvedMember(admin: Person, username: string): Promise<Person> {
  const m = await register(username);
  await submitApplication(m.db, m.uid, {
    game: 'retail',
    characterName: username,
    server: 'Azralon',
    characterClass: 'sacerdote',
    characterRole: 'cura',
    professions: ['alquimia'],
    battleTag: 'Jogador#1234',
    motivation: 'Quero entrar.',
  });
  const result = await approveApplication(admin.db, admin.uid, m.uid);
  if (!result.ok) throw new Error(result.error);
  return m;
}

const adminList = async () =>
  (
    (await adminGet('config/admins'))?.['activeAdminUids'] as { values?: { stringValue: string }[] }
  )?.values?.map((v) => v.stringValue) ?? [];

describe('Gerenciar membros e permissões (emuladores)', () => {
  it('lista membros com situação, permissão e personagem principal', async () => {
    const admin = await firstAdmin();
    const dorvan = await approvedMember(admin, 'Dorvan');
    const rows = await new Promise<MemberRow[]>((resolve, reject) => {
      const stop = watchMembers(admin.db, (r) => (stop(), resolve(r)), reject);
    });
    expect(rows.map((r) => [r.username, r.status, r.role, r.mainCharacter?.characterName])).toEqual(
      [
        ['Dorvan', 'ativo', 'membro', 'Dorvan'],
        ['Maren', 'ativo', 'admin', undefined],
      ],
    );
    expect(rows[0].uid).toBe(dorvan.uid);
    // O BattleTag (dado privado da conta) aparece para os administradores.
    expect(rows.map((r) => r.battleTag)).toEqual(['Jogador#1234', null]);
  });

  it('promove a administrador e a permissão vale na próxima requisição', async () => {
    const admin = await firstAdmin();
    const dorvan = await approvedMember(admin, 'Dorvan');

    // Antes: Dorvan não lê a lista de admins.
    await expect(getDoc(doc(dorvan.db, 'config', 'admins'))).rejects.toThrow();

    expect(await changeRole(admin.db, dorvan.uid, 'admin')).toEqual({ ok: true });
    expect(await adminList()).toEqual([admin.uid, dorvan.uid]);

    // Mesma sessão, sem novo login: já é admin.
    expect((await getDoc(doc(dorvan.db, 'config', 'admins'))).exists()).toBe(true);

    expect(await changeRole(admin.db, dorvan.uid, 'membro')).toEqual({ ok: true });
    expect(await adminList()).toEqual([admin.uid]);
    await expect(getDoc(doc(dorvan.db, 'config', 'admins'))).rejects.toThrow();
  });

  it('impede remover a permissão ou desativar o último administrador ativo', async () => {
    const admin = await firstAdmin();
    expect(await changeRole(admin.db, admin.uid, 'membro')).toEqual({
      ok: false,
      error: 'last-admin',
    });
    expect(await deactivateMember(admin.db, admin.uid)).toEqual({ ok: false, error: 'last-admin' });
    expect(await adminGet(`users/${admin.uid}`)).toMatchObject({ status: 'ativo', role: 'admin' });
  });

  it('desativar: o membro perde o acesso, sai das listas e não entra mais', async () => {
    const admin = await firstAdmin();
    const dorvan = await approvedMember(admin, 'Dorvan');

    expect(await deactivateMember(admin.db, dorvan.uid)).toEqual({ ok: true });
    expect(await adminGet(`users/${dorvan.uid}`)).toMatchObject({ status: 'desativado' });
    expect(await adminGet(`members/${dorvan.uid}`)).toMatchObject({ active: false });

    await expect(getDoc(doc(dorvan.db, 'members', admin.uid))).rejects.toThrow();
    await signOut(dorvan.auth);
    const again = client();
    expect(await signIn(again.auth, again.db, dorvan.email, 'segredo123')).toEqual({
      ok: false,
      error: 'disabled',
    });
  });

  it('desativar um admin, havendo outro, o remove da lista de admins', async () => {
    const admin = await firstAdmin();
    const dorvan = await approvedMember(admin, 'Dorvan');
    await changeRole(admin.db, dorvan.uid, 'admin');
    expect(await deactivateMember(dorvan.db, admin.uid)).toEqual({ ok: true });
    expect(await adminList()).toEqual([dorvan.uid]);
  });

  it('reativar: o membro volta a entrar e às listas, com permissão de membro', async () => {
    const admin = await firstAdmin();
    const dorvan = await approvedMember(admin, 'Dorvan');
    await changeRole(admin.db, dorvan.uid, 'admin');
    await deactivateMember(admin.db, dorvan.uid);

    expect(await reactivateMember(admin.db, dorvan.uid)).toEqual({ ok: true });
    expect(await adminGet(`users/${dorvan.uid}`)).toMatchObject({
      status: 'ativo',
      role: 'membro',
    });
    expect(await adminGet(`members/${dorvan.uid}`)).toMatchObject({ active: true });
    expect(await adminList()).toEqual([admin.uid]);

    await signOut(dorvan.auth);
    const again = client();
    expect(await signIn(again.auth, again.db, dorvan.email, 'segredo123')).toEqual({
      ok: true,
      access: 'member',
    });
  });

  it('só reativa conta desativada', async () => {
    const admin = await firstAdmin();
    const dorvan = await approvedMember(admin, 'Dorvan');
    expect(await reactivateMember(admin.db, dorvan.uid)).toEqual({
      ok: false,
      error: 'not-inactive',
    });
  });

  it('membro comum não altera permissões', async () => {
    const admin = await firstAdmin();
    const dorvan = await approvedMember(admin, 'Dorvan');
    expect(await changeRole(dorvan.db, dorvan.uid, 'admin')).toEqual({
      ok: false,
      error: 'not-allowed',
    });
  });
});
