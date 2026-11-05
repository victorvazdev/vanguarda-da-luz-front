/**
 * O jsdom não implementa `showModal()`/`close()` nem foca elementos de um `<dialog>` fechado.
 * Para testes: abre e fecha pelo atributo `open` e dispara `close`, como o navegador.
 */
export function stubDialog(): void {
  const proto = HTMLDialogElement.prototype as HTMLDialogElement & Record<string, unknown>;
  if (typeof proto.showModal === 'function') return;
  proto.showModal = function (this: HTMLDialogElement) {
    this.setAttribute('open', '');
  };
  proto.close = function (this: HTMLDialogElement) {
    if (!this.hasAttribute('open')) return;
    this.removeAttribute('open');
    this.dispatchEvent(new Event('close'));
  };
}
