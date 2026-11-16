// Textos e visão do backup do addon (prévia, relatório e histórico).
import { ACCOUNT_MESSAGES } from '../../../core/auth/messages';
import type {
  BackupReport,
  EventReport,
  PresenceItemReport,
  PreviewError,
} from '../../../core/data/addon-backup';
import type {
  BackupPlan,
  DataCount,
  EventAction,
  EventChanges,
  EventPlanItem,
} from '../../../core/data/addon-backup-plan';
import type { AppliedItem, ItemOutcome } from '../../../core/data/presence-import';
import type { PlanItem } from '../../../core/data/presence-import-plan';
import {
  dateTime,
  eventView,
  unixDate,
  type EventView,
} from '../events/presence-import/presence-view';

export const BACKUP_PREVIEW_ERRORS: Record<PreviewError, string> = {
  prefix: 'Isto não é uma string de backup do addon. Ela começa com "VDLB1:".',
  version: 'Esta versão da string de backup não é aceita pelo site. Atualize o addon.',
  encoding: 'A string está incompleta ou corrompida. Copie-a de novo no jogo.',
  compression: 'A string está incompleta ou corrompida. Copie-a de novo no jogo.',
  checksum: 'A string está incompleta ou corrompida. Copie-a de novo no jogo.',
  payload: 'O conteúdo da string é inválido. Gere o backup de novo no jogo.',
  'too-long': 'A string é grande demais para ser guardada. Fale com quem cuida do site.',
  'not-allowed': 'Somente administradores aplicam backups do addon.',
  network: ACCOUNT_MESSAGES.network,
  unknown: 'Não foi possível validar a string. Tente novamente.',
};

export const BACKUP_APPLY_ERRORS = {
  'not-allowed': 'Somente administradores aplicam backups do addon.',
  network: ACCOUNT_MESSAGES.network,
  unknown: 'Não foi possível aplicar o backup. Tente novamente.',
} as const;

const ACTION_LABELS: Record<EventAction, { preview: string; report: string; tone: Tone }> = {
  create: { preview: 'Criar', report: 'Criado', tone: 'success' },
  update: { preview: 'Alterar', report: 'Alterado', tone: 'success' },
  cancel: { preview: 'Cancelar', report: 'Cancelado', tone: 'success' },
  delete: { preview: 'Excluir', report: 'Excluído', tone: 'success' },
  unchanged: { preview: 'Sem mudança', report: 'Sem mudança', tone: 'info' },
  conflict: { preview: 'Conflito', report: 'Conflito', tone: 'warning' },
  refused: { preview: 'Recusado', report: 'Não aplicado', tone: 'danger' },
  ignored: { preview: 'Ignorado', report: 'Ignorado', tone: 'info' },
};

const REASONS: Record<string, string> = {
  past: 'O evento já começou ou o novo horário já passou.',
  cancelled: 'O evento foi cancelado no site e não pode mais ser alterado.',
  'not-forever': 'O evento não é do WoW Forever.',
  invalid: 'Título, organizador, descrição ou limite de vagas fora do que o site aceita.',
  'invalid-id': 'O ID do evento não está no formato do addon (20 letras e dígitos).',
  'max-below-count': 'O limite de vagas ficaria abaixo das presenças já confirmadas.',
  deleted: 'Evento excluído no site; a alteração do jogo foi ignorada.',
  'cancelled-new': 'O evento foi criado e cancelado no jogo antes de chegar ao site.',
  'already-deleted': 'O evento excluído no jogo já não existe no site.',
  'not-allowed': 'Sem permissão para alterar este evento.',
  error: 'Não foi possível aplicar. Tente aplicar o backup de novo.',
};

const FIELD_LABELS: Record<keyof EventChanges, string> = {
  title: 'título',
  startsAt: 'horário',
  description: 'descrição',
  organizer: 'organizador',
  maxAttendees: 'limite de vagas',
  guestsAllowed: 'visitantes',
};

type Tone = 'success' | 'warning' | 'info' | 'danger';

export interface EventLineView {
  key: string;
  title: string;
  when: string;
  label: string;
  tone: Tone;
  origin: string;
  /** Motivo, campos alterados ou explicação do conflito. */
  detail: string | null;
}

export interface DataCountView {
  label: string;
  text: string;
}

/** Tudo o que a prévia, o relatório e o histórico mostram de um backup. */
export interface BackupView {
  events: EventLineView[];
  presences: EventView[];
  /** Eventos de presença ignorados (passados, cancelados, desconhecidos). */
  ignoredPresences: EventView[];
  counts: DataCountView[];
}

function eventLine(
  e: Pick<EventReport, 'id' | 'origin' | 'title' | 'startsAt' | 'changedBy' | 'updatedAt'> & {
    /** Situação no jogo (relatórios antigos não têm). */
    status?: string;
  },
  action: EventAction,
  reason: string | null,
  changed: string[],
  report: boolean,
): EventLineView {
  const deletion = e.status === 'excluido';
  // Já excluído no site: informativo, não é aviso.
  const label =
    reason === 'already-deleted'
      ? { preview: 'Já excluído', report: 'Já excluído', tone: 'info' as const }
      : ACTION_LABELS[action];
  let detail: string | null = reason ? (REASONS[reason] ?? reason) : null;
  if (action === 'conflict') {
    detail = deletion
      ? 'O evento está ativo no site ou foi alterado no site depois da exclusão no jogo. Vale o site.'
      : 'O evento foi alterado no site depois desta alteração do jogo. Vale o site.';
  } else if (action === 'update' && changed.length) {
    detail = `${report ? 'Mudou' : 'Muda'}: ${changed
      .map((f) => FIELD_LABELS[f as keyof EventChanges] ?? f)
      .join(', ')}.`;
  }
  return {
    key: e.id,
    title: e.title || `Evento ${e.id}`,
    when: dateTime(unixDate(e.startsAt)),
    label: report ? label.report : label.preview,
    tone: label.tone,
    origin:
      `${deletion ? 'Excluído' : e.origin === 'jogo' ? 'Criado' : 'Alterado'} no jogo` +
      `${e.changedBy ? ` por ${e.changedBy}` : ''} em ${dateTime(unixDate(e.updatedAt))}`,
    detail,
  };
}

const planReason = (item: EventPlanItem) =>
  item.action === 'refused' || item.action === 'ignored' ? item.reason : null;

const fromBackupEvent = (item: EventPlanItem) => ({
  id: item.backup.id,
  origin: item.backup.origin,
  status: item.backup.status,
  title: item.backup.title,
  startsAt: item.backup.startsAt,
  changedBy: item.backup.changedBy,
  updatedAt: item.backup.updatedAt,
});

/** Item do relatório guardado no formato da importação de presenças, para a mesma exibição. */
function appliedItem(i: PresenceItemReport): AppliedItem {
  const outcome: ItemOutcome =
    i.result === 'refused'
      ? { result: 'refused', reason: (i.reason ?? 'error') as never }
      : { result: i.result };
  return {
    character: i.character,
    status: i.status,
    updatedAt: i.updatedAt,
    action: i.action,
    username: i.username ?? '',
    reason: i.reason,
    ...(i.detail ? { detail: i.detail } : {}),
    outcome,
  } as unknown as AppliedItem;
}

function counts(data: { professions: DataCount; itemLevels: DataCount; together: DataCount }) {
  const text = (c: DataCount) =>
    `${c.total} ${c.total === 1 ? 'personagem' : 'personagens'}` +
    (c.total
      ? `, ${c.newer} ${c.newer === 1 ? 'mais recente' : 'mais recentes'} que o guardado`
      : '');
  return [
    { label: 'Profissões', text: text(data.professions) },
    { label: 'Item level e main', text: text(data.itemLevels) },
    { label: 'Tempo jogado junto', text: text(data.together) },
  ];
}

function split(views: EventView[]) {
  return {
    presences: views.filter((v) => !v.ignored),
    ignoredPresences: views.filter((v) => v.ignored),
  };
}

export function planView(plan: BackupPlan): BackupView {
  return {
    events: plan.events.map((item) =>
      eventLine(
        fromBackupEvent(item),
        item.action,
        planReason(item),
        item.action === 'update' ? item.changed : [],
        false,
      ),
    ),
    ...split(
      plan.presences.map((e) =>
        eventView(e, e.event?.title ?? null, e.event?.startsAt ?? null, e.items as PlanItem[]),
      ),
    ),
    counts: counts(plan),
  };
}

export function reportView(report: BackupReport): BackupView {
  return {
    events: report.events.map((e) => eventLine(e, e.action, e.reason, e.changed, true)),
    ...split(
      report.presences.map((e) =>
        eventView(
          e,
          e.title,
          e.startsAt === null ? null : unixDate(e.startsAt),
          e.items.map(appliedItem),
        ),
      ),
    ),
    counts: counts(report),
  };
}
