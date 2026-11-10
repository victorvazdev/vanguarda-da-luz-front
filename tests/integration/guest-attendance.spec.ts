import { describe, expect, it } from 'vitest';
import { signUp } from '../../src/app/core/auth/sign-up';
import {
  cancelEvent,
  createEvent,
  deleteCancelledEvent,
  updateEvent,
  type EventInput,
} from '../../src/app/core/data/events';
import {
  confirmGuestAttendance,
  removeGuestAttendance,
  watchGuest,
  watchGuests,
  type Guest,
} from '../../src/app/core/data/guest-attendance';
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

const input = (over: Partial<EventInput> = {}): EventInput => ({
  title: 'Raid semanal',
  startsAt: new Date(Date.now() + 3 * 86_400_000),
  description: '[DESCRIÇÃO DO EVENTO]',
  organizer: 'Maren',
  guestsAllowed: true,
  ...over,
});

async function newEvent(admin: Person, over: Partial<EventInput> = {}): Promise<string> {
  const r = await createEvent(admin.db, admin.uid, input(over));
  if (!r.ok) throw new Error(r.error);
  return r.id;
}

const lunara = {
  game: 'forever',
  characterName: 'lunara',
  characterSurname: ' SOMBRAVIVA ',
} as const;
const thalor = { game: 'retail', characterName: 'Thalor', realm: '  tol   barad ' } as const;

function firstGuests(admin: Person, eventId: string): Promise<Guest[]> {
  return new Promise((resolve, reject) => {
    const stop = watchGuests(admin.db, eventId, (list) => (stop(), resolve(list)), reject);
  });
}

describe('Visitantes confirmam presença (emuladores)', () => {
  it('visitante sem login confirma com o personagem, padronizado como no jogo', async () => {
    const admin = await firstAdmin();
    const id = await newEvent(admin);
    const visitor = client();

    expect(await confirmGuestAttendance(visitor.db, id, lunara)).toEqual({
      ok: true,
      id: 'forever:Lunara:Sombraviva',
    });
    expect(await confirmGuestAttendance(visitor.db, id, thalor)).toEqual({
      ok: true,
      id: 'retail:Thalor:Tol Barad',
    });
    expect(await adminGet(`events/${id}/guests/forever:Lunara:Sombraviva`)).toMatchObject({
      game: 'forever',
      characterName: 'Lunara',
      characterSurname: 'Sombraviva',
    });

    const guests = await firstGuests(admin, id);
    expect(guests.map((g) => g.id)).toEqual([
      'forever:Lunara:Sombraviva',
      'retail:Thalor:Tol Barad',
    ]);
  });

  it('o mesmo personagem não confirma duas vezes', async () => {
    const admin = await firstAdmin();
    const id = await newEvent(admin);
    const visitor = client();
    await confirmGuestAttendance(visitor.db, id, lunara);
    expect(
      await confirmGuestAttendance(client().db, id, {
        game: 'forever',
        characterName: 'LUNARA',
        characterSurname: 'sombraviva',
      }),
    ).toEqual({ ok: false, error: 'already-confirmed' });
  });

  it('conta pendente confirma como visitante', async () => {
    const admin = await firstAdmin();
    const id = await newEvent(admin);
    const kaelen = await register('Kaelen');
    expect((await confirmGuestAttendance(kaelen.db, id, thalor)).ok).toBe(true);
  });

  it('não confirma quando o administrador desativa a confirmação de visitantes', async () => {
    const admin = await firstAdmin();
    const id = await newEvent(admin, { guestsAllowed: false });
    expect(await confirmGuestAttendance(client().db, id, lunara)).toEqual({
      ok: false,
      error: 'guests-closed',
    });

    // Ligada de novo na edição: volta a aceitar.
    expect(await updateEvent(admin.db, admin.uid, id, input())).toEqual({ ok: true });
    expect((await confirmGuestAttendance(client().db, id, lunara)).ok).toBe(true);
  });

  it('não confirma em evento cancelado ou inexistente', async () => {
    const admin = await firstAdmin();
    const id = await newEvent(admin);
    await cancelEvent(admin.db, admin.uid, id);
    expect(await confirmGuestAttendance(client().db, id, lunara)).toEqual({
      ok: false,
      error: 'cancelled',
    });
    expect(await confirmGuestAttendance(client().db, 'nao-existe', lunara)).toEqual({
      ok: false,
      error: 'not-found',
    });
  });

  it('o visitante acompanha a própria confirmação; o administrador a cancela', async () => {
    const admin = await firstAdmin();
    const id = await newEvent(admin);
    const visitor = client();
    const confirmed = await confirmGuestAttendance(visitor.db, id, lunara);
    if (!confirmed.ok) throw new Error(confirmed.error);

    const seen: (string | null)[] = [];
    const gone = new Promise<void>((resolve, reject) => {
      const stop = watchGuest(
        visitor.db,
        id,
        confirmed.id,
        (g) => {
          seen.push(g ? g.characterName : null);
          if (!g) (stop(), resolve());
        },
        reject,
      );
    });
    // Visitante não cancela; o administrador cancela.
    expect(await removeGuestAttendance(visitor.db, id, confirmed.id)).toEqual({
      ok: false,
      error: 'not-allowed',
    });
    expect(await removeGuestAttendance(admin.db, id, confirmed.id)).toEqual({
      ok: true,
      id: confirmed.id,
    });
    await gone;
    expect(seen).toEqual(['Lunara', null]);
    // Pode confirmar de novo.
    expect((await confirmGuestAttendance(visitor.db, id, lunara)).ok).toBe(true);
  });

  it('excluir o evento cancelado apaga também as presenças de visitantes', async () => {
    const admin = await firstAdmin();
    const id = await newEvent(admin);
    await confirmGuestAttendance(client().db, id, lunara);
    await cancelEvent(admin.db, admin.uid, id);
    expect(await deleteCancelledEvent(admin.db, id)).toEqual({ ok: true });
    expect(await adminGet(`events/${id}`)).toBeNull();
    expect(await adminGet(`events/${id}/guests/forever:Lunara:Sombraviva`)).toBeNull();
  });
});
