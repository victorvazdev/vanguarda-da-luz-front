// Backup do addon (string VDLB1) contra os emuladores: criação de evento com o ID do jogo,
// edição e cancelamento com as regras do site, conflito, presenças de evento recém-criado,
// histórico, estado combinado, reaplicação e restauração.
import { describe, expect, it } from 'vitest';
import { signUp } from '../../src/app/core/auth/sign-up';
import {
  applyAddonBackup,
  generateRestoreString,
  listBackups,
  previewAddonBackup,
  readCharacterState,
  recordAddonExport,
  type ApplyResult,
} from '../../src/app/core/data/addon-backup';
import {
  decodeAddonBackup,
  encodeAddonBackup,
  type AddonBackup,
  type BackupEvent,
} from '../../src/app/core/data/addon-backup-format';
import { submitApplication } from '../../src/app/core/data/applications';
import {
  cancelEvent,
  createEvent,
  deleteCancelledEvent,
  updateEvent,
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

async function foreverMember(admin: Person, username: string, name: string, surname: string) {
  const m = await register(username);
  await submitApplication(m.db, m.uid, {
    game: 'forever',
    characterName: name,
    characterSurname: surname,
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

const DAY = 86_400;
const now = () => Math.floor(Date.now() / 1000);
const ID = 'G7cQx2LmP9aRt4VbN1sK';

const siteInput = (over: { maxAttendees?: number } = {}) => ({
  title: 'Encontro da guilda',
  game: 'forever' as const,
  startsAt: new Date((now() + 5 * DAY) * 1000),
  description: 'Conversa sobre a próxima temporada.',
  organizer: 'Tavia',
  guestsAllowed: true,
  maxAttendees: over.maxAttendees ?? 40,
});

async function siteEvent(admin: Person, over: { maxAttendees?: number } = {}): Promise<string> {
  const r = await createEvent(admin.db, admin.uid, siteInput(over));
  if (!r.ok) throw new Error(r.error);
  return r.id;
}

const gameEvent = (over: Partial<BackupEvent> = {}): BackupEvent => ({
  id: ID,
  origin: 'jogo',
  title: 'Treino de PvP',
  startsAt: now() + 3 * DAY,
  description: '',
  organizer: 'Victor Vaz',
  status: 'ativo',
  updatedAt: now() - 60,
  maxAttendees: 25,
  guestsAllowed: true,
  changedBy: 'Victor Vaz',
  ...over,
});

let generated = now();
const backupOf = (over: Partial<AddonBackup> = {}): AddonBackup => ({
  version: 1,
  game: 'forever',
  generatedAt: ++generated,
  exportNumber: 0,
  generatedBy: 'Victor Vaz',
  events: [],
  attendance: [],
  professions: [],
  itemLevels: [],
  together: [],
  ...over,
});

/** Prévia e aplicação, como a tela faz. */
async function applyText(admin: Person, text: string) {
  const preview = await previewAddonBackup(admin.db, text);
  if (!preview.ok) throw new Error(preview.error);
  const result = await applyAddonBackup(admin.db, preview.plan, preview.text, admin.uid, 'Maren');
  if (!result.ok) throw new Error(result.error);
  return { plan: preview.plan, ...(result as Extract<ApplyResult, { ok: true }>) };
}

const apply = async (admin: Person, data: AddonBackup) =>
  applyText(admin, await encodeAddonBackup(data));

const actions = (report: { events: { id: string; action: string; reason: string | null }[] }) =>
  Object.fromEntries(
    report.events.map((e) => [e.id, e.reason ? `${e.action}:${e.reason}` : e.action]),
  );

describe('Backup do addon: eventos', () => {
  it('cria o evento com o ID gerado no jogo e as presenças dele', async () => {
    const admin = await firstAdmin();
    const { report, recorded } = await apply(
      admin,
      backupOf({
        events: [gameEvent()],
        attendance: [
          { id: ID, records: [{ character: 'Árya Ñúñez', status: 1, updatedAt: now() - 30 }] },
        ],
      }),
    );
    expect(actions(report)).toEqual({ [ID]: 'create' });
    expect(recorded).toBe('new');
    const event = await adminGet(`events/${ID}`);
    expect(event).toMatchObject({
      title: 'Treino de PvP',
      game: 'forever',
      description: '',
      source: 'addon',
      createdBy: admin.uid,
      maxAttendees: '25',
      guestsAllowed: true,
      attendeeCount: '1',
    });
    expect(await adminGet(`events/${ID}/guests/forever:Árya:Ñúñez`)).not.toBeNull();
    expect(report.presences[0].items[0]).toMatchObject({ result: 'applied' });
  });

  it('aplica edições e cancelamentos mais novos, e mostra conflito com o site', async () => {
    const admin = await firstAdmin();
    const edited = await siteEvent(admin);
    const cancelled = await siteEvent(admin);
    const conflict = await siteEvent(admin);
    const gone = 'pL5wE1dN7sA3gF6hJ0Ko';
    const later = now() + 120;
    const { report } = await apply(
      admin,
      backupOf({
        events: [
          gameEvent({
            id: edited,
            origin: 'site',
            title: 'Encontro (novo título)',
            description: 'Nova descrição.',
            startsAt: now() + 5 * DAY,
            maxAttendees: 0,
            guestsAllowed: null,
            updatedAt: later,
          }),
          gameEvent({ id: cancelled, origin: 'site', status: 'cancelado', updatedAt: later }),
          // O site mudou depois desta alteração do jogo.
          gameEvent({ id: conflict, origin: 'site', title: 'Velho', updatedAt: now() - DAY }),
          gameEvent({ id: gone, origin: 'site', updatedAt: later }),
          gameEvent({ id: 'Hq2mB8xY4nRcT0vKs9Ue', status: 'cancelado' }),
        ],
      }),
    );
    expect(actions(report)).toEqual({
      [edited]: 'update',
      [cancelled]: 'cancel',
      [conflict]: 'conflict',
      [gone]: 'ignored:deleted',
      Hq2mB8xY4nRcT0vKs9Ue: 'ignored:cancelled-new',
    });
    expect(await adminGet(`events/${edited}`)).toMatchObject({
      title: 'Encontro (novo título)',
      maxAttendees: '40',
      guestsAllowed: true,
      updatedBy: admin.uid,
    });
    expect(await adminGet(`events/${cancelled}`)).toMatchObject({ status: 'cancelado' });
    expect(await adminGet(`events/${conflict}`)).toMatchObject({ title: 'Encontro da guilda' });
    expect(await adminGet(`events/${gone}`)).toBeNull();
  });

  it('não recria um evento do site excluído e aplica o resto do backup', async () => {
    const admin = await firstAdmin();
    const member = await foreverMember(admin, 'Tavia', 'Lunara', 'Sombraviva');
    const edited = await siteEvent(admin);
    // Editado no jogo e, depois, cancelado e excluído no site.
    const deleted = await siteEvent(admin);
    expect(await cancelEvent(admin.db, admin.uid, deleted)).toEqual({ ok: true });
    expect(await deleteCancelledEvent(admin.db, deleted)).toEqual({ ok: true });
    const later = now() + 120;

    const { report, recorded } = await apply(
      admin,
      backupOf({
        events: [
          gameEvent(),
          gameEvent({
            id: deleted,
            origin: 'site',
            title: 'Alterado no jogo antes da exclusão',
            description: 'Nova descrição.',
            maxAttendees: 0,
            guestsAllowed: null,
            updatedAt: now() - 600,
          }),
          gameEvent({
            id: edited,
            origin: 'site',
            title: 'Encontro (novo título)',
            description: 'Nova descrição.',
            startsAt: now() + 5 * DAY,
            maxAttendees: 0,
            guestsAllowed: null,
            updatedAt: later,
          }),
        ],
        attendance: [
          { id: ID, records: [{ character: 'Árya Ñúñez', status: 1, updatedAt: now() }] },
          {
            id: deleted,
            records: [{ character: 'Lunara Sombraviva', status: 1, updatedAt: now() }],
          },
          {
            id: edited,
            records: [{ character: 'Lunara Sombraviva', status: 1, updatedAt: now() }],
          },
        ],
      }),
    );

    expect(actions(report)).toEqual({
      [ID]: 'create',
      [deleted]: 'ignored:deleted',
      [edited]: 'update',
    });
    expect(recorded).toBe('new');
    // O evento excluído não volta, nem pelas presenças.
    expect(await adminGet(`events/${deleted}`)).toBeNull();
    expect(await adminGet(`events/${deleted}/attendees/${member.uid}`)).toBeNull();
    const presence = (eventId: string) => report.presences.find((p) => p.eventId === eventId)!;
    expect(presence(deleted)).toMatchObject({ ignored: 'unknown', items: [] });
    // Os demais eventos e presenças foram aplicados.
    expect(await adminGet(`events/${ID}/guests/forever:Árya:Ñúñez`)).not.toBeNull();
    expect(await adminGet(`events/${edited}`)).toMatchObject({ title: 'Encontro (novo título)' });
    expect(await adminGet(`events/${edited}/attendees/${member.uid}`)).not.toBeNull();
    // O aviso fica no histórico.
    const [stored] = await listBackups(admin.db);
    expect(stored.report.events.find((e) => e.id === deleted)).toMatchObject({
      action: 'ignored',
      reason: 'deleted',
    });
  });

  it('não baixa o limite de vagas abaixo dos confirmados', async () => {
    const admin = await firstAdmin();
    const id = await siteEvent(admin);
    await apply(
      admin,
      backupOf({
        events: [],
        attendance: [
          {
            id,
            records: [
              { character: 'Aaa Bbb', status: 1, updatedAt: now() },
              { character: 'Ccc Ddd', status: 1, updatedAt: now() },
            ],
          },
        ],
      }),
    );
    // Evento do site não recebe limite do jogo; simulamos um criado no jogo, com limite.
    await adminPatch(`events/${id}`, { source: 'addon' });
    const { report } = await apply(
      admin,
      backupOf({
        events: [gameEvent({ id, origin: 'jogo', maxAttendees: 1, updatedAt: now() + 300 })],
      }),
    );
    expect(actions(report)).toEqual({ [id]: 'refused:max-below-count' });
    // O formulário do site segue a mesma regra.
    const r = await updateEvent(admin.db, admin.uid, id, { ...siteInput(), maxAttendees: 1 });
    expect(r).toEqual({ ok: false, error: 'max-below-count' });
  });
});

describe('Backup do addon: histórico, estado e restauração', () => {
  const data = () =>
    backupOf({
      professions: [
        {
          character: 'Victor Vaz',
          updatedAt: 100,
          professions: [{ id: 186, level: 230, max: 300, name: 'Mineração' }],
        },
      ],
      itemLevels: [
        { character: 'Victor Vaz', updatedAt: 100, itemLevel: 31, main: 'Victor Vaz' },
        { character: 'Victor Alt', updatedAt: 100, itemLevel: 12, main: 'Victor Vaz' },
      ],
      together: [{ character: 'Árya Ñúñez', seconds: 5400 }],
    });

  it('guarda o backup e o estado combinado; reaplicar não muda nada', async () => {
    const admin = await firstAdmin();
    const member = await foreverMember(admin, 'Tavia', 'Lunara', 'Sombraviva');
    const event = await siteEvent(admin);
    const backup = data();
    backup.attendance = [
      { id: event, records: [{ character: 'Lunara Sombraviva', status: 1, updatedAt: now() }] },
    ];
    const text = await encodeAddonBackup(backup);

    const first = await applyText(admin, text);
    expect(first.recorded).toBe('new');
    expect(first.report.presences[0].items[0]).toMatchObject({
      action: 'confirm-member',
      result: 'applied',
    });
    expect(await adminGet(`events/${event}/attendees/${member.uid}`)).not.toBeNull();

    const second = await applyText(admin, text);
    expect(second.plan.alreadyApplied).not.toBeNull();
    expect(second.recorded).toBe('existing');
    expect(second.report.presences[0].items[0]).toMatchObject({ result: 'unchanged' });

    const history = await listBackups(admin.db);
    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({
      text,
      generatedBy: 'Victor Vaz',
      appliedBy: admin.uid,
      appliedByName: 'Maren',
    });
    expect(history[0].report.presences).toHaveLength(1);

    const state = await readCharacterState(admin.db);
    expect(state.professions['Victor Vaz'].professions[0].name).toBe('Mineração');
    expect(state.together).toEqual({ 'Árya Ñúñez': 5400 });
  });

  it('aceita um backup mais antigo, com aviso, sem perder dados mais novos', async () => {
    const admin = await firstAdmin();
    const newer = data();
    await apply(admin, newer);
    const older = backupOf({
      generatedAt: newer.generatedAt - 10,
      itemLevels: [{ character: 'Victor Vaz', updatedAt: 50, itemLevel: 20, main: 'Victor Vaz' }],
      together: [{ character: 'Maren Luz', seconds: 60 }],
    });
    const { plan, recorded } = await apply(admin, older);
    expect(plan.older?.generatedAt).toBe(newer.generatedAt);
    expect(recorded).toBe('new');
    const state = await readCharacterState(admin.db);
    expect(state.itemLevels['Victor Vaz'].itemLevel).toBe(31);
    expect(state.together).toEqual({ 'Árya Ñúñez': 5400, 'Maren Luz': 60 });
    expect(await listBackups(admin.db)).toHaveLength(2);
  });

  it('gera a string de restauração a partir do estado combinado, sem eventos', async () => {
    const admin = await firstAdmin();
    const recent = await siteEvent(admin);
    const backup = data();
    backup.events = [gameEvent()];
    backup.attendance = [
      { id: recent, records: [{ character: 'Maren Luz', status: 1, updatedAt: now() }] },
      // Evento que o site não conhece: só entra com as presenças antigas.
      { id: 'antigo', records: [{ character: 'Maren Luz', status: 0, updatedAt: now() - DAY }] },
    ];
    await apply(admin, backup);
    expect(await recordAddonExport(admin.db, 1794409200, admin.uid)).toBe(true);

    const restore = await generateRestoreString(admin.db, false);
    const decoded = await decodeAddonBackup(restore.text);
    expect(decoded).toMatchObject({ exportNumber: 1794409200, generatedBy: '', events: [] });
    expect(decoded.attendance.map((a) => a.id)).toEqual([recent]);
    expect(decoded.itemLevels).toHaveLength(2);
    expect(restore).toMatchObject({ characters: 3, presenceEvents: 1, tooLong: false });

    const all = await decodeAddonBackup((await generateRestoreString(admin.db, true)).text);
    expect(all.attendance.map((a) => a.id).sort()).toEqual(['antigo', recent].sort());
  });

  it('membros não aplicam backups', async () => {
    const admin = await firstAdmin();
    const member = await foreverMember(admin, 'Tavia', 'Lunara', 'Sombraviva');
    const result = await previewAddonBackup(member.db, await encodeAddonBackup(data()));
    expect(result).toEqual({ ok: false, error: 'not-allowed' });
  });
});
