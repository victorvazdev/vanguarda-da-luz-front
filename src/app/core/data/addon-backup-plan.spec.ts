import type { AddonBackup, BackupEvent } from './addon-backup-format';
import {
  countEventActions,
  planBackup,
  planEvent,
  type BackupSiteEvent,
  type BackupSiteState,
} from './addon-backup-plan';
import type { SiteEventState } from './presence-import-plan';

const NOW = new Date('2026-11-12T12:00:00Z');
const s = (iso: string) => Date.parse(iso) / 1000;
const GAME = s('2026-11-11T20:00:00Z');
const FUTURE = s('2026-11-20T23:00:00Z');
const ID = 'G7cQx2LmP9aRt4VbN1sK';

const gameEvent = (over: Partial<BackupEvent> = {}): BackupEvent => ({
  id: ID,
  origin: 'jogo',
  title: 'Treino de PvP',
  startsAt: FUTURE,
  description: 'Ponto de encontro em Altaforja.',
  organizer: 'Victor Vaz',
  status: 'ativo',
  updatedAt: GAME,
  maxAttendees: 25,
  guestsAllowed: false,
  changedBy: 'Victor Vaz',
  ...over,
});

const siteEvent = (over: Partial<BackupSiteEvent> = {}): BackupSiteEvent => ({
  id: ID,
  title: 'Treino de PvP',
  startsAt: new Date(FUTURE * 1000),
  description: 'Ponto de encontro em Altaforja.',
  organizer: 'Victor Vaz',
  status: 'ativo',
  game: 'forever',
  guestsAllowed: false,
  maxAttendees: 25,
  attendeeCount: 0,
  lastChangedAt: new Date((GAME - 3600) * 1000),
  source: null,
  ...over,
});

const state = (event: BackupSiteEvent): SiteEventState & { event: BackupSiteEvent } => ({
  event,
  attendees: [],
  guests: [],
  cancellations: new Map(),
});

const backup = (over: Partial<AddonBackup> = {}): AddonBackup => ({
  version: 1,
  game: 'forever',
  generatedAt: GAME + 3600,
  exportNumber: 0,
  generatedBy: 'Victor Vaz',
  events: [],
  attendance: [],
  professions: [],
  itemLevels: [],
  together: [],
  ...over,
});

const site = (over: Partial<BackupSiteState> = {}): BackupSiteState => ({
  events: new Map(),
  characters: [],
  latest: null,
  same: null,
  combined: { professions: new Map(), itemLevels: new Map(), together: new Map() },
  ...over,
});

describe('Eventos criados no jogo', () => {
  it('cria com o ID e os campos da string', () => {
    const item = planEvent(gameEvent(), null, NOW);
    expect(item.action).toBe('create');
    if (item.action !== 'create') return;
    expect(item.changes).toEqual({
      title: 'Treino de PvP',
      startsAt: new Date(FUTURE * 1000),
      description: 'Ponto de encontro em Altaforja.',
      organizer: 'Victor Vaz',
      maxAttendees: 25,
      guestsAllowed: false,
    });
  });

  it('usa 40 vagas e visitantes aceitos quando vierem sem valor', () => {
    const item = planEvent(gameEvent({ maxAttendees: 0, guestsAllowed: null }), null, NOW);
    expect(item.action === 'create' && item.changes).toMatchObject({
      maxAttendees: 40,
      guestsAllowed: true,
    });
  });

  it('aceita descrição vazia', () => {
    expect(planEvent(gameEvent({ description: '  ' }), null, NOW).action).toBe('create');
  });

  it('ignora o evento que chega já cancelado e nunca existiu no site', () => {
    expect(planEvent(gameEvent({ status: 'cancelado' }), null, NOW)).toMatchObject({
      action: 'ignored',
      reason: 'cancelled-new',
    });
  });

  it('recusa data já passada, ID fora do formato e campos fora dos limites', () => {
    const refused = (e: Partial<BackupEvent>) => {
      const item = planEvent(gameEvent(e), null, NOW);
      return item.action === 'refused' ? item.reason : item.action;
    };
    expect(refused({ startsAt: s('2026-11-12T11:00:00Z') })).toBe('past');
    expect(refused({ id: 'curto' })).toBe('invalid-id');
    expect(refused({ id: 'G7cQx2LmP9aRt4VbN1s!' })).toBe('invalid-id');
    expect(refused({ title: ' ' })).toBe('invalid');
    expect(refused({ title: 'x'.repeat(81) })).toBe('invalid');
    expect(refused({ organizer: 'x'.repeat(41) })).toBe('invalid');
    expect(refused({ description: 'x'.repeat(2001) })).toBe('invalid');
    expect(refused({ maxAttendees: 501 })).toBe('invalid');
  });
});

describe('Eventos que já existem no site', () => {
  const edit = (over: Partial<BackupEvent> = {}) =>
    gameEvent({ origin: 'site', title: 'Treino de PvP (novo horário)', ...over });

  it('aplica a alteração mais nova que a última do site', () => {
    const item = planEvent(edit(), siteEvent(), NOW);
    expect(item.action).toBe('update');
    expect(item.action === 'update' && item.changed).toEqual(['title']);
  });

  it('mostra conflito quando o site mudou depois (vale o site)', () => {
    const current = siteEvent({ lastChangedAt: new Date((GAME + 60) * 1000) });
    expect(planEvent(edit(), current, NOW).action).toBe('conflict');
    // Mesmo horário também é conflito: a alteração do jogo não é mais nova.
    const same = siteEvent({ lastChangedAt: new Date(GAME * 1000) });
    expect(planEvent(edit(), same, NOW).action).toBe('conflict');
  });

  it('não muda nada quando o site já está igual (reaplicar o mesmo backup)', () => {
    const created = siteEvent({ lastChangedAt: new Date((GAME + 60) * 1000), source: 'addon' });
    expect(planEvent(gameEvent(), created, NOW).action).toBe('unchanged');
    const cancelled = siteEvent({ status: 'cancelado' });
    expect(planEvent(gameEvent({ status: 'cancelado' }), cancelled, NOW).action).toBe('unchanged');
  });

  it('mantém vagas e visitantes do site quando vierem sem valor', () => {
    const current = siteEvent({ maxAttendees: 60, guestsAllowed: true });
    const item = planEvent(edit({ maxAttendees: 0, guestsAllowed: null }), current, NOW);
    expect(item.action === 'update' && item.changes).toMatchObject({
      maxAttendees: 60,
      guestsAllowed: true,
    });
  });

  it('cancela um evento ativo que ainda não começou', () => {
    expect(planEvent(gameEvent({ status: 'cancelado' }), siteEvent(), NOW).action).toBe('cancel');
  });

  it('segue as regras de edição do site', () => {
    const refused = (e: BackupEvent, current: BackupSiteEvent) => {
      const item = planEvent(e, current, NOW);
      return item.action === 'refused' ? item.reason : item.action;
    };
    expect(refused(edit(), siteEvent({ status: 'cancelado' }))).toBe('cancelled');
    expect(refused(edit(), siteEvent({ startsAt: new Date('2026-11-12T11:00:00Z') }))).toBe('past');
    expect(refused(edit({ startsAt: s('2026-11-12T11:00:00Z') }), siteEvent())).toBe('past');
    expect(refused(edit(), siteEvent({ game: 'retail' }))).toBe('not-forever');
    expect(refused(edit({ maxAttendees: 10 }), siteEvent({ attendeeCount: 12 }))).toBe(
      'max-below-count',
    );
    // Sem mudar o limite, o evento já acima do limite pode ser editado.
    expect(
      refused(edit({ maxAttendees: 0 }), siteEvent({ maxAttendees: 10, attendeeCount: 12 })),
    ).toBe('update');
  });

  it('descrição vazia só em eventos criados pelo addon', () => {
    expect(planEvent(edit({ description: '' }), siteEvent(), NOW)).toMatchObject({
      action: 'refused',
      reason: 'invalid',
    });
    expect(planEvent(edit({ description: '' }), siteEvent({ source: 'addon' }), NOW).action).toBe(
      'update',
    );
  });

  it('ignora o evento do site que foi excluído', () => {
    expect(planEvent(edit(), null, NOW)).toMatchObject({ action: 'ignored', reason: 'deleted' });
  });
});

describe('Prévia do backup', () => {
  it('aplica as presenças de um evento criado neste backup', () => {
    const plan = planBackup(
      backup({
        events: [gameEvent({ guestsAllowed: true })],
        attendance: [
          { id: ID, records: [{ character: 'Árya Ñúñez', status: 1, updatedAt: GAME }] },
        ],
      }),
      site(),
      NOW,
    );
    expect(plan.events[0].action).toBe('create');
    expect(plan.presences[0].ignored).toBeNull();
    expect(plan.presences[0].items[0]).toMatchObject({
      action: 'confirm-guest',
      guestId: 'forever:Árya:Ñúñez',
    });
  });

  it('usa o evento como fica depois do backup (visitantes fechados, cancelado)', () => {
    const presence = {
      id: ID,
      records: [{ character: 'Árya Ñúñez', status: 1 as const, updatedAt: GAME }],
    };
    const closed = planBackup(
      backup({ events: [gameEvent()], attendance: [presence] }),
      site(),
      NOW,
    );
    expect(closed.presences[0].items[0]).toMatchObject({
      action: 'refused',
      reason: 'guests-closed',
    });

    const cancelled = planBackup(
      backup({ events: [gameEvent({ status: 'cancelado' })], attendance: [presence] }),
      site({ events: new Map([[ID, state(siteEvent({ guestsAllowed: true }))]]) }),
      NOW,
    );
    expect(cancelled.events[0].action).toBe('cancel');
    expect(cancelled.presences[0].ignored).toBe('cancelled');
  });

  it('ignora presenças de eventos desconhecidos ou passados', () => {
    const plan = planBackup(
      backup({
        attendance: [
          { id: 'sumiu', records: [{ character: 'Maren Luz', status: 1, updatedAt: GAME }] },
          { id: ID, records: [{ character: 'Maren Luz', status: 1, updatedAt: GAME }] },
        ],
      }),
      site({
        events: new Map([[ID, state(siteEvent({ startsAt: new Date('2026-11-01T00:00:00Z') }))]]),
      }),
      NOW,
    );
    expect(plan.presences.map((p) => p.ignored)).toEqual(['unknown', 'past']);
  });

  it('avisa quando o backup não é mais novo que o último aplicado', () => {
    const latest = { id: 'outro', generatedAt: GAME + 7200, appliedAt: NOW };
    expect(planBackup(backup(), site({ latest }), NOW).older).toEqual(latest);
    expect(
      planBackup(backup({ generatedAt: GAME + 9000 }), site({ latest }), NOW).older,
    ).toBeNull();
  });

  it('avisa quando o mesmo backup já foi aplicado (sem aviso de mais antigo)', () => {
    const same = { id: 'este', generatedAt: GAME + 3600, appliedAt: NOW };
    const plan = planBackup(backup(), site({ latest: same, same }), NOW);
    expect(plan.alreadyApplied).toEqual(same);
    expect(plan.older).toBeNull();
  });

  it('conta profissões, item levels e tempos, e quantos são mais novos que os guardados', () => {
    const plan = planBackup(
      backup({
        professions: [
          { character: 'Maren Luz', updatedAt: 10, professions: [] },
          { character: 'Victor Vaz', updatedAt: 10, professions: [] },
        ],
        itemLevels: [{ character: 'Maren Luz', updatedAt: 5, itemLevel: 20, main: '' }],
        together: [
          { character: 'Maren Luz', seconds: 100 },
          { character: 'Victor Vaz', seconds: 50 },
        ],
      }),
      site({
        combined: {
          professions: new Map([['Maren Luz', 10]]),
          itemLevels: new Map([['Maren Luz', 4]]),
          together: new Map([['Victor Vaz', 60]]),
        },
      }),
      NOW,
    );
    expect(plan.professions).toEqual({ total: 2, newer: 1 });
    expect(plan.itemLevels).toEqual({ total: 1, newer: 1 });
    expect(plan.together).toEqual({ total: 2, newer: 1 });
  });

  it('resume as ações dos eventos', () => {
    const plan = planBackup(
      backup({
        events: [
          gameEvent(),
          gameEvent({ id: 'pL5wE1dN7sA3gF6hJ0Ko', origin: 'site' }),
          gameEvent({ id: 'Hq2mB8xY4nRcT0vKs9Ue', status: 'cancelado' }),
        ],
      }),
      site(),
      NOW,
    );
    expect(countEventActions(plan.events)).toMatchObject({ create: 1, ignored: 2 });
  });
});
