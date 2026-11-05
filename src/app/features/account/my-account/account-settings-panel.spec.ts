import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { AccountService } from '../../../core/auth/account.service';
import type { SettingsResult } from '../../../core/auth/account-settings';
import { provideSessionStub } from '../../../core/auth/session.stub';
import { AccountSettingsPanel } from './account-settings-panel';

class AccountStub {
  result: SettingsResult = { ok: true };
  usernames: string[] = [];
  emails: [string, string][] = [];
  passwords: [string, string][] = [];
  changeUsername(username: string) {
    this.usernames.push(username);
    return Promise.resolve(this.result);
  }
  requestEmailChange(current: string, email: string) {
    this.emails.push([current, email]);
    return Promise.resolve(this.result);
  }
  changePassword(current: string, password: string) {
    this.passwords.push([current, password]);
    return Promise.resolve(this.result);
  }
}

let fixture: ComponentFixture<AccountSettingsPanel>;
let el: HTMLElement;
let accounts: AccountStub;

beforeEach(async () => {
  accounts = new AccountStub();
  const session = provideSessionStub('member');
  TestBed.configureTestingModule({
    imports: [AccountSettingsPanel],
    providers: [session.provider, { provide: AccountService, useValue: accounts }],
  });
  fixture = TestBed.createComponent(AccountSettingsPanel);
  el = fixture.nativeElement;
  await fixture.whenStable();
});

function type(id: string, value: string) {
  const input = el.querySelector<HTMLInputElement>(`#${id}`)!;
  input.value = value;
  input.dispatchEvent(new Event('input'));
}

async function submit(formId: string) {
  el.querySelector(`#${formId}`)!.dispatchEvent(new Event('submit'));
  await fixture.whenStable();
}

const text = (root: ParentNode = el) => root.textContent?.replace(/\s+/g, ' ') ?? '';
const form = (id: string) => el.querySelector<HTMLElement>(`#${id}`)!;

describe('AccountSettingsPanel (dados da conta)', () => {
  it('abre com o nome de usuário e o e-mail atuais', () => {
    expect(el.querySelector<HTMLInputElement>('#conta-username-input')!.value).toBe('Elaris');
    expect(text()).toContain('elaris@example.com');
  });

  it('troca o nome de usuário e avisa quando o nome está em uso', async () => {
    type('conta-username-input', 'Elaria');
    accounts.result = { ok: false, error: 'username-taken' };
    await submit('conta-username');
    expect(text(form('conta-username'))).toContain('Este nome de usuário já está em uso.');

    accounts.result = { ok: true };
    type('conta-username-input', 'Elarinha');
    await submit('conta-username');
    expect(accounts.usernames).toEqual(['Elaria', 'Elarinha']);
    expect(text(form('conta-username'))).toContain('Nome de usuário alterado.');
  });

  it('valida o formato do nome de usuário antes de enviar', async () => {
    type('conta-username-input', 'a b');
    await submit('conta-username');
    expect(text(form('conta-username'))).toContain('Use de 3 a 20 caracteres');
    expect(accounts.usernames).toEqual([]);
  });

  it('pede a troca de e-mail com a senha atual e explica a confirmação', async () => {
    await submit('conta-email');
    expect(text(form('conta-email'))).toContain('Informe o novo e-mail.');
    expect(text(form('conta-email'))).toContain('Informe a senha atual.');

    type('conta-email-input', 'novo@example.com');
    type('conta-email-senha', 'segredo123');
    await submit('conta-email');
    expect(accounts.emails).toEqual([['segredo123', 'novo@example.com']]);
    expect(text(form('conta-email'))).toContain(
      'Enviamos um link de confirmação para novo@example.com',
    );
    expect(el.querySelector<HTMLInputElement>('#conta-email-senha')!.value).toBe('');
  });

  it('senha atual incorreta aparece junto ao campo', async () => {
    accounts.result = { ok: false, error: 'wrong-password' };
    type('conta-senha-atual', 'errada123');
    type('conta-senha-nova', 'novasenha1');
    type('conta-senha-confirmar', 'novasenha1');
    await submit('conta-password');
    expect(text(form('conta-password'))).toContain('Senha atual incorreta.');
  });

  it('troca a senha com as regras do cadastro', async () => {
    type('conta-senha-atual', 'segredo123');
    type('conta-senha-nova', 'curta');
    type('conta-senha-confirmar', 'outra');
    await submit('conta-password');
    expect(text(form('conta-password'))).toContain('no mínimo 8 caracteres');
    expect(text(form('conta-password'))).toContain('As senhas não coincidem.');
    expect(accounts.passwords).toEqual([]);

    type('conta-senha-nova', 'novasenha1');
    type('conta-senha-confirmar', 'novasenha1');
    await submit('conta-password');
    expect(accounts.passwords).toEqual([['segredo123', 'novasenha1']]);
    expect(text(form('conta-password'))).toContain('Senha alterada.');
  });

  it('mostra erros gerais no formulário', async () => {
    accounts.result = { ok: false, error: 'network' };
    type('conta-username-input', 'Elaria');
    await submit('conta-username');
    expect(form('conta-username').querySelector('.form-alert')?.textContent).toContain(
      'Não foi possível conectar',
    );
  });
});
