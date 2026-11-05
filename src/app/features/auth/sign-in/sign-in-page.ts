import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AccountService } from '../../../core/auth/account.service';
import { ACCOUNT_MESSAGES } from '../../../core/auth/messages';
import { SessionService } from '../../../core/auth/session.service';
import type { SignInError } from '../../../core/auth/sign-in';
import { PATHS, landingPathFor } from '../../../core/routing/paths';
import { safeReturnUrl } from '../../../core/routing/return-url';
import { firstError, type ErrorMessages } from '../../../shared/forms/field-errors';

type Field = 'email' | 'password';

const MESSAGES: Record<Field, ErrorMessages> = {
  email: { required: 'Informe o e-mail.', email: 'Informe um e-mail válido.' },
  password: { required: 'Informe a senha.' },
};

const ERRORS: Record<SignInError, string> = {
  'invalid-credentials': ACCOUNT_MESSAGES.invalidCredentials,
  disabled: ACCOUNT_MESSAGES.disabled,
  'too-many-requests': ACCOUNT_MESSAGES.tooManyRequests,
  network: ACCOUNT_MESSAGES.network,
  unknown: 'Não foi possível entrar. Tente novamente.',
};

/** História "Entrar na conta". */
@Component({
  selector: 'app-sign-in-page',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './sign-in-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SignInPage {
  private readonly accounts = inject(AccountService);
  private readonly session = inject(SessionService);
  private readonly router = inject(Router);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);

  /** Página que o visitante tentou abrir antes de ser mandado ao login (`?returnUrl=`). */
  readonly returnUrl = input<string>();

  protected readonly paths = PATHS;
  protected readonly submitted = signal(false);
  protected readonly submitting = signal(false);
  protected readonly error = signal<string | null>(null);
  /** Erro desta tela ou aviso da sessão (ex.: conta desativada durante o uso). */
  protected readonly alert = computed(() => this.error() ?? this.session.notice());

  private readonly lockMs = signal(0);
  protected readonly lockSeconds = computed(() => Math.ceil(this.lockMs() / 1000));
  private lockTimer: ReturnType<typeof setInterval> | null = null;

  protected readonly form = inject(NonNullableFormBuilder).group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]],
  });

  constructor() {
    this.refreshLock();
    inject(DestroyRef).onDestroy(() => this.stopLockTimer());
  }

  protected fieldError(field: Field): string | null {
    const control = this.form.controls[field];
    if (!control.touched && !this.submitted()) return null;
    return firstError(control, MESSAGES[field]);
  }

  protected async submit(): Promise<void> {
    if (this.submitting() || this.lockMs() > 0) return;
    this.submitted.set(true);
    this.error.set(null);
    this.session.clearNotice();

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.focus('[aria-invalid="true"]');
      return;
    }

    this.submitting.set(true);
    const { email, password } = this.form.getRawValue();
    const result = await this.accounts.signIn(email, password);
    this.submitting.set(false);

    if (result.ok) {
      const target = safeReturnUrl(this.returnUrl()) ?? landingPathFor(result.access);
      await this.router.navigateByUrl(target);
      return;
    }

    this.error.set(ERRORS[result.error]);
    this.form.controls.password.reset();
    this.refreshLock();
    this.focus('.form-alert');
  }

  private refreshLock(): void {
    const remaining = this.accounts.loginThrottle.remainingMs(Date.now());
    this.lockMs.set(remaining);
    if (remaining > 0 && !this.lockTimer) {
      this.lockTimer = setInterval(() => {
        const left = this.accounts.loginThrottle.remainingMs(Date.now());
        this.lockMs.set(left);
        if (left === 0) this.stopLockTimer();
      }, 1000);
    }
  }

  private stopLockTimer(): void {
    if (this.lockTimer) clearInterval(this.lockTimer);
    this.lockTimer = null;
  }

  private focus(selector: string): void {
    afterNextRender(() => this.host.nativeElement.querySelector<HTMLElement>(selector)?.focus(), {
      injector: this.injector,
    });
  }
}
