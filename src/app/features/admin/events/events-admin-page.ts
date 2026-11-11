import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  inject,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { isChangeable, type GuildEvent } from '../../../core/data/events';
import { EventsService } from '../../../core/data/events.service';
import { gameLabel } from '../../../core/models/wow';
import { GUILD_TIME_ZONE_LABEL, formatEventDateTime } from '../../../core/time/brasilia';
import { ConfirmService } from '../../../shared/ui/confirm-dialog/confirm.service';
import { EVENT_ACTION_ERRORS, EVENT_STARTED } from './event-messages';

interface EventView {
  id: string;
  title: string;
  when: string;
  /** Versão do jogo ("Retail"); `null` em eventos antigos, sem versão. */
  game: string | null;
  organizer: string;
  cancelled: boolean;
  changeable: boolean;
  guestsAllowed: boolean;
  /** "12 de 40 confirmados". */
  attendance: string;
}

/**
 * História "Criar, editar, cancelar e excluir eventos": lista dos próximos eventos. A criação e
 * a edição ficam em página própria (EventFormPage).
 */
@Component({
  selector: 'app-events-admin-page',
  imports: [RouterLink],
  templateUrl: './events-admin-page.html',
  styleUrl: './events-admin-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EventsAdminPage {
  private readonly events = inject(EventsService);
  private readonly confirm = inject(ConfirmService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);

  protected readonly timeZone = GUILD_TIME_ZONE_LABEL;
  protected readonly state = signal<'loading' | 'ready' | 'error'>('loading');
  private readonly list = signal<GuildEvent[]>([]);
  protected readonly busy = signal<string | null>(null);
  protected readonly status = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);

  protected readonly view = computed<EventView[]>(() =>
    this.list().map((e) => ({
      id: e.id,
      title: e.title,
      when: formatEventDateTime(e.startsAt),
      game: e.game ? gameLabel(e.game) : null,
      organizer: e.organizer,
      cancelled: e.status === 'cancelado',
      changeable: isChangeable(e),
      guestsAllowed: e.guestsAllowed,
      attendance: `${e.attendeeCount} de ${e.maxAttendees} confirmados`,
    })),
  );

  constructor() {
    const stop = this.events.watchFrom(
      new Date(),
      (events) => {
        this.list.set(events);
        this.state.set('ready');
      },
      () => this.state.set('error'),
    );
    inject(DestroyRef).onDestroy(stop);
  }

  /** Exclui um evento cancelado (com a lista de confirmados), após confirmação. */
  protected async remove(event: EventView): Promise<void> {
    const confirmed = await this.confirm.ask({
      title: 'Excluir evento?',
      message: `${event.title} (${event.when}) sairá do calendário, junto com a lista de confirmados. Esta ação não pode ser desfeita.`,
      confirmLabel: 'Excluir evento',
      cancelLabel: 'Manter',
      tone: 'danger',
    });
    if (!confirmed || this.busy()) return;

    this.busy.set(event.id);
    this.resetMessages();
    const result = await this.events.deleteCancelled(event.id);
    this.busy.set(null);
    if (result.ok || result.error === 'not-found') {
      this.status.set(`${event.title} foi excluído do calendário.`);
      // O botão usado some com o evento; o foco vai para o título da lista.
      this.focus('#titulo-eventos');
    } else {
      this.error.set(result.error === 'past' ? EVENT_STARTED : EVENT_ACTION_ERRORS[result.error]);
    }
  }

  protected async cancel(event: EventView): Promise<void> {
    const confirmed = await this.confirm.ask({
      title: 'Cancelar evento?',
      message: `${event.title} (${event.when}) continuará no calendário, identificado como cancelado. Esta ação não pode ser desfeita.`,
      confirmLabel: 'Cancelar evento',
      tone: 'danger',
    });
    if (!confirmed || this.busy()) return;

    this.busy.set(event.id);
    this.resetMessages();
    const result = await this.events.cancel(event.id);
    this.busy.set(null);
    if (result.ok) {
      this.status.set(`${event.title} foi cancelado e continua no calendário como cancelado.`);
    } else {
      this.error.set(result.error === 'past' ? EVENT_STARTED : EVENT_ACTION_ERRORS[result.error]);
    }
  }

  private resetMessages(): void {
    this.status.set(null);
    this.error.set(null);
  }

  private focus(selector: string): void {
    afterNextRender(() => this.host.nativeElement.querySelector<HTMLElement>(selector)?.focus(), {
      injector: this.injector,
    });
  }
}
