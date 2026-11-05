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
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import {
  NonNullableFormBuilder,
  ReactiveFormsModule,
  Validators,
  type ValidatorFn,
} from '@angular/forms';
import { ACCOUNT_MESSAGES } from '../../../core/auth/messages';
import {
  type Character,
  type CharacterError,
  type CharacterInput,
} from '../../../core/data/characters';
import { CharactersService } from '../../../core/data/characters.service';
import {
  GAMES,
  MAX_LEVEL,
  RULESETS,
  characterDisplayName,
  classLabel,
  classesFor,
  gameLabel,
  isClassInGame,
  isGame,
  isValidCombination,
  roleLabel,
  rolesFor,
  rulesetLabel,
  type CharacterClass,
  type CharacterRole,
  type Game,
  type Ruleset,
} from '../../../core/models/wow';
import { firstError, type ErrorMessages } from '../../../shared/forms/field-errors';
import { characterNameFormat } from '../../../shared/forms/validators';
import { ConfirmService } from '../../../shared/ui/confirm-dialog/confirm.service';

type Field =
  | 'game'
  | 'characterName'
  | 'characterSurname'
  | 'server'
  | 'ruleset'
  | 'characterClass'
  | 'characterRole'
  | 'level';

const NAME_FORMAT = 'Use de 2 a 12 letras, sem espaços ou números.';

const MESSAGES: Record<Field, ErrorMessages> = {
  game: { required: 'Selecione o jogo.' },
  characterName: { required: 'Informe o nome do personagem.', characterName: NAME_FORMAT },
  characterSurname: { required: 'Informe o sobrenome do personagem.', characterName: NAME_FORMAT },
  server: { required: 'Informe o servidor.', maxlength: 'Use no máximo 40 caracteres.' },
  ruleset: { required: 'Selecione o ruleset.' },
  characterClass: { required: 'Selecione a classe.' },
  characterRole: { required: 'Selecione a função.' },
  level: { required: 'Informe o nível.', level: 'Informe um número inteiro dentro do limite.' },
};

const ERRORS: Record<CharacterError, string> = {
  'is-main': 'O personagem principal não pode ser removido. Escolha outro principal antes.',
  'not-found': 'Este personagem não existe mais. A lista foi atualizada.',
  'not-allowed': 'Você não tem permissão para alterar este personagem.',
  network: ACCOUNT_MESSAGES.network,
  unknown: 'Não foi possível salvar. Tente novamente.',
};

const GAME_ONLY_FIELDS: Record<Game, readonly ('server' | 'characterSurname' | 'ruleset')[]> = {
  retail: ['server'],
  forever: ['characterSurname', 'ruleset'],
};

/** Nível inteiro de 1 ao máximo do jogo escolhido no mesmo formulário. */
const levelInRange: ValidatorFn = (control) => {
  const raw = control.value as number | string | null;
  if (raw === null || raw === '') return null;
  const game = control.parent?.get('game')?.value as string | undefined;
  const max = isGame(game) ? MAX_LEVEL[game] : Math.max(...Object.values(MAX_LEVEL));
  const level = Number(raw);
  return Number.isInteger(level) && level >= 1 && level <= max ? null : { level: true };
};

interface CharacterView {
  key: string;
  name: string;
  details: string;
  level: string;
  isMain: boolean;
  needsLevel: boolean;
  source: Character;
}

/** História "Editar perfil e personagens": personagens do membro e o principal. */
@Component({
  selector: 'app-characters-panel',
  imports: [ReactiveFormsModule],
  templateUrl: './characters-panel.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CharactersPanel {
  private readonly characters = inject(CharactersService);
  private readonly confirm = inject(ConfirmService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);

  protected readonly games = GAMES;
  protected readonly rulesets = RULESETS;
  protected readonly state = signal<'loading' | 'ready' | 'error'>('loading');
  private readonly list = signal<Character[]>([]);
  /** Formulário aberto: `'new'`, o personagem em edição, ou fechado. */
  protected readonly editing = signal<Character | 'new' | null>(null);
  protected readonly busy = signal<string | null>(null);
  protected readonly saving = signal(false);
  protected readonly submitted = signal(false);
  protected readonly status = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly formError = signal<string | null>(null);

  protected readonly view = computed<CharacterView[]>(() =>
    this.list().map((c) => {
      const place = c.game === 'forever' ? rulesetLabel(c.ruleset ?? '') : (c.server ?? '');
      return {
        key: c.id ?? 'principal',
        name: characterDisplayName(c),
        details: [
          gameLabel(c.game),
          place,
          classLabel(c.characterClass),
          roleLabel(c.characterRole),
        ]
          .filter(Boolean)
          .join(' · '),
        level: c.level === null ? 'Nível não informado' : `Nível ${c.level}`,
        isMain: c.isMain,
        needsLevel: c.level === null,
        source: c,
      };
    }),
  );

  /** O principal ainda é a cópia da candidatura: precisa ser salvo antes de trocar de principal. */
  protected readonly mainPending = computed(() => this.list().some((c) => c.isMain && !c.id));

  protected readonly form = inject(NonNullableFormBuilder).group({
    game: ['' as Game | '', [Validators.required]],
    characterName: ['', [Validators.required, characterNameFormat]],
    characterSurname: [{ value: '', disabled: true }, [Validators.required, characterNameFormat]],
    server: [{ value: '', disabled: true }, [Validators.required, Validators.maxLength(40)]],
    ruleset: [{ value: '' as Ruleset | '', disabled: true }, [Validators.required]],
    characterClass: [{ value: '' as CharacterClass | '', disabled: true }, [Validators.required]],
    characterRole: [{ value: '' as CharacterRole | '', disabled: true }, [Validators.required]],
    level: [null as number | null, [Validators.required, levelInRange]],
    asMain: [false],
  });

  protected readonly game = toSignal(this.form.controls.game.valueChanges, { initialValue: '' });
  private readonly selectedClass = toSignal(this.form.controls.characterClass.valueChanges, {
    initialValue: '',
  });
  protected readonly classes = computed(() => classesFor(this.gameOrNull()));
  protected readonly roles = computed(() =>
    rolesFor(this.gameOrNull(), this.selectedClass() || null),
  );
  protected readonly maxLevel = computed(() => {
    const game = this.gameOrNull();
    return game ? MAX_LEVEL[game] : null;
  });

  protected readonly formTitle = computed(() => {
    const editing = this.editing();
    return editing === 'new'
      ? 'Novo personagem'
      : `Editar ${editing ? characterDisplayName(editing) : ''}`;
  });
  /** Editando o principal: ele continua principal. */
  protected readonly editingMain = computed(() => {
    const editing = this.editing();
    return editing !== null && editing !== 'new' && editing.isMain;
  });

  constructor() {
    const { controls } = this.form;

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
      controls.level.updateValueAndValidity();
    });
    controls.characterClass.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.dropInvalidRole());

    const stop = this.characters.watchMine(
      (list) => {
        this.list.set(list);
        this.state.set('ready');
      },
      () => this.state.set('error'),
    );
    inject(DestroyRef).onDestroy(stop);
  }

  protected fieldError(field: Field): string | null {
    const control = this.form.controls[field];
    if (control.disabled || (!control.touched && !this.submitted())) return null;
    return firstError(control, MESSAGES[field]);
  }

  protected describedBy(field: Field, hint?: string): string | null {
    const ids = [hint, this.fieldError(field) ? `personagem-${field}-erro` : null];
    return ids.filter(Boolean).join(' ') || null;
  }

  protected openNew(): void {
    this.open('new');
  }

  protected edit(character: Character): void {
    this.open(character);
  }

  protected cancelEdit(): void {
    const editing = this.editing();
    this.editing.set(null);
    this.formError.set(null);
    const key = editing && editing !== 'new' ? (editing.id ?? 'principal') : null;
    this.focus(key ? `[data-character="${key}"] .character__edit` : '.characters__add');
  }

  protected async save(): Promise<void> {
    const editing = this.editing();
    if (this.saving() || !editing) return;
    this.submitted.set(true);
    this.formError.set(null);
    this.status.set(null);

    const input = this.form.valid ? this.toInput() : null;
    if (!input) {
      this.form.markAllAsTouched();
      this.focus('.character-form [aria-invalid="true"]');
      return;
    }

    const id = editing === 'new' ? null : editing.id;
    // Enquanto o principal da candidatura não é salvo, outro personagem não pode substituí-lo
    // (a cópia dele se perderia).
    const asMain = this.editingMain() || (this.form.controls.asMain.value && !this.mainPending());
    this.saving.set(true);
    const result = await this.characters.save(id, input, asMain);
    this.saving.set(false);

    if (!result.ok) {
      this.formError.set(ERRORS[result.error]);
      this.focus('.character-form .form-alert');
      return;
    }
    this.editing.set(null);
    this.status.set(editing === 'new' ? 'Personagem adicionado.' : 'Personagem salvo.');
    this.focus(`[data-character="${result.id}"] .character__edit`);
  }

  protected async makeMain(character: Character): Promise<void> {
    if (!character.id || this.busy()) return;
    this.clearMessages();
    this.busy.set(character.id);
    const result = await this.characters.setMain(character.id);
    this.busy.set(null);
    if (result.ok) this.status.set(`${characterDisplayName(character)} agora é o principal.`);
    else this.error.set(ERRORS[result.error]);
  }

  protected async remove(character: Character): Promise<void> {
    if (!character.id || character.isMain || this.busy()) return;
    this.clearMessages();
    const name = characterDisplayName(character);
    const confirmed = await this.confirm.ask({
      title: 'Remover personagem?',
      message: `${name} sairá da sua lista de personagens.`,
      confirmLabel: 'Remover',
      cancelLabel: 'Manter',
      tone: 'danger',
    });
    if (!confirmed) return;
    this.busy.set(character.id);
    const result = await this.characters.remove(character);
    this.busy.set(null);
    if (result.ok) {
      this.status.set(`${name} foi removido.`);
      this.focus('.characters__add');
    } else {
      this.error.set(ERRORS[result.error]);
    }
  }

  private open(target: Character | 'new'): void {
    this.clearMessages();
    this.submitted.set(false);
    this.formError.set(null);
    this.form.reset();
    if (target !== 'new') {
      this.form.controls.game.setValue(target.game);
      this.form.patchValue({
        characterName: target.characterName,
        characterSurname: target.characterSurname ?? '',
        server: target.server ?? '',
        ruleset: target.ruleset ?? '',
        characterClass: target.characterClass,
        characterRole: target.characterRole,
        level: target.level,
      });
    } else {
      for (const field of [
        'characterSurname',
        'server',
        'ruleset',
        'characterClass',
        'characterRole',
      ] as const) {
        this.form.controls[field].disable({ emitEvent: false });
      }
    }
    this.editing.set(target);
    this.focus('.character-form h3');
  }

  private toInput(): CharacterInput | null {
    const v = this.form.getRawValue();
    const common = {
      characterName: v.characterName,
      characterClass: v.characterClass as CharacterClass,
      characterRole: v.characterRole as CharacterRole,
      level: Number(v.level),
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

  private clearMessages(): void {
    this.status.set(null);
    this.error.set(null);
  }

  private gameOrNull(): Game | null {
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
