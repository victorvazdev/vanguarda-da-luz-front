import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { DEFAULT_SOCIAL_LINKS } from '../../../../core/content/site-content';
import { provideSiteContentStub } from '../../../../core/content/site-content.stub';
import { CommunitySection } from './community-section';

async function render() {
  const { stub, provider } = provideSiteContentStub();
  TestBed.configureTestingModule({
    imports: [CommunitySection],
    providers: [provideRouter([]), provider],
  });
  const fixture = TestBed.createComponent(CommunitySection);
  await fixture.whenStable();
  const el = fixture.nativeElement as HTMLElement;
  const names = (selector: string) =>
    [...el.querySelectorAll(`${selector} .network__name`)].map((h) => h.textContent?.trim());
  return { stub, fixture, el, names };
}

describe('CommunitySection (Junte-se à comunidade)', () => {
  it('destaca Discord e WhatsApp e deixa Instagram e YouTube em segundo plano', async () => {
    const { el, names } = await render();
    expect(el.querySelector('h2')?.textContent).toBe('Junte-se à comunidade');
    expect(names('.network--featured')).toEqual(['Discord', 'WhatsApp']);
    expect(names('.network--other')).toEqual(['Instagram', 'YouTube']);
    expect(el.querySelectorAll('.network--featured .btn--primary')).toHaveLength(2);
    expect(el.querySelectorAll('.network--other .btn--outline')).toHaveLength(2);
  });

  it('cada rede tem ícone, frase e botão que abre o link em nova aba', async () => {
    const { el } = await render();
    const cards = [...el.querySelectorAll('.network')];
    expect(cards).toHaveLength(4);
    for (const card of cards) {
      expect(card.querySelector('svg.network__icon[aria-hidden="true"]')).toBeTruthy();
      expect(card.querySelector('.network__text')?.textContent?.trim()).toBeTruthy();
      const a = card.querySelector<HTMLAnchorElement>('a.network__action')!;
      expect(a.target).toBe('_blank');
      expect(a.rel).toContain('noopener');
      expect(a.textContent).toContain('(abre em nova aba)');
    }
    expect(el.querySelector<HTMLAnchorElement>('.network--featured a.network__action')?.href).toBe(
      DEFAULT_SOCIAL_LINKS.discord,
    );
  });

  it('informa no Discord que o nome do Discord é necessário para o Core (regra 5)', async () => {
    const { el } = await render();
    const note = el.querySelector('.network--featured .network__note');
    expect(note?.textContent).toContain('nome do Discord é necessário para participar do Core');
    expect(note?.querySelector('a')?.getAttribute('href')).toBe('/regras');
    expect(el.querySelectorAll('.network__note')).toHaveLength(1);
  });

  it('exibe os links definidos no painel e omite redes sem link', async () => {
    const { stub, fixture, el, names } = await render();
    stub.socialState.set({
      ...DEFAULT_SOCIAL_LINKS,
      whatsapp: null,
      youtube: null,
      instagram: 'https://www.instagram.com/novo/',
    });
    await fixture.whenStable();
    expect(names('.network--featured')).toEqual(['Discord']);
    expect(names('.network--other')).toEqual(['Instagram']);
    expect(el.querySelector<HTMLAnchorElement>('.network--other a')?.href).toBe(
      'https://www.instagram.com/novo/',
    );
  });

  it('não exibe a seção enquanto carrega, se falhar ou sem nenhum link', async () => {
    const { stub, fixture, el } = await render();
    for (const state of [
      undefined,
      null,
      { discord: null, whatsapp: null, instagram: null, youtube: null },
    ]) {
      stub.socialState.set(state);
      await fixture.whenStable();
      expect(el.querySelector('section')).toBeNull();
    }
  });
});
