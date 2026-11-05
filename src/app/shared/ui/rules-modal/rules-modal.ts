import { ChangeDetectionStrategy, Component, viewChild } from '@angular/core';
import { Modal } from '../modal/modal';
import { RulesList } from '../rules-list/rules-list';

/** Regras completas em um modal, sem sair da página (cadastro e candidatura). */
@Component({
  selector: 'app-rules-modal',
  imports: [Modal, RulesList],
  template: `
    <app-modal heading="Regras da guilda" size="wide">
      <app-rules-list idPrefix="modal-regra-" />
      <div class="confirm__actions">
        <button type="button" class="btn btn--primary" (click)="close()">Fechar</button>
      </div>
    </app-modal>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RulesModal {
  private readonly modal = viewChild.required(Modal);

  open(): void {
    this.modal().open();
  }

  close(): void {
    this.modal().close();
  }
}
