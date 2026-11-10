import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import type { AccessLevel } from '../../../core/auth/access';
import { provideSessionStub } from '../../../core/auth/session.stub';
import { DEFAULT_GUILD_INFO } from '../../../core/content/site-content';
import { provideSiteContentStub } from '../../../core/content/site-content.stub';
import { HomePage } from './home-page';

async function render(access: AccessLevel) {
  const content = provideSiteContentStub();
  content.stub.guildState.set({
    history: 'Fundada em **2004**.\n\nSegundo parágrafo.',
    values: '- Honra\n- Respeito',
    faction: 'alianca',
    retailServer: 'Azralon',
    foreverRulesets: ['normal', 'jxj'],
    updatedAt: new Date('2026-11-05T15:00:00Z'),
  });
  TestBed.configureTestingModule({
    imports: [HomePage],
    providers: [provideRouter([]), provideSessionStub(access).provider, content.provider],
  });
  const fixture = TestBed.createComponent(HomePage);
  await fixture.whenStable();
  return { el: fixture.nativeElement as HTMLElement, stub: content.stub, fixture };
}

const labels = (el: HTMLElement) =>
  [...el.querySelectorAll('dt')].map((d) => d.textContent?.trim());

describe('HomePage (Conhecer a guilda)', () => {
  it('apresenta história, valores, facção, servidor e rulesets definidos no painel', async () => {
    const { el } = await render('visitor');
    expect(el.textContent).toContain('Nossa história');
    expect(labels(el)).toEqual([
      'Valores',
      'Facção',
      'Servidor no Retail',
      'Rulesets no WoW Forever',
    ]);
    expect(el.querySelector('.band strong')?.textContent).toBe('2004');
    expect(el.querySelectorAll('.band__text p')).toHaveLength(2);
    expect([...el.querySelectorAll('.facts li')].map((li) => li.textContent)).toEqual([
      'Honra',
      'Respeito',
    ]);
    expect(el.textContent).toContain('Aliança');
    expect(el.textContent).toContain('Azralon');
    expect(el.textContent).toContain('Normal e JxJ');
    expect(el.textContent).toContain('Atualizado em 5 nov. 2026');
  });

  it('não exibe informações sem conteúdo cadastrado', async () => {
    const { el, stub, fixture } = await render('visitor');
    stub.guildState.set({ ...DEFAULT_GUILD_INFO, foreverRulesets: [], faction: 'horda' });
    await fixture.whenStable();
    expect(labels(el)).toEqual(['Facção']);
    expect(el.textContent).toContain('Horda');
    expect(el.querySelector('.band__text')).toBeNull();
    expect(el.textContent).not.toContain('Atualizado em');
  });

  it('avisa quando não consegue carregar as informações', async () => {
    const { el, stub, fixture } = await render('visitor');
    stub.guildState.set(null);
    await fixture.whenStable();
    expect(el.querySelector('[role="alert"]')?.textContent).toContain('Não foi possível carregar');
  });

  it('apresenta as redes sociais logo abaixo da história da guilda', async () => {
    const { el } = await render('visitor');
    const community = el.querySelector('app-community-section');
    expect(community?.textContent).toContain('Junte-se à comunidade');
    expect(community?.previousElementSibling?.classList).toContain('band');
  });

  it('oferece link para as instruções de ingresso', async () => {
    const { el } = await render('visitor');
    expect(el.querySelector('a[href="/como-ingressar"]')).toBeTruthy();
  });

  it('não convida membros a fazer parte', async () => {
    const { el } = await render('member');
    expect(el.querySelector('a[href="/cadastro"]')).toBeNull();
    expect(el.textContent).not.toContain('Pronto para se juntar a nós?');
  });
});
