import { TestBed } from '@angular/core/testing';
import { ConfirmDialogHost } from './confirm-dialog-host';
import { ConfirmService } from './confirm.service';

const options = { title: 'Recusar?', message: 'Tem certeza?', confirmLabel: 'Recusar' };

describe('ConfirmService', () => {
  it('resolve com a resposta do usuário', async () => {
    const service = new ConfirmService();
    const answer = service.ask(options);
    expect(service.current()?.title).toBe('Recusar?');
    service.settle(true);
    expect(await answer).toBe(true);
    expect(service.current()).toBeNull();
  });

  it('um novo pedido cancela o anterior', async () => {
    const service = new ConfirmService();
    const first = service.ask(options);
    const second = service.ask({ ...options, title: 'Outro' });
    expect(await first).toBe(false);
    service.settle(true);
    expect(await second).toBe(true);
  });
});

describe('ConfirmDialogHost', () => {
  it('mostra título, mensagem e ações; "Voltar" responde não', async () => {
    const fixture = TestBed.createComponent(ConfirmDialogHost);
    const service = TestBed.inject(ConfirmService);
    const answer = service.ask({ ...options, tone: 'danger' });
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const dialog = el.querySelector('dialog')!;
    expect(dialog.getAttribute('aria-labelledby')).toBe('confirm-titulo');
    expect(el.querySelector('#confirm-titulo')?.textContent).toBe('Recusar?');
    const [back, confirm] = [...el.querySelectorAll('button')];
    expect(confirm.classList).toContain('btn--cancel');
    back.click();
    expect(await answer).toBe(false);
  });

  it('confirmar responde sim', async () => {
    const fixture = TestBed.createComponent(ConfirmDialogHost);
    const service = TestBed.inject(ConfirmService);
    const answer = service.ask(options);
    await fixture.whenStable();
    [...(fixture.nativeElement as HTMLElement).querySelectorAll('button')][1].click();
    expect(await answer).toBe(true);
  });
});
