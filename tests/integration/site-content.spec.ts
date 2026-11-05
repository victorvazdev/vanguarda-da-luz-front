import { describe, expect, it } from 'vitest';
import { signUp } from '../../src/app/core/auth/sign-up';
import {
  DEFAULT_GUILD_INFO,
  DEFAULT_SOCIAL_LINKS,
  type GuildInfo,
  type SocialLinks,
} from '../../src/app/core/content/site-content';
import {
  saveGuildInfo,
  saveSocialLinks,
  watchGuildInfo,
  watchSocialLinks,
} from '../../src/app/core/content/site-content.store';
import { adminGet, adminPatch, useEmulators, type Client } from './emulators';

const client = useEmulators();

async function register(username: string): Promise<Client & { uid: string }> {
  const c = client();
  const email = `${username.toLowerCase()}@example.com`;
  const result = await signUp(c.auth, c.db, { username, email, password: 'segredo123' });
  if (!result.ok) throw new Error(result.error);
  return { ...c, uid: result.uid };
}

async function admin() {
  const a = await register('Maren');
  await adminPatch(`users/${a.uid}`, { status: 'ativo', role: 'admin' });
  return a;
}

/** Próximo valor do listener que satisfaz `until`. */
function nextValue<T>(
  watch: (next: (v: T) => void, error: (e: unknown) => void) => () => void,
  until: (v: T) => boolean = () => true,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const stop = watch((v) => {
      if (!until(v)) return;
      stop();
      resolve(v);
    }, reject);
  });
}

describe('informações da guilda', () => {
  it('antes do primeiro salvamento, o visitante recebe os valores padrão', async () => {
    const visitor = client();
    const info = await nextValue<GuildInfo>((n, e) => watchGuildInfo(visitor.db, n, e));
    expect(info).toEqual(DEFAULT_GUILD_INFO);
  });

  it('o administrador salva e o visitante vê na hora, com a data da atualização', async () => {
    const a = await admin();
    const visitor = client();
    const seen = nextValue<GuildInfo>(
      (n, e) => watchGuildInfo(visitor.db, n, e),
      (info) => info.retailServer === 'Azralon',
    );
    const result = await saveGuildInfo(a.db, a.uid, {
      history: '  Fundada em 2004.  ',
      values: '- Honra',
      faction: 'horda',
      retailServer: 'Azralon',
      foreverRulesets: ['jxj', 'normal'],
    });
    expect(result).toEqual({ ok: true });
    const info = await seen;
    expect(info).toMatchObject({
      history: 'Fundada em 2004.',
      faction: 'horda',
      foreverRulesets: ['normal', 'jxj'],
    });
    expect(info.updatedAt).toBeInstanceOf(Date);
    expect((await adminGet('site/guild'))?.['updatedBy']).toBe(a.uid);
  });

  it('um membro sem permissão não salva', async () => {
    const m = await register('Tavia');
    await adminPatch(`users/${m.uid}`, { status: 'ativo' });
    const result = await saveGuildInfo(m.db, m.uid, { ...DEFAULT_GUILD_INFO, history: 'x' });
    expect(result).toEqual({ ok: false, error: 'not-allowed' });
    expect(await adminGet('site/guild')).toBeNull();
  });
});

describe('redes sociais', () => {
  it('antes do primeiro salvamento, o rodapé usa os links oficiais', async () => {
    const visitor = client();
    const links = await nextValue<SocialLinks>((n, e) => watchSocialLinks(visitor.db, n, e));
    expect(links).toEqual(DEFAULT_SOCIAL_LINKS);
  });

  it('o administrador altera e apaga links, e o visitante vê na hora', async () => {
    const a = await admin();
    const visitor = client();
    const seen = nextValue<SocialLinks>(
      (n, e) => watchSocialLinks(visitor.db, n, e),
      (l) => l.whatsapp === null,
    );
    const result = await saveSocialLinks(a.db, a.uid, {
      ...DEFAULT_SOCIAL_LINKS,
      discord: ' https://discord.gg/novo ',
      whatsapp: '',
    });
    expect(result).toEqual({ ok: true });
    expect(await seen).toEqual({
      ...DEFAULT_SOCIAL_LINKS,
      discord: 'https://discord.gg/novo',
      whatsapp: null,
    });
  });

  it('recusa um link inválido sem gravar nada', async () => {
    const a = await admin();
    const result = await saveSocialLinks(a.db, a.uid, {
      ...DEFAULT_SOCIAL_LINKS,
      youtube: 'http://youtube.com',
    });
    expect(result).toEqual({ ok: false, error: 'invalid' });
    expect(await adminGet('site/social')).toBeNull();
  });
});
