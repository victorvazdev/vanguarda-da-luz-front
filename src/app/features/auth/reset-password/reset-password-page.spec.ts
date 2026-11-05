import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AccountService } from '../../../core/auth/account.service';
import type { Result } from '../../../core/auth/password-reset';
import { ResetPasswordPage } from './reset-password-page';

class AccountStub {
  check: Result<{ email: string }> = { ok: true, email: 'elaris@example.com' };
  reset: Result = { ok: true };
  resets: [string, string][] = [];
  checkResetCode() {
    return Promise.resolve(this.check);
  }
  resetPassword(code: string, password: string) {
    this.resets.push([code, password]);
    return Promise.resolve(this.reset);
  }
}

let fixture: ComponentFixture<ResetPasswordPage>;
let el: HTMLElement;
let accounts: AccountStub;

async function setup(configure?: (a: AccountStub) => void, code = 'codigo-123') {
  accounts = new AccountStub();
  configure?.(accounts);
  TestBed.configureTestingModule({
    imports: [ResetPasswordPage],
    providers: [provideRouter([]), { provide: AccountService, useValue: accounts }],
  });
  fixture = TestBed.createComponent(ResetPasswordPage);
  fixture.componentRef.setInput('mode', 'resetPassword');
  fixture.componentRef.setInput('oobCode', code);
  el = fixture.nativeElement;
  await fixture.whenStable();
}

function type(id: string, value: string) {
  const input = el.querySelector<HTMLInputElement>(`#${id}`)!;
  input.value = value;
  input.dispatchEvent(new Event('input'));
}

async function submitWith(password: string, confirm = password) {
  type('redefinir-senha', password);
  type('redefinir-confirmar', confirm);
  el.querySelector('form')!.dispatchEvent(new Event('submit'));
  await fixture.whenStable();
}

const h1 = () => el.querySelector('h1')?.textContent?.trim();

describe('ResetPasswordPage (Recuperar a senha)', () => {
  it('link válido abre o formulário com o e-mail da conta', async () => {
    await setup();
    expect(h1()).toBe('Redefinir senha');
    expect(el.textContent).toContain('elaris@example.com');
    expect(el.querySelector('label[for="redefinir-senha"]')?.textContent?.trim()).toBe(
      'Nova senha',
    );
  });

  it('link expirado ou inválido mostra mensagem e permite solicitar outro', async () => {
    await setup((a) => (a.check = { ok: false, error: 'invalid-link' }));
    expect(h1()).toBe('Link inválido');
    expect(el.textContent).toContain('expirou ou já foi usado');
    expect(el.querySelector('a[href="/recuperar-senha"]')?.textContent).toContain(
      'Solicitar novo link',
    );
  });

  it('nova senha segue as regras do cadastro (mínimo 8 e confirmação)', async () => {
    await setup();
    await submitWith('1234567');
    expect(el.querySelector('#redefinir-senha-erro')?.textContent).toContain('no mínimo 8');
    await submitWith('segredo123', 'outra-senha');
    expect(el.querySelector('#redefinir-confirmar-erro')?.textContent).toContain('não coincidem');
    expect(accounts.resets).toHaveLength(0);
  });

  it('salva a nova senha e confirma a alteração', async () => {
    await setup();
    await submitWith('nova-senha-1');
    expect(accounts.resets).toEqual([['codigo-123', 'nova-senha-1']]);
    expect(h1()).toBe('Senha alterada');
    expect(el.querySelector('a[href="/entrar"]')).toBeTruthy();
  });

  it('link usado no meio do caminho vira "Link inválido"', async () => {
    await setup((a) => (a.reset = { ok: false, error: 'invalid-link' }));
    await submitWith('nova-senha-1');
    expect(h1()).toBe('Link inválido');
  });
});
