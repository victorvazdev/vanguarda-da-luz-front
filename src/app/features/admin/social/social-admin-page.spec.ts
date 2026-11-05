import { TestBed } from '@angular/core/testing';
import { DEFAULT_SOCIAL_LINKS } from '../../../core/content/site-content';
import { provideSiteContentStub } from '../../../core/content/site-content.stub';
import { SocialAdminPage } from './social-admin-page';

async function render() {
  const { stub, provider } = provideSiteContentStub();
  stub.socialState.set({ ...DEFAULT_SOCIAL_LINKS, youtube: null });
  TestBed.configureTestingModule({ imports: [SocialAdminPage], providers: [provider] });
  const fixture = TestBed.createComponent(SocialAdminPage);
  await fixture.whenStable();
  const el = fixture.nativeElement as HTMLElement;
  const input = (id: string) => el.querySelector<HTMLInputElement>(`#rede-${id}`)!;
  const type = (id: string, value: string) => {
    input(id).value = value;
    input(id).dispatchEvent(new Event('input'));
    input(id).dispatchEvent(new Event('blur'));
  };
  const submit = async () => {
    el.querySelector('form')!.dispatchEvent(new Event('submit'));
    await fixture.whenStable();
  };
  return { stub, fixture, el, input, type, submit };
}

describe('SocialAdminPage (Gerenciar redes sociais)', () => {
  it('lista as redes com o link atual de cada uma', async () => {
    const { el, input } = await render();
    const labels = [...el.querySelectorAll('label')].map((l) => l.textContent?.trim());
    expect(labels).toEqual(['Discord', 'WhatsApp', 'Instagram', 'YouTube']);
    expect(input('discord').value).toBe(DEFAULT_SOCIAL_LINKS.discord);
    expect(input('youtube').value).toBe('');
  });

  it('salva links alterados, adicionados e apagados', async () => {
    const { stub, fixture, el, type, submit } = await render();
    type('discord', 'https://discord.gg/novo');
    type('youtube', 'https://www.youtube.com/@Nova');
    const apagar = [...el.querySelectorAll('button')].find((b) =>
      b.textContent?.includes('link do WhatsApp'),
    )!;
    apagar.click();
    await fixture.whenStable();
    await submit();
    expect(stub.savedSocial).toEqual([
      {
        discord: 'https://discord.gg/novo',
        whatsapp: null,
        instagram: DEFAULT_SOCIAL_LINKS.instagram,
        youtube: 'https://www.youtube.com/@Nova',
      },
    ]);
    expect(el.querySelector('.notice')?.textContent).toContain('Links salvos');
  });

  it('um link inválido mostra a mensagem junto ao campo e impede salvar', async () => {
    const { stub, el, input, type, submit } = await render();
    type('instagram', 'instagram.com/vanguarda');
    await submit();
    expect(stub.savedSocial).toHaveLength(0);
    expect(input('instagram').getAttribute('aria-invalid')).toBe('true');
    expect(el.querySelector('#rede-instagram-erro')?.textContent).toContain('https://');
  });
});
