import { TestBed } from '@angular/core/testing';
import { AddonPage } from './addon-page';

async function render() {
  TestBed.configureTestingModule({ imports: [AddonPage] });
  const fixture = TestBed.createComponent(AddonPage);
  await fixture.whenStable();
  return fixture.nativeElement as HTMLElement;
}

describe('AddonPage (Baixar o addon da guilda)', () => {
  it('oferece o download no CurseForge em nova aba', async () => {
    const el = await render();
    const link = el.querySelector<HTMLAnchorElement>('a.btn--primary')!;
    expect(link.getAttribute('href')).toBe(
      'https://www.curseforge.com/wow/addons/vanguarda-da-luz-guild-hub',
    );
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toContain('noopener');
    expect(link.textContent).toContain('Baixar no CurseForge');
    expect(link.textContent).toContain('(abre em nova aba)');
  });

  it('explica o caminho dos eventos e das presenças entre o site e o jogo', async () => {
    const el = await render();
    expect(el.querySelector('h1')?.textContent).toContain('Addon da guilda');
    const features = el.querySelectorAll('ol li');
    expect(features).toHaveLength(3);
    expect(features[0].textContent).toContain('Eventos do site no jogo');
    expect(features[1].textContent).toContain('Presença confirmada no jogo');
    expect(features[2].textContent).toContain('Presenças de volta no site');
    expect(el.textContent).toContain('WoW Forever');
  });

  it('mantém entre colchetes o que ainda não se conhece', async () => {
    const el = await render();
    expect(el.textContent).toContain('[INSTRUÇÕES DE INSTALAÇÃO E USO DO ADDON]');
  });
});
