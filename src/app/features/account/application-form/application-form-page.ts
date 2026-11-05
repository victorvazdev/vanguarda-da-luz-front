import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Injector,
  OnInit,
  afterNextRender,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import {
  FormControl,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { Router } from '@angular/router';
import { ACCOUNT_MESSAGES } from '../../../core/auth/messages';
import {
  canSubmit,
  type ApplicationInput,
  type SubmitError,
} from '../../../core/data/applications';
import { ApplicationsService } from '../../../core/data/applications.service';
import {
  GAMES,
  RULESETS,
  classesFor,
  isClassInGame,
  isGame,
  isValidCombination,
  rolesFor,
  type CharacterClass,
  type CharacterRole,
  type Game,
  type Ruleset,
} from '../../../core/models/wow';
import { PATHS } from '../../../core/routing/paths';
import { firstError, type ErrorMessages } from '../../../shared/forms/field-errors';
import {
  PROFESSIONS_MESSAGES,
  ProfessionsField,
  professionsInGame,
  professionsRequired,
  type ProfessionsValue,
} from '../../../shared/forms/professions-field/professions-field';
import { battleTagFormat, characterNameFormat } from '../../../shared/forms/validators';
import { RulesModal } from '../../../shared/ui/rules-modal/rules-modal';

type Field =
  | 'game'
  | 'characterName'
  | 'characterSurname'
  | 'server'
  | 'ruleset'
  | 'characterClass'
  | 'characterRole'
  | 'professions'
  | 'battleTag'
  | 'motivation'
  | 'rulesAccepted';

export const MOTIVATION_MAX = 1000;

const MESSAGES: Record<Field, ErrorMessages> = {
  game: { required: 'Selecione o jogo.' },
  characterName: {
    required: 'Informe o nome do personagem.',
    characterName: 'Use de 2 a 12 letras, sem espaços ou números.',
  },
  characterSurname: {
    required: 'Informe o sobrenome do personagem.',
    characterName: 'Use de 2 a 12 letras, sem espaços ou números.',
  },
  server: { required: 'Informe o servidor.', maxlength: 'Use no máximo 40 caracteres.' },
  ruleset: { required: 'Selecione o ruleset.' },
  characterClass: { required: 'Selecione a classe.' },
  characterRole: { required: 'Selecione a função.' },
  professions: PROFESSIONS_MESSAGES,
  battleTag: {
    required: 'Informe seu BattleTag.',
    battleTag: 'Use o formato Nome#1234: de 3 a 12 letras ou números, começando por letra.',
  },
  motivation: {
    required: 'Conte por que você quer entrar na guilda.',
    maxlength: `Use no máximo ${MOTIVATION_MAX} caracteres.`,
  },
  rulesAccepted: { required: 'Confirme que leu e aceita as regras da guilda.' },
};

const SUBMIT_ERRORS: Partial<Record<SubmitError, string>> = {
  'not-allowed': 'Somente contas aguardando aprovação podem enviar candidatura.',
  network: ACCOUNT_MESSAGES.network,
  unknown: 'Não foi possível enviar a candidatura. Tente novamente.',
};

/** Campos que só existem em um dos jogos. */
const GAME_ONLY_FIELDS: Record<Game, readonly ('server' | 'characterSurname' | 'ruleset')[]> = {
  retail: ['server'],
  forever: ['characterSurname', 'ruleset'],
};

/** História "Enviar candidatura" (World of Warcraft Retail ou Forever). */
@Component({
  selector: 'app-application-form-page',
  imports: [ReactiveFormsModule, ProfessionsField, RulesModal],
  templateUrl: './application-form-page.html',
  styleUrl: './application-form-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ApplicationFormPage implements OnInit {
  private readonly applications = inject(ApplicationsService);
  private readonly router = inject(Router);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);

  protected readonly games = GAMES;
  protected readonly rulesets = RULESETS;
  protected readonly motivationMax = MOTIVATION_MAX;
  protected readonly ready = signal(false);
  protected readonly isResubmission = signal(false);
  protected readonly submitted = signal(false);
  protected readonly submitting = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly form = inject(NonNullableFormBuilder).group({
    game: ['' as Game | '', [Validators.required]],
    characterName: ['', [Validators.required, characterNameFormat]],
    characterSurname: [{ value: '', disabled: true }, [Validators.required, characterNameFormat]],
    server: [{ value: '', disabled: true }, [Validators.required, Validators.maxLength(40)]],
    ruleset: [{ value: '' as Ruleset | '', disabled: true }, [Validators.required]],
    characterClass: [{ value: '' as CharacterClass | '', disabled: true }, [Validators.required]],
    characterRole: [{ value: '' as CharacterRole | '', disabled: true }, [Validators.required]],
    professions: new FormControl<ProfessionsValue>(null, [professionsRequired, professionsInGame]),
    battleTag: ['', [Validators.required, battleTagFormat]],
    motivation: ['', [Validators.required, Validators.maxLength(MOTIVATION_MAX)]],
    rulesAccepted: [false, [Validators.requiredTrue]],
  });

  protected readonly game = toSignal(this.form.controls.game.valueChanges, { initialValue: '' });
  private readonly selectedClass = toSignal(this.form.controls.characterClass.valueChanges, {
    initialValue: '',
  });
  protected readonly classes = computed(() => classesFor(this.gameOrNull()));
  /** Funções possíveis para a classe escolhida no jogo escolhido. */
  protected readonly roles = computed(() =>
    rolesFor(this.gameOrNull(), this.selectedClass() || null),
  );

  constructor() {
    const { controls } = this.form;

    // Ao trocar de jogo: habilita os campos do jogo e descarta classe/função que não existem nele.
    controls.game.valueChanges.pipe(takeUntilDestroyed()).subscribe((game) => {
      if (!isGame(game)) return;
      for (const g of ['retail', 'forever'] as const) {
        for (const field of GAME_ONLY_FIELDS[g]) {
          if (g === game) controls[field].enable({ emitEvent: false });
          else controls[field].disable({ emitEvent: false });
        }
      }
      controls.characterClass.enable({ emitEvent: false });
      controls.characterRole.enable({ emitEvent: false });
      if (controls.characterClass.value && !isClassInGame(game, controls.characterClass.value)) {
        controls.characterClass.setValue('');
      }
      this.dropInvalidRole();
      controls.professions.updateValueAndValidity();
    });

    // Ao trocar de classe, descarta uma função que ela não pode exercer.
    controls.characterClass.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.dropInvalidRole());
  }

  async ngOnInit(): Promise<void> {
    try {
      const current = await this.applications.mine();
      if (!canSubmit(current)) {
        // Já existe candidatura pendente (ou aprovada): mostra o acompanhamento.
        await this.router.navigateByUrl(PATHS.account, { replaceUrl: true });
        return;
      }
      if (current) {
        // Reenvio após recusa: parte dos dados anteriores (o jogo primeiro, para habilitar os campos).
        this.isResubmission.set(true);
        this.form.controls.game.setValue(current.game);
        this.form.patchValue({
          characterName: current.characterName,
          characterSurname: current.characterSurname ?? '',
          server: current.server ?? '',
          ruleset: current.ruleset ?? '',
          characterClass: current.characterClass,
          characterRole: current.characterRole,
          professions: current.professions,
          battleTag: current.battleTag ?? '',
          motivation: current.motivation,
        });
      }
    } catch {
      this.error.set('Não foi possível carregar sua candidatura. Recarregue a página.');
    }
    this.ready.set(true);
  }

  protected fieldError(field: Field): string | null {
    const control = this.form.controls[field];
    if (control.disabled || (!control.touched && !this.submitted())) return null;
    return firstError(control, MESSAGES[field]);
  }

  protected describedBy(field: Field, hint?: string): string | null {
    const ids = [hint, this.fieldError(field) ? `candidatura-${field}-erro` : null];
    return ids.filter(Boolean).join(' ') || null;
  }

  protected async submit(): Promise<void> {
    if (this.submitting()) return;
    this.submitted.set(true);
    this.error.set(null);

    const input = this.form.valid ? this.toInput() : null;
    if (!input) {
      this.form.markAllAsTouched();
      this.focus('[aria-invalid="true"]');
      return;
    }

    this.submitting.set(true);
    const result = await this.applications.submit(input);
    this.submitting.set(false);

    if (result.ok || result.error === 'already-pending' || result.error === 'already-approved') {
      await this.router.navigateByUrl(PATHS.account);
      return;
    }
    this.error.set(SUBMIT_ERRORS[result.error] ?? SUBMIT_ERRORS.unknown!);
    this.focus('.form-alert');
  }

  private toInput(): ApplicationInput | null {
    const v = this.form.getRawValue();
    const common = {
      characterName: v.characterName,
      characterClass: v.characterClass as CharacterClass,
      characterRole: v.characterRole as CharacterRole,
      professions: v.professions ?? [],
      battleTag: v.battleTag,
      motivation: v.motivation,
    };
    if (v.game === 'retail') return { ...common, game: 'retail', server: v.server };
    if (v.game === 'forever') {
      return {
        ...common,
        game: 'forever',
        characterSurname: v.characterSurname,
        ruleset: v.ruleset as Ruleset,
      };
    }
    return null;
  }

  protected gameOrNull(): Game | null {
    const game = this.game();
    return isGame(game) ? game : null;
  }

  private dropInvalidRole(): void {
    const { game, characterClass, characterRole } = this.form.controls;
    if (
      isGame(game.value) &&
      characterClass.value &&
      characterRole.value &&
      !isValidCombination(game.value, characterClass.value, characterRole.value)
    ) {
      characterRole.setValue('');
    }
  }

  private focus(selector: string): void {
    afterNextRender(() => this.host.nativeElement.querySelector<HTMLElement>(selector)?.focus(), {
      injector: this.injector,
    });
  }
}
