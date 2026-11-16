// Itens de presença agrupados para exibição (prévia ou relatório), usados pela importação de
// presenças (VDLP1) e pelo backup do addon (VDLB1).
import type { AppliedItem } from '../../../../core/data/presence-import';
import type { EventPlan, PlanItem } from '../../../../core/data/presence-import-plan';
import { GUILD_TIME_ZONE_LABEL, formatEventDateTime } from '../../../../core/time/brasilia';
import { IGNORED_EVENTS, refusalMessage } from './presence-import-messages';

export interface Line {
  character: string;
  detail: string;
}

/** Itens de um evento agrupados para exibição (prévia ou relatório). */
export interface EventView {
  key: string;
  title: string;
  when: string | null;
  ignored: string | null;
  members: Line[];
  guests: Line[];
  cancellations: Line[];
  refused: Line[];
  unchanged: number;
}

export const unixDate = (seconds: number) => new Date(seconds * 1000);
export const dateTime = (date: Date) => `${formatEventDateTime(date)}, ${GUILD_TIME_ZONE_LABEL}`;

/** Resultado de um item: o planejado (prévia) ou o obtido na aplicação (relatório). */
function place(view: EventView, item: PlanItem | AppliedItem) {
  const outcome = 'outcome' in item ? item.outcome : null;
  const line = (detail: string) => ({ character: item.character, detail });
  if (outcome?.result === 'refused') {
    view.refused.push(line(refusalMessage(outcome.reason)));
    return;
  }
  if (outcome?.result === 'unchanged') {
    view.unchanged++;
    return;
  }
  switch (item.action) {
    case 'confirm-member':
      view.members.push(line(`Membro ${item.username}`));
      break;
    case 'confirm-guest':
      view.guests.push(line('Visitante'));
      break;
    case 'cancel-member':
      view.cancellations.push(line(`Membro ${item.username}`));
      break;
    case 'cancel-guest':
      view.cancellations.push(line('Visitante'));
      break;
    case 'refused':
      view.refused.push(line(refusalMessage(item.reason, item.detail)));
      break;
    case 'unchanged':
      view.unchanged++;
      break;
  }
}

export function eventView(
  e: { eventId: string; ignored: EventPlan['ignored'] },
  title: string | null,
  startsAt: Date | null,
  items: (PlanItem | AppliedItem)[],
): EventView {
  const view: EventView = {
    key: e.eventId,
    title: title ?? `Evento ${e.eventId}`,
    when: startsAt ? dateTime(startsAt) : null,
    ignored: e.ignored ? IGNORED_EVENTS[e.ignored] : null,
    members: [],
    guests: [],
    cancellations: [],
    refused: [],
    unchanged: 0,
  };
  for (const item of items) place(view, item);
  return view;
}
