import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  inject,
  signal,
} from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AccountService } from '../../../core/auth/account.service';
import type { SignUpError } from '../../../core/auth/sign-up';
import { PATHS } from '../../../core/routing/paths';
import { firstError, type ErrorMessages } from '../../../shared/forms/field-errors';
import {
  CONFIRM_PASSWORD_MESSAGES,
  PASSWORD_MESSAGES,
  PASSWORD_MIN_LENGTH,
  passwordsMatch,
  usernameFormat,
} from '../../../shared/forms/validators';

type Field = 'username' | 'email' | 'password' | 'confirmPassword';

const MESSAGES: Record<Field, ErrorMessages> = {
  username: {
    required: 'Informe o nome de usuário.',
    usernameFormat: 'Use de 3 a 20 caracteres: letras sem acento, números, _ ou -.',
    taken: 'Este nome de usuário já está em uso.',
  },
  email: {
    required: 'Informe o e-mail.',
    email: 'Informe um e-mail válido.',
    inUse: 'Este e-mail já está em uso.',
  },
  password: PASSWORD_MESSAGES,
  confirmPassword: CONFIRM_PASSWORD_MESSAGES,
};

const GENERAL_ERRORS: Partial<Record<SignUpError, string>> = {
  'too-many-requests': 'Muitas tentativas seguidas. Aguarde alguns minutos e tente novamente.',
  network: 'Não foi possível conectar. Verifique sua internet e tente novamente.',
  unknown: 'Não foi possível criar a conta. Tente novamente.',
};

/** História "Cadastrar-se". */
@Component({
  selector: 'app-sign-up-page',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './sign-up-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SignUpPage {
  private readonly accounts = inject(AccountService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);

  protected readonly paths = PATHS;
  protected readonly minLength = PASSWORD_MIN_LENGTH;
  protected readonly submitted = signal(false);
  protected readonly submitting = signal(false);
  protected readonly done = signal(false);
  protected readonly generalError = signal<string | null>(null);

  protected readonly form = inject(NonNullableFormBuilder).group(
    {
      username: ['', [Validators.required, usernameFormat]],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(PASSWORD_MIN_LENGTH)]],
      confirmPassword: ['', [Validators.required]],
    },
    { validators: passwordsMatch('password', 'confirmPassword') },
  );

  /** Mensagem do campo, exibida após tocar no campo ou tentar enviar. */
  protected error(field: Field): string | null {
    const control = this.form.controls[field];
    if (!control.touched && !this.submitted()) return null;
    const groupErrors = field === 'confirmPassword' ? this.form.errors : null;
    return firstError(control, MESSAGES[field], groupErrors);
  }

  protected async submit(): Promise<void> {
    if (this.submitting()) return;
    this.submitted.set(true);
    this.generalError.set(null);

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.focusFirstInvalid();
      return;
    }

    this.submitting.set(true);
    const { username, email, password } = this.form.getRawValue();
    const result = await this.accounts.signUp({ username, email, password });
    this.submitting.set(false);

    if (result.ok) {
      this.done.set(true);
      this.focusAfterRender('#titulo-conta-criada');
      return;
    }

    switch (result.error) {
      case 'username-taken':
        this.form.controls.username.setErrors({ taken: true });
        break;
      case 'email-in-use':
        this.form.controls.email.setErrors({ inUse: true });
        break;
      case 'invalid-email':
        this.form.controls.email.setErrors({ email: true });
        break;
      case 'weak-password':
        this.form.controls.password.setErrors({ minlength: true });
        break;
      default:
        this.generalError.set(GENERAL_ERRORS[result.error] ?? GENERAL_ERRORS.unknown!);
    }
    this.focusFirstInvalid();
  }

  private focusFirstInvalid(): void {
    this.focusAfterRender('[aria-invalid="true"], .form-alert');
  }

  private focusAfterRender(selector: string): void {
    afterNextRender(() => this.host.nativeElement.querySelector<HTMLElement>(selector)?.focus(), {
      injector: this.injector,
    });
  }
}
