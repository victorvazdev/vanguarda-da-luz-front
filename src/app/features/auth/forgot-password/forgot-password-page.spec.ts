import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AccountService } from '../../../core/auth/account.service';
import type { Result } from '../../../core/auth/password-reset';
import { ForgotPasswordPage } from './forgot-password-page';

class AccountStub {
  calls: string[] = [];
  result: Result = { ok: true };
  requestPasswordReset(email: string) {
    this.calls.push(email);
    return Promise.resolve(this.result);
  }
}

let fixture: ComponentFixture<ForgotPasswordPage>;
let el: HTMLElement;
let accounts: AccountStub;

beforeEach(async () => {
  accounts = new AccountStub();
  TestBed.configureTestingModule({
    imports: [ForgotPasswordPage],
    providers: [provideRouter([]), { provide: AccountService, useValue: accounts }],
  });
  fixture = TestBed.createComponent(ForgotPasswordPage);
  el = fixture.nativeElement;
  await fixture.whenStable();
});

async function submitWith(email: string) {
  const input = el.querySelector<HTMLInputElement>('#recuperar-email')!;
  input.value = email;
  input.dispatchEvent(new Event('input'));
  el.querySelector('form')!.dispatchEvent(new Event('submit'));
  await fixture.whenStable();
}

describe('ForgotPasswordPage (Recuperar a senha)', () => {
  it('solicita o e-mail e oferece volta ao login', () => {
    expect(el.querySelector('label[for="recuperar-email"]')?.textContent?.trim()).toBe('E-mail');
    expect(el.querySelector('a[href="/entrar"]')?.textContent).toContain('Voltar para o login');
  });

  it('valida o e-mail antes de enviar', async () => {
    await submitWith('');
    expect(el.querySelector('#recuperar-email-erro')?.textContent).toContain('Informe o e-mail.');
    await submitWith('invalido');
    expect(el.querySelector('#recuperar-email-erro')?.textContent).toContain('e-mail válido');
    expect(accounts.calls).toHaveLength(0);
  });

  it('mostra a mesma confirmação neutra após o envio, com validade de 1 hora', async () => {
    await submitWith('elaris@example.com');
    expect(accounts.calls).toEqual(['elaris@example.com']);
    const status = el.querySelector('[role="status"]')?.textContent ?? '';
    expect(status).toContain('Se houver uma conta com este e-mail');
    expect(status).toContain('1 hora');
    expect(el.querySelector('form')).toBeNull();
  });

  it('informa falha de conexão', async () => {
    accounts.result = { ok: false, error: 'network' };
    await submitWith('elaris@example.com');
    expect(el.querySelector('[role="alert"]')?.textContent).toContain('Não foi possível conectar');
  });
});
