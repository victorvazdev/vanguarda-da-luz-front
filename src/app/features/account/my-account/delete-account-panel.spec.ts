import { Component } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import type { AccessLevel } from '../../../core/auth/access';
import type { DeletionResult } from '../../../core/auth/account-deletion';
import { AccountService } from '../../../core/auth/account.service';
import { provideSessionStub } from '../../../core/auth/session.stub';
import { FlashService } from '../../../shared/ui/flash/flash.service';
import { stubDialog } from '../../../shared/ui/modal/dialog.stub';
import { DELETED_MESSAGE, DeleteAccountPanel } from './delete-account-panel';

stubDialog();

@Component({ template: '' })
class Blank {}

class AccountStub {
  result: DeletionResult = { ok: true };
  passwords: string[] = [];
  deleteAccount(password: string) {
    this.passwords.push(password);
    return Promise.resolve(this.result);
  }
}

let fixture: ComponentFixture<DeleteAccountPanel>;
let el: HTMLElement;
let accounts: AccountStub;
let session: ReturnType<typeof provideSessionStub>['stub'];

async function setup(access: AccessLevel = 'member', result?: DeletionResult) {
  accounts = new AccountStub();
  if (result) accounts.result = result;
  const s = provideSessionStub(access);
  session = s.stub;
  TestBed.configureTestingModule({
    imports: [DeleteAccountPanel],
    providers: [
      provideRouter([{ path: '**', component: Blank }]),
      s.provider,
      { provide: AccountService, useValue: accounts },
    ],
  });
  await TestBed.inject(Router).navigateByUrl('/minha-conta');
  fixture = TestBed.createComponent(DeleteAccountPanel);
  el = fixture.nativeElement;
  await fixture.whenStable();
}

const text = () => el.textContent?.replace(/\s+/g, ' ') ?? '';
const dialog = () => el.querySelector<HTMLDialogElement>('dialog')!;
const button = (label: string) =>
  [...el.querySelectorAll<HTMLButtonElement>('button')].find((b) =>
    b.textContent?.trim().startsWith(label),
  )!;

async function openModal() {
  const trigger = button('Excluir conta');
  trigger.focus();
  trigger.click();
  await fixture.whenStable();
}

async function fill(password: string, confirmed = true) {
  if (confirmed) el.querySelector<HTMLInputElement>('#excluir-confirmar')!.click();
  const input = el.querySelector<HTMLInputElement>('#excluir-senha')!;
  input.value = password;
  input.dispatchEvent(new Event('input'));
  await fixture.whenStable();
}

async function submit() {
  el.querySelector('form')!.dispatchEvent(new Event('submit'));
  await fixture.whenStable();
  await fixture.whenStable();
}

describe('DeleteAccountPanel (Excluir conta)', () => {
  it('oferece "Excluir conta" e abre um modal explicando o que é removido e mantido', async () => {
    await setup();
    expect(dialog().open).toBe(false);
    await openModal();
    expect(dialog().open).toBe(true);
    const removed = el.querySelector('.delete-account__list--removed')!.textContent!;
    expect(removed).toContain('e-mail e senha');
    expect(removed).toContain('nome de usuário');
    expect(removed).toContain('BattleTag');
    expect(removed).toContain('eventos futuros');
    expect(text()).toContain('Seus personagens');
    expect(text()).toContain('Conta excluída');
    expect(document.activeElement?.id).toBe('excluir-confirmar');
  });

  it('conta pendente: informa que nada é mantido', async () => {
    await setup('pending');
    await openModal();
    expect(text()).not.toContain('Seus personagens');
    expect(text()).toContain('Nada: sua conta ainda não foi aprovada');
  });

  it('exige confirmação explícita e a senha antes de excluir', async () => {
    await setup();
    await openModal();
    await submit();
    expect(text()).toContain('Confirme que você entende que a exclusão é permanente.');
    expect(text()).toContain('Informe sua senha.');
    expect(accounts.passwords).toHaveLength(0);

    await fill('segredo123', false);
    await submit();
    expect(accounts.passwords).toHaveLength(0);
  });

  it('exclui, encerra a sessão e leva à página inicial com um aviso', async () => {
    await setup();
    await openModal();
    await fill('segredo123');
    await submit();
    expect(accounts.passwords).toEqual(['segredo123']);
    expect(session.signOutCalls).toBe(1);
    expect(TestBed.inject(Router).url).toBe('/');
    expect(TestBed.inject(FlashService).message()).toBe(DELETED_MESSAGE);
  });

  it('senha incorreta: mensagem junto ao campo e nada é excluído', async () => {
    await setup('member', { ok: false, error: 'wrong-password' });
    await openModal();
    await fill('errada');
    await submit();
    expect(el.querySelector('#excluir-senha-erro')?.textContent?.trim()).toBe('Senha incorreta.');
    expect(dialog().open).toBe(true);
    expect(TestBed.inject(Router).url).toBe('/minha-conta');
  });

  it('último administrador ativo: explica por que não pode excluir', async () => {
    await setup('admin', { ok: false, error: 'last-admin' });
    await openModal();
    await fill('segredo123');
    await submit();
    expect(el.querySelector('[role="alert"]')?.textContent).toContain('último administrador ativo');
    expect(session.signOutCalls).toBe(0);
  });

  it('falha no meio do processo: pede para tentar de novo', async () => {
    await setup('member', { ok: false, error: 'network' });
    await openModal();
    await fill('segredo123');
    await submit();
    expect(el.querySelector('[role="alert"]')?.textContent).toContain('tentar de novo');
  });

  it('fecha pelo botão "Manter conta" e devolve o foco a "Excluir conta"', async () => {
    await setup();
    await openModal();
    button('Manter conta').click();
    await fixture.whenStable();
    expect(dialog().open).toBe(false);
    expect(document.activeElement).toBe(button('Excluir conta'));
    expect(accounts.passwords).toHaveLength(0);
  });

  it('exclusão interrompida: oferece concluir a exclusão', async () => {
    await setup('deleting');
    expect(text()).toContain('Exclusão da conta em andamento');
    button('Concluir exclusão').click();
    await fixture.whenStable();
    expect(dialog().open).toBe(true);
    await fill('segredo123');
    await submit();
    expect(accounts.passwords).toEqual(['segredo123']);
    expect(TestBed.inject(Router).url).toBe('/');
  });
});
