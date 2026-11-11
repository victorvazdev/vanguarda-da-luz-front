import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import type { GuildEvent } from '../../../core/data/events';
import { SessionService } from '../../../core/auth/session.service';
import { EventsService } from '../../../core/data/events.service';
import { gameLabel } from '../../../core/models/wow';
import { PATHS } from '../../../core/routing/paths';
import {
  GUILD_TIME_ZONE_LABEL,
  formatBrasiliaDate,
  formatBrasiliaTime,
  formatBrasiliaWeekday,
} from '../../../core/time/brasilia';
import {
  WEEKDAYS,
  addMonths,
  currentMonth,
  dayKey,
  eventsByDay,
  gridRange,
  monthGrid,
  monthParam,
  monthTitle,
  parseMonth,
  sameMonth,
} from './month';

interface EventChip {
  id: string;
  title: string;
  time: string;
  cancelled: boolean;
  /** Versão do jogo ("Retail"); `null` em eventos antigos, sem versão. */
  game: string | null;
  /** Para a lista do celular: "Sáb, 7 nov. 2026". */
  date: string;
}

const chip = (e: GuildEvent): EventChip => ({
  id: e.id,
  title: e.title,
  time: formatBrasiliaTime(e.startsAt),
  cancelled: e.status === 'cancelado',
  game: e.game ? gameLabel(e.game) : null,
  date: `${formatBrasiliaWeekday(e.startsAt)}, ${formatBrasiliaDate(e.startsAt)}`,
});

/** História "Acessar o calendário de eventos". */
@Component({
  selector: 'app-calendar-page',
  imports: [RouterLink],
  templateUrl: './calendar-page.html',
  styleUrl: './calendar-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CalendarPage {
  private readonly events = inject(EventsService);
  private readonly session = inject(SessionService);

  /** Parâmetro `?mes=2026-11` (ligado pelo roteador). Ausente = mês atual. */
  readonly mes = input<string>();

  protected readonly paths = PATHS;
  /** Administradores criam eventos direto do calendário. */
  protected readonly isAdmin = computed(() => this.session.access() === 'admin');
  protected readonly weekdays = WEEKDAYS;
  protected readonly timeZone = GUILD_TIME_ZONE_LABEL;
  private readonly todayKey = dayKey(new Date());
  private readonly thisMonth = currentMonth();

  protected readonly month = computed(() => parseMonth(this.mes()) ?? this.thisMonth);
  protected readonly title = computed(() => monthTitle(this.month()));
  protected readonly isThisMonth = computed(() => sameMonth(this.month(), this.thisMonth));
  protected readonly prev = computed(() => monthParam(addMonths(this.month(), -1)));
  protected readonly next = computed(() => monthParam(addMonths(this.month(), 1)));
  protected readonly current = monthParam(this.thisMonth);
  protected readonly weeks = computed(() => monthGrid(this.month(), this.todayKey));

  protected readonly state = signal<'loading' | 'ready' | 'error'>('loading');
  private readonly list = signal<GuildEvent[]>([]);
  protected readonly byDay = computed(() => {
    const map = new Map<string, EventChip[]>();
    for (const [key, events] of eventsByDay(this.list())) map.set(key, events.map(chip));
    return map;
  });
  /** Eventos do mês exibido (lista usada no celular). */
  protected readonly agenda = computed(() => {
    const prefix = `${monthParam(this.month())}-`;
    return this.list()
      .filter((e) => dayKey(e.startsAt).startsWith(prefix))
      .map(chip);
  });

  constructor() {
    // Ao trocar de mês, troca a consulta em tempo real.
    effect((onCleanup) => {
      const { from, to } = gridRange(this.weeks());
      this.state.set('loading');
      const stop = this.events.watchBetween(
        from,
        to,
        (events) => {
          this.list.set(events);
          this.state.set('ready');
        },
        () => this.state.set('error'),
      );
      onCleanup(stop);
    });
  }
}
