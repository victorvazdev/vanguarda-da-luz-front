import { signOut } from 'firebase/auth';
import { describe, expect, it } from 'vitest';
import {
  deleteAccount,
  finishDeletion,
  startDeletion,
} from '../../src/app/core/auth/account-deletion';
import { signIn } from '../../src/app/core/auth/sign-in';
import { signUp } from '../../src/app/core/auth/sign-up';
import { submitApplication } from '../../src/app/core/data/applications';
import {
  confirmAttendance,
  watchAttendees,
  type Attendee,
} from '../../src/app/core/data/attendance';
import { saveCharacter } from '../../src/app/core/data/characters';
import { createEvent } from '../../src/app/core/data/events';
import { approveApplication } from '../../src/app/core/data/review';
import { adminGet, adminPatch, authAccounts, useEmulators, type Client } from './emulators';

const client = useEmulators();
const PASSWORD = 'segredo123';

type Person = Client & { uid: string; email: string };

async function register(username: string, email = `${username.toLowerCase()}@example.com`) {
  const c = client();
  const result = await signUp(c.auth, c.db, { username, email, password: PASSWORD });
  if (!result.ok) throw new Error(result.error);
  return { ...c, uid: result.uid, email } as Person;
}

async function firstAdmin(): Promise<Person> {
  const a = await register('Maren');
  await adminPatch(`users/${a.uid}`, { status: 'ativo', role: 'admin' });
  await adminPatch('config/admins', { activeAdminUids: [a.uid] });
  return a;
}

async function apply(p: Person) {
  const result = await submitApplication(p.db, p.uid, {
    game: 'retail',
    characterName: 'Tavia',
    server: 'Azralon',
    characterClass: 'sacerdote',
    characterRole: 'cura',
    professions: ['alquimia', 'herborismo'],
    battleTag: 'Tavia#1234',
    motivation: 'Quero entrar.',
  });
  if (!result.ok) throw new Error(result.error);
}

async function approvedMember(admin: Person, username = 'Tavia'): Promise<Person> {
  const m = await register(username);
  await apply(m);
  const result = await approveApplication(admin.db, admin.uid, m.uid);
  if (!result.ok) throw new Error(result.error);
  return m;
}

async function futureEvent(admin: Person): Promise<string> {
  const r = await createEvent(admin.db, admin.uid, {
    title: 'Raid semanal',
    startsAt: new Date(Date.now() + 3 * 86_400_000),
    description: '[DESCRIÇÃO DO EVENTO]',
    organizer: 'Maren',
    guestsAllowed: true,
  });
  if (!r.ok) throw new Error(r.error);
  return r.id;
}

/** Evento que já aconteceu, com a presença do membro (gravados como pelo console). */
async function pastEventWith(uid: string, admin: Person): Promise<string> {
  const id = 'evento-passado';
  await adminPatch(`events/${id}`, {
    title: 'Raid antiga',
    startsAt: new Date(Date.now() - 7 * 86_400_000),
    description: 'Aconteceu.',
    organizer: 'Maren',
    status: 'ativo',
    createdBy: admin.uid,
  });
  await adminPatch(`events/${id}/attendees/${uid}`, {
    confirmedAt: new Date(Date.now() - 8 * 86_400_000),
  });
  return id;
}

function attendeesOnce(p: Person, eventId: string): Promise<Attendee[]> {
  return new Promise((resolve, reject) => {
    const stop = watchAttendees(p.db, eventId, (list) => (stop(), resolve(list)), reject);
  });
}

const authEmails = async () => (await authAccounts()).map((a) => a.email);

describe('Excluir conta (emuladores)', () => {
  it('membro: remove dados pessoais e login, cancela presenças futuras e mantém o histórico', async () => {
    const admin = await firstAdmin();
    const tavia = await approvedMember(admin);
    const altId = await saveCharacter(
      tavia.db,
      tavia.uid,
      null,
      {
        game: 'forever',
        characterName: 'Brisa',
        characterSurname: 'Aurora',
        ruleset: 'jxj',
        characterClass: 'druida',
        characterRole: 'tanque',
        professions: [],
        level: 42,
      },
      false,
    );
    if (!altId.ok) throw new Error(altId.error);
    const future = await futureEvent(admin);
    expect(await confirmAttendance(tavia.db, future, tavia.uid)).toEqual({ ok: true });
    const past = await pastEventWith(tavia.uid, admin);

    expect(await deleteAccount(tavia.auth, tavia.db, PASSWORD)).toEqual({ ok: true });

    // Login e e-mail
    expect(tavia.auth.currentUser).toBeNull();
    expect(await authEmails()).not.toContain(tavia.email);
    // Conta: somente o registro mínimo
    const user = await adminGet(`users/${tavia.uid}`);
    expect(Object.keys(user!).sort()).toEqual(['deletedAt', 'status']);
    expect(user!['status']).toBe('excluido');
    // Nome de usuário livre e candidatura (BattleTag, motivo) apagada
    expect(await adminGet('usernames/tavia')).toBeNull();
    expect(await adminGet(`applications/${tavia.uid}`)).toBeNull();
    // Membro: sem nome de usuário, fora das listas, personagens mantidos
    const member = await adminGet(`members/${tavia.uid}`);
    expect(member).not.toHaveProperty('username');
    expect(member!['active']).toBe(false);
    expect(member).toHaveProperty('deletedAt');
    expect(member).toHaveProperty('mainCharacter');
    expect(await adminGet(`members/${tavia.uid}/characters/${altId.id}`)).toMatchObject({
      characterName: 'Brisa',
    });
    // Presenças: futura cancelada, passada mantida
    expect(await adminGet(`events/${future}/attendees/${tavia.uid}`)).toBeNull();
    expect(await adminGet(`events/${past}/attendees/${tavia.uid}`)).not.toBeNull();

    // Listas: some dos confirmados do evento futuro; no passado aparece como conta excluída
    expect(await attendeesOnce(admin, future)).toEqual([]);
    const history = await attendeesOnce(admin, past);
    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({
      deleted: true,
      username: '',
      mainCharacter: { characterName: 'Tavia', characterClass: 'sacerdote' },
    });
  });

  it('o nome de usuário e o e-mail ficam livres para uma nova conta', async () => {
    const admin = await firstAdmin();
    const tavia = await approvedMember(admin);
    expect(await deleteAccount(tavia.auth, tavia.db, PASSWORD)).toEqual({ ok: true });

    const again = client();
    expect(
      await signUp(again.auth, again.db, {
        username: 'Tavia',
        email: tavia.email,
        password: PASSWORD,
      }),
    ).toMatchObject({ ok: true });
  });

  it('conta pendente: remove a candidatura e o login', async () => {
    const elaris = await register('Elaris');
    await apply(elaris);

    expect(await deleteAccount(elaris.auth, elaris.db, PASSWORD)).toEqual({ ok: true });

    expect(await adminGet(`applications/${elaris.uid}`)).toBeNull();
    expect(await adminGet('usernames/elaris')).toBeNull();
    expect(await adminGet(`users/${elaris.uid}`)).toMatchObject({ status: 'excluido' });
    expect(await authEmails()).not.toContain(elaris.email);
  });

  it('senha incorreta não altera nada', async () => {
    const admin = await firstAdmin();
    const tavia = await approvedMember(admin);

    expect(await deleteAccount(tavia.auth, tavia.db, 'errada123')).toEqual({
      ok: false,
      error: 'wrong-password',
    });
    expect(await adminGet(`users/${tavia.uid}`)).toMatchObject({ status: 'ativo' });
    expect(await authEmails()).toContain(tavia.email);
  });

  it('impede excluir o último administrador ativo', async () => {
    const admin = await firstAdmin();

    expect(await deleteAccount(admin.auth, admin.db, PASSWORD)).toEqual({
      ok: false,
      error: 'last-admin',
    });
    expect(await adminGet(`users/${admin.uid}`)).toMatchObject({ status: 'ativo', role: 'admin' });
    expect((await adminGet('config/admins'))!['activeAdminUids']).toBeTruthy();
    expect(await authEmails()).toContain(admin.email);
  });

  it('administrador que não é o último sai da lista de administradores', async () => {
    const admin = await firstAdmin();
    const other = await approvedMember(admin, 'Dorvan');
    await adminPatch(`users/${other.uid}`, { role: 'admin' });
    await adminPatch('config/admins', { activeAdminUids: [admin.uid, other.uid] });

    expect(await deleteAccount(other.auth, other.db, PASSWORD)).toEqual({ ok: true });

    const admins = await adminGet('config/admins');
    const values = (admins!['activeAdminUids'] as { values: { stringValue: string }[] }).values;
    expect(values.map((v) => v.stringValue)).toEqual([admin.uid]);
  });

  it('exclusão interrompida é concluída no próximo login', async () => {
    const admin = await firstAdmin();
    const tavia = await approvedMember(admin);

    // Falha simulada depois da primeira etapa: a conta fica "excluindo", sem acesso de membro.
    const { reauthenticateWithCredential, EmailAuthProvider } = await import('firebase/auth');
    await reauthenticateWithCredential(
      tavia.auth.currentUser!,
      EmailAuthProvider.credential(tavia.email, PASSWORD),
    );
    await tavia.auth.currentUser!.getIdToken(true);
    await startDeletion(tavia.db, tavia.uid);
    expect(await adminGet(`users/${tavia.uid}`)).toMatchObject({ status: 'excluindo' });
    expect(await adminGet(`members/${tavia.uid}`)).toMatchObject({ active: false });
    await signOut(tavia.auth);

    const back = await signIn(tavia.auth, tavia.db, tavia.email, PASSWORD);
    expect(back).toEqual({ ok: true, access: 'deleting' });

    expect(await deleteAccount(tavia.auth, tavia.db, PASSWORD)).toEqual({ ok: true });
    expect(await adminGet(`users/${tavia.uid}`)).toMatchObject({ status: 'excluido' });
    expect(await authEmails()).not.toContain(tavia.email);
  });

  it('se só o login ficou para trás, o próximo login conclui a exclusão', async () => {
    const elaris = await register('Elaris');
    const { reauthenticateWithCredential, EmailAuthProvider } = await import('firebase/auth');
    await reauthenticateWithCredential(
      elaris.auth.currentUser!,
      EmailAuthProvider.credential(elaris.email, PASSWORD),
    );
    await elaris.auth.currentUser!.getIdToken(true);
    await startDeletion(elaris.db, elaris.uid);
    await finishDeletion(elaris.db, elaris.uid);
    await signOut(elaris.auth);

    const back = await signIn(elaris.auth, elaris.db, elaris.email, PASSWORD);
    expect(back).toEqual({ ok: true, access: 'deleting' });
    expect(await deleteAccount(elaris.auth, elaris.db, PASSWORD)).toEqual({ ok: true });
    expect(await authEmails()).not.toContain(elaris.email);
  });
});
