import { describe, expect, it } from 'vitest';
import { signUp } from '../../src/app/core/auth/sign-up';
import {
  encodePresenceExport,
  type PresenceRecord,
} from '../../src/app/core/data/addon-presence-format';
import { submitApplication } from '../../src/app/core/data/applications';
import { cancelAttendance } from '../../src/app/core/data/attendance';
import { saveCharacter, type CharacterInput } from '../../src/app/core/data/characters';
import { createEvent, deleteCancelledEvent, cancelEvent } from '../../src/app/core/data/events';
import {
  confirmGuestAttendance,
  removeGuestAttendance,
} from '../../src/app/core/data/guest-attendance';
import {
  applyPresenceImport,
  previewPresenceImport,
  type ImportReport,
} from '../../src/app/core/data/presence-import';
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

/** Membro aprovado com o personagem principal do WoW Forever vindo da candidatura. */
async function foreverMember(
  admin: Person,
  username: string,
  characterName: string,
  characterSurname: string,
): Promise<Person> {
  const m = await register(username);
  await submitApplication(m.db, m.uid, {
    game: 'forever',
    characterName,
    characterSurname,
    ruleset: 'normal',
    characterClass: 'druida',
    characterRole: 'cura',
    professions: [],
    battleTag: 'Jogador#1234',
    motivation: 'Quero entrar.',
  });
  const result = await approveApplication(admin.db, admin.uid, m.uid);
  if (!result.ok) throw new Error(result.error);
  return m;
}

const character = (characterName: string, characterSurname: string): CharacterInput => ({
  game: 'forever',
  characterName,
  characterSurname,
  ruleset: 'jxj',
  characterClass: 'guerreiro',
  characterRole: 'tanque',
  professions: [],
  level: 60,
});

async function addCharacter(p: Person, input: CharacterInput): Promise<string> {
  const r = await saveCharacter(p.db, p.uid, null, input, false);
  if (!r.ok) throw new Error(r.error);
  return r.id;
}

async function newEvent(
  admin: Person,
  over: { game?: 'retail' | 'forever'; maxAttendees?: number; guestsAllowed?: boolean } = {},
): Promise<string> {
  const r = await createEvent(admin.db, admin.uid, {
    title: 'Raid semanal',
    game: over.game ?? 'forever',
    startsAt: new Date(Date.now() + 3 * 86_400_000),
    description: '[DESCRIÇÃO DO EVENTO]',
    organizer: 'Maren',
    guestsAllowed: over.guestsAllowed ?? true,
    maxAttendees: over.maxAttendees ?? 40,
  });
  if (!r.ok) throw new Error(r.error);
  return r.id;
}

const now = () => Math.floor(Date.now() / 1000);
let generated = now();

/** String VDLP1 nova (cada chamada é mais nova que a anterior). */
function presenceString(events: Record<string, PresenceRecord[]>, generatedAt = ++generated) {
  return encodePresenceExport({
    version: 1,
    game: 'forever',
    generatedAt,
    exportNumber: 0,
    events: Object.entries(events).map(([id, records]) => ({ id, records })),
  });
}

const rec = (character: string, status: 0 | 1 = 1, updatedAt = now()): PresenceRecord => ({
  character,
  status,
  updatedAt,
});

/** Prévia e aplicação, como a tela faz. */
async function importString(admin: Person, text: string): Promise<ImportReport> {
  const preview = await previewPresenceImport(admin.db, text);
  if (!preview.ok) throw new Error(preview.error);
  const result = await applyPresenceImport(admin.db, preview.plan, admin.uid);
  if (!result.ok) throw new Error(result.error);
  return result.report;
}

/** `personagem → resultado` de um evento do relatório. */
const outcomes = (report: ImportReport, eventId: string) =>
  Object.fromEntries(
    report.events
      .find((e) => e.eventId === eventId)!
      .items.map((i) => [
        i.character,
        i.outcome.result === 'refused' ? i.outcome.reason : `${i.outcome.result}:${i.action}`,
      ]),
  );

const count = async (eventId: string) =>
  Number((await adminGet(`events/${eventId}`))!['attendeeCount'] ?? 0);

describe('Importar presenças do addon (emuladores)', () => {
  it('confirma membros (pelo personagem) e visitantes, com a origem addon', async () => {
    const admin = await firstAdmin();
    const victor = await foreverMember(admin, 'Victor', 'Victor', 'Vaz');
    const tavia = await foreverMember(admin, 'Tavia', 'Lunara', 'Sombraviva');
    const alt = await addCharacter(tavia, character('Brisa', 'Aurora'));
    const id = await newEvent(admin);
    const gameTime = now() - 600;

    const report = await importString(
      admin,
      await presenceString({
        [id]: [rec('victor vaz', 1, gameTime), rec('Brisa Aurora'), rec('Árya Ñúñez')],
      }),
    );

    expect(outcomes(report, id)).toEqual({
      'victor vaz': 'applied:confirm-member',
      'Brisa Aurora': 'applied:confirm-member',
      'Árya Ñúñez': 'applied:confirm-guest',
    });
    expect(report.recorded).toBe(true);
    // Principal vindo da candidatura (sem documento próprio).
    const victorPresence = await adminGet(`events/${id}/attendees/${victor.uid}`);
    expect(victorPresence).toMatchObject({ source: 'addon', importedBy: admin.uid });
    expect(victorPresence!['characterId']).toBeUndefined();
    expect(Date.parse(String(victorPresence!['addonUpdatedAt']))).toBe(gameTime * 1000);
    expect(await adminGet(`events/${id}/attendees/${tavia.uid}`)).toMatchObject({
      characterId: alt,
      source: 'addon',
    });
    expect(await adminGet(`events/${id}/guests/forever:Árya:Ñúñez`)).toMatchObject({
      characterName: 'Árya',
      characterSurname: 'Ñúñez',
      source: 'addon',
    });
    expect(await count(id)).toBe(3);
    expect(await adminGet('config/presenceImport')).toMatchObject({ importedBy: admin.uid });
  });

  it('cancela no site quem cancelou no jogo, com o registro do cancelamento', async () => {
    const admin = await firstAdmin();
    const victor = await foreverMember(admin, 'Victor', 'Victor', 'Vaz');
    const id = await newEvent(admin);
    await importString(
      admin,
      await presenceString({ [id]: [rec('Victor Vaz'), rec('Árya Ñúñez')] }),
    );

    const later = now() + 60;
    const report = await importString(
      admin,
      await presenceString({ [id]: [rec('Victor Vaz', 0, later), rec('Árya Ñúñez', 0, later)] }),
    );

    expect(outcomes(report, id)).toEqual({
      'Victor Vaz': 'applied:cancel-member',
      'Árya Ñúñez': 'applied:cancel-guest',
    });
    expect(await adminGet(`events/${id}/attendees/${victor.uid}`)).toBeNull();
    expect(await adminGet(`events/${id}/guests/forever:Árya:Ñúñez`)).toBeNull();
    expect(await adminGet(`events/${id}/cancellations/attendees:${victor.uid}`)).toMatchObject({
      source: 'addon',
      kind: 'attendees',
    });
    expect(await count(id)).toBe(0);

    // Excluir o evento cancelado também apaga o registro de cancelamentos.
    await cancelEvent(admin.db, admin.uid, id);
    expect(await deleteCancelledEvent(admin.db, id)).toEqual({ ok: true });
    expect(await adminGet(`events/${id}/cancellations/attendees:${victor.uid}`)).toBeNull();
  });

  it('não desfaz uma alteração feita no site depois da resposta do jogo', async () => {
    const admin = await firstAdmin();
    const victor = await foreverMember(admin, 'Victor', 'Victor', 'Vaz');
    const id = await newEvent(admin);
    const before = now() - 600;
    await importString(admin, await presenceString({ [id]: [rec('Victor Vaz', 1, before)] }));

    // O membro cancela no site; o registro do cancelamento fica gravado.
    expect(await cancelAttendance(victor.db, id, victor.uid)).toEqual({ ok: true });
    expect(await adminGet(`events/${id}/cancellations/attendees:${victor.uid}`)).not.toBeNull();

    // Uma string nova com a mesma confirmação antiga do jogo não refaz a presença...
    let report = await importString(
      admin,
      await presenceString({ [id]: [rec('Victor Vaz', 1, before)] }),
    );
    expect(outcomes(report, id)).toEqual({ 'Victor Vaz': 'stale' });
    expect(await adminGet(`events/${id}/attendees/${victor.uid}`)).toBeNull();

    // ...mas uma confirmação feita no jogo depois do cancelamento, sim.
    report = await importString(
      admin,
      await presenceString({ [id]: [rec('Victor Vaz', 1, now() + 60)] }),
    );
    expect(outcomes(report, id)).toEqual({ 'Victor Vaz': 'applied:confirm-member' });
  });

  it('o administrador que cancela um visitante no site também registra o cancelamento', async () => {
    const admin = await firstAdmin();
    const id = await newEvent(admin);
    const visitor = client();
    const guest = { game: 'forever', characterName: 'Árya', characterSurname: 'Ñúñez' } as const;
    expect(await confirmGuestAttendance(visitor.db, id, guest)).toMatchObject({ ok: true });
    expect(await removeGuestAttendance(admin.db, id, 'forever:Árya:Ñúñez')).toMatchObject({
      ok: true,
    });
    const report = await importString(
      admin,
      await presenceString({ [id]: [rec('Árya Ñúñez', 1, now() - 600)] }),
    );
    expect(outcomes(report, id)).toEqual({ 'Árya Ñúñez': 'stale' });
  });

  it('recusa strings que não são mais novas que a última importada', async () => {
    const admin = await firstAdmin();
    const id = await newEvent(admin);
    const generatedAt = now() + 10_000;
    await importString(admin, await presenceString({ [id]: [rec('Árya Ñúñez')] }, generatedAt));

    const preview = await previewPresenceImport(
      admin.db,
      await presenceString({ [id]: [rec('Dorvan Pedra')] }, generatedAt),
    );
    expect(preview.ok && preview.plan.outdated).toBe(true);
    if (!preview.ok) return;
    expect(await applyPresenceImport(admin.db, preview.plan, admin.uid)).toEqual({
      ok: false,
      error: 'outdated',
    });
    expect(await adminGet(`events/${id}/guests/forever:Dorvan:Pedra`)).toBeNull();
  });

  it('respeita o limite de vagas e a duplicidade com as presenças do site', async () => {
    const admin = await firstAdmin();
    await foreverMember(admin, 'Victor', 'Victor', 'Vaz');
    const id = await newEvent(admin, { maxAttendees: 2 });
    const visitor = client();
    // Alguém confirmou no site como visitante com o personagem de um membro.
    await confirmGuestAttendance(visitor.db, id, {
      game: 'forever',
      characterName: 'Victor',
      characterSurname: 'Vaz',
    });

    const report = await importString(
      admin,
      await presenceString({
        [id]: [rec('Victor Vaz'), rec('Árya Ñúñez', 1, now()), rec('Dorvan Pedra', 1, now() + 1)],
      }),
    );
    expect(outcomes(report, id)).toEqual({
      'Victor Vaz': 'duplicate-guest',
      'Árya Ñúñez': 'applied:confirm-guest',
      'Dorvan Pedra': 'full',
    });
    expect(await count(id)).toBe(2);
  });

  it('confirma visitantes do jogo mesmo com a confirmação de visitantes do site desligada', async () => {
    const admin = await firstAdmin();
    const id = await newEvent(admin, { guestsAllowed: false });
    const report = await importString(
      admin,
      await presenceString({ [id]: [rec('Árya Ñúñez', 1, now())] }),
    );
    expect(outcomes(report, id)).toEqual({ 'Árya Ñúñez': 'applied:confirm-guest' });
    expect(await count(id)).toBe(1);
  });

  it('revalida na aplicação o que mudou depois da prévia', async () => {
    const admin = await firstAdmin();
    const id = await newEvent(admin, { maxAttendees: 1 });
    const preview = await previewPresenceImport(
      admin.db,
      await presenceString({ [id]: [rec('Árya Ñúñez')] }),
    );
    if (!preview.ok) throw new Error(preview.error);
    // Um visitante ocupa a única vaga entre a prévia e a confirmação.
    await confirmGuestAttendance(client().db, id, {
      game: 'forever',
      characterName: 'Dorvan',
      characterSurname: 'Pedra',
    });
    const result = await applyPresenceImport(admin.db, preview.plan, admin.uid);
    expect(result.ok && outcomes(result.report, id)).toEqual({ 'Árya Ñúñez': 'full' });
    expect(await count(id)).toBe(1);
  });

  it('não passa do limite com confirmações simultâneas no site', async () => {
    const admin = await firstAdmin();
    const id = await newEvent(admin, { maxAttendees: 3 });
    const names = ['Alfa', 'Bravo', 'Charlie', 'Delta'];
    const text = await presenceString({ [id]: names.map((n) => rec(`${n} Jogo`)) });
    const visitors = names.map((n) =>
      confirmGuestAttendance(client().db, id, {
        game: 'forever',
        characterName: n,
        characterSurname: 'Site',
      }),
    );
    await Promise.all([importString(admin, text), ...visitors]);

    const total = await count(id);
    expect(total).toBe(3);
  });

  it('ignora eventos desconhecidos, cancelados e que não são do WoW Forever', async () => {
    const admin = await firstAdmin();
    const retail = await newEvent(admin, { game: 'retail' });
    const cancelled = await newEvent(admin);
    await cancelEvent(admin.db, admin.uid, cancelled);
    const report = await importString(
      admin,
      await presenceString({
        [retail]: [rec('Árya Ñúñez')],
        [cancelled]: [rec('Árya Ñúñez')],
        naoexiste: [rec('Árya Ñúñez')],
      }),
    );
    expect(Object.fromEntries(report.events.map((e) => [e.eventId, e.ignored]))).toEqual({
      [retail]: 'not-forever',
      [cancelled]: 'cancelled',
      naoexiste: 'unknown',
    });
    expect(await count(retail)).toBe(0);
  });

  it('somente administradores importam', async () => {
    const admin = await firstAdmin();
    const victor = await foreverMember(admin, 'Victor', 'Victor', 'Vaz');
    const id = await newEvent(admin);
    const text = await presenceString({ [id]: [rec('Árya Ñúñez')] });
    expect(await previewPresenceImport(victor.db, text)).toEqual({
      ok: false,
      error: 'not-allowed',
    });
    const preview = await previewPresenceImport(admin.db, text);
    if (!preview.ok) throw new Error(preview.error);
    const result = await applyPresenceImport(victor.db, preview.plan, victor.uid);
    expect(result.ok).toBe(false);
    expect(await adminGet(`events/${id}/guests/forever:Árya:Ñúñez`)).toBeNull();
  });
});
