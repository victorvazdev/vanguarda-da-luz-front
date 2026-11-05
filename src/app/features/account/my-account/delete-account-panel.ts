import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AccountService } from '../../../core/auth/account.service';
import type { DeletionError } from '../../../core/auth/account-deletion';
import { ACCOUNT_MESSAGES } from '../../../core/auth/messages';
import { SessionService } from '../../../core/auth/session.service';
import { PATHS } from '../../../core/routing/paths';
import { firstError } from '../../../shared/forms/field-errors';
import { FlashService } from '../../../shared/ui/flash/flash.service';
import { Modal } from '../../../shared/ui/modal/modal';

const MESSAGES = {
  confirmed: { required: 'Confirme que você entende que a exclusão é permanente.' },
  password: { required: 'Informe sua senha.', wrong: 'Senha incorreta.' },
};

const ERRORS: Partial<Record<DeletionError, string>> = {
  'last-admin':
    'Você é o último administrador ativo da guilda e não pode excluir sua conta. Torne outro membro administrador em Administração > Membros e tente novamente.',
  'too-many-requests': ACCOUNT_MESSAGES.tooManyRequests,
  network: `${ACCOUNT_MESSAGES.network} Nenhum dado foi perdido: você pode tentar de novo.`,
  'not-allowed': 'Sua conta não pode ser excluída no momento. Entre novamente e tente outra vez.',
  unknown:
    'Não foi possível concluir a exclusão. Tente novamente; o que já foi feito não precisa ser refeito.',
};

export const DELETED_MESSAGE = 'Sua conta foi excluída. Obrigado por ter feito parte da guilda.';

/** "Minha conta": excluir a própria conta (ou concluir uma exclusão interrompida). */
@Component({
  selector: 'app-delete-account-panel',
  imports: [ReactiveFormsModule, Modal],
  templateUrl: './delete-account-panel.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DeleteAccountPanel {
  private readonly accounts = inject(AccountService);
  private readonly session = inject(SessionService);
  private readonly flash = inject(FlashService);
  private readonly router = inject(Router);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  private readonly modal = viewChild.required(Modal);

  /** Exclusão iniciada antes e não concluída: só resta concluí-la. */
  protected readonly resuming = computed(() => this.session.access() === 'deleting');
  protected readonly isMember = computed(() => {
    const access = this.session.access();
    return access === 'member' || access === 'admin';
  });
  protected readonly deleting = signal(false);
  protected readonly submitted = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly form = inject(NonNullableFormBuilder).group({
    confirmed: [false, [Validators.requiredTrue]],
    password: ['', [Validators.required]],
  });

  protected open(): void {
    this.form.reset();
    this.submitted.set(false);
    this.error.set(null);
    this.modal().open();
  }

  protected close(): void {
    this.modal().close();
  }

  protected fieldError(field: 'confirmed' | 'password'): string | null {
    const control = this.form.controls[field];
    if (!control.touched && !this.submitted()) return null;
    return firstError(control, MESSAGES[field]);
  }

  protected async confirmDeletion(): Promise<void> {
    if (this.deleting()) return;
    this.submitted.set(true);
    this.error.set(null);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.focus('.delete-account [aria-invalid="true"]');
      return;
    }

    this.deleting.set(true);
    const result = await this.accounts.deleteAccount(this.form.getRawValue().password);
    this.deleting.set(false);

    if (result.ok) {
      // O Firebase encerra a sessão ao excluir o login; garante a saída e vai para o início.
      await this.session.signOut().catch(() => undefined);
      this.modal().close();
      await this.router.navigateByUrl(PATHS.home);
      this.flash.show(DELETED_MESSAGE);
      return;
    }
    if (result.error === 'wrong-password') {
      const control = this.form.controls.password;
      control.setErrors({ wrong: true });
      control.markAsTouched();
      this.focus('#excluir-senha');
      return;
    }
    this.error.set(ERRORS[result.error] ?? ERRORS.unknown!);
    this.focus('.delete-account .form-alert');
  }

  private focus(selector: string): void {
    afterNextRender(() => this.host.nativeElement.querySelector<HTMLElement>(selector)?.focus(), {
      injector: this.injector,
    });
  }
}
