import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';

let nextId = 0;

/**
 * Modal com `<dialog>` nativo: o resto da página fica inerte (o foco não sai do modal), fecha
 * pelo botão, pela tecla Esc ou por um clique no fundo, e devolve o foco a quem o abriu.
 */
@Component({
  selector: 'app-modal',
  template: `
    <dialog
      #dialog
      class="confirm modal"
      [class.modal--wide]="size() === 'wide'"
      [attr.aria-labelledby]="titleId"
      (cancel)="onCancel($event)"
      (close)="onClose()"
    >
      <div class="modal__header">
        <h2 [id]="titleId" class="confirm__title modal__title" tabindex="-1">{{ heading() }}</h2>
        <button
          type="button"
          class="modal__close"
          [disabled]="locked()"
          (click)="close()"
          aria-label="Fechar"
        >
          <span aria-hidden="true">×</span>
        </button>
      </div>
      <div class="modal__body">
        <ng-content />
      </div>
    </dialog>
  `,
  // Clique no fundo: atalho de mouse; pelo teclado, o equivalente é a tecla Esc.
  host: { '(click)': 'onBackdropClick($event)' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Modal {
  readonly heading = input.required<string>();
  readonly size = input<'default' | 'wide'>('default');
  /** Impede fechar (ex.: durante uma operação que não pode ser interrompida). */
  readonly locked = input(false);
  readonly closed = output<void>();

  protected readonly titleId = `modal-titulo-${++nextId}`;
  protected readonly isOpen = signal(false);
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');
  private readonly injector = inject(Injector);
  private opener: HTMLElement | null = null;

  open(): void {
    if (this.isOpen()) return;
    const active = document.activeElement;
    this.opener = active instanceof HTMLElement ? active : null;
    this.isOpen.set(true);
    // Abre depois de renderizar o conteúdo e leva o foco ao título.
    afterNextRender(
      () => {
        const el = this.dialog().nativeElement;
        if (!el.open && typeof el.showModal === 'function') el.showModal();
        const initial =
          el.querySelector<HTMLElement>('[data-initial-focus]') ??
          el.querySelector<HTMLElement>(`#${this.titleId}`);
        initial?.focus();
      },
      { injector: this.injector },
    );
  }

  close(): void {
    if (!this.isOpen() || this.locked()) return;
    const el = this.dialog().nativeElement;
    if (el.open) el.close();
    else this.onClose();
  }

  protected onCancel(event: Event): void {
    // Esc: fecha pelo mesmo caminho do botão (respeitando `locked`).
    event.preventDefault();
    this.close();
  }

  /** Clique no fundo: o alvo é o próprio `<dialog>`, não o conteúdo. */
  protected onBackdropClick(event: MouseEvent): void {
    if (event.target === this.dialog().nativeElement) this.close();
  }

  protected onClose(): void {
    if (!this.isOpen()) return;
    this.isOpen.set(false);
    const opener = this.opener;
    this.opener = null;
    opener?.focus();
    this.closed.emit();
  }
}
