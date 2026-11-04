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
import { ACCOUNT_MESSAGES } from '../../../core/auth/messages';
import { PATHS } from '../../../core/routing/paths';
import { firstError } from '../../../shared/forms/field-errors';

const EMAIL_MESSAGES = { required: 'Informe o e-mail.', email: 'Informe um e-mail válido.' };

/** História "Recuperar a senha": solicitação do link. */
@Component({
  selector: 'app-forgot-password-page',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './forgot-password-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ForgotPasswordPage {
  private readonly accounts = inject(AccountService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);

  protected readonly paths = PATHS;
  protected readonly submitted = signal(false);
  protected readonly submitting = signal(false);
  protected readonly sent = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly form = inject(NonNullableFormBuilder).group({
    email: ['', [Validators.required, Validators.email]],
  });

  protected emailError(): string | null {
    const control = this.form.controls.email;
    if (!control.touched && !this.submitted()) return null;
    return firstError(control, EMAIL_MESSAGES);
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
    const result = await this.accounts.requestPasswordReset(this.form.getRawValue().email);
    this.submitting.set(false);

    if (result.ok) {
      this.sent.set(true);
      this.focus('#titulo-recuperar');
      return;
    }
    this.error.set(
      result.error === 'too-many-requests'
        ? ACCOUNT_MESSAGES.tooManyRequests
        : result.error === 'network'
          ? ACCOUNT_MESSAGES.network
          : 'Não foi possível enviar o link. Tente novamente.',
    );
    this.focus('.form-alert');
  }

  private focus(selector: string): void {
    afterNextRender(() => this.host.nativeElement.querySelector<HTMLElement>(selector)?.focus(), {
      injector: this.injector,
    });
  }
}
