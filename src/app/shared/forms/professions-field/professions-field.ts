import { ChangeDetectionStrategy, Component, computed, effect, input, signal } from '@angular/core';
import { NG_VALUE_ACCESSOR, type ControlValueAccessor, type ValidatorFn } from '@angular/forms';
import {
  MAX_PROFESSIONS,
  isValidProfessions,
  professionsFor,
  type Game,
  type Profession,
} from '../../../core/models/wow';

/**
 * Valor do campo: profissões escolhidas, `[]` para "não tenho profissão" ou `null` enquanto
 * nada foi informado.
 */
export type ProfessionsValue = Profession[] | null;

/** Obrigatório informar: ao menos uma profissão ou "não tenho profissão". */
export const professionsRequired: ValidatorFn = (control) =>
  control.value === null || control.value === undefined ? { required: true } : null;

/** Limite e profissões do jogo escolhido no mesmo formulário (campo `game`). */
export const professionsInGame: ValidatorFn = (control) => {
  const value = control.value as ProfessionsValue;
  const game = control.parent?.get('game')?.value as Game | '' | undefined;
  if (!value || !game) return null;
  return isValidProfessions(game, value) ? null : { professions: true };
};

export const PROFESSIONS_MESSAGES = {
  required: 'Selecione as profissões ou marque que o personagem não tem profissão.',
  professions: `Escolha no máximo ${MAX_PROFESSIONS} profissões do jogo selecionado.`,
} as const;

/**
 * Escolha de profissões primárias (até 2, conforme o jogo) com a opção "não tenho profissão".
 * Ao atingir o limite, as demais opções ficam indisponíveis.
 */
@Component({
  selector: 'app-professions-field',
  template: `
    <fieldset
      class="choices"
      [attr.aria-describedby]="describedBy()"
      [attr.aria-invalid]="invalid() || null"
    >
      <legend class="field__label">Profissões</legend>
      <p [id]="idPrefix() + '-dica'" class="field__hint">
        @if (game()) {
          Escolha até {{ max }} profissões primárias.
        } @else {
          Escolha o jogo para ver as profissões.
        }
      </p>
      @if (options().length) {
        <div class="choices__options">
          @for (p of options(); track p.id) {
            <label class="choice" [class.choice--disabled]="isBlocked(p.id)">
              <input
                class="choice__input"
                type="checkbox"
                [checked]="isChecked(p.id)"
                [disabled]="disabled() || isBlocked(p.id)"
                [attr.aria-invalid]="invalid()"
                (change)="toggle(p.id, $event)"
                (blur)="onTouched()"
              />
              {{ p.label }}
            </label>
          }
        </div>
        <div class="checkbox">
          <input
            [id]="idPrefix() + '-nenhuma'"
            class="checkbox__input"
            type="checkbox"
            [checked]="value() !== null && value()!.length === 0"
            [disabled]="disabled()"
            [attr.aria-invalid]="invalid()"
            (change)="toggleNone($event)"
            (blur)="onTouched()"
          />
          <label class="checkbox__label" [for]="idPrefix() + '-nenhuma'"
            >O personagem não tem profissão</label
          >
        </div>
      }
      @if (error(); as message) {
        <p [id]="idPrefix() + '-erro'" class="field__error">{{ message }}</p>
      }
    </fieldset>
  `,
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: ProfessionsField, multi: true }],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProfessionsField implements ControlValueAccessor {
  readonly game = input.required<Game | null>();
  /** Prefixo dos IDs de dica e erro (ex.: `candidatura-professions`). */
  readonly idPrefix = input.required<string>();
  readonly error = input<string | null>(null);

  protected readonly max = MAX_PROFESSIONS;
  protected readonly value = signal<ProfessionsValue>(null);
  protected readonly disabled = signal(false);
  protected readonly options = computed(() => professionsFor(this.game()));
  protected readonly invalid = computed(() => !!this.error());
  protected readonly describedBy = computed(() =>
    [`${this.idPrefix()}-dica`, this.error() ? `${this.idPrefix()}-erro` : null]
      .filter(Boolean)
      .join(' '),
  );

  private onChange: (value: ProfessionsValue) => void = () => undefined;
  protected onTouched: () => void = () => undefined;

  constructor() {
    // Ao trocar de jogo, descarta profissões que não existem nele.
    effect(() => {
      const ids = this.options().map((o) => o.id);
      const current = this.value();
      if (!current?.length || !ids.length) return;
      const kept = current.filter((p) => ids.includes(p));
      if (kept.length !== current.length) this.emit(kept.length ? kept : null);
    });
  }

  writeValue(value: ProfessionsValue | undefined): void {
    this.value.set(Array.isArray(value) ? [...value] : null);
  }

  registerOnChange(fn: (value: ProfessionsValue) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(disabled: boolean): void {
    this.disabled.set(disabled);
  }

  protected isChecked(id: Profession): boolean {
    return this.value()?.includes(id) ?? false;
  }

  /** Limite atingido: as opções não marcadas ficam indisponíveis. */
  protected isBlocked(id: Profession): boolean {
    return (this.value()?.length ?? 0) >= MAX_PROFESSIONS && !this.isChecked(id);
  }

  protected toggle(id: Profession, event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    const current = this.value() ?? [];
    const next = checked ? [...current, id] : current.filter((p) => p !== id);
    this.emit(next.length ? next : null);
  }

  protected toggleNone(event: Event): void {
    this.emit((event.target as HTMLInputElement).checked ? [] : null);
  }

  private emit(value: ProfessionsValue): void {
    this.value.set(value);
    this.onChange(value);
    this.onTouched();
  }
}
