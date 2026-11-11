// Exportação de eventos para o addon da guilda, sem dependência do Angular.
// Formato: ./addon-format.ts e docs/formato-string-addon.md.
import {
  Timestamp,
  collection,
  getDocs,
  orderBy,
  query,
  where,
  type Firestore,
} from 'firebase/firestore';
import { brasiliaToDate, toBrasiliaInputs } from '../time/brasilia';
import {
  ADDON_FORMAT_VERSION,
  ADDON_MAX_LENGTH,
  encodeAddonExport,
  type AddonEvent,
  type AddonGame,
} from './addon-format';
import { toDate } from './applications';

/** Janela padrão e faixa aceita, em dias a partir de hoje. */
export const ADDON_DEFAULT_DAYS = 60;
export const ADDON_DAYS_RANGE = { min: 1, max: 180 } as const;

export interface ExportWindow {
  /** 00:00 de hoje, no horário de Brasília (inclusive). */
  from: Date;
  /** 00:00 do dia seguinte ao último dia da janela (exclusivo). */
  to: Date;
}

/** Hoje e os próximos `days` dias, inteiros, no horário de Brasília. */
export function exportWindow(now: Date, days: number): ExportWindow {
  const today = toBrasiliaInputs(now).date;
  const [y, m, d] = today.split('-').map(Number);
  const last = new Date(Date.UTC(y, m - 1, d + days + 1)).toISOString().slice(0, 10);
  return { from: brasiliaToDate(today, '00:00')!, to: brasiliaToDate(last, '00:00')! };
}

const seconds = (date: Date) => Math.floor(date.getTime() / 1000);

/**
 * Evento no formato do addon, a partir do documento do Firestore; `null` se não for da versão
 * do jogo pedida (eventos antigos, sem versão, ficam de fora). A última alteração é a mais
 * recente entre edição e cancelamento (o cancelamento não muda `updatedAt`).
 */
export function addonEventFromData(
  id: string,
  data: Record<string, unknown>,
  game: AddonGame,
): AddonEvent | null {
  if (data['game'] !== game) return null;
  const startsAt = toDate(data['startsAt']);
  if (!startsAt) return null;
  const changes = [data['createdAt'], data['updatedAt'], data['cancelledAt']]
    .map(toDate)
    .filter((d): d is Date => d !== null)
    .map(seconds);
  return {
    id,
    title: String(data['title'] ?? ''),
    startsAt: seconds(startsAt),
    description: String(data['description'] ?? ''),
    organizer: String(data['organizer'] ?? ''),
    status: data['status'] === 'cancelado' ? 'cancelado' : 'ativo',
    updatedAt: changes.length ? Math.max(...changes) : seconds(startsAt),
  };
}

/** Eventos da janela, da versão do jogo pedida, ativos e cancelados. */
export async function fetchAddonEvents(
  db: Firestore,
  game: AddonGame,
  window: ExportWindow,
): Promise<AddonEvent[]> {
  const snap = await getDocs(
    query(
      collection(db, 'events'),
      where('startsAt', '>=', Timestamp.fromDate(window.from)),
      where('startsAt', '<', Timestamp.fromDate(window.to)),
      orderBy('startsAt'),
    ),
  );
  return snap.docs
    .map((d) => addonEventFromData(d.id, d.data(), game))
    .filter((e): e is AddonEvent => e !== null);
}

/** Eventos que começam dentro da janela. */
export function inWindow(events: AddonEvent[], window: ExportWindow): AddonEvent[] {
  const from = seconds(window.from);
  const to = seconds(window.to);
  return events.filter((e) => e.startsAt >= from && e.startsAt < to);
}

export type AddonExportResult =
  | {
      ok: true;
      text: string;
      count: number;
      generatedAt: Date;
      window: ExportWindow;
    }
  | {
      ok: false;
      error: 'too-long';
      length: number;
      /** Maior janela, em dias, cuja string cabe no limite (`null` se nem 1 dia cabe). */
      maxDays: number | null;
      generatedAt: Date;
    };

async function encodeFor(
  events: AddonEvent[],
  game: AddonGame,
  now: Date,
  window: ExportWindow,
): Promise<string> {
  return encodeAddonExport({
    version: ADDON_FORMAT_VERSION,
    game,
    exportNumber: seconds(now),
    windowStart: seconds(window.from),
    windowEnd: seconds(window.to),
    events: inWindow(events, window),
  });
}

/**
 * Gera a string para os eventos já lidos (`events`, da janela de `days` dias). Se ela passar do
 * limite, informa o tamanho e a maior janela que cabe.
 */
export async function buildAddonExport(
  events: AddonEvent[],
  game: AddonGame,
  days: number,
  now: Date,
  maxLength = ADDON_MAX_LENGTH,
): Promise<AddonExportResult> {
  const window = exportWindow(now, days);
  const text = await encodeFor(events, game, now, window);
  if (text.length <= maxLength) {
    return { ok: true, text, count: inWindow(events, window).length, generatedAt: now, window };
  }
  // Busca binária pela maior janela que cabe (o tamanho cresce com a janela).
  let lo = 0;
  let hi = days - 1;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    const fits = (await encodeFor(events, game, now, exportWindow(now, mid))).length <= maxLength;
    if (fits) lo = mid;
    else hi = mid - 1;
  }
  const fits =
    lo >= ADDON_DAYS_RANGE.min &&
    (await encodeFor(events, game, now, exportWindow(now, lo))).length <= maxLength;
  return {
    ok: false,
    error: 'too-long',
    length: text.length,
    maxDays: fits ? lo : null,
    generatedAt: now,
  };
}

/** Lê os eventos e gera a string de exportação. */
export async function generateAddonExport(
  db: Firestore,
  game: AddonGame,
  days: number,
  now = new Date(),
  maxLength = ADDON_MAX_LENGTH,
): Promise<AddonExportResult> {
  const events = await fetchAddonEvents(db, game, exportWindow(now, days));
  return buildAddonExport(events, game, days, now, maxLength);
}
