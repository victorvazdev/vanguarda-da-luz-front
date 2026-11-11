import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import {
  NonNullableFormBuilder,
  ReactiveFormsModule,
  Validators,
  type ValidatorFn,
} from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import {
  DEFAULT_MAX_ATTENDEES,
  EVENT_LIMITS,
  MAX_ATTENDEES_RANGE,
  canChangeGame,
  isChangeable,
  isUpcoming,
  type EventInput,
  type GuildEvent,
} from '../../../../core/data/events';
import { EventsService } from '../../../../core/data/events.service';
import { GAMES, type Game } from '../../../../core/models/wow';
import { PATHS } from '../../../../core/routing/paths';
import {
  GUILD_TIME_ZONE_LABEL,
  brasiliaToDate,
  toBrasiliaInputs,
} from '../../../../core/time/brasilia';
import { firstError, type ErrorMessages } from '../../../../shared/forms/field-errors';
import { requiredText } from '../../../../shared/forms/validators';
import { FlashService } from '../../../../shared/ui/flash/flash.service';
import { EVENT_ACTION_ERRORS, EVENT_STARTED } from '../event-messages';

type Field = 'title' | 'game' | 'date' | 'time' | 'organizer' | 'description' | 'maxAttendees';

const RANGE = `Use um número inteiro de ${MAX_ATTENDEES_RANGE.min} a ${MAX_ATTENDEES_RANGE.max}.`;
const MESSAGES: Record<Field, ErrorMessages> = {
  title: {
    required: 'Informe o título.',
    maxlength: `Use no máximo ${EVENT_LIMITS.title} caracteres.`,
  },
  game: { required: 'Escolha a versão do jogo.' },
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
  maxAttendees: {
    required: 'Informe o limite de confirmados.',
    min: RANGE,
    max: RANGE,
    integer: RANGE,
  },
};

/** Número inteiro (o campo numérico aceita decimais). */
const integer: ValidatorFn = (control) =>
  control.value === null || Number.isInteger(control.value) ? null : { integer: true };

/** Data e horário (no fuso da guilda) precisam formar um momento futuro. */
const futureDateTime: ValidatorFn = (group) => {
  const startsAt = brasiliaToDate(group.get('date')?.value ?? '', group.get('time')?.value ?? '');
  return startsAt && !isUpcoming(startsAt) ? { past: true } : null;
};

const EVENTS_PATH = '/admin/eventos';

/**
 * Criação (`/admin/eventos/novo`) e edição (`/admin/eventos/:id/editar`) de evento, em página
 * própria. Ao salvar, volta à lista de eventos. Criado a partir do calendário
 * (`/calendario/novo`), fora do painel administrativo, o evento abre em seguida no detalhe.
 */
@Component({
  selector: 'app-event-form-page',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './event-form-page.html',
  styleUrl: './event-form-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EventFormPage {
  private readonly events = inject(EventsService);
  private readonly router = inject(Router);
  private readonly flash = inject(FlashService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);

  /** Parâmetro `:id` da rota; ausente na criação. */
  readonly id = input<string>();
  /** De onde o formulário foi aberto (dado da rota): painel administrativo ou calendário. */
  readonly from = input<'admin' | 'calendar'>('admin');

  protected readonly fromCalendar = computed(() => this.from() === 'calendar');
  /** Destino de "Voltar" e "Cancelar". */
  protected readonly backPath = computed(() =>
    this.fromCalendar() ? PATHS.calendar : EVENTS_PATH,
  );
  protected readonly games = GAMES;
  protected readonly limits = EVENT_LIMITS;
  protected readonly attendeesRange = MAX_ATTENDEES_RANGE;
  protected readonly timeZone = GUILD_TIME_ZONE_LABEL;
  /** `locked`: o evento foi cancelado ou já começou e não pode mais ser editado. */
  protected readonly state = signal<'loading' | 'ready' | 'not-found' | 'locked' | 'error'>(
    'loading',
  );
  /** Evento em edição (atualizado em tempo real); `null` na criação. */
  protected readonly editing = signal<GuildEvent | null>(null);
  /** A versão do jogo não muda depois que alguém confirmou presença. */
  protected readonly gameLocked = computed(() => {
    const e = this.editing();
    return !!e && !canChangeGame(e);
  });
  protected readonly saving = signal(false);
  protected readonly submitted = signal(false);
  protected readonly formError = signal<string | null>(null);
  protected readonly today = signal(toBrasiliaInputs(new Date()).date);

  protected readonly form = inject(NonNullableFormBuilder).group(
    {
      title: ['', [requiredText, Validators.maxLength(EVENT_LIMITS.title)]],
      /** Versão do jogo: define com quais personagens se confirma presença. */
      game: ['' as Game | '', [Validators.required]],
      date: ['', [Validators.required]],
      time: ['', [Validators.required]],
      organizer: ['', [requiredText, Validators.maxLength(EVENT_LIMITS.organizer)]],
      description: ['', [requiredText, Validators.maxLength(EVENT_LIMITS.description)]],
      /** Visitantes podem confirmar presença (padrão: sim). */
      guestsAllowed: [true],
      /** Limite de confirmados, membros e visitantes (padrão: 40). */
      maxAttendees: [
        DEFAULT_MAX_ATTENDEES as number | null,
        [
          Validators.required,
          Validators.min(MAX_ATTENDEES_RANGE.min),
          Validators.max(MAX_ATTENDEES_RANGE.max),
          integer,
        ],
      ],
    },
    { validators: futureDateTime },
  );

  constructor() {
    // Edição: carrega o evento. O formulário é preenchido só na primeira leitura; as seguintes
    // atualizam o evento (presenças confirmadas, cancelamento) sem apagar o que foi digitado.
    effect((onCleanup) => {
      const id = this.id();
      if (!id) {
        this.state.set('ready');
        this.focus('#evento-title');
        return;
      }
      this.state.set('loading');
      let filled = false;
      const stop = this.events.watchOne(
        id,
        (event) => {
          this.editing.set(event);
          if (!event) {
            this.state.set('not-found');
          } else if (!filled && !isChangeable(event)) {
            this.state.set('locked');
          } else if (!filled) {
            filled = true;
            untracked(() => this.fill(event));
            this.state.set('ready');
            this.focus('#evento-title');
          }
        },
        () => this.state.set('error'),
      );
      onCleanup(stop);
    });

    // Com presenças confirmadas, a versão do jogo fica travada.
    effect(() => {
      const control = this.form.controls.game;
      if (this.gameLocked()) control.disable();
      else control.enable();
    });
  }

  protected fieldError(field: Field): string | null {
    const control = this.form.controls[field];
    if (control.disabled || (!control.touched && !this.submitted())) return null;
    // O erro de data no passado é do grupo (data + horário) e aparece junto à data.
    return firstError(control, MESSAGES[field], field === 'date' ? this.form.errors : null);
  }

  protected describedBy(field: Field, ...extra: string[]): string | null {
    const ids = [this.fieldError(field) ? `evento-${field}-erro` : '', ...extra].filter(Boolean);
    return ids.length ? ids.join(' ') : null;
  }

  protected async save(): Promise<void> {
    if (this.saving()) return;
    this.today.set(toBrasiliaInputs(new Date()).date);
    this.submitted.set(true);
    this.formError.set(null);
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

    if (result.ok) {
      const created = 'id' in result ? result.id : null;
      await this.router.navigateByUrl(
        this.fromCalendar() && created ? `${PATHS.calendar}/${created}` : this.backPath(),
      );
      this.flash.show(
        editing ? `Alterações salvas em ${input.title}.` : `Evento criado: ${input.title}.`,
      );
      return;
    }
    this.saving.set(false);
    this.formError.set(
      result.error === 'past'
        ? isUpcoming(input.startsAt)
          ? EVENT_STARTED
          : MESSAGES.date['past']
        : EVENT_ACTION_ERRORS[result.error],
    );
    this.focus('.event-form .form-alert');
  }

  private fill(event: GuildEvent): void {
    const { date, time } = toBrasiliaInputs(event.startsAt);
    this.form.reset({
      title: event.title,
      game: event.game ?? '',
      date,
      time,
      organizer: event.organizer,
      description: event.description,
      guestsAllowed: event.guestsAllowed,
      maxAttendees: event.maxAttendees,
    });
  }

  private toInput(): EventInput | null {
    const v = this.form.getRawValue();
    const startsAt = brasiliaToDate(v.date, v.time);
    if (!startsAt || v.maxAttendees === null || !v.game) return null;
    return {
      title: v.title.trim(),
      game: v.game,
      startsAt,
      organizer: v.organizer.trim(),
      description: v.description.trim(),
      guestsAllowed: v.guestsAllowed,
      maxAttendees: v.maxAttendees,
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
