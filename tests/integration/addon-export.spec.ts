import { describe, expect, it } from 'vitest';
import { signUp } from '../../src/app/core/auth/sign-up';
import { generateAddonExport } from '../../src/app/core/data/addon-export';
import { decodeAddonExport } from '../../src/app/core/data/addon-format';
import { cancelEvent, createEvent, type EventInput } from '../../src/app/core/data/events';
import { adminPatch, useEmulators, type Client } from './emulators';

const client = useEmulators();

type Person = Client & { uid: string };

async function firstAdmin(): Promise<Person> {
  const c = client();
  const result = await signUp(c.auth, c.db, {
    username: 'Maren',
    email: 'maren@example.com',
    password: 'segredo123',
  });
  if (!result.ok) throw new Error(result.error);
  await adminPatch(`users/${result.uid}`, { status: 'ativo', role: 'admin' });
  await adminPatch('config/admins', { activeAdminUids: [result.uid] });
  return { ...c, uid: result.uid };
}

const DAY = 86_400_000;
const input = (over: Partial<EventInput> = {}): EventInput => ({
  title: 'Raid semanal',
  game: 'forever',
  startsAt: new Date(Date.now() + 3 * DAY),
  description: 'Traga poções.',
  organizer: 'Maren',
  guestsAllowed: true,
  maxAttendees: 40,
  ...over,
});

async function newEvent(admin: Person, over: Partial<EventInput> = {}): Promise<string> {
  const r = await createEvent(admin.db, admin.uid, input(over));
  if (!r.ok) throw new Error(r.error);
  return r.id;
}

describe('Exportação para o addon (emuladores)', () => {
  it('exporta ativos e cancelados do WoW Forever dentro da janela, sem dados de contas', async () => {
    const admin = await firstAdmin();
    const raid = await newEvent(admin, { title: 'Raid: Núcleo' });
    const cancelled = await newEvent(admin, {
      title: 'Masmorras',
      startsAt: new Date(Date.now() + 5 * DAY),
    });
    await cancelEvent(admin.db, admin.uid, cancelled);
    await newEvent(admin, { title: 'Raid do Retail', game: 'retail' });
    await newEvent(admin, { title: 'Muito depois', startsAt: new Date(Date.now() + 90 * DAY) });
    // Evento que já começou hoje continua na exportação (gravado como pelo console).
    await adminPatch('events/comecou-hoje', {
      title: 'Começou agora',
      game: 'forever',
      startsAt: new Date(Date.now() - 60_000),
      description: 'Em andamento.',
      organizer: 'Maren',
      status: 'ativo',
    });

    const now = new Date();
    const result = await generateAddonExport(admin.db, 'forever', 60, now);
    if (!result.ok) throw new Error('esperava sucesso');
    // "Começou agora" só entra se hoje (em Brasília) ainda for o dia em que ele começou.
    const startedToday = Date.now() - 60_000 >= result.window.from.getTime();
    expect(result.count).toBe(startedToday ? 3 : 2);

    const decoded = await decodeAddonExport(result.text);
    expect(decoded.game).toBe('forever');
    expect(decoded.exportNumber).toBe(Math.floor(now.getTime() / 1000));
    const byTitle = Object.fromEntries(decoded.events.map((e) => [e.title, e]));
    expect(Object.keys(byTitle).sort()).toEqual(
      (startedToday ? ['Começou agora'] : []).concat(['Masmorras', 'Raid: Núcleo']).sort(),
    );
    expect(byTitle['Raid: Núcleo']).toMatchObject({ id: raid, status: 'ativo' });
    expect(byTitle['Masmorras']).toMatchObject({ id: cancelled, status: 'cancelado' });
    // A última alteração do cancelado é o cancelamento.
    expect(byTitle['Masmorras'].updatedAt).toBeGreaterThanOrEqual(
      byTitle['Raid: Núcleo'].updatedAt,
    );
    // Nada de contas: nem o uid de quem criou, nem e-mail.
    expect(JSON.stringify(decoded)).not.toContain(admin.uid);
    expect(JSON.stringify(decoded)).not.toContain('@');
  });

  it('a janela de dias é respeitada', async () => {
    const admin = await firstAdmin();
    await newEvent(admin, { startsAt: new Date(Date.now() + 3 * DAY) });
    await newEvent(admin, { startsAt: new Date(Date.now() + 20 * DAY) });
    const short = await generateAddonExport(admin.db, 'forever', 10);
    const long = await generateAddonExport(admin.db, 'forever', 30);
    expect(short.ok && short.count).toBe(1);
    expect(long.ok && long.count).toBe(2);
  });
});
