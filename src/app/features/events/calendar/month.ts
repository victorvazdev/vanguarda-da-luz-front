// Grade mensal do calendário, sempre no fuso da guilda (Brasília).
import type { GuildEvent } from '../../../core/data/events';
import { brasiliaToDate, toBrasiliaInputs } from '../../../core/time/brasilia';

export interface MonthRef {
  year: number;
  /** 1 a 12. */
  month: number;
}

export interface CalendarDay {
  /** "2026-11-07". */
  key: string;
  day: number;
  inMonth: boolean;
  isToday: boolean;
  /** Nome completo para leitores de tela: "sábado, 7 de novembro de 2026". */
  label: string;
}

const MONTH_PARAM = /^(\d{4})-(0[1-9]|1[0-2])$/;

/** Lê o parâmetro `mes` da URL ("2026-11"); null se ausente ou inválido. */
export function parseMonth(param: string | null | undefined): MonthRef | null {
  const m = MONTH_PARAM.exec(param ?? '');
  return m ? { year: +m[1], month: +m[2] } : null;
}

export const monthParam = (m: MonthRef) => `${m.year}-${String(m.month).padStart(2, '0')}`;

/** Chave do dia ("2026-11-07") de um instante, no fuso da guilda. */
export const dayKey = (date: Date) => toBrasiliaInputs(date).date;

export function currentMonth(now = new Date()): MonthRef {
  const [year, month] = dayKey(now).split('-').map(Number);
  return { year, month };
}

export function addMonths(m: MonthRef, n: number): MonthRef {
  const index = m.year * 12 + (m.month - 1) + n;
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
}

export const sameMonth = (a: MonthRef, b: MonthRef) => a.year === b.year && a.month === b.month;

// Datas "de calendário" (sem hora) são manipuladas em UTC para não depender do fuso do navegador.
const utc = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d));
const keyOf = (d: Date) => d.toISOString().slice(0, 10);
const plain = (options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC', ...options });
const monthName = plain({ month: 'long' });
const fullDay = plain({ weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

/** "Novembro de 2026". */
export function monthTitle(m: MonthRef): string {
  const name = monthName.format(utc(m.year, m.month, 1));
  return `${name.charAt(0).toUpperCase()}${name.slice(1)} de ${m.year}`;
}

export const WEEKDAYS = [
  { short: 'Dom', long: 'Domingo' },
  { short: 'Seg', long: 'Segunda-feira' },
  { short: 'Ter', long: 'Terça-feira' },
  { short: 'Qua', long: 'Quarta-feira' },
  { short: 'Qui', long: 'Quinta-feira' },
  { short: 'Sex', long: 'Sexta-feira' },
  { short: 'Sáb', long: 'Sábado' },
] as const;

/** Semanas (domingo a sábado) que cobrem o mês, com os dias vizinhos para completar. */
export function monthGrid(m: MonthRef, todayKey: string): CalendarDay[][] {
  const first = utc(m.year, m.month, 1);
  const daysInMonth = utc(m.year, m.month + 1, 0).getUTCDate();
  const leading = first.getUTCDay();
  const total = Math.ceil((leading + daysInMonth) / 7) * 7;

  const weeks: CalendarDay[][] = [];
  for (let i = 0; i < total; i++) {
    const date = utc(m.year, m.month, 1 - leading + i);
    const key = keyOf(date);
    if (i % 7 === 0) weeks.push([]);
    weeks[weeks.length - 1].push({
      key,
      day: date.getUTCDate(),
      inMonth: date.getUTCMonth() === m.month - 1,
      isToday: key === todayKey,
      label: fullDay.format(date),
    });
  }
  return weeks;
}

/** Instantes de início (inclusivo) e fim (exclusivo) da grade, para buscar os eventos. */
export function gridRange(weeks: CalendarDay[][]): { from: Date; to: Date } {
  const firstKey = weeks[0][0].key;
  const lastKey = weeks[weeks.length - 1][6].key;
  const [y, mo, d] = lastKey.split('-').map(Number);
  return {
    from: brasiliaToDate(firstKey, '00:00')!,
    to: brasiliaToDate(keyOf(utc(y, mo, d + 1)), '00:00')!,
  };
}

/** Eventos agrupados pelo dia (no fuso da guilda), mantendo a ordem cronológica. */
export function eventsByDay(events: GuildEvent[]): Map<string, GuildEvent[]> {
  const map = new Map<string, GuildEvent[]>();
  for (const event of events) {
    const key = dayKey(event.startsAt);
    map.set(key, [...(map.get(key) ?? []), event]);
  }
  return map;
}
