import { RULES, SOCIAL_LINKS, visibleSocialLinks } from './guild-content';

describe('visibleSocialLinks', () => {
  it('omite redes sem link cadastrado', () => {
    const links = visibleSocialLinks([
      { name: 'Discord', url: 'https://discord.gg/x' },
      { name: 'WhatsApp', url: null },
      { name: 'YouTube', url: '  ' },
    ]);
    expect(links.map((l) => l.name)).toEqual(['Discord']);
  });

  it('exibe as quatro redes oficiais, todas com https', () => {
    const links = visibleSocialLinks(SOCIAL_LINKS);
    expect(links.map((l) => l.name)).toEqual(['Discord', 'WhatsApp', 'Instagram', 'YouTube']);
    links.forEach((l) => expect(l.url).toMatch(/^https:\/\//));
  });
});

describe('RULES', () => {
  it('tem as 10 regras do protótipo e a data da última atualização', () => {
    expect(RULES.items).toHaveLength(10);
    expect(RULES.updatedAt).toBeTruthy();
  });
});
