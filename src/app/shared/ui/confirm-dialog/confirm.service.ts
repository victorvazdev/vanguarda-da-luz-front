import { Injectable, signal } from '@angular/core';

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel?: string;
  /** `danger` usa o estilo de ação de cancelamento no botão de confirmar. */
  tone?: 'default' | 'danger';
}

interface PendingConfirm extends ConfirmOptions {
  resolve: (confirmed: boolean) => void;
}

/** Pede confirmação ao usuário com um diálogo acessível (ver ConfirmDialogHost). */
@Injectable({ providedIn: 'root' })
export class ConfirmService {
  private readonly _current = signal<PendingConfirm | null>(null);
  readonly current = this._current.asReadonly();

  ask(options: ConfirmOptions): Promise<boolean> {
    this._current()?.resolve(false);
    return new Promise((resolve) => this._current.set({ ...options, resolve }));
  }

  /** Chamado pelo diálogo ao fechar. */
  settle(confirmed: boolean): void {
    const current = this._current();
    this._current.set(null);
    current?.resolve(confirmed);
  }
}
