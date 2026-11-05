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
import { RouterLink } from '@angular/router';
import { AccountService } from '../../../core/auth/account.service';
import type { EmailAction } from '../../../core/auth/account-settings';
import { ACCOUNT_MESSAGES } from '../../../core/auth/messages';
import { SessionService } from '../../../core/auth/session.service';
import { PATHS } from '../../../core/routing/paths';

type Step = 'checking' | 'invalid' | EmailAction;

/**
 * História "Editar perfil e personagens": link da troca de e-mail
 * (`/confirmar-email?mode=verifyAndChangeEmail|recoverEmail&oobCode=…`).
 * Depois da troca o Firebase encerra as sessões, então a pessoa entra de novo.
 */
@Component({
  selector: 'app-email-action-page',
  imports: [RouterLink],
  templateUrl: './email-action-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EmailActionPage implements OnInit {
  private readonly accounts = inject(AccountService);
  private readonly session = inject(SessionService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);

  readonly mode = input<string>();
  readonly oobCode = input<string>();

  protected readonly paths = PATHS;
  protected readonly step = signal<Step>('checking');
  protected readonly error = signal<string | null>(null);

  async ngOnInit(): Promise<void> {
    const result = await this.accounts.applyEmailAction(this.oobCode());
    if (result.ok) {
      if (this.session.isAuthenticated()) await this.session.signOut();
      this.show(result.action);
      return;
    }
    if (result.error === 'network') this.error.set(ACCOUNT_MESSAGES.network);
    this.show('invalid');
  }

  private show(step: Step): void {
    this.step.set(step);
    afterNextRender(() => this.host.nativeElement.querySelector<HTMLElement>('h1')?.focus(), {
      injector: this.injector,
    });
  }
}
