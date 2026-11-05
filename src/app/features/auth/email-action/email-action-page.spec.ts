import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AccountService } from '../../../core/auth/account.service';
import type { EmailAction, SettingsResult } from '../../../core/auth/account-settings';
import { provideSessionStub } from '../../../core/auth/session.stub';
import { EmailActionPage } from './email-action-page';

class AccountStub {
  result: SettingsResult<{ action: EmailAction }> = { ok: true, action: 'changed' };
  codes: (string | null | undefined)[] = [];
  applyEmailAction(code: string | null | undefined) {
    this.codes.push(code);
    return Promise.resolve(this.result);
  }
}

let fixture: ComponentFixture<EmailActionPage>;
let el: HTMLElement;
let accounts: AccountStub;
let session: ReturnType<typeof provideSessionStub>['stub'];

async function setup(result?: AccountStub['result']) {
  accounts = new AccountStub();
  if (result) accounts.result = result;
  const s = provideSessionStub('member');
  session = s.stub;
  TestBed.configureTestingModule({
    imports: [EmailActionPage],
    providers: [provideRouter([]), s.provider, { provide: AccountService, useValue: accounts }],
  });
  fixture = TestBed.createComponent(EmailActionPage);
  fixture.componentRef.setInput('mode', 'verifyAndChangeEmail');
  fixture.componentRef.setInput('oobCode', 'codigo-1');
  el = fixture.nativeElement;
  await fixture.whenStable();
  await new Promise((resolve) => setTimeout(resolve)); // aplica o link e encerra a sessão
  await fixture.whenStable();
}

const h1 = () => el.querySelector('h1')?.textContent?.trim();

describe('EmailActionPage (troca de e-mail)', () => {
  it('confirma o novo e-mail e encerra a sessão para entrar de novo', async () => {
    await setup();
    expect(accounts.codes).toEqual(['codigo-1']);
    expect(h1()).toBe('E-mail alterado');
    expect(session.signOutCalls).toBe(1);
    expect(el.querySelector('a[href="/entrar"]')).toBeTruthy();
  });

  it('desfazer a troca orienta a redefinir a senha', async () => {
    await setup({ ok: true, action: 'restored' });
    expect(h1()).toBe('E-mail restaurado');
    expect(el.querySelector('a[href="/recuperar-senha"]')).toBeTruthy();
  });

  it('link expirado ou usado', async () => {
    await setup({ ok: false, error: 'invalid-link' });
    expect(h1()).toBe('Link inválido');
    expect(el.textContent).toContain('expirou ou já foi usado');
    expect(session.signOutCalls).toBe(0);
  });
});
