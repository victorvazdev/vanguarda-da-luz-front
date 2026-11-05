import { Injectable, signal } from '@angular/core';

/** Aviso exibido no topo da próxima página (ex.: "Sua conta foi excluída."). */
@Injectable({ providedIn: 'root' })
export class FlashService {
  private readonly _message = signal<string | null>(null);
  readonly message = this._message.asReadonly();

  show(message: string): void {
    this._message.set(message);
  }

  clear(): void {
    this._message.set(null);
  }
}
