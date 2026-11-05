import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  effect,
  inject,
  viewChild,
} from '@angular/core';
import { ConfirmService } from './confirm.service';

/**
 * Diálogo de confirmação único da aplicação, colocado no shell.
 * Usa `<dialog>` nativo: modal, prende o foco, fecha com Esc e devolve o foco ao fechar.
 */
@Component({
  selector: 'app-confirm-dialog-host',
  template: `
    <dialog
      #dialog
      class="confirm"
      aria-labelledby="confirm-titulo"
      aria-describedby="confirm-mensagem"
      (close)="onClose()"
      (cancel)="onCancel($event)"
    >
      @if (confirm.current(); as c) {
        <h2 id="confirm-titulo" class="confirm__title">{{ c.title }}</h2>
        <p id="confirm-mensagem" class="confirm__message">{{ c.message }}</p>
        <div class="confirm__actions">
          <button type="button" class="btn btn--outline" (click)="answer(false)" data-initial-focus>
            {{ c.cancelLabel ?? 'Voltar' }}
          </button>
          <button
            type="button"
            class="btn"
            [class.btn--cancel]="c.tone === 'danger'"
            [class.btn--primary]="c.tone !== 'danger'"
            (click)="answer(true)"
          >
            {{ c.confirmLabel }}
          </button>
        </div>
      }
    </dialog>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConfirmDialogHost {
  protected readonly confirm = inject(ConfirmService);
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');
  private readonly injector = inject(Injector);
  private answered: boolean | null = null;

  constructor() {
    effect(() => {
      const el = this.dialog().nativeElement;
      if (this.confirm.current()) {
        this.answered = null;
        // Abre depois de renderizar o conteúdo e foca a opção segura ("Voltar").
        afterNextRender(
          () => {
            if (!el.open && typeof el.showModal === 'function') el.showModal();
            el.querySelector<HTMLElement>('[data-initial-focus]')?.focus();
          },
          { injector: this.injector },
        );
      } else if (el.open) {
        el.close();
      }
    });
  }

  protected answer(confirmed: boolean): void {
    this.answered = confirmed;
    const el = this.dialog().nativeElement;
    if (el.open) el.close();
    else this.onClose();
  }

  protected onCancel(event: Event): void {
    event.preventDefault();
    this.answer(false);
  }

  protected onClose(): void {
    if (this.confirm.current()) this.confirm.settle(this.answered ?? false);
  }
}
