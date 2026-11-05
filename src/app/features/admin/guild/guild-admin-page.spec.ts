import { TestBed } from '@angular/core/testing';
import { provideSiteContentStub } from '../../../core/content/site-content.stub';
import { GuildAdminPage } from './guild-admin-page';

async function render() {
  const { stub, provider } = provideSiteContentStub();
  stub.guildState.set({
    history: 'Fundada em 2004.',
    values: '- Honra',
    faction: 'alianca',
    retailServer: 'Azralon',
    foreverRulesets: ['normal'],
    updatedAt: new Date('2026-11-05T15:00:00Z'),
  });
  TestBed.configureTestingModule({ imports: [GuildAdminPage], providers: [provider] });
  const fixture = TestBed.createComponent(GuildAdminPage);
  await fixture.whenStable();
  const el = fixture.nativeElement as HTMLElement;
  const field = <T extends HTMLElement>(selector: string) => el.querySelector<T>(selector)!;
  const type = (selector: string, value: string) => {
    const input = field<HTMLInputElement | HTMLTextAreaElement>(selector);
    input.value = value;
    input.dispatchEvent(new Event('input'));
    input.dispatchEvent(new Event('blur'));
  };
  const submit = async () => {
    field<HTMLFormElement>('form').dispatchEvent(new Event('submit'));
    await fixture.whenStable();
  };
  return { stub, fixture, el, field, type, submit };
}

describe('GuildAdminPage (Editar informações da guilda)', () => {
  it('abre com as informações atuais e a data da última atualização', async () => {
    const { el, field } = await render();
    expect(field<HTMLTextAreaElement>('#guilda-history').value).toBe('Fundada em 2004.');
    expect(field<HTMLTextAreaElement>('#guilda-values').value).toBe('- Honra');
    expect(field<HTMLInputElement>('#guilda-retailServer').value).toBe('Azralon');
    const radios = [...el.querySelectorAll<HTMLInputElement>('input[type="radio"]')];
    expect(radios.find((r) => r.checked)?.parentElement?.textContent?.trim()).toBe('Aliança');
    const boxes = [...el.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')];
    expect(boxes.map((b) => b.checked)).toEqual([true, false]);
    expect(el.textContent).toContain('Última atualização em 5 nov. 2026');
  });

  it('salva história, valores, facção, servidor e rulesets', async () => {
    const { stub, el, type, submit } = await render();
    type('#guilda-history', 'Nova história');
    type('#guilda-retailServer', 'Nemesis');
    const horda = [...el.querySelectorAll<HTMLInputElement>('input[type="radio"]')][1];
    horda.click();
    el.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')[1].click();
    await submit();
    expect(stub.savedGuild).toEqual([
      {
        history: 'Nova história',
        values: '- Honra',
        faction: 'horda',
        retailServer: 'Nemesis',
        foreverRulesets: ['normal', 'jxj'],
      },
    ]);
    expect(el.querySelector('.notice')?.textContent).toContain('Informações salvas');
  });

  it('impede salvar um servidor longo demais e mostra a mensagem junto ao campo', async () => {
    const { stub, el, type, submit } = await render();
    type('#guilda-retailServer', 'x'.repeat(41));
    await submit();
    expect(stub.savedGuild).toHaveLength(0);
    expect(el.querySelector('#guilda-retailServer-erro')?.textContent).toContain('40 caracteres');
  });

  it('mostra o erro quando a gravação é recusada', async () => {
    const { stub, el, submit } = await render();
    stub.result = { ok: false, error: 'not-allowed' };
    await submit();
    expect(el.querySelector('.form-alert')?.textContent).toContain('permissão');
  });
});
