import { ChangeDetectionStrategy, Component, viewChild } from '@angular/core';
import { RULES } from '../../../core/content/guild-content';
import { Modal } from '../modal/modal';
import { RulesList } from '../rules-list/rules-list';

/** Regras completas em um modal, sem sair da página (cadastro e candidatura). */
@Component({
  selector: 'app-rules-modal',
  imports: [Modal, RulesList],
  template: `
    <app-modal heading="Regras da guilda" size="wide">
      <p class="muted">Última atualização: {{ rules.updatedAt }}</p>
      <app-rules-list idPrefix="modal-regra-" />
      <div class="confirm__actions">
        <button type="button" class="btn btn--primary" (click)="close()">Fechar</button>
      </div>
    </app-modal>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RulesModal {
  protected readonly rules = RULES;
  private readonly modal = viewChild.required(Modal);

  open(): void {
    this.modal().open();
  }

  close(): void {
    this.modal().close();
  }
}
