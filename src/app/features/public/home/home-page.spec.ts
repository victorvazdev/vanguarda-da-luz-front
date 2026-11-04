import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import type { AccessLevel } from '../../../core/auth/access';
import { provideSessionStub } from '../../../core/auth/session.stub';
import { HomePage } from './home-page';

async function render(access: AccessLevel) {
  TestBed.configureTestingModule({
    imports: [HomePage],
    providers: [provideRouter([]), provideSessionStub(access).provider],
  });
  const fixture = TestBed.createComponent(HomePage);
  await fixture.whenStable();
  return fixture.nativeElement as HTMLElement;
}

describe('HomePage (Conhecer a guilda)', () => {
  it('apresenta história, valores, facção e servidor', async () => {
    const el = await render('visitor');
    expect(el.textContent).toContain('Nossa história');
    const labels = [...el.querySelectorAll('dt')].map((d) => d.textContent?.trim());
    expect(labels).toEqual(['Valores', 'Facção', 'Servidor no Retail', 'Rulesets no WoW Forever']);
    expect(el.textContent).toContain('Normal e JxJ');
    expect(el.textContent).toContain('Aliança');
    expect(el.textContent).toContain('[NOME DO SERVIDOR]');
  });

  it('oferece link para as instruções de ingresso', async () => {
    const el = await render('visitor');
    expect(el.querySelector('a[href="/como-ingressar"]')).toBeTruthy();
  });

  it('não convida membros a fazer parte', async () => {
    const el = await render('member');
    expect(el.querySelector('a[href="/cadastro"]')).toBeNull();
    expect(el.textContent).not.toContain('Pronto para se juntar a nós?');
  });
});
