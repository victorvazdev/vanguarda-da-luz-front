import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import type { AccessLevel } from '../../core/auth/access';
import { provideSessionStub } from '../../core/auth/session.stub';
import { SiteHeader } from './site-header';

async function render(access: AccessLevel) {
  const { stub, provider } = provideSessionStub(access);
  TestBed.configureTestingModule({
    imports: [SiteHeader],
    providers: [provideRouter([]), provider],
  });
  const fixture = TestBed.createComponent(SiteHeader);
  await fixture.whenStable();
  return { fixture, stub, el: fixture.nativeElement as HTMLElement };
}

describe('SiteHeader', () => {
  it('mostra o menu de visitante com o botão Fazer parte', async () => {
    const { el } = await render('visitor');
    const nav = el.querySelector('nav[aria-label="Principal"]');
    expect(nav?.textContent).toContain('Como ingressar');
    expect(el.querySelector('a.nav__cta')?.getAttribute('href')).toBe('/cadastro');
  });

  it('não mostra Administração para membros', async () => {
    const { el } = await render('member');
    expect(el.textContent).toContain('Calendário');
    expect(el.textContent).not.toContain('Administração');
  });

  it('mostra Administração para admins', async () => {
    const { el } = await render('admin');
    expect(el.querySelector('a[href="/admin"]')).toBeTruthy();
  });

  it('o botão Menu alterna aria-expanded', async () => {
    const { fixture, el } = await render('visitor');
    const toggle = el.querySelector<HTMLButtonElement>('.menu-toggle')!;
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    toggle.click();
    await fixture.whenStable();
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
  });

  it('mostra o botão de destaque do addon para visitantes e membros', async () => {
    for (const access of ['visitor', 'member'] as const) {
      TestBed.resetTestingModule();
      const { el } = await render(access);
      const addon = el.querySelector<HTMLAnchorElement>('nav a.nav__highlight');
      expect(addon?.getAttribute('href')).toBe('/addon');
      expect(addon?.textContent?.trim()).toBe('Baixar addon');
      expect(addon?.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
    }
  });

  it('Sair encerra a sessão', async () => {
    const { el, stub } = await render('pending');
    const sair = [...el.querySelectorAll('button')].find((b) => b.textContent?.trim() === 'Sair');
    sair!.click();
    await Promise.resolve();
    expect(stub.signOutCalls).toBe(1);
  });
});
