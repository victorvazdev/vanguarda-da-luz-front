import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AccountService } from '../../../core/auth/account.service';
import type { SignUpInput, SignUpResult } from '../../../core/auth/sign-up';
import { stubDialog } from '../../../shared/ui/modal/dialog.stub';
import { SignUpPage } from './sign-up-page';

stubDialog();

class AccountStub {
  calls: SignUpInput[] = [];
  result: SignUpResult = { ok: true, uid: 'u1' };
  signUp(input: SignUpInput) {
    this.calls.push(input);
    return Promise.resolve(this.result);
  }
}

let fixture: ComponentFixture<SignUpPage>;
let el: HTMLElement;
let accounts: AccountStub;

async function setup() {
  accounts = new AccountStub();
  TestBed.configureTestingModule({
    imports: [SignUpPage],
    providers: [provideRouter([]), { provide: AccountService, useValue: accounts }],
  });
  fixture = TestBed.createComponent(SignUpPage);
  el = fixture.nativeElement;
  await fixture.whenStable();
}

function type(id: string, value: string) {
  const input = el.querySelector<HTMLInputElement>(`#${id}`)!;
  input.value = value;
  input.dispatchEvent(new Event('input'));
  input.dispatchEvent(new Event('blur'));
}

async function fill(values: Partial<Record<'usuario' | 'email' | 'senha' | 'confirmar', string>>) {
  const all = {
    usuario: 'Elaris',
    email: 'elaris@example.com',
    senha: 'segredo123',
    confirmar: 'segredo123',
    ...values,
  };
  type('cadastro-usuario', all.usuario);
  type('cadastro-email', all.email);
  type('cadastro-senha', all.senha);
  type('cadastro-confirmar', all.confirmar);
  await fixture.whenStable();
}

async function submit() {
  el.querySelector<HTMLFormElement>('form')!.dispatchEvent(new Event('submit'));
  await fixture.whenStable();
}

const errorOf = (id: string) => el.querySelector(`#${id}-erro`)?.textContent?.trim() ?? null;

describe('SignUpPage (Cadastrar-se)', () => {
  beforeEach(setup);

  it('solicita nome de usuário, e-mail, senha e confirmação, todos com label', () => {
    for (const [id, label] of [
      ['cadastro-usuario', 'Nome de usuário'],
      ['cadastro-email', 'E-mail'],
      ['cadastro-senha', 'Senha'],
      ['cadastro-confirmar', 'Confirmar senha'],
    ]) {
      expect(el.querySelector(`label[for="${id}"]`)?.textContent?.trim()).toBe(label);
      expect(el.querySelector(`#${id}`)).toBeTruthy();
    }
  });

  it('campos vazios exibem mensagens junto ao campo e não enviam', async () => {
    await submit();
    expect(errorOf('cadastro-usuario')).toBe('Informe o nome de usuário.');
    expect(errorOf('cadastro-email')).toBe('Informe o e-mail.');
    expect(errorOf('cadastro-senha')).toBe('Informe a senha.');
    expect(errorOf('cadastro-confirmar')).toBe('Confirme a senha.');
    expect(el.querySelector('#cadastro-email')?.getAttribute('aria-invalid')).toBe('true');
    expect(el.querySelector('#cadastro-email')?.getAttribute('aria-describedby')).toBe(
      'cadastro-email-erro',
    );
    expect(accounts.calls).toHaveLength(0);
  });

  it('valida formato de nome e e-mail', async () => {
    await fill({ usuario: 'a b', email: 'nao-e-email' });
    await submit();
    expect(errorOf('cadastro-usuario')).toContain('3 a 20 caracteres');
    expect(errorOf('cadastro-email')).toBe('Informe um e-mail válido.');
    expect(accounts.calls).toHaveLength(0);
  });

  it('exige senha de no mínimo 8 caracteres', async () => {
    await fill({ senha: '1234567', confirmar: '1234567' });
    await submit();
    expect(errorOf('cadastro-senha')).toBe('A senha deve ter no mínimo 8 caracteres.');
    expect(accounts.calls).toHaveLength(0);
  });

  it('exige que a confirmação coincida com a senha', async () => {
    await fill({ confirmar: 'outra-senha' });
    await submit();
    expect(errorOf('cadastro-confirmar')).toBe('As senhas não coincidem.');
    expect(accounts.calls).toHaveLength(0);
  });

  it('bloqueia nome de usuário em uso', async () => {
    accounts.result = { ok: false, error: 'username-taken' };
    await fill({});
    await submit();
    expect(errorOf('cadastro-usuario')).toBe('Este nome de usuário já está em uso.');
  });

  it('bloqueia e-mail em uso', async () => {
    accounts.result = { ok: false, error: 'email-in-use' };
    await fill({});
    await submit();
    expect(errorOf('cadastro-email')).toBe('Este e-mail já está em uso.');
  });

  it('mostra erro geral em falha de conexão', async () => {
    accounts.result = { ok: false, error: 'network' };
    await fill({});
    await submit();
    expect(el.querySelector('[role="alert"]')?.textContent).toContain('Não foi possível conectar');
  });

  it('envia os dados e informa que a conta precisa de aprovação', async () => {
    await fill({});
    await submit();
    expect(accounts.calls).toEqual([
      { username: 'Elaris', email: 'elaris@example.com', password: 'segredo123' },
    ]);
    expect(el.querySelector('h1')?.textContent).toContain('Conta criada');
    const status = el.querySelector('[role="status"]')?.textContent ?? '';
    expect(status).toContain('Pendente');
    expect(status).toContain('aprovação');
    expect(el.querySelector('a[href="/candidatura"]')).toBeTruthy();
  });

  it('oferece link para entrar', () => {
    expect(el.querySelector('a[href="/entrar"]')?.textContent).toContain('Entrar');
  });

  it('abre as regras completas em um modal, sem sair da página nem perder os dados', async () => {
    await fill({ usuario: 'Tavia' });
    const link = [...el.querySelectorAll<HTMLButtonElement>('button')].find((b) =>
      b.textContent?.includes('regras da guilda'),
    )!;
    link.focus();
    link.click();
    await fixture.whenStable();
    const dialog = el.querySelector<HTMLDialogElement>('app-rules-modal dialog')!;
    expect(dialog.open).toBe(true);
    expect(dialog.querySelectorAll('ol li')).toHaveLength(10);

    dialog.dispatchEvent(new Event('cancel', { cancelable: true }));
    await fixture.whenStable();
    expect(dialog.open).toBe(false);
    expect(document.activeElement).toBe(link);
    expect(el.querySelector<HTMLInputElement>('#cadastro-usuario')!.value).toBe('Tavia');
  });
});
