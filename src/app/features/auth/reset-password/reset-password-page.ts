import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Injector,
  OnInit,
  afterNextRender,
  inject,
  input,
  signal,
} from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AccountService } from '../../../core/auth/account.service';
import { ACCOUNT_MESSAGES } from '../../../core/auth/messages';
import { PATHS } from '../../../core/routing/paths';
import { firstError, type ErrorMessages } from '../../../shared/forms/field-errors';
import {
  CONFIRM_PASSWORD_MESSAGES,
  PASSWORD_MESSAGES,
  PASSWORD_MIN_LENGTH,
  passwordsMatch,
} from '../../../shared/forms/validators';

type Field = 'password' | 'confirmPassword';

/** Links de e-mail que usam a mesma URL de ação (configurada uma vez no Console). */
const EMAIL_MODES = ['verifyAndChangeEmail', 'recoverEmail'];
type Step = 'checking' | 'form' | 'invalid' | 'done';

const MESSAGES: Record<Field, ErrorMessages> = {
  password: PASSWORD_MESSAGES,
  confirmPassword: CONFIRM_PASSWORD_MESSAGES,
};

/**
 * História "Recuperar a senha": página aberta pelo link do e-mail
 * (`/redefinir-senha?mode=resetPassword&oobCode=…`).
 */
@Component({
  selector: 'app-reset-password-page',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './reset-password-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ResetPasswordPage implements OnInit {
  private readonly accounts = inject(AccountService);
  private readonly router = inject(Router);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);

  readonly mode = input<string>();
  readonly oobCode = input<string>();

  protected readonly paths = PATHS;
  protected readonly minLength = PASSWORD_MIN_LENGTH;
  protected readonly step = signal<Step>('checking');
  protected readonly email = signal('');
  protected readonly submitted = signal(false);
  protected readonly submitting = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly form = inject(NonNullableFormBuilder).group(
    {
      password: ['', [Validators.required, Validators.minLength(PASSWORD_MIN_LENGTH)]],
      confirmPassword: ['', [Validators.required]],
    },
    { validators: passwordsMatch('password', 'confirmPassword') },
  );

  async ngOnInit(): Promise<void> {
    const mode = this.mode();
    if (mode && EMAIL_MODES.includes(mode)) {
      await this.router.navigate([PATHS.emailAction], {
        queryParams: { mode, oobCode: this.oobCode() },
        replaceUrl: true,
      });
      return;
    }
    if (mode && mode !== 'resetPassword') {
      this.show('invalid');
      return;
    }
    const result = await this.accounts.checkResetCode(this.oobCode());
    if (result.ok) {
      this.email.set(result.email);
      this.show('form');
    } else if (result.error === 'network') {
      this.error.set(ACCOUNT_MESSAGES.network);
      this.show('invalid');
    } else {
      this.show('invalid');
    }
  }

  protected fieldError(field: Field): string | null {
    const control = this.form.controls[field];
    if (!control.touched && !this.submitted()) return null;
    const groupErrors = field === 'confirmPassword' ? this.form.errors : null;
    return firstError(control, MESSAGES[field], groupErrors);
  }

  protected async submit(): Promise<void> {
    if (this.submitting()) return;
    this.submitted.set(true);
    this.error.set(null);

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.focus('[aria-invalid="true"]');
      return;
    }

    this.submitting.set(true);
    const result = await this.accounts.resetPassword(
      this.oobCode() ?? '',
      this.form.getRawValue().password,
    );
    this.submitting.set(false);

    if (result.ok) {
      this.show('done');
    } else if (result.error === 'invalid-link') {
      this.show('invalid');
    } else if (result.error === 'weak-password') {
      this.form.controls.password.setErrors({ minlength: true });
      this.focus('[aria-invalid="true"]');
    } else {
      this.error.set(
        result.error === 'network'
          ? ACCOUNT_MESSAGES.network
          : 'Não foi possível alterar a senha. Tente novamente.',
      );
      this.focus('.form-alert');
    }
  }

  private show(step: Step): void {
    this.step.set(step);
    if (step !== 'checking') this.focus('h1');
  }

  private focus(selector: string): void {
    afterNextRender(() => this.host.nativeElement.querySelector<HTMLElement>(selector)?.focus(), {
      injector: this.injector,
    });
  }
}
