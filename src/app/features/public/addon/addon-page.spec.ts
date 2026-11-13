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

  it('avisa que o addon só funciona para membros da guilda', async () => {
    const el = await render();
    expect(el.querySelector('h1')?.textContent).toContain('Addon da guilda');
    expect(el.textContent).toContain('Vanguarda da Luz Guild Hub');
    expect(el.querySelector('.members-only')?.textContent).toContain(
      'Todas as funções exigem estar na guilda Vanguarda da Luz',
    );
  });

  it('apresenta as funções do addon', async () => {
    const el = await render();
    const titles = [...el.querySelectorAll('.feature__title')].map((h) => h.textContent?.trim());
    expect(titles).toEqual([
      'Início',
      'Calendário de eventos',
      'Presença',
      'Profissões',
      'Alertas de raide',
      'Janela da guilda',
    ]);
  });

  it('lista as permissões, os comandos e a privacidade', async () => {
    const el = await render();
    expect([...el.querySelectorAll('.permissions dt')].map((d) => d.textContent?.trim())).toEqual([
      'Mestre da guilda e cargo Lorde',
      'Todos os membros',
    ]);
    const commands = [...el.querySelectorAll('.commands tbody th')].map((c) =>
      c.textContent?.trim(),
    );
    expect(commands).toHaveLength(7);
    expect(commands).toContain('/vdl importar');
    expect(commands).toContain('/vdl presencas');
    expect(el.textContent).toContain('O addon nunca acessa a internet.');
  });

  it('não traz instruções de instalação', async () => {
    const el = await render();
    expect(el.textContent).not.toMatch(/instala/i);
  });
});
