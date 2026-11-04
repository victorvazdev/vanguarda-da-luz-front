/** Fuso horário da guilda. Todos os horários do site são exibidos nele. */
export const GUILD_TIME_ZONE = 'America/Sao_Paulo';
export const GUILD_TIME_ZONE_LABEL = 'Brasília';

const dateParts = new Intl.DateTimeFormat('pt-BR', {
  timeZone: GUILD_TIME_ZONE,
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

/** Data curta no fuso de Brasília, no formato do protótipo: "4 nov. 2026". */
export function formatBrasiliaDate(date: Date): string {
  const parts = Object.fromEntries(dateParts.formatToParts(date).map((p) => [p.type, p.value]));
  const month = parts['month'].endsWith('.') ? parts['month'] : `${parts['month']}.`;
  return `${parts['day']} ${month} ${parts['year']}`;
}

const wallClock = new Intl.DateTimeFormat('en-CA', {
  timeZone: GUILD_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

function wallParts(date: Date): Record<string, string> {
  return Object.fromEntries(wallClock.formatToParts(date).map((p) => [p.type, p.value]));
}

/** Diferença (ms) entre o relógio de Brasília e o UTC naquele instante. */
function offsetAt(date: Date): number {
  const p = wallParts(date);
  const asUtc = Date.UTC(+p['year'], +p['month'] - 1, +p['day'], +p['hour'], +p['minute']);
  return asUtc - Math.floor(date.getTime() / 60_000) * 60_000;
}

const DATE_INPUT = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_INPUT = /^([01]\d|2[0-3]):([0-5]\d)$/;

/**
 * Converte data ("2026-11-07") e horário ("21:00") digitados no horário de Brasília
 * para o instante correspondente. Devolve null se algum valor for inválido.
 */
export function brasiliaToDate(date: string, time: string): Date | null {
  const d = DATE_INPUT.exec(date);
  const t = TIME_INPUT.exec(time);
  if (!d || !t) return null;
  const [y, m, day] = [+d[1], +d[2], +d[3]];
  const guess = Date.UTC(y, m - 1, day, +t[1], +t[2]);
  const check = new Date(guess);
  if (check.getUTCMonth() !== m - 1 || check.getUTCDate() !== day) return null;
  // Duas passadas acertam o deslocamento mesmo perto de uma mudança de horário.
  let result = guess - offsetAt(new Date(guess));
  result = guess - offsetAt(new Date(result));
  return new Date(result);
}

/** Valores para os campos de data e horário, no relógio de Brasília. */
export function toBrasiliaInputs(date: Date): { date: string; time: string } {
  const p = wallParts(date);
  return { date: `${p['year']}-${p['month']}-${p['day']}`, time: `${p['hour']}:${p['minute']}` };
}

const weekday = new Intl.DateTimeFormat('pt-BR', { timeZone: GUILD_TIME_ZONE, weekday: 'short' });

/** Dia da semana abreviado, como no protótipo: "Sáb". */
export function formatBrasiliaWeekday(date: Date): string {
  const name = weekday.format(date).replace('.', '');
  return name.charAt(0).toUpperCase() + name.slice(1);
}

/** Horário no fuso de Brasília: "21:00". */
export function formatBrasiliaTime(date: Date): string {
  return toBrasiliaInputs(date).time;
}

/** Data e horário do evento, como no protótipo: "Sáb, 7 nov. 2026, 21:00". */
export function formatEventDateTime(date: Date): string {
  return `${formatBrasiliaWeekday(date)}, ${formatBrasiliaDate(date)}, ${formatBrasiliaTime(date)}`;
}
