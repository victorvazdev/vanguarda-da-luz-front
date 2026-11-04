import { describe, expect, it } from 'vitest';
import { signUp } from '../../src/app/core/auth/sign-up';
import { submitApplication } from '../../src/app/core/data/applications';
import {
  cancelEvent,
  createEvent,
  updateEvent,
  watchEventsFrom,
  type EventInput,
  type GuildEvent,
} from '../../src/app/core/data/events';
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
    motivation: 'Quero entrar.',
  });
  const result = await approveApplication(admin.db, admin.uid, m.uid);
  if (!result.ok) throw new Error(result.error);
  return m;
}

const DAY = 86_400_000;
const input = (over: Partial<EventInput> = {}): EventInput => ({
  title: '  Raid semanal ',
  startsAt: new Date(Date.now() + 3 * DAY),
  description: '[DESCRIÇÃO DO EVENTO]',
  organizer: 'Maren',
  ...over,
});

function firstSnapshot(p: Person, from = new Date()): Promise<GuildEvent[]> {
  return new Promise((resolve, reject) => {
    const stop = watchEventsFrom(p.db, from, (events) => (stop(), resolve(events)), reject);
  });
}

describe('Criar, editar e cancelar eventos (emuladores)', () => {
  it('evento criado pelo admin aparece para os membros, com textos aparados', async () => {
    const admin = await firstAdmin();
    const tavia = await approvedMember(admin, 'Tavia');
    const created = await createEvent(admin.db, admin.uid, input());
    expect(created.ok).toBe(true);

    const [event] = await firstSnapshot(tavia);
    expect(event).toMatchObject({
      title: 'Raid semanal',
      organizer: 'Maren',
      status: 'ativo',
    });
  });

  it('lista em ordem cronológica a partir da data pedida', async () => {
    const admin = await firstAdmin();
    await createEvent(
      admin.db,
      admin.uid,
      input({ title: 'Segundo', startsAt: new Date(Date.now() + 5 * DAY) }),
    );
    await createEvent(
      admin.db,
      admin.uid,
      input({ title: 'Primeiro', startsAt: new Date(Date.now() + 2 * DAY) }),
    );
    await createEvent(
      admin.db,
      admin.uid,
      input({ title: 'Distante', startsAt: new Date(Date.now() + 40 * DAY) }),
    );
    const events = await firstSnapshot(admin, new Date(Date.now() + DAY));
    expect(events.map((e) => e.title)).toEqual(['Primeiro', 'Segundo', 'Distante']);
  });

  it('recusa data e horário no passado', async () => {
    const admin = await firstAdmin();
    const result = await createEvent(
      admin.db,
      admin.uid,
      input({ startsAt: new Date(Date.now() - 60_000) }),
    );
    expect(result).toEqual({ ok: false, error: 'past' });
  });

  it('membro não cria eventos', async () => {
    const admin = await firstAdmin();
    const tavia = await approvedMember(admin, 'Tavia');
    expect(await createEvent(tavia.db, tavia.uid, input())).toEqual({
      ok: false,
      error: 'not-allowed',
    });
  });

  it('edição salva as alterações e mantém as presenças confirmadas', async () => {
    const admin = await firstAdmin();
    const tavia = await approvedMember(admin, 'Tavia');
    const created = await createEvent(admin.db, admin.uid, input());
    if (!created.ok) throw new Error(created.error);
    await adminPatch(`events/${created.id}/attendees/tavia`, { uid: 'tavia' });

    const newDate = new Date(Date.now() + 6 * DAY);
    const result = await updateEvent(admin.db, admin.uid, created.id, {
      title: 'Raid heroica',
      startsAt: newDate,
      description: 'Traga poções.',
      organizer: 'Dorvan',
    });
    expect(result).toEqual({ ok: true });

    // Um membro (outro navegador) vê a versão salva.
    const [event] = await firstSnapshot(tavia);
    expect(event).toMatchObject({ title: 'Raid heroica', organizer: 'Dorvan' });
    expect(event.startsAt.getTime()).toBe(newDate.getTime());
    expect(await adminGet(`events/${created.id}/attendees/tavia`)).not.toBeNull();
  });

  it('não move um evento para o passado', async () => {
    const admin = await firstAdmin();
    const created = await createEvent(admin.db, admin.uid, input());
    if (!created.ok) throw new Error(created.error);
    const result = await updateEvent(
      admin.db,
      admin.uid,
      created.id,
      input({ startsAt: new Date(Date.now() - DAY) }),
    );
    expect(result).toEqual({ ok: false, error: 'past' });
  });

  it('cancelamento mantém o evento, identificado como cancelado, e é definitivo', async () => {
    const admin = await firstAdmin();
    const tavia = await approvedMember(admin, 'Tavia');
    const created = await createEvent(admin.db, admin.uid, input());
    if (!created.ok) throw new Error(created.error);

    expect(await cancelEvent(admin.db, admin.uid, created.id)).toEqual({ ok: true });
    const [event] = await firstSnapshot(tavia);
    expect(event).toMatchObject({ id: created.id, status: 'cancelado' });
    expect((await adminGet(`events/${created.id}`))?.['cancelledBy']).toBe(admin.uid);

    expect(await cancelEvent(admin.db, admin.uid, created.id)).toEqual({
      ok: false,
      error: 'cancelled',
    });
    expect(await updateEvent(admin.db, admin.uid, created.id, input())).toEqual({
      ok: false,
      error: 'cancelled',
    });
  });

  it('membro não edita nem cancela', async () => {
    const admin = await firstAdmin();
    const tavia = await approvedMember(admin, 'Tavia');
    const created = await createEvent(admin.db, admin.uid, input());
    if (!created.ok) throw new Error(created.error);
    expect(await updateEvent(tavia.db, tavia.uid, created.id, input({ title: 'X' }))).toEqual({
      ok: false,
      error: 'not-allowed',
    });
    expect(await cancelEvent(tavia.db, tavia.uid, created.id)).toEqual({
      ok: false,
      error: 'not-allowed',
    });
  });
});
