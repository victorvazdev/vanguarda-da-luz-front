import { describe, expect, it } from 'vitest';
import { signUp } from '../../src/app/core/auth/sign-up';
import { submitApplication } from '../../src/app/core/data/applications';
import {
  cancelAttendance,
  confirmAttendance,
  watchAttendees,
  type Attendee,
  watchMyAttendance,
  type MyAttendance,
} from '../../src/app/core/data/attendance';
import { saveCharacter, type CharacterInput } from '../../src/app/core/data/characters';
import { cancelEvent, createEvent } from '../../src/app/core/data/events';
import { deactivateMember } from '../../src/app/core/data/members-admin';
import { approveApplication } from '../../src/app/core/data/review';
import { adminGet, adminPatch, useEmulators, type Client } from './emulators';

const client = useEmulators();

type Person = Client & { uid: string };

async function register(username: string): Promise<Person> {
  const c = client();
  const email = `${username.toLowerCase()}@example.com`;
  const result = await signUp(c.auth, c.db, { username, email, password: 'segredo123' });
  if (!result.ok) throw new Error(result.error);
  return { ...c, uid: result.uid };
}

async function firstAdmin(): Promise<Person> {
  const a = await register('Maren');
  await adminPatch(`users/${a.uid}`, { status: 'ativo', role: 'admin' });
  await adminPatch('config/admins', { activeAdminUids: [a.uid] });
  return a;
}

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

async function newEvent(admin: Person, game: 'retail' | 'forever' = 'retail'): Promise<string> {
  const r = await createEvent(admin.db, admin.uid, {
    title: 'Raid semanal',
    game,
    startsAt: new Date(Date.now() + 3 * 86_400_000),
    description: '[DESCRIÇÃO DO EVENTO]',
    organizer: 'Maren',
    guestsAllowed: true,
    maxAttendees: 40,
  });
  if (!r.ok) throw new Error(r.error);
  return r.id;
}

const forever: CharacterInput = {
  game: 'forever',
  characterName: 'Brisa',
  characterSurname: 'Aurora',
  ruleset: 'jxj',
  characterClass: 'druida',
  characterRole: 'tanque',
  professions: [],
  level: 42,
};

async function addCharacter(p: Person, input: CharacterInput): Promise<string> {
  const r = await saveCharacter(p.db, p.uid, null, input, false);
  if (!r.ok) throw new Error(r.error);
  return r.id;
}

const mine = (p: Person, eventId: string) =>
  new Promise<MyAttendance | null>((resolve, reject) => {
    const stop = watchMyAttendance(p.db, eventId, p.uid, (a) => (stop(), resolve(a)), reject);
  });

describe('Confirmar presença (emuladores)', () => {
  it('registra a presença do membro autenticado', async () => {
    const admin = await firstAdmin();
    const tavia = await approvedMember(admin, 'Tavia');
    const id = await newEvent(admin);
    expect(await mine(tavia, id)).toBeNull();

    // Com a página aberta (listener ativo), a confirmação aparece em seguida.
    const confirmed = new Promise<MyAttendance>((resolve, reject) => {
      const stop = watchMyAttendance(
        tavia.db,
        id,
        tavia.uid,
        (a) => a?.confirmedAt && (stop(), resolve(a)),
        reject,
      );
    });
    expect(await confirmAttendance(tavia.db, id, tavia.uid, null)).toEqual({ ok: true });
    expect((await confirmed).confirmedAt).toBeInstanceOf(Date);
    expect((await confirmed).character).toMatchObject({ game: 'retail', characterName: 'Tavia' });
    expect(await adminGet(`events/${id}/attendees/${tavia.uid}`)).not.toBeNull();
  });

  it('confirma com um personagem salvo da versão do jogo do evento', async () => {
    const admin = await firstAdmin();
    const tavia = await approvedMember(admin, 'Tavia');
    const brisa = await addCharacter(tavia, forever);
    const id = await newEvent(admin, 'forever');

    expect(await confirmAttendance(tavia.db, id, tavia.uid, brisa)).toEqual({ ok: true });
    expect(await mine(tavia, id)).toMatchObject({
      character: { game: 'forever', characterName: 'Brisa', characterSurname: 'Aurora' },
    });
  });

  it('não confirma com personagem de outra versão do jogo, nem inexistente', async () => {
    const admin = await firstAdmin();
    const tavia = await approvedMember(admin, 'Tavia');
    const brisa = await addCharacter(tavia, forever);
    const retail = await newEvent(admin, 'retail');
    const foreverEvent = await newEvent(admin, 'forever');

    expect(await confirmAttendance(tavia.db, retail, tavia.uid, brisa)).toEqual({
      ok: false,
      error: 'wrong-game',
    });
    // O principal (Retail) também não vale no evento do WoW Forever.
    expect(await confirmAttendance(tavia.db, foreverEvent, tavia.uid, null)).toEqual({
      ok: false,
      error: 'wrong-game',
    });
    expect(await confirmAttendance(tavia.db, retail, tavia.uid, 'nao-existe')).toEqual({
      ok: false,
      error: 'character-not-found',
    });
    expect(await adminGet(`events/${retail}/attendees/${tavia.uid}`)).toBeNull();
  });

  it('não confirma duas vezes', async () => {
    const admin = await firstAdmin();
    const tavia = await approvedMember(admin, 'Tavia');
    const id = await newEvent(admin);
    await confirmAttendance(tavia.db, id, tavia.uid, null);
    expect(await confirmAttendance(tavia.db, id, tavia.uid, null)).toEqual({
      ok: false,
      error: 'already-confirmed',
    });
  });

  it('não confirma em evento cancelado, passado ou inexistente', async () => {
    const admin = await firstAdmin();
    const tavia = await approvedMember(admin, 'Tavia');
    const cancelled = await newEvent(admin);
    await cancelEvent(admin.db, admin.uid, cancelled);
    expect(await confirmAttendance(tavia.db, cancelled, tavia.uid, null)).toEqual({
      ok: false,
      error: 'cancelled',
    });

    const past = await newEvent(admin);
    await adminPatch(`events/${past}`, { startsAt: new Date(Date.now() - 60_000) });
    expect(await confirmAttendance(tavia.db, past, tavia.uid, null)).toEqual({
      ok: false,
      error: 'past',
    });

    expect(await confirmAttendance(tavia.db, 'nao-existe', tavia.uid, null)).toEqual({
      ok: false,
      error: 'not-found',
    });
  });

  it('conta pendente não confirma', async () => {
    const admin = await firstAdmin();
    const id = await newEvent(admin);
    const kaelen = await register('Kaelen');
    expect(await confirmAttendance(kaelen.db, id, kaelen.uid, null)).toEqual({
      ok: false,
      error: 'not-allowed',
    });
  });

  it('ninguém confirma em nome de outra pessoa', async () => {
    const admin = await firstAdmin();
    const tavia = await approvedMember(admin, 'Tavia');
    const id = await newEvent(admin);
    expect(await confirmAttendance(admin.db, id, tavia.uid, null)).toEqual({
      ok: false,
      error: 'not-allowed',
    });
  });
});

describe('Cancelar presença (emuladores)', () => {
  it('remove a presença e permite confirmar de novo', async () => {
    const admin = await firstAdmin();
    const tavia = await approvedMember(admin, 'Tavia');
    const id = await newEvent(admin);
    await confirmAttendance(tavia.db, id, tavia.uid, null);

    expect(await cancelAttendance(tavia.db, id, tavia.uid)).toEqual({ ok: true });
    expect(await adminGet(`events/${id}/attendees/${tavia.uid}`)).toBeNull();

    expect(await confirmAttendance(tavia.db, id, tavia.uid, null)).toEqual({ ok: true });
    expect(await adminGet(`events/${id}/attendees/${tavia.uid}`)).not.toBeNull();
  });

  it('informa quando não havia presença confirmada', async () => {
    const admin = await firstAdmin();
    const tavia = await approvedMember(admin, 'Tavia');
    const id = await newEvent(admin);
    expect(await cancelAttendance(tavia.db, id, tavia.uid)).toEqual({
      ok: false,
      error: 'not-confirmed',
    });
  });

  it('não cancela depois que o evento começou ou foi cancelado', async () => {
    const admin = await firstAdmin();
    const tavia = await approvedMember(admin, 'Tavia');
    const past = await newEvent(admin);
    await confirmAttendance(tavia.db, past, tavia.uid, null);
    await adminPatch(`events/${past}`, { startsAt: new Date(Date.now() - 60_000) });
    expect(await cancelAttendance(tavia.db, past, tavia.uid)).toEqual({
      ok: false,
      error: 'past',
    });

    const cancelled = await newEvent(admin);
    await confirmAttendance(tavia.db, cancelled, tavia.uid, null);
    await cancelEvent(admin.db, admin.uid, cancelled);
    expect(await cancelAttendance(tavia.db, cancelled, tavia.uid)).toEqual({
      ok: false,
      error: 'cancelled',
    });
  });

  it('membro não cancela a presença de outra pessoa', async () => {
    const admin = await firstAdmin();
    const tavia = await approvedMember(admin, 'Tavia');
    const dorvan = await approvedMember(admin, 'Dorvan');
    const id = await newEvent(admin);
    await confirmAttendance(tavia.db, id, tavia.uid, null);
    expect(await cancelAttendance(dorvan.db, id, tavia.uid)).toEqual({
      ok: false,
      error: 'not-allowed',
    });
  });

  it('administrador cancela a presença de um membro, que pode confirmar de novo', async () => {
    const admin = await firstAdmin();
    const tavia = await approvedMember(admin, 'Tavia');
    const id = await newEvent(admin);
    await confirmAttendance(tavia.db, id, tavia.uid, null);
    expect(await cancelAttendance(admin.db, id, tavia.uid)).toEqual({ ok: true });
    expect(await adminGet(`events/${id}/attendees/${tavia.uid}`)).toBeNull();
    expect(await confirmAttendance(tavia.db, id, tavia.uid, null)).toEqual({ ok: true });
  });
});

describe('Ver presenças confirmadas (emuladores)', () => {
  /** Espera a lista satisfazer a condição (listener ativo, como na página aberta). */
  const listUntil = (p: Person, id: string, done: (list: Attendee[]) => boolean) =>
    new Promise<Attendee[]>((resolve, reject) => {
      const stop = watchAttendees(
        p.db,
        id,
        (list) => done(list) && (stop(), resolve(list)),
        reject,
      );
    });

  it('admin vê os confirmados com o personagem escolhido, na ordem de confirmação', async () => {
    const admin = await firstAdmin();
    const tavia = await approvedMember(admin, 'Tavia');
    const dorvan = await approvedMember(admin, 'Dorvan');
    const kaelen = await approvedMember(admin, 'Kaelen');
    const alt = await addCharacter(kaelen, {
      game: 'retail',
      characterName: 'Kaelguerra',
      server: 'Azralon',
      characterClass: 'guerreiro',
      characterRole: 'tanque',
      professions: [],
      level: 70,
    });
    const id = await newEvent(admin);
    await confirmAttendance(dorvan.db, id, dorvan.uid, null);
    await confirmAttendance(tavia.db, id, tavia.uid, null);
    await confirmAttendance(kaelen.db, id, kaelen.uid, alt);

    const list = await listUntil(admin, id, (l) => l.length === 3);
    expect(list.map((a) => [a.username, a.character?.characterName ?? null])).toEqual([
      ['Dorvan', 'Dorvan'],
      ['Tavia', 'Tavia'],
      ['Kaelen', 'Kaelguerra'],
    ]);
    expect(list[2].character?.characterClass).toBe('guerreiro');
  });

  it('presença anterior à escolha do personagem mostra o principal atual', async () => {
    const admin = await firstAdmin();
    const tavia = await approvedMember(admin, 'Tavia');
    const id = await newEvent(admin);
    await adminPatch(`events/${id}/attendees/${tavia.uid}`, { confirmedAt: new Date() });
    const [attendee] = await listUntil(admin, id, (l) => l.length === 1);
    expect(attendee.character).toMatchObject({ characterName: 'Tavia' });
  });

  it('reflete cancelamentos e tira contas desativadas da lista', async () => {
    const admin = await firstAdmin();
    const tavia = await approvedMember(admin, 'Tavia');
    const dorvan = await approvedMember(admin, 'Dorvan');
    const id = await newEvent(admin);
    await confirmAttendance(dorvan.db, id, dorvan.uid, null);
    await confirmAttendance(tavia.db, id, tavia.uid, null);
    await listUntil(admin, id, (l) => l.length === 2);

    await cancelAttendance(tavia.db, id, tavia.uid);
    await deactivateMember(admin.db, dorvan.uid);
    expect(await listUntil(admin, id, (l) => l.length === 0)).toEqual([]);
  });

  it('membro não vê a lista de confirmados', async () => {
    const admin = await firstAdmin();
    const tavia = await approvedMember(admin, 'Tavia');
    const id = await newEvent(admin);
    const error = await new Promise<unknown>((resolve) => {
      watchAttendees(tavia.db, id, () => resolve(null), resolve);
    });
    expect((error as { code?: string })?.code).toBe('permission-denied');
  });
});
