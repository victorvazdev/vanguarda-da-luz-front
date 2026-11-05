import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import {
  NonNullableFormBuilder,
  ReactiveFormsModule,
  Validators,
  type FormGroup,
} from '@angular/forms';
import { AccountService } from '../../../core/auth/account.service';
import type { SettingsError } from '../../../core/auth/account-settings';
import { ACCOUNT_MESSAGES } from '../../../core/auth/messages';
import { SessionService } from '../../../core/auth/session.service';
import { firstError, type ErrorMessages } from '../../../shared/forms/field-errors';
import {
  CONFIRM_PASSWORD_MESSAGES,
  PASSWORD_MESSAGES,
  PASSWORD_MIN_LENGTH,
  battleTagFormat,
  passwordsMatch,
  usernameFormat,
} from '../../../shared/forms/validators';

type Section = 'username' | 'battleTag' | 'email' | 'password';

const CURRENT_PASSWORD: ErrorMessages = {
  required: 'Informe a senha atual.',
  wrong: 'Senha atual incorreta.',
};

const MESSAGES = {
  username: {
    username: {
      required: 'Informe o nome de usuário.',
      usernameFormat: 'Use de 3 a 20 caracteres: letras sem acento, números, _ ou -.',
      taken: 'Este nome de usuário já está em uso.',
    },
  },
  battleTag: {
    battleTag: {
      required: 'Informe seu BattleTag.',
      battleTag: 'Use o formato Nome#1234: de 3 a 12 letras ou números, começando por letra.',
    },
  },
  email: {
    email: {
      required: 'Informe o novo e-mail.',
      email: 'Informe um e-mail válido.',
      same: 'Este já é o seu e-mail.',
      inUse: 'Este e-mail já está em uso.',
    },
    currentPassword: CURRENT_PASSWORD,
  },
  password: {
    currentPassword: CURRENT_PASSWORD,
    password: PASSWORD_MESSAGES,
    confirmPassword: CONFIRM_PASSWORD_MESSAGES,
  },
} satisfies Record<Section, Record<string, ErrorMessages>>;

/** Erros que viram mensagem num campo: [campo, código de validação]. */
const FIELD_ERRORS: Partial<Record<SettingsError, [string, string]>> = {
  'username-taken': ['username', 'taken'],
  'wrong-password': ['currentPassword', 'wrong'],
  'email-in-use': ['email', 'inUse'],
  'invalid-email': ['email', 'email'],
  'same-email': ['email', 'same'],
  'weak-password': ['password', 'minlength'],
};

const GENERAL_ERRORS: Partial<Record<SettingsError, string>> = {
  'too-many-requests': ACCOUNT_MESSAGES.tooManyRequests,
  network: ACCOUNT_MESSAGES.network,
  'not-allowed': 'Sua conta não pode ser alterada no momento.',
};

/** História "Editar perfil e personagens": nome de usuário, e-mail e senha. */
@Component({
  selector: 'app-account-settings-panel',
  imports: [ReactiveFormsModule],
  templateUrl: './account-settings-panel.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccountSettingsPanel {
  private readonly accounts = inject(AccountService);
  protected readonly session = inject(SessionService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  private readonly fb = inject(NonNullableFormBuilder);

  protected readonly minLength = PASSWORD_MIN_LENGTH;
  protected readonly saving = signal<Section | null>(null);
  protected readonly submitted = signal<Record<Section, boolean>>({
    username: false,
    battleTag: false,
    email: false,
    password: false,
  });
  protected readonly success = signal<Partial<Record<Section, string>>>({});
  protected readonly errors = signal<Partial<Record<Section, string>>>({});

  protected readonly forms = {
    username: this.fb.group({ username: ['', [Validators.required, usernameFormat]] }),
    battleTag: this.fb.group({ battleTag: ['', [Validators.required, battleTagFormat]] }),
    email: this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      currentPassword: ['', [Validators.required]],
    }),
    password: this.fb.group(
      {
        currentPassword: ['', [Validators.required]],
        password: ['', [Validators.required, Validators.minLength(PASSWORD_MIN_LENGTH)]],
        confirmPassword: ['', [Validators.required]],
      },
      { validators: passwordsMatch('password', 'confirmPassword') },
    ),
  };

  constructor() {
    // Preenche o nome atual (e acompanha a troca, que chega pela sessão).
    effect(() => {
      const username = this.session.account()?.username;
      if (username === undefined) return;
      untracked(() => {
        const control = this.forms.username.controls.username;
        if (!control.dirty) control.setValue(username);
      });
    });

    // Preenche o BattleTag atual, se já informado.
    effect(() => {
      const battleTag = this.session.account()?.battleTag;
      if (battleTag === undefined) return;
      untracked(() => {
        const control = this.forms.battleTag.controls.battleTag;
        if (!control.dirty) control.setValue(battleTag);
      });
    });
  }

  protected fieldError(section: Section, field: string): string | null {
    const form = this.forms[section] as FormGroup;
    const control = form.get(field);
    if (!control || (!control.touched && !this.submitted()[section])) return null;
    const groupErrors = field === 'confirmPassword' ? form.errors : null;
    const messages = (MESSAGES[section] as Record<string, ErrorMessages>)[field];
    return firstError(control, messages, groupErrors);
  }

  protected describedBy(section: Section, field: string, hint?: string): string | null {
    const ids = [hint, this.fieldError(section, field) ? `conta-${field}-${section}-erro` : null];
    return ids.filter(Boolean).join(' ') || null;
  }

  protected async saveUsername(): Promise<void> {
    const form = this.forms.username;
    if (!this.begin('username', form)) return;
    const result = await this.accounts.changeUsername(form.getRawValue().username);
    this.finish('username', form, result, 'Nome de usuário alterado.');
    if (result.ok) form.markAsPristine();
  }

  protected async saveBattleTag(): Promise<void> {
    const form = this.forms.battleTag;
    if (!this.begin('battleTag', form)) return;
    const result = await this.accounts.changeBattleTag(form.getRawValue().battleTag);
    this.finish('battleTag', form, result, 'BattleTag salvo.');
    if (result.ok) form.markAsPristine();
  }

  protected async saveEmail(): Promise<void> {
    const form = this.forms.email;
    if (!this.begin('email', form)) return;
    const { email, currentPassword } = form.getRawValue();
    const result = await this.accounts.requestEmailChange(currentPassword, email);
    this.finish(
      'email',
      form,
      result,
      `Enviamos um link de confirmação para ${email.trim()}. O e-mail só muda depois que você abrir o link; então entre novamente com o novo e-mail.`,
    );
    if (result.ok) this.reset('email', form);
  }

  protected async savePassword(): Promise<void> {
    const form = this.forms.password;
    if (!this.begin('password', form)) return;
    const { currentPassword, password } = form.getRawValue();
    const result = await this.accounts.changePassword(currentPassword, password);
    this.finish('password', form, result, 'Senha alterada.');
    if (result.ok) this.reset('password', form);
  }

  /** Valida antes de enviar; devolve `false` se não deve enviar. */
  private begin(section: Section, form: FormGroup): boolean {
    if (this.saving()) return false;
    this.submitted.update((s) => ({ ...s, [section]: true }));
    this.success.update((s) => ({ ...s, [section]: undefined }));
    this.errors.update((s) => ({ ...s, [section]: undefined }));
    if (form.invalid) {
      form.markAllAsTouched();
      this.focus(`#conta-${section} [aria-invalid="true"]`);
      return false;
    }
    this.saving.set(section);
    return true;
  }

  private finish(
    section: Section,
    form: FormGroup,
    result: { ok: true } | { ok: false; error: SettingsError },
    message: string,
  ): void {
    this.saving.set(null);
    if (result.ok) {
      this.success.update((s) => ({ ...s, [section]: message }));
      return;
    }
    const field = FIELD_ERRORS[result.error];
    const control = field ? form.get(field[0]) : null;
    if (field && control) {
      control.setErrors({ ...(control.errors ?? {}), [field[1]]: true });
      control.markAsTouched();
      this.focus(`#conta-${section} [aria-invalid="true"]`);
      return;
    }
    this.errors.update((s) => ({
      ...s,
      [section]: GENERAL_ERRORS[result.error] ?? 'Não foi possível salvar. Tente novamente.',
    }));
    this.focus(`#conta-${section} .form-alert`);
  }

  private reset(section: Section, form: FormGroup): void {
    form.reset();
    this.submitted.update((s) => ({ ...s, [section]: false }));
  }

  private focus(selector: string): void {
    afterNextRender(() => this.host.nativeElement.querySelector<HTMLElement>(selector)?.focus(), {
      injector: this.injector,
    });
  }
}
