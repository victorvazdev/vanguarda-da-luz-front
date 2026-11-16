// Prévia da aplicação de um backup do addon (string VDLB1), sem dependências (nem Angular, nem
// Firebase): recebe o backup decodificado e o estado atual do site e diz o que vai mudar. A
// aplicação no Firestore fica em addon-backup.ts, que revalida cada item.
// Testado em addon-backup-plan.spec.ts.
//
// Regras decididas com a guilda (docs/formato-string-backup.md e a história "Aplicar backup do
// addon" em docs/criterios-de-aceite.md):
// - evento criado no jogo e inexistente no site: criado com o ID da string (padrões de vagas e
//   visitantes quando vierem sem valor); se chegar já cancelado, é ignorado;
// - evento do site que não existe mais (excluído): ignorado;
// - evento existente: vale a alteração mais recente. Se a do jogo não for mais nova que a última
//   alteração no site, é conflito e vale o site (ou "sem mudança", se já estiver igual);
// - continuam valendo as regras de edição e cancelamento do site;
// - presenças: as regras da importação da VDLP1 (presence-import-plan.ts), já com os eventos
//   como ficam depois do backup;
// - profissões, item level, main e tempo junto não mudam nada no site: são guardados.
import type { AddonBackup, BackupEvent } from './addon-backup-format';
import {
  DEFAULT_MAX_ATTENDEES,
  EVENT_LIMITS,
  MAX_ATTENDEES_RANGE,
  type EventStatus,
} from './events';
import {
  planPresenceImport,
  type EventPlan as PresenceEventPlan,
  type SiteEvent,
  type SiteEventState,
  type SiteState,
} from './presence-import-plan';

/** Evento do site, com a última alteração (criação, edição ou cancelamento). */
export interface BackupSiteEvent extends SiteEvent {
  description: string;
  organizer: string;
  lastChangedAt: Date;
  /** `'addon'` nos eventos criados por um backup do addon. */
  source?: string | null;
}

/** Backup já guardado no histórico. */
export interface StoredBackupInfo {
  id: string;
  generatedAt: number;
  appliedAt: Date | null;
}

/** Estado combinado guardado (para saber o que o backup acrescenta). */
export interface CombinedCharacters {
  professions: Map<string, number>;
  itemLevels: Map<string, number>;
  together: Map<string, number>;
}

export interface BackupSiteState {
  /** Estado de cada evento citado no backup (eventos e presenças); ausente = não existe. */
  events: Map<string, SiteEventState & { event: BackupSiteEvent }>;
  characters: SiteState['characters'];
  /** O backup mais novo do histórico (`null` se nenhum). */
  latest: StoredBackupInfo | null;
  /** Este mesmo backup, se já estiver no histórico. */
  same: StoredBackupInfo | null;
  combined: CombinedCharacters;
}

export type EventRefusal =
  /** Já começou (ou o novo horário já passou). */
  | 'past'
  /** Foi cancelado no site e não muda mais. */
  | 'cancelled'
  /** Não é do WoW Forever. */
  | 'not-forever'
  /** Título, organizador, descrição ou limite fora do aceito pelo site. */
  | 'invalid'
  /** ID fora do formato (20 letras e dígitos). */
  | 'invalid-id'
  /** Limite de vagas abaixo dos confirmados. */
  | 'max-below-count';

export type EventIgnored =
  /** Evento do site que não existe mais (excluído). */
  | 'deleted'
  /** Criado no jogo e cancelado antes de chegar ao site. */
  | 'cancelled-new'
  /** Excluído no jogo e que não existe no site (já excluído ou nunca aplicado). Sem aviso. */
  | 'already-deleted';

/** Campos do evento que o backup grava no site. */
export interface EventChanges {
  title: string;
  startsAt: Date;
  description: string;
  organizer: string;
  maxAttendees: number;
  guestsAllowed: boolean;
}

export type EventPlanItem = { backup: BackupEvent; current: BackupSiteEvent | null } & (
  | { action: 'create'; changes: EventChanges }
  | { action: 'update'; changes: EventChanges; changed: (keyof EventChanges)[] }
  | { action: 'cancel' }
  /** Excluir o evento cancelado (status `excluido` no jogo). */
  | { action: 'delete' }
  | { action: 'unchanged' }
  | { action: 'conflict' }
  | { action: 'refused'; reason: EventRefusal }
  | { action: 'ignored'; reason: EventIgnored }
);

export type EventAction = EventPlanItem['action'];

/** Quantos registros de cada tipo e quantos são mais novos que o estado guardado. */
export interface DataCount {
  total: number;
  newer: number;
}

export interface BackupPlan {
  backup: AddonBackup;
  events: EventPlanItem[];
  presences: PresenceEventPlan[];
  professions: DataCount;
  itemLevels: DataCount;
  together: DataCount;
  /** O backup não é mais novo que o último aplicado (aceito, com aviso). */
  older: StoredBackupInfo | null;
  /** O mesmo backup já foi aplicado (reaplicar não muda nada). */
  alreadyApplied: StoredBackupInfo | null;
}

/** IDs de evento gerados pelo addon (iguais aos IDs automáticos do Firestore). */
export const EVENT_ID_PATTERN = /^[A-Za-z0-9]{20}$/;

const seconds = (date: Date) => Math.floor(date.getTime() / 1000);
const unixDate = (s: number) => new Date(s * 1000);

/** Os campos do jogo respeitam os limites do site? (descrição vazia só em evento do addon) */
function validChanges(c: EventChanges, allowEmptyDescription: boolean): boolean {
  const filled = (v: string, max: number) => v.trim().length > 0 && v.length <= max;
  return (
    filled(c.title, EVENT_LIMITS.title) &&
    filled(c.organizer, EVENT_LIMITS.organizer) &&
    c.description.length <= EVENT_LIMITS.description &&
    (allowEmptyDescription || c.description.trim().length > 0) &&
    Number.isInteger(c.maxAttendees) &&
    c.maxAttendees >= MAX_ATTENDEES_RANGE.min &&
    c.maxAttendees <= MAX_ATTENDEES_RANGE.max
  );
}

/** Campos do backup (limpos como no formulário do site), com os do site quando vierem vazios. */
function changesFrom(e: BackupEvent, current: BackupSiteEvent | null): EventChanges {
  return {
    title: e.title.trim(),
    startsAt: unixDate(e.startsAt),
    description: e.description.trim(),
    organizer: e.organizer.trim(),
    maxAttendees: e.maxAttendees || current?.maxAttendees || DEFAULT_MAX_ATTENDEES,
    guestsAllowed: e.guestsAllowed ?? current?.guestsAllowed ?? true,
  };
}

function changedFields(c: EventChanges, current: BackupSiteEvent): (keyof EventChanges)[] {
  const fields: (keyof EventChanges)[] = [];
  if (c.title !== current.title) fields.push('title');
  if (seconds(c.startsAt) !== seconds(current.startsAt)) fields.push('startsAt');
  if (c.description !== current.description) fields.push('description');
  if (c.organizer !== current.organizer) fields.push('organizer');
  if (c.maxAttendees !== current.maxAttendees) fields.push('maxAttendees');
  if (c.guestsAllowed !== current.guestsAllowed) fields.push('guestsAllowed');
  return fields;
}

/** Evento criado no site pelo backup (o campo `source` marca a origem). */
export const isAddonCreated = (event: { source?: unknown }) => event.source === 'addon';

/** O que fazer com um evento do backup. Usado na prévia e de novo na aplicação. */
export function planEvent(
  e: BackupEvent,
  current: BackupSiteEvent | null,
  now: Date,
): EventPlanItem {
  const base = { backup: e, current };
  if (e.status === 'excluido') return planDeletion(e, current);
  if (!current) {
    if (e.origin === 'site') return { ...base, action: 'ignored', reason: 'deleted' };
    if (e.status === 'cancelado') return { ...base, action: 'ignored', reason: 'cancelled-new' };
    if (!EVENT_ID_PATTERN.test(e.id)) return { ...base, action: 'refused', reason: 'invalid-id' };
    const changes = changesFrom(e, null);
    if (!validChanges(changes, true)) return { ...base, action: 'refused', reason: 'invalid' };
    if (changes.startsAt.getTime() <= now.getTime()) {
      return { ...base, action: 'refused', reason: 'past' };
    }
    return { ...base, action: 'create', changes };
  }

  const changes = changesFrom(e, current);
  const changed = changedFields(changes, current);
  const sameStatus = (e.status as EventStatus) === current.status;
  // Já está como o jogo quer: nada a fazer (inclusive ao reaplicar o mesmo backup).
  if (sameStatus && (e.status === 'cancelado' || changed.length === 0)) {
    return { ...base, action: 'unchanged' };
  }
  if (e.updatedAt * 1000 <= current.lastChangedAt.getTime()) {
    return { ...base, action: 'conflict' };
  }
  if (current.game !== 'forever') return { ...base, action: 'refused', reason: 'not-forever' };
  if (current.status === 'cancelado') return { ...base, action: 'refused', reason: 'cancelled' };
  if (current.startsAt.getTime() <= now.getTime()) {
    return { ...base, action: 'refused', reason: 'past' };
  }
  if (e.status === 'cancelado') return { ...base, action: 'cancel' };

  if (!validChanges(changes, isAddonCreated(current))) {
    return { ...base, action: 'refused', reason: 'invalid' };
  }
  if (changed.includes('startsAt') && changes.startsAt.getTime() <= now.getTime()) {
    return { ...base, action: 'refused', reason: 'past' };
  }
  if (changed.includes('maxAttendees') && changes.maxAttendees < current.attendeeCount) {
    return { ...base, action: 'refused', reason: 'max-below-count' };
  }
  return { ...base, action: 'update', changes, changed };
}

/**
 * Evento cancelado e excluído no jogo: exclui o evento cancelado no site se a exclusão for mais
 * nova que a última alteração do site; ativo no site ou alteração do site mais nova é conflito.
 * O site não reativa nem edita eventos cancelados, então "ativo" quer dizer que o site não
 * chegou a cancelá-lo.
 */
function planDeletion(e: BackupEvent, current: BackupSiteEvent | null): EventPlanItem {
  const base = { backup: e, current };
  if (!current) return { ...base, action: 'ignored', reason: 'already-deleted' };
  if (current.status !== 'cancelado' || e.updatedAt * 1000 <= current.lastChangedAt.getTime()) {
    return { ...base, action: 'conflict' };
  }
  if (current.game !== 'forever') return { ...base, action: 'refused', reason: 'not-forever' };
  return { ...base, action: 'delete' };
}

/** Evento excluído pelo item (neste backup ou antes): as presenças dele são ignoradas. */
export const deletesEvent = (item: EventPlanItem) =>
  item.action === 'delete' || (item.action === 'ignored' && item.reason === 'already-deleted');

/** Evento como fica depois do item, para a prévia das presenças. */
function eventAfter(item: EventPlanItem): BackupSiteEvent | null {
  const { current } = item;
  switch (item.action) {
    case 'create':
      return {
        id: item.backup.id,
        game: 'forever',
        status: 'ativo',
        attendeeCount: 0,
        lastChangedAt: new Date(),
        source: 'addon',
        ...item.changes,
      };
    case 'update':
      return current && { ...current, ...item.changes };
    case 'cancel':
      return current && { ...current, status: 'cancelado' };
    case 'delete':
      return null;
    default:
      return current;
  }
}

function countNewer<T extends { character: string }>(
  list: T[],
  stored: Map<string, number>,
  value: (item: T) => number,
): DataCount {
  return {
    total: list.length,
    newer: list.filter((i) => value(i) > (stored.get(i.character) ?? -1)).length,
  };
}

/** Monta a prévia do backup. Não altera nada. */
export function planBackup(data: AddonBackup, site: BackupSiteState, now = new Date()): BackupPlan {
  const events = data.events.map((e) => planEvent(e, site.events.get(e.id)?.event ?? null, now));

  const deleted = new Set(events.filter(deletesEvent).map((i) => i.backup.id));

  // Presenças sobre o estado dos eventos depois do backup (criados entram sem confirmados).
  const presenceEvents = new Map<string, SiteEventState>();
  for (const [id, state] of site.events) presenceEvents.set(id, state);
  for (const item of events) {
    const after = eventAfter(item);
    if (!after) continue;
    const state = presenceEvents.get(item.backup.id);
    presenceEvents.set(item.backup.id, {
      event: after,
      attendees: state?.attendees ?? [],
      guests: state?.guests ?? [],
      cancellations: state?.cancellations ?? new Map(),
    });
  }
  const presences = planPresenceImport(
    {
      version: data.version,
      game: 'forever',
      generatedAt: data.generatedAt,
      exportNumber: data.exportNumber,
      events: data.attendance,
    },
    { lastGeneratedAt: null, characters: site.characters, events: presenceEvents },
    now,
  ).events.map((p) =>
    // Presenças de evento excluído (neste backup ou antes) são ignoradas, sem recriar nada.
    deleted.has(p.eventId) ? { ...p, event: null, ignored: 'deleted' as const, items: [] } : p,
  );

  const older =
    site.latest && site.latest.id !== site.same?.id && data.generatedAt <= site.latest.generatedAt
      ? site.latest
      : null;

  return {
    backup: data,
    events,
    presences,
    professions: countNewer(data.professions, site.combined.professions, (p) => p.updatedAt),
    itemLevels: countNewer(data.itemLevels, site.combined.itemLevels, (m) => m.updatedAt),
    together: countNewer(data.together, site.combined.together, (t) => t.seconds),
    older,
    alreadyApplied: site.same,
  };
}

/** Quantidade de eventos por ação (resumo da prévia e do relatório). */
export function countEventActions(items: { action: EventAction }[]): Record<EventAction, number> {
  const counts: Record<EventAction, number> = {
    create: 0,
    update: 0,
    cancel: 0,
    delete: 0,
    unchanged: 0,
    conflict: 0,
    refused: 0,
    ignored: 0,
  };
  for (const i of items) counts[i.action]++;
  return counts;
}
