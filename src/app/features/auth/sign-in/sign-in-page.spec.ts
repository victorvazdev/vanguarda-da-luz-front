import { Component } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { AccountService } from '../../../core/auth/account.service';
import { LoginThrottle } from '../../../core/auth/login-throttle';
import { provideSessionStub } from '../../../core/auth/session.stub';
import type { SignInResult } from '../../../core/auth/sign-in';
import { SignInPage } from './sign-in-page';

@Component({ template: '' })
class Blank {}

class AccountStub {
  readonly loginThrottle = new LoginThrottle();
  calls: [string, string][] = [];
  result: SignInResult = { ok: true, access: 'member' };
  signIn(email: string, password: string) {
    this.calls.push([email, password]);
    if (!this.result.ok && this.result.error === 'invalid-credentials') {
      this.loginThrottle.registerFailure(Date.now());
    }
    return Promise.resolve(this.result);
  }
}

let fixture: ComponentFixture<SignInPage>;
let el: HTMLElement;
let accounts: AccountStub;
let session: ReturnType<typeof provideSessionStub>['stub'];

async function setup(returnUrl?: string) {
  accounts = new AccountStub();
  const s = provideSessionStub('visitor');
  session = s.stub;
  TestBed.configureTestingModule({
    imports: [SignInPage],
    providers: [
      provideRouter([{ path: '**', component: Blank }]),
      { provide: AccountService, useValue: accounts },
      s.provider,
    ],
  });
  fixture = TestBed.createComponent(SignInPage);
  if (returnUrl) fixture.componentRef.setInput('returnUrl', returnUrl);
  el = fixture.nativeElement;
  await fixture.whenStable();
}

function type(id: string, value: string) {
  const input = el.querySelector<HTMLInputElement>(`#${id}`)!;
  input.value = value;
  input.dispatchEvent(new Event('input'));
}

async function submitWith(email = 'elaris@example.com', password = 'segredo123') {
  type('login-email', email);
  type('login-senha', password);
  el.querySelector('form')!.dispatchEvent(new Event('submit'));
  await fixture.whenStable();
}

const alertText = () => el.querySelector('[role="alert"]')?.textContent?.trim() ?? null;

describe('SignInPage (Entrar na conta)', () => {
  it('solicita e-mail e senha e oferece link de recuperação', async () => {
    await setup();
    expect(el.querySelector('label[for="login-email"]')?.textContent?.trim()).toBe('E-mail');
    expect(el.querySelector('label[for="login-senha"]')?.textContent?.trim()).toBe('Senha');
    expect(el.querySelector('a[href="/recuperar-senha"]')?.textContent).toContain(
      'Esqueci minha senha',
    );
  });

  it('campos vazios exibem mensagens e não tentam entrar', async () => {
    await setup();
    await submitWith('', '');
    expect(el.querySelector('#login-email-erro')?.textContent).toContain('Informe o e-mail.');
    expect(el.querySelector('#login-senha-erro')?.textContent).toContain('Informe a senha.');
    expect(accounts.calls).toHaveLength(0);
  });

  it.each([
    ['member', '/calendario'],
    ['admin', '/calendario'],
    ['pending', '/minha-conta'],
  ] as const)('credenciais válidas (%s) levam a %s', async (access, path) => {
    await setup();
    accounts.result = { ok: true, access };
    await submitWith();
    expect(TestBed.inject(Router).url).toBe(path);
  });

  it('volta à página que o usuário tentou abrir', async () => {
    await setup('/eventos/abc');
    await submitWith();
    expect(TestBed.inject(Router).url).toBe('/eventos/abc');
  });

  it('ignora returnUrl externo', async () => {
    await setup('https://malicioso.com');
    await submitWith();
    expect(TestBed.inject(Router).url).toBe('/calendario');
  });

  it('credenciais inválidas exibem mensagem genérica e limpam a senha', async () => {
    await setup();
    accounts.result = { ok: false, error: 'invalid-credentials' };
    await submitWith();
    expect(alertText()).toBe('E-mail ou senha incorretos.');
    expect(el.querySelector<HTMLInputElement>('#login-senha')!.value).toBe('');
  });

  it('conta desativada recebe mensagem explicativa', async () => {
    await setup();
    accounts.result = { ok: false, error: 'disabled' };
    await submitWith();
    expect(alertText()).toContain('Sua conta está desativada');
  });

  it('exibe o aviso da sessão (conta desativada durante o uso)', async () => {
    await setup();
    session.notice.set('Sua conta está desativada e não pode entrar.');
    await fixture.whenStable();
    expect(alertText()).toContain('desativada');
  });

  it('limita tentativas repetidas: bloqueia o botão após 5 falhas', async () => {
    await setup();
    accounts.result = { ok: false, error: 'invalid-credentials' };
    for (let i = 0; i < 5; i++) await submitWith();
    const button = el.querySelector<HTMLButtonElement>('button[type="submit"]')!;
    expect(button.disabled).toBe(true);
    expect(el.querySelector('#login-bloqueio')?.textContent).toContain('Tente novamente em 30 s');

    await submitWith();
    expect(accounts.calls).toHaveLength(5);
    fixture.destroy();
  });

  it('o limite do Firebase também exibe mensagem', async () => {
    await setup();
    accounts.result = { ok: false, error: 'too-many-requests' };
    await submitWith();
    expect(alertText()).toContain('Muitas tentativas');
  });
});
