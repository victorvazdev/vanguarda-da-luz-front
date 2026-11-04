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
import {
  NonNullableFormBuilder,
  ReactiveFormsModule,
  Validators,
  type ValidatorFn,
} from '@angular/forms';
import {
  EVENT_LIMITS,
  isChangeable,
  isUpcoming,
  type EventActionError,
  type EventInput,
  type GuildEvent,
} from '../../../core/data/events';
import { EventsService } from '../../../core/data/events.service';
import {
  GUILD_TIME_ZONE_LABEL,
  brasiliaToDate,
  formatEventDateTime,
  toBrasiliaInputs,
} from '../../../core/time/brasilia';
import { firstError, type ErrorMessages } from '../../../shared/forms/field-errors';
import { requiredText } from '../../../shared/forms/validators';
import { ConfirmService } from '../../../shared/ui/confirm-dialog/confirm.service';

type Field = 'title' | 'date' | 'time' | 'organizer' | 'description';

const MESSAGES: Record<Field, ErrorMessages> = {
  title: {
    required: 'Informe o título.',
    maxlength: `Use no máximo ${EVENT_LIMITS.title} caracteres.`,
  },
  date: { required: 'Informe a data.', past: 'Escolha uma data e um horário futuros.' },
  time: { required: 'Informe o horário.' },
  organizer: {
    required: 'Informe o organizador.',
    maxlength: `Use no máximo ${EVENT_LIMITS.organizer} caracteres.`,
  },
  description: {
    required: 'Informe a descrição.',
    maxlength: `Use no máximo ${EVENT_LIMITS.description} caracteres.`,
  },
};

const ERRORS: Record<Exclude<EventActionError, 'past'>, string> = {
  cancelled: 'Este evento foi cancelado e não pode mais ser alterado. A lista foi atualizada.',
  'not-found': 'Este evento não existe mais. A lista foi atualizada.',
  'not-allowed': 'Você não tem permissão para esta ação.',
  network: 'Não foi possível conectar. Verifique sua internet e tente novamente.',
  unknown: 'Não foi possível salvar. Tente novamente.',
};
const STARTED = 'Este evento já começou e não pode mais ser alterado.';

/** Data e horário (no fuso da guilda) precisam formar um momento futuro. */
const futureDateTime: ValidatorFn = (group) => {
  const startsAt = brasiliaToDate(group.get('date')?.value ?? '', group.get('time')?.value ?? '');
  return startsAt && !isUpcoming(startsAt) ? { past: true } : null;
};

interface EventView {
  id: string;
  title: string;
  when: string;
  organizer: string;
  cancelled: boolean;
  changeable: boolean;
  source: GuildEvent;
}

/** História "Criar, editar e cancelar eventos". */
@Component({
  selector: 'app-events-admin-page',
  imports: [ReactiveFormsModule],
  templateUrl: './events-admin-page.html',
  styleUrl: './events-admin-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EventsAdminPage {
  private readonly events = inject(EventsService);
  private readonly confirm = inject(ConfirmService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);

  protected readonly limits = EVENT_LIMITS;
  protected readonly timeZone = GUILD_TIME_ZONE_LABEL;
  protected readonly state = signal<'loading' | 'ready' | 'error'>('loading');
  private readonly list = signal<GuildEvent[]>([]);
  /** Evento em edição; null = formulário de novo evento. */
  protected readonly editing = signal<GuildEvent | null>(null);
  protected readonly busy = signal<string | null>(null);
  protected readonly saving = signal(false);
  protected readonly submitted = signal(false);
  protected readonly status = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly formError = signal<string | null>(null);
  protected readonly today = signal(toBrasiliaInputs(new Date()).date);

  protected readonly view = computed<EventView[]>(() =>
    this.list().map((e) => ({
      id: e.id,
      title: e.title,
      when: formatEventDateTime(e.startsAt),
      organizer: e.organizer,
      cancelled: e.status === 'cancelado',
      changeable: isChangeable(e),
      source: e,
    })),
  );

  protected readonly form = inject(NonNullableFormBuilder).group(
    {
      title: ['', [requiredText, Validators.maxLength(EVENT_LIMITS.title)]],
      date: ['', [Validators.required]],
      time: ['', [Validators.required]],
      organizer: ['', [requiredText, Validators.maxLength(EVENT_LIMITS.organizer)]],
      description: ['', [requiredText, Validators.maxLength(EVENT_LIMITS.description)]],
    },
    { validators: futureDateTime },
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

  protected fieldError(field: Field): string | null {
    const control = this.form.controls[field];
    if (!control.touched && !this.submitted()) return null;
    // O erro de data no passado é do grupo (data + horário) e aparece junto à data.
    return firstError(control, MESSAGES[field], field === 'date' ? this.form.errors : null);
  }

  protected describedBy(field: Field, ...extra: string[]): string | null {
    const ids = [this.fieldError(field) ? `evento-${field}-erro` : '', ...extra].filter(Boolean);
    return ids.length ? ids.join(' ') : null;
  }

  protected edit(event: EventView): void {
    const { date, time } = toBrasiliaInputs(event.source.startsAt);
    this.editing.set(event.source);
    this.resetMessages();
    this.submitted.set(false);
    this.form.reset({
      title: event.source.title,
      date,
      time,
      organizer: event.source.organizer,
      description: event.source.description,
    });
    this.focus('#evento-title');
  }

  protected goToForm(): void {
    this.focus('#evento-title');
  }

  protected discard(): void {
    const id = this.editing()?.id;
    this.startNew();
    if (id) this.focus(`#editar-${id}`);
  }

  protected async save(): Promise<void> {
    if (this.saving()) return;
    this.today.set(toBrasiliaInputs(new Date()).date);
    this.submitted.set(true);
    this.resetMessages();
    this.form.updateValueAndValidity();

    const input = this.toInput();
    if (!input || this.form.invalid) {
      this.form.markAllAsTouched();
      this.focus('.event-form [aria-invalid="true"]');
      return;
    }

    const editing = this.editing();
    this.saving.set(true);
    const result = editing
      ? await this.events.update(editing.id, input)
      : await this.events.create(input);
    this.saving.set(false);

    if (result.ok) {
      this.status.set(
        editing ? `Alterações salvas em ${input.title}.` : `Evento criado: ${input.title}.`,
      );
      this.startNew();
      if (editing) this.focus(`#editar-${editing.id}`);
      return;
    }
    if (result.error === 'past') {
      this.formError.set(isUpcoming(input.startsAt) ? STARTED : MESSAGES.date['past']);
    } else {
      this.formError.set(ERRORS[result.error]);
      if (result.error === 'cancelled' || result.error === 'not-found') this.startNew();
    }
    this.focus('.event-form .form-alert');
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
      if (this.editing()?.id === event.id) this.startNew();
    } else {
      this.error.set(result.error === 'past' ? STARTED : ERRORS[result.error]);
    }
  }

  private startNew(): void {
    this.editing.set(null);
    this.submitted.set(false);
    this.form.reset();
  }

  private resetMessages(): void {
    this.status.set(null);
    this.error.set(null);
    this.formError.set(null);
  }

  private toInput(): EventInput | null {
    const v = this.form.getRawValue();
    const startsAt = brasiliaToDate(v.date, v.time);
    if (!startsAt) return null;
    return {
      title: v.title.trim(),
      startsAt,
      organizer: v.organizer.trim(),
      description: v.description.trim(),
    };
  }

  private focus(selector: string): void {
    afterNextRender(
      () => {
        const el = this.host.nativeElement.querySelector<HTMLElement>(selector);
        el?.focus();
        el?.scrollIntoView?.({ block: 'center' });
      },
      { injector: this.injector },
    );
  }
}
