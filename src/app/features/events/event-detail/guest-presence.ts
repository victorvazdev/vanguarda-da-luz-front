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
import { toSignal } from '@angular/core/rxjs-interop';
import {
  NonNullableFormBuilder,
  ReactiveFormsModule,
  Validators,
  type ValidatorFn,
} from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ACCOUNT_MESSAGES } from '../../../core/auth/messages';
import {
  REALM_MAX_LENGTH,
  REALM_PATTERN,
  guestData,
  guestDisplayName,
  guestKey,
  type Guest,
  type GuestAttendanceError,
  type GuestInput,
} from '../../../core/data/guest-attendance';
import { EventsService } from '../../../core/data/events.service';
import { GAMES, gameLabel, type Game } from '../../../core/models/wow';
import { firstError, type ErrorMessages } from '../../../shared/forms/field-errors';
import { characterNameFormat } from '../../../shared/forms/validators';

type Field = 'game' | 'characterName' | 'characterSurname' | 'realm';

const NAME = 'Use de 2 a 12 letras, sem espaços ou números.';
const MESSAGES: Record<Field, ErrorMessages> = {
  game: { required: 'Escolha o jogo.' },
  characterName: { required: 'Informe o nome do personagem.', characterName: NAME },
  characterSurname: { required: 'Informe o sobrenome do personagem.', characterName: NAME },
  realm: {
    required: 'Informe o reino.',
    maxlength: `Use no máximo ${REALM_MAX_LENGTH} caracteres.`,
    realm: 'O reino não pode conter "/".',
  },
};

const ERRORS: Record<Exclude<GuestAttendanceError, 'already-confirmed'>, string> = {
  'guests-closed': 'A confirmação de presença de visitantes foi desativada neste evento.',
  past: 'Este evento já começou. Não é mais possível confirmar presença.',
  cancelled: 'Este evento foi cancelado. Não é possível confirmar presença.',
  'not-found': 'Este evento não existe mais.',
  'not-confirmed': 'Não foi possível confirmar sua presença. Tente novamente.',
  'not-allowed': 'Não foi possível confirmar sua presença. Confira os dados do personagem.',
  network: ACCOUNT_MESSAGES.network,
  unknown: 'Não foi possível confirmar sua presença. Tente novamente.',
};

/** Presença de visitante lembrada neste navegador (por evento). */
const storageKey = (eventId: string) => `vanguarda:presenca-visitante:${eventId}`;

function readRemembered(eventId: string): string | null {
  try {
    return localStorage.getItem(storageKey(eventId));
  } catch {
    return null;
  }
}

function remember(eventId: string, guestId: string | null): void {
  try {
    if (guestId) localStorage.setItem(storageKey(eventId), guestId);
    else localStorage.removeItem(storageKey(eventId));
  } catch {
    // Sem armazenamento (navegação privada): a confirmação vale, só não é lembrada.
  }
}

/** Reino sem "/" (o tamanho fica com `maxlength`; espaços extras são removidos ao salvar). */
const realmFormat: ValidatorFn = (control) => {
  const value = String(control.value ?? '')
    .trim()
    .replace(/\s+/gu, ' ');
  return !value || REALM_PATTERN.test(value) ? null : { realm: true };
};

/**
 * Confirmação de presença de visitantes (sem conta de membro): o personagem do WoW Forever
 * (nome e sobrenome) ou do Retail (nome e reino).
 */
@Component({
  selector: 'app-guest-presence',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './guest-presence.html',
  styleUrl: './guest-presence.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GuestPresence {
  private readonly events = inject(EventsService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);

  readonly eventId = input.required<string>();
  /** Evento ativo e futuro. */
  readonly upcoming = input.required<boolean>();
  /** O administrador permite a confirmação de visitantes neste evento. */
  readonly guestsAllowed = input.required<boolean>();
  /** Destino do botão "Fazer parte" (cadastro ou candidatura). */
  readonly joinPath = input<string | null>(null);

  protected readonly games = GAMES;
  protected readonly realmMax = REALM_MAX_LENGTH;
  /** ID da presença lembrada neste navegador. */
  private readonly rememberedId = signal<string | null>(null);
  /** Presença lembrada: `undefined` enquanto carrega, `null` se não há (ou foi cancelada). */
  protected readonly guest = signal<Guest | null | undefined>(undefined);
  protected readonly saving = signal(false);
  protected readonly submitted = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly form = inject(NonNullableFormBuilder).group({
    game: ['' as Game | '', [Validators.required]],
    characterName: ['', [Validators.required, characterNameFormat]],
    characterSurname: [{ value: '', disabled: true }, [Validators.required, characterNameFormat]],
    realm: [
      { value: '', disabled: true },
      [Validators.required, Validators.maxLength(REALM_MAX_LENGTH), realmFormat],
    ],
  });

  protected readonly game = toSignal(this.form.controls.game.valueChanges, {
    initialValue: this.form.controls.game.value,
  });

  protected readonly confirmedView = computed(() => {
    const g = this.guest();
    return g ? { name: guestDisplayName(g), game: gameLabel(g.game) } : null;
  });

  constructor() {
    // Mostra só o campo do jogo escolhido (sobrenome no Forever, reino no Retail).
    effect(() => {
      const game = this.game();
      const { characterSurname, realm } = this.form.controls;
      if (game === 'forever') characterSurname.enable({ emitEvent: false });
      else characterSurname.disable({ emitEvent: false });
      if (game === 'retail') realm.enable({ emitEvent: false });
      else realm.disable({ emitEvent: false });
    });

    effect(() => this.rememberedId.set(readRemembered(this.eventId())));

    // Acompanha a presença lembrada: se o administrador a cancelar, o formulário volta.
    effect((onCleanup) => {
      const eventId = this.eventId();
      const id = this.rememberedId();
      if (!id) {
        this.guest.set(null);
        return;
      }
      // Recém-confirmada aqui: já é exibida enquanto o listener não responde.
      if (untracked(this.guest)?.id !== id) this.guest.set(undefined);
      const stop = this.events.watchGuest(
        eventId,
        id,
        (guest) => {
          this.guest.set(guest);
          if (!guest) remember(eventId, null);
        },
        () => this.guest.set(null),
      );
      onCleanup(stop);
    });
  }

  protected fieldError(field: Field): string | null {
    const control = this.form.controls[field];
    if (control.disabled || (!control.touched && !this.submitted())) return null;
    return firstError(control, MESSAGES[field]);
  }

  protected describedBy(field: Field): string | null {
    return this.fieldError(field) ? `visitante-${field}-erro` : null;
  }

  protected async submit(): Promise<void> {
    if (this.saving()) return;
    this.submitted.set(true);
    this.error.set(null);
    const input = this.toInput();
    if (!input || this.form.invalid) {
      this.form.markAllAsTouched();
      this.focus('.guest-form [aria-invalid="true"]');
      return;
    }

    this.saving.set(true);
    const eventId = this.eventId();
    const result = await this.events.confirmGuest(eventId, input);
    this.saving.set(false);
    // "Já confirmada" também é sucesso: o personagem está na lista.
    if (result.ok || result.error === 'already-confirmed') {
      const key = result.ok ? result.id : guestKey(input);
      remember(eventId, key);
      this.guest.set({ ...guestData(input), id: key, confirmedAt: null });
      this.rememberedId.set(key);
      this.submitted.set(false);
      this.form.reset({ game: '' });
      this.focus('#visitante-status');
      return;
    }
    this.error.set(ERRORS[result.error]);
    this.focus('.guest-form .form-alert');
  }

  /** Esquece a presença neste navegador para confirmar outro personagem (ela continua salva). */
  protected another(): void {
    remember(this.eventId(), null);
    this.rememberedId.set(null);
    this.focus('.guest-form input[type="radio"]');
  }

  private toInput(): GuestInput | null {
    const v = this.form.getRawValue();
    if (v.game === 'forever') {
      return {
        game: 'forever',
        characterName: v.characterName,
        characterSurname: v.characterSurname,
      };
    }
    if (v.game === 'retail') {
      return { game: 'retail', characterName: v.characterName, realm: v.realm };
    }
    return null;
  }

  private focus(selector: string): void {
    afterNextRender(() => this.host.nativeElement.querySelector<HTMLElement>(selector)?.focus(), {
      injector: this.injector,
    });
  }
}
