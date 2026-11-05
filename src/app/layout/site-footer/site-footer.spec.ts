import { TestBed } from '@angular/core/testing';
import { DEFAULT_SOCIAL_LINKS } from '../../core/content/site-content';
import { provideSiteContentStub } from '../../core/content/site-content.stub';
import { SiteFooter } from './site-footer';

async function render() {
  const { stub, provider } = provideSiteContentStub();
  TestBed.configureTestingModule({ imports: [SiteFooter], providers: [provider] });
  const fixture = TestBed.createComponent(SiteFooter);
  await fixture.whenStable();
  const el = fixture.nativeElement as HTMLElement;
  const links = () => [
    ...el.querySelectorAll<HTMLAnchorElement>('nav[aria-label="Redes sociais"] a'),
  ];
  const names = () => links().map((a) => a.textContent?.replace('(abre em nova aba)', '').trim());
  return { stub, fixture, links, names };
}

describe('SiteFooter', () => {
  it('lista as redes sociais com nome, nova aba e rel seguro', async () => {
    const { links, names } = await render();
    expect(names()).toEqual(['Discord', 'WhatsApp', 'Instagram', 'YouTube']);
    for (const a of links()) {
      expect(a.target).toBe('_blank');
      expect(a.rel).toContain('noopener');
      expect(a.href).toMatch(/^https:\/\//);
    }
  });

  it('exibe os links definidos no painel e omite redes sem link', async () => {
    const { stub, fixture, links, names } = await render();
    stub.socialState.set({
      ...DEFAULT_SOCIAL_LINKS,
      whatsapp: null,
      discord: 'https://discord.gg/novo',
    });
    await fixture.whenStable();
    expect(names()).toEqual(['Discord', 'Instagram', 'YouTube']);
    expect(links()[0].href).toBe('https://discord.gg/novo');
  });

  it('não exibe a lista enquanto carrega ou se falhar', async () => {
    const { stub, fixture } = await render();
    stub.socialState.set(null);
    await fixture.whenStable();
    expect((fixture.nativeElement as HTMLElement).querySelector('nav')).toBeNull();
  });
});
