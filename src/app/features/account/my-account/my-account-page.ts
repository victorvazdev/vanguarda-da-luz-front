import {
  ChangeDetectionStrategy,
  Component,
  ViewEncapsulation,
  computed,
  inject,
} from '@angular/core';
import { isMemberAccess } from '../../../core/auth/access';
import { SessionService } from '../../../core/auth/session.service';
import { AccountSettingsPanel } from './account-settings-panel';
import { ApplicationStatusPanel } from './application-status';
import { CharactersPanel } from './characters-panel';
import { DeleteAccountPanel } from './delete-account-panel';

/**
 * "Minha conta": acompanhamento da candidatura (conta pendente), personagens (membros)
 * dados da conta (nome de usuário, e-mail e senha) e exclusão da conta.
 */
@Component({
  selector: 'app-my-account-page',
  imports: [AccountSettingsPanel, ApplicationStatusPanel, CharactersPanel, DeleteAccountPanel],
  templateUrl: './my-account-page.html',
  styleUrl: './my-account-page.scss',
  // Os estilos valem para os painéis filhos.
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MyAccountPage {
  private readonly session = inject(SessionService);
  protected readonly isMember = computed(() => isMemberAccess(this.session.access()));
  protected readonly deleting = computed(() => this.session.access() === 'deleting');
}
