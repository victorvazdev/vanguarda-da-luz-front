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
