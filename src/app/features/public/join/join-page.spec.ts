import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import type { AccessLevel } from '../../../core/auth/access';
import { provideSessionStub } from '../../../core/auth/session.stub';
import { JoinPage } from './join-page';

async function render(access: AccessLevel) {
  TestBed.configureTestingModule({
    imports: [JoinPage],
    providers: [provideRouter([]), provideSessionStub(access).provider],
  });
  const fixture = TestBed.createComponent(JoinPage);
  await fixture.whenStable();
  return fixture.nativeElement as HTMLElement;
}

describe('JoinPage (Ver como ingressar)', () => {
  it('informa que a entrada depende de aprovação', async () => {
    const el = await render('visitor');
    expect(el.textContent).toContain('A entrada depende da aprovação de um administrador.');
  });

  it('apresenta os 4 passos em ordem, sem a seção de requisitos', async () => {
    const el = await render('visitor');
    expect(el.querySelector('#titulo-requisitos')).toBeNull();
    expect(el.textContent).not.toContain('Requisitos');
    const steps = [...el.querySelectorAll('ol li strong')].map((s) => s.textContent?.trim());
    expect(steps).toEqual([
      'Leia as regras',
      'Crie sua conta',
      'Envie sua candidatura',
      'Aguarde o contato e avaliação',
    ]);
  });

  it('visitante: botão leva ao cadastro', async () => {
    const el = await render('visitor');
    const btn = el.querySelector('a.btn--primary');
    expect(btn?.textContent?.trim()).toBe('Criar minha conta');
    expect(btn?.getAttribute('href')).toBe('/cadastro');
  });

  it('usuário cadastrado: botão leva à candidatura', async () => {
    const el = await render('pending');
    const btn = el.querySelector('a.btn--primary');
    expect(btn?.getAttribute('href')).toBe('/candidatura');
  });

  it('oferece link para as regras', async () => {
    const el = await render('visitor');
    expect(el.querySelector('a[href="/regras"]')).toBeTruthy();
  });
});
