import { TestBed } from '@angular/core/testing';
import { SiteFooter } from './site-footer';

describe('SiteFooter', () => {
  it('lista as redes sociais com nome, nova aba e rel seguro', async () => {
    const fixture = TestBed.createComponent(SiteFooter);
    await fixture.whenStable();
    const links = [
      ...(fixture.nativeElement as HTMLElement).querySelectorAll<HTMLAnchorElement>(
        'nav[aria-label="Redes sociais"] a',
      ),
    ];
    expect(links.map((a) => a.textContent?.replace('(abre em nova aba)', '').trim())).toEqual([
      'Discord',
      'WhatsApp',
      'Instagram',
      'YouTube',
    ]);
    for (const a of links) {
      expect(a.target).toBe('_blank');
      expect(a.rel).toContain('noopener');
      expect(a.href).toMatch(/^https:\/\//);
    }
  });
});
