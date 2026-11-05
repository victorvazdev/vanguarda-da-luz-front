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
  battleTags: string[] = [];
  changeBattleTag(battleTag: string) {
    this.battleTags.push(battleTag);
    return Promise.resolve(this.result);
  }
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
let session: ReturnType<typeof provideSessionStub>;

beforeEach(async () => {
  accounts = new AccountStub();
  session = provideSessionStub('member');
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

  describe('BattleTag', () => {
    it('informa o BattleTag e avisa que é privado', async () => {
      expect(el.querySelector<HTMLInputElement>('#conta-battleTag-input')!.value).toBe('');
      expect(text(form('conta-battleTag'))).toContain(
        'Visível somente para você e para os administradores.',
      );
      type('conta-battleTag-input', 'Elaris#1234');
      await submit('conta-battleTag');
      expect(accounts.battleTags).toEqual(['Elaris#1234']);
      expect(text(form('conta-battleTag'))).toContain('BattleTag salvo.');
    });

    it('abre com o BattleTag atual e permite alterá-lo', async () => {
      session.stub.account.update((a) => ({ ...a!, battleTag: 'Elaris#1234' }));
      await fixture.whenStable();
      expect(el.querySelector<HTMLInputElement>('#conta-battleTag-input')!.value).toBe(
        'Elaris#1234',
      );
      type('conta-battleTag-input', 'Elarinha#98765');
      await submit('conta-battleTag');
      expect(accounts.battleTags).toEqual(['Elarinha#98765']);
    });

    it('bloqueia vazio ou formato inválido, com a mensagem junto ao campo', async () => {
      await submit('conta-battleTag');
      expect(text(form('conta-battleTag'))).toContain('Informe seu BattleTag.');
      type('conta-battleTag-input', 'Elaris');
      await submit('conta-battleTag');
      expect(el.querySelector('#conta-battleTag-battleTag-erro')?.textContent).toContain(
        'Nome#1234',
      );
      expect(accounts.battleTags).toEqual([]);
    });
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
