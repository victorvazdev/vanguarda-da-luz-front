import {
  DEFAULT_GUILD_INFO,
  DEFAULT_SOCIAL_LINKS,
  guildInfoFromData,
  isValidSocialUrl,
  rulesetsLabel,
  socialLinksFromData,
  visibleSocialLinks,
} from './site-content';

describe('isValidSocialUrl', () => {
  it('aceita somente links completos com https://', () => {
    expect(isValidSocialUrl('https://discord.gg/abc')).toBe(true);
    expect(isValidSocialUrl('https://www.youtube.com/@VanguardaDaLuz')).toBe(true);
    expect(isValidSocialUrl('http://discord.gg/abc')).toBe(false);
    expect(isValidSocialUrl('discord.gg/abc')).toBe(false);
    expect(isValidSocialUrl('javascript:alert(1)')).toBe(false);
    expect(isValidSocialUrl('https://localhost')).toBe(false);
    expect(isValidSocialUrl('https://discord gg')).toBe(false);
    expect(isValidSocialUrl(`https://x.com/${'a'.repeat(300)}`)).toBe(false);
  });
});

describe('visibleSocialLinks', () => {
  it('omite redes sem link cadastrado, na ordem fixa das redes', () => {
    const links = visibleSocialLinks({ ...DEFAULT_SOCIAL_LINKS, whatsapp: null });
    expect(links.map((l) => l.name)).toEqual(['Discord', 'Instagram', 'YouTube']);
  });

  it('os links padrão são as quatro redes oficiais, todas com https', () => {
    const links = visibleSocialLinks(DEFAULT_SOCIAL_LINKS);
    expect(links.map((l) => l.name)).toEqual(['Discord', 'WhatsApp', 'Instagram', 'YouTube']);
    links.forEach((l) => expect(l.url).toMatch(/^https:\/\//));
  });
});

describe('socialLinksFromData', () => {
  it('usa os links padrão enquanto nada foi salvo', () => {
    expect(socialLinksFromData(undefined)).toEqual(DEFAULT_SOCIAL_LINKS);
  });

  it('descarta links vazios ou inválidos', () => {
    expect(
      socialLinksFromData({
        links: { discord: 'https://discord.gg/x', whatsapp: '', youtube: 'ftp://x' },
      }),
    ).toEqual({ discord: 'https://discord.gg/x', whatsapp: null, instagram: null, youtube: null });
  });
});

describe('guildInfoFromData', () => {
  it('usa os valores padrão enquanto nada foi salvo', () => {
    expect(guildInfoFromData(undefined)).toEqual(DEFAULT_GUILD_INFO);
  });

  it('converte a data e ordena os rulesets', () => {
    const at = new Date('2026-11-05T12:00:00Z');
    const info = guildInfoFromData({
      history: 'H',
      faction: 'horda',
      foreverRulesets: ['jxj', 'normal', 'pve'],
      updatedAt: { toDate: () => at },
    });
    expect(info).toMatchObject({ history: 'H', values: '', faction: 'horda', updatedAt: at });
    expect(info.foreverRulesets).toEqual(['normal', 'jxj']);
  });
});

describe('rulesetsLabel', () => {
  it('junta os rulesets marcados', () => {
    expect(rulesetsLabel(['normal', 'jxj'])).toBe('Normal e JxJ');
    expect(rulesetsLabel(['jxj'])).toBe('JxJ');
    expect(rulesetsLabel([])).toBe('');
  });
});
