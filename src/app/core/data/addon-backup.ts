// Backup do addon (string VDLB1), sem dependência do Angular. Somente administradores.
// Testado contra os emuladores (tests/integration/addon-backup.spec.ts).
//
// Fluxo:
// - `previewAddonBackup` decodifica a string, lê o estado do site e monta a prévia
//   (addon-backup-plan.ts);
// - `applyAddonBackup` aplica cada evento numa transação própria, que relê e revalida tudo
//   (criação com o ID da string, conferindo que ele ainda não existe), depois as presenças (as
//   mesmas transações da importação da VDLP1), junta as presenças e os dados dos personagens ao
//   estado combinado e guarda o backup no histórico;
// - `generateRestoreString` monta, a partir do estado combinado, a string de restauração.
//
// Coleções (só administradores leem e gravam; ver firestore.rules):
// - `addonBackups/{generatedAt}-{checksum}`: string original, cabeçalho, quem aplicou e quando,
//   e o relatório. O ID fixo faz a reaplicação do mesmo backup não criar outro registro;
// - `addonState/characters`: profissões, item level e main, e tempo junto de cada personagem;
// - `addonPresences/{eventId}`: presenças conhecidas pelo addon, por personagem (separadas por
//   evento porque crescem sem parar e não caberiam num documento só);
// - `config/addonExport`: a última string VDL1 do WoW Forever gerada (o `exportNumber`).
import { FirebaseError } from 'firebase/app';
import {
  Timestamp,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  where,
  type DocumentData,
  type Firestore,
} from 'firebase/firestore';
import { ADDON_MAX_LENGTH, AddonDecodeFailure, type AddonDecodeError } from './addon-format';
import { decodeAddonBackup, encodeAddonBackup, type AddonBackup } from './addon-backup-format';
import {
  planBackup,
  planEvent,
  type BackupPlan,
  type BackupSiteEvent,
  type BackupSiteState,
  type DataCount,
  type EventAction,
  type EventPlanItem,
  type StoredBackupInfo,
} from './addon-backup-plan';
import {
  emptyCharacterState,
  mergeCharacters,
  mergePresences,
  restoreBackup,
  type CharacterState,
  type PresenceRecords,
} from './addon-backup-state';
import { toDate } from './applications';
import { deleteCancelledEvent, eventFromData } from './events';
import {
  errorCode,
  loadEventState,
  loadMemberCharacters,
  runPresenceItem,
  type ItemOutcome,
} from './presence-import';
import type { EventIgnoredReason, PlanItem } from './presence-import-plan';

export const ADDON_BACKUPS = 'addonBackups';
export const ADDON_STATE_PATH = 'addonState/characters';
export const ADDON_PRESENCES = 'addonPresences';
export const ADDON_EXPORT_PATH = 'config/addonExport';

/** Tamanho máximo da string guardada (igual a firestore.rules; o documento tem até 1 MiB). */
export const BACKUP_MAX_LENGTH = 500_000;
/** Presenças incluídas por padrão na restauração: eventos a partir de tantos dias atrás. */
export const RESTORE_RECENT_DAYS = 30;
/** Documentos de presença por transação ao juntar ao estado combinado. */
const PRESENCE_CHUNK = 100;

// ---------- Relatório (guardado no histórico) ----------

/** Resultado de um evento. `reason`: motivo da recusa ou de ser ignorado. */
export interface EventReport {
  id: string;
  origin: 'jogo' | 'site';
  /** Situação no jogo: `ativo`, `cancelado` ou `excluido` (relatórios antigos não têm). */
  status?: string;
  title: string;
  /** Início pedido pelo jogo, em segundos Unix. */
  startsAt: number;
  changedBy: string;
  /** Horário da alteração no jogo, em segundos Unix. */
  updatedAt: number;
  action: EventAction;
  reason: string | null;
  /** Campos alterados (só em `update`). */
  changed: string[];
}

export interface PresenceItemReport {
  character: string;
  status: 0 | 1;
  updatedAt: number;
  action: PlanItem['action'];
  /** Nome de usuário do membro, quando houver. */
  username: string | null;
  result: ItemOutcome['result'];
  reason: string | null;
  /** Nomes envolvidos numa recusa, quando houver. */
  detail: string | null;
}

export interface PresenceEventReport {
  eventId: string;
  title: string | null;
  /** Início do evento no site, em segundos Unix (`null` se não existe). */
  startsAt: number | null;
  ignored: EventIgnoredReason | null;
  items: PresenceItemReport[];
}

export interface BackupReport {
  events: EventReport[];
  presences: PresenceEventReport[];
  professions: DataCount;
  itemLevels: DataCount;
  together: DataCount;
}

export interface StoredBackup {
  id: string;
  text: string;
  generatedAt: number;
  exportNumber: number;
  generatedBy: string;
  appliedAt: Date | null;
  appliedBy: string;
  appliedByName: string;
  report: BackupReport;
}

export type PreviewError = AddonDecodeError | 'too-long' | 'not-allowed' | 'network' | 'unknown';
export type PreviewResult =
  { ok: true; plan: BackupPlan; text: string } | { ok: false; error: PreviewError };

export type ApplyResult =
  | { ok: true; report: BackupReport; recorded: 'new' | 'existing' | 'failed' }
  | { ok: false; error: 'not-allowed' | 'network' | 'unknown' };

/** ID do backup no histórico: horário de geração e checksum da string. */
export function backupId(text: string, generatedAt: number): string {
  const checksum = /^VDLB\d+:(\d+):/.exec(text.trim())?.[1] ?? '0';
  return `${generatedAt}-${checksum}`;
}

const seconds = (date: Date) => Math.floor(date.getTime() / 1000);

// ---------- Leitura do estado do site ----------

/** Última alteração do evento no site: criação, edição ou cancelamento (igual à VDL1). */
export function lastChangedAt(data: DocumentData): Date {
  const times = [data['createdAt'], data['updatedAt'], data['cancelledAt']]
    .map(toDate)
    .filter((d): d is Date => d !== null)
    .map((d) => d.getTime());
  return new Date(times.length ? Math.max(...times) : 0);
}

export function backupSiteEvent(id: string, data: DocumentData): BackupSiteEvent {
  const event = eventFromData(id, data);
  return {
    ...event,
    lastChangedAt: lastChangedAt(data),
    source: typeof data['source'] === 'string' ? data['source'] : null,
  };
}

function storedInfo(id: string, data: DocumentData): StoredBackupInfo {
  return {
    id,
    generatedAt: typeof data['generatedAt'] === 'number' ? data['generatedAt'] : 0,
    appliedAt: toDate(data['appliedAt']),
  };
}

function characterStateFrom(data: DocumentData | undefined): CharacterState {
  if (!data) return emptyCharacterState();
  const map = (value: unknown) =>
    value && typeof value === 'object' ? (value as Record<string, never>) : {};
  return {
    professions: map(data['professions']),
    itemLevels: map(data['itemLevels']),
    together: map(data['together']),
  };
}

async function loadCharacterState(db: Firestore): Promise<CharacterState> {
  const snap = await getDoc(doc(db, ADDON_STATE_PATH));
  return characterStateFrom(snap.data());
}

/** Decodifica a string e monta a prévia do que vai mudar (somente administradores). */
export async function previewAddonBackup(
  db: Firestore,
  rawText: string,
  now = new Date(),
): Promise<PreviewResult> {
  const text = rawText.trim();
  if (text.length > BACKUP_MAX_LENGTH) return { ok: false, error: 'too-long' };
  let data: AddonBackup;
  try {
    data = await decodeAddonBackup(text);
  } catch (error) {
    if (error instanceof AddonDecodeFailure) return { ok: false, error: error.reason };
    return { ok: false, error: 'unknown' };
  }
  try {
    const ids = [
      ...new Set([...data.events.map((e) => e.id), ...data.attendance.map((e) => e.id)]),
    ];
    const id = backupId(text, data.generatedAt);
    const [characters, events, latest, same, state] = await Promise.all([
      loadMemberCharacters(db),
      Promise.all(
        ids.map(async (eventId) => [eventId, await loadEventState(db, eventId)] as const),
      ),
      getDocs(query(collection(db, ADDON_BACKUPS), orderBy('generatedAt', 'desc'), limit(1))),
      getDoc(doc(db, ADDON_BACKUPS, id)),
      loadCharacterState(db),
    ]);
    const site: BackupSiteState = {
      characters,
      events: new Map(
        events.flatMap(([eventId, loaded]) =>
          loaded
            ? [
                [
                  eventId,
                  { ...loaded.state, event: backupSiteEvent(eventId, loaded.data) },
                ] as const,
              ]
            : [],
        ),
      ),
      latest: latest.docs[0] ? storedInfo(latest.docs[0].id, latest.docs[0].data()) : null,
      same: same.exists() ? storedInfo(same.id, same.data()) : null,
      combined: {
        professions: new Map(Object.entries(state.professions).map(([k, v]) => [k, v.updatedAt])),
        itemLevels: new Map(Object.entries(state.itemLevels).map(([k, v]) => [k, v.updatedAt])),
        together: new Map(Object.entries(state.together)),
      },
    };
    return { ok: true, plan: planBackup(data, site, now), text };
  } catch (error) {
    return { ok: false, error: errorCode(error) };
  }
}

// ---------- Aplicação ----------

/** Recusa vinda da transação (o site mudou desde a prévia). */
class EventOutcome extends Error {
  constructor(readonly item: EventPlanItem) {
    super(item.action);
  }
}

const eventReason = (item: EventPlanItem) =>
  item.action === 'refused' || item.action === 'ignored' ? item.reason : null;

function eventReport(item: EventPlanItem, override?: { reason: string }): EventReport {
  const e = item.backup;
  return {
    id: e.id,
    origin: e.origin,
    status: e.status,
    title: e.title,
    startsAt: e.startsAt,
    changedBy: e.changedBy,
    updatedAt: e.updatedAt,
    action: override ? 'refused' : item.action,
    reason: override ? override.reason : eventReason(item),
    changed: item.action === 'update' ? item.changed : [],
  };
}

/**
 * Aplica um evento numa transação: relê o evento, refaz a decisão com o estado atual e grava.
 * Na criação, a leitura dentro da transação garante que o ID ainda não existe.
 */
async function applyEvent(
  db: Firestore,
  planned: EventPlanItem,
  adminUid: string,
): Promise<EventReport> {
  if (!['create', 'update', 'cancel'].includes(planned.action)) return eventReport(planned);
  try {
    const item = await runTransaction(db, async (tx) => {
      const ref = doc(db, 'events', planned.backup.id);
      const snap = await tx.get(ref);
      const current = snap.exists() ? backupSiteEvent(snap.id, snap.data()) : null;
      const item = planEvent(planned.backup, current, new Date());
      switch (item.action) {
        case 'create': {
          // `current` é null: o ID ainda não existe (se existir, planEvent não devolve 'create').
          const c = item.changes;
          tx.set(ref, {
            title: c.title,
            game: 'forever',
            startsAt: Timestamp.fromDate(c.startsAt),
            description: c.description,
            organizer: c.organizer,
            guestsAllowed: c.guestsAllowed,
            maxAttendees: c.maxAttendees,
            status: 'ativo',
            attendeeCount: 0,
            source: 'addon',
            createdBy: adminUid,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
          return item;
        }
        case 'update': {
          const c = item.changes;
          tx.update(ref, {
            title: c.title,
            startsAt: Timestamp.fromDate(c.startsAt),
            description: c.description,
            organizer: c.organizer,
            guestsAllowed: c.guestsAllowed,
            maxAttendees: c.maxAttendees,
            updatedAt: serverTimestamp(),
            updatedBy: adminUid,
          });
          return item;
        }
        case 'cancel':
          tx.update(ref, {
            status: 'cancelado',
            cancelledAt: serverTimestamp(),
            cancelledBy: adminUid,
          });
          return item;
        default:
          throw new EventOutcome(item);
      }
    });
    return eventReport(item);
  } catch (error) {
    if (error instanceof EventOutcome) return eventReport(error.item);
    const code = errorCode(error);
    if (code === 'network') throw error;
    return eventReport(planned, { reason: code === 'not-allowed' ? 'not-allowed' : 'error' });
  }
}

/**
 * Exclui um evento cancelado e excluído no jogo, com a mesma rotina do botão "Excluir evento"
 * do site (evento, confirmados, visitantes e cancelamentos). Relê o evento e refaz a decisão
 * antes; a exclusão não cabe numa transação porque as subcoleções precisam ser listadas.
 */
async function applyDeletion(db: Firestore, planned: EventPlanItem): Promise<EventReport> {
  if (planned.action !== 'delete') return eventReport(planned);
  try {
    const snap = await getDoc(doc(db, 'events', planned.backup.id));
    const current = snap.exists() ? backupSiteEvent(snap.id, snap.data()) : null;
    const item = planEvent(planned.backup, current, new Date());
    if (item.action !== 'delete') return eventReport(item);
    const result = await deleteCancelledEvent(db, planned.backup.id);
    if (result.ok) return eventReport(item);
    // Excluído ou alterado por outra pessoa entre a leitura e a exclusão.
    if (result.error === 'not-found') {
      return eventReport({ ...item, action: 'ignored', reason: 'already-deleted' });
    }
    if (result.error === 'not-cancelled') return eventReport({ ...item, action: 'conflict' });
    return eventReport(planned, {
      reason: result.error === 'not-allowed' ? 'not-allowed' : 'error',
    });
  } catch (error) {
    const code = errorCode(error);
    if (code === 'network') throw error;
    return eventReport(planned, { reason: code === 'not-allowed' ? 'not-allowed' : 'error' });
  }
}

function presenceItemReport(item: PlanItem, outcome: ItemOutcome): PresenceItemReport {
  return {
    character: item.character,
    status: item.status,
    updatedAt: item.updatedAt,
    action: item.action,
    username: 'username' in item ? item.username : null,
    result: outcome.result,
    reason:
      outcome.result === 'refused'
        ? outcome.reason
        : item.action === 'refused'
          ? item.reason
          : null,
    detail: item.action === 'refused' ? (item.detail ?? null) : null,
  };
}

/**
 * Junta as presenças do backup em `addonPresences`, em transações de até 100 eventos. As de
 * eventos excluídos (`deleted`) não são guardadas, e as já guardadas saem, para a string de
 * restauração não levá-las de volta ao jogo.
 */
async function storePresences(
  db: Firestore,
  data: AddonBackup,
  startsAt: Map<string, number | null>,
  deleted: Set<string>,
): Promise<void> {
  for (let i = 0; i < data.attendance.length; i += PRESENCE_CHUNK) {
    const chunk = data.attendance.slice(i, i + PRESENCE_CHUNK);
    await runTransaction(db, async (tx) => {
      const refs = chunk.map((e) => doc(db, ADDON_PRESENCES, e.id));
      const snaps = await Promise.all(refs.map((ref) => tx.get(ref)));
      // Só sai o registro de evento que não existe mais (igual às rules).
      const gone = await Promise.all(
        chunk.map(async (e) =>
          deleted.has(e.id) ? !(await tx.get(doc(db, 'events', e.id))).exists() : false,
        ),
      );
      chunk.forEach((e, k) => {
        if (deleted.has(e.id)) {
          if (gone[k] && snaps[k].exists()) tx.delete(refs[k]);
          return;
        }
        const stored = (snaps[k].get('records') ?? {}) as PresenceRecords;
        const merged = mergePresences(stored, e.records);
        const start = startsAt.get(e.id) ?? null;
        const storedStart = toDate(snaps[k].get('startsAt'));
        const startChanged =
          start !== null && (storedStart === null || seconds(storedStart) !== start);
        if (!merged.changed && !startChanged && snaps[k].exists()) return;
        tx.set(refs[k], {
          records: merged.records,
          startsAt:
            start !== null
              ? Timestamp.fromMillis(start * 1000)
              : storedStart
                ? Timestamp.fromDate(storedStart)
                : null,
          updatedAt: serverTimestamp(),
        });
      });
    });
  }
}

/**
 * Aplica a prévia (administrador `adminUid`, nome `adminName` para o histórico). Cada evento e
 * cada presença é revalidado na sua transação; o que não puder ser aplicado aparece no
 * relatório. Por fim, junta os dados ao estado combinado e guarda o backup no histórico.
 */
export async function applyAddonBackup(
  db: Firestore,
  plan: BackupPlan,
  text: string,
  adminUid: string,
  adminName: string,
): Promise<ApplyResult> {
  try {
    const data = plan.backup;

    // 1. Eventos: criações, edições e cancelamentos; depois, as exclusões; as presenças vêm
    // por último (as dos eventos criados, depois da criação). O relatório segue a ordem da prévia.
    const events: EventReport[] = new Array(plan.events.length);
    for (const [k, item] of plan.events.entries()) {
      if (item.action !== 'delete') events[k] = await applyEvent(db, item, adminUid);
    }
    for (const [k, item] of plan.events.entries()) {
      if (item.action === 'delete') events[k] = await applyDeletion(db, item);
    }

    // 2. Presenças, com as mesmas transações da importação da VDLP1.
    const presences: PresenceEventReport[] = [];
    for (const e of plan.presences) {
      const items: PresenceItemReport[] = [];
      for (const item of e.items) {
        const outcome = await runPresenceItem(db, e.eventId, item, adminUid);
        items.push(presenceItemReport(item, outcome));
      }
      presences.push({
        eventId: e.eventId,
        title: e.event?.title ?? null,
        startsAt: e.event ? seconds(e.event.startsAt) : null,
        ignored: e.ignored,
        items,
      });
    }

    // 3. Estado combinado das presenças (com o início do evento, para filtrar a restauração).
    const deleted = new Set(
      events
        .filter(
          (e) =>
            e.action === 'delete' || (e.action === 'ignored' && e.reason === 'already-deleted'),
        )
        .map((e) => e.id),
    );
    await storePresences(db, data, new Map(presences.map((p) => [p.eventId, p.startsAt])), deleted);

    const report: BackupReport = {
      events,
      presences,
      professions: plan.professions,
      itemLevels: plan.itemLevels,
      together: plan.together,
    };

    // 4. Estado combinado dos personagens e histórico, juntos.
    let recorded: 'new' | 'existing' | 'failed' = 'new';
    try {
      recorded = await runTransaction(db, async (tx) => {
        const stateRef = doc(db, ADDON_STATE_PATH);
        const historyRef = doc(db, ADDON_BACKUPS, backupId(text, data.generatedAt));
        const [state, history] = await Promise.all([tx.get(stateRef), tx.get(historyRef)]);
        const merged = mergeCharacters(characterStateFrom(state.data()), data);
        if (merged.changed || !state.exists()) {
          tx.set(stateRef, {
            ...merged.state,
            updatedAt: serverTimestamp(),
            updatedBy: adminUid,
          });
        }
        if (history.exists()) return 'existing';
        tx.set(historyRef, {
          text: text.trim(),
          generatedAt: data.generatedAt,
          exportNumber: data.exportNumber,
          generatedBy: data.generatedBy,
          appliedAt: serverTimestamp(),
          appliedBy: adminUid,
          appliedByName: adminName,
          report,
        });
        return 'new';
      });
    } catch (error) {
      if (errorCode(error) === 'network') throw error;
      recorded = 'failed';
    }
    return { ok: true, report, recorded };
  } catch (error) {
    const code = errorCode(error);
    return { ok: false, error: code };
  }
}

// ---------- Histórico e estado combinado ----------

function reportFrom(value: unknown): BackupReport {
  const r = (value ?? {}) as Partial<BackupReport>;
  const count = (c: unknown): DataCount =>
    c && typeof c === 'object' ? (c as DataCount) : { total: 0, newer: 0 };
  return {
    events: Array.isArray(r.events) ? r.events : [],
    presences: Array.isArray(r.presences) ? r.presences : [],
    professions: count(r.professions),
    itemLevels: count(r.itemLevels),
    together: count(r.together),
  };
}

/** Backups aplicados, do mais novo (pela geração no jogo) para o mais antigo. */
export async function listBackups(db: Firestore): Promise<StoredBackup[]> {
  const snap = await getDocs(query(collection(db, ADDON_BACKUPS), orderBy('generatedAt', 'desc')));
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      text: String(data['text'] ?? ''),
      generatedAt: Number(data['generatedAt'] ?? 0),
      exportNumber: Number(data['exportNumber'] ?? 0),
      generatedBy: String(data['generatedBy'] ?? ''),
      appliedAt: toDate(data['appliedAt']),
      appliedBy: String(data['appliedBy'] ?? ''),
      appliedByName: String(data['appliedByName'] ?? ''),
      report: reportFrom(data['report']),
    };
  });
}

/** Estado combinado dos personagens (vazio se nenhum backup foi aplicado). */
export const readCharacterState = loadCharacterState;

// ---------- Restauração (site → addon) ----------

export interface RestoreResult {
  text: string;
  characters: number;
  presenceEvents: number;
  /** A string passa do tamanho que a caixa do jogo aceita bem (o mesmo limite da VDL1). */
  tooLong: boolean;
}

/** `exportNumber` da última VDL1 do WoW Forever gerada pelo site (0 se nenhuma). */
async function lastExportNumber(db: Firestore): Promise<number> {
  const snap = await getDoc(doc(db, ADDON_EXPORT_PATH));
  const value = snap.exists() ? snap.get('exportNumber') : null;
  return typeof value === 'number' ? value : 0;
}

/**
 * String de restauração a partir do estado combinado. Por padrão, só as presenças de eventos
 * que começam a partir de 30 dias atrás; `includeOld` inclui todas.
 */
export async function generateRestoreString(
  db: Firestore,
  includeOld: boolean,
  now = new Date(),
): Promise<RestoreResult> {
  const cutoff = new Date(now.getTime() - RESTORE_RECENT_DAYS * 24 * 60 * 60 * 1000);
  const presencesQuery = includeOld
    ? collection(db, ADDON_PRESENCES)
    : query(collection(db, ADDON_PRESENCES), where('startsAt', '>=', Timestamp.fromDate(cutoff)));
  const [state, exportNumber, presences] = await Promise.all([
    loadCharacterState(db),
    lastExportNumber(db),
    getDocs(presencesQuery),
  ]);
  const backup = restoreBackup(
    state,
    presences.docs.map((d) => ({
      eventId: d.id,
      records: (d.get('records') ?? {}) as PresenceRecords,
    })),
    exportNumber,
    now,
  );
  const text = await encodeAddonBackup(backup);
  const characters = new Set([
    ...backup.professions.map((p) => p.character),
    ...backup.itemLevels.map((p) => p.character),
    ...backup.together.map((p) => p.character),
  ]).size;
  return {
    text,
    characters,
    presenceEvents: backup.attendance.length,
    tooLong: text.length > ADDON_MAX_LENGTH,
  };
}

/** Registra a última string VDL1 do WoW Forever gerada (para a string de restauração). */
export async function recordAddonExport(
  db: Firestore,
  exportNumber: number,
  adminUid: string,
): Promise<boolean> {
  try {
    await runTransaction(db, async (tx) => {
      const ref = doc(db, ADDON_EXPORT_PATH);
      const snap = await tx.get(ref);
      const current = snap.exists() ? snap.get('exportNumber') : null;
      if (typeof current === 'number' && current >= exportNumber) return;
      tx.set(ref, {
        game: 'forever',
        exportNumber,
        generatedAt: serverTimestamp(),
        generatedBy: adminUid,
      });
    });
    return true;
  } catch (error) {
    if (error instanceof FirebaseError) return false;
    throw error;
  }
}
