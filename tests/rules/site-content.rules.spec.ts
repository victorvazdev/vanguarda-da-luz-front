import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { deleteDoc, doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { beforeEach, describe, it } from 'vitest';
import { account, asUser, asVisitor, seed, useRulesEnv } from './env';

const env = useRulesEnv();

const guild = (uid: string, over: Record<string, unknown> = {}) => ({
  history: 'Fundada em 2004.',
  values: '- Honra',
  faction: 'alianca',
  retailServer: 'Azralon',
  foreverRulesets: ['normal', 'jxj'],
  updatedAt: serverTimestamp(),
  updatedBy: uid,
  ...over,
});

const links = (over: Record<string, unknown> = {}) => ({
  discord: 'https://discord.gg/abc',
  whatsapp: null,
  instagram: 'https://www.instagram.com/vanguardaluz/',
  youtube: 'https://www.youtube.com/@VanguardaDaLuz',
  ...over,
});

const social = (uid: string, over: Record<string, unknown> = {}) => ({
  links: links(),
  updatedAt: serverTimestamp(),
  updatedBy: uid,
  ...over,
});

beforeEach(() =>
  seed(env(), {
    'users/ana': account('ana', { status: 'ativo', role: 'admin' }),
    'users/tavia': account('tavia', { status: 'ativo' }),
    'users/brenna': account('brenna', { status: 'desativado', role: 'admin' }),
    'site/guild': { ...guild('ana'), updatedAt: new Date() },
    'site/social': { ...social('ana'), updatedAt: new Date() },
  }),
);

const guildDoc = (uid: string) => doc(asUser(env(), uid), 'site', 'guild');
const socialDoc = (uid: string) => doc(asUser(env(), uid), 'site', 'social');

describe('site/guild', () => {
  it('qualquer pessoa lê, inclusive visitantes', async () => {
    await assertSucceeds(getDoc(doc(asVisitor(env()), 'site', 'guild')));
  });

  it('administrador ativo salva as informações', async () => {
    await assertSucceeds(setDoc(guildDoc('ana'), guild('ana')));
    await assertSucceeds(
      setDoc(guildDoc('ana'), guild('ana', { history: '', retailServer: '', foreverRulesets: [] })),
    );
  });

  it('membro, administrador desativado e visitante não salvam', async () => {
    await assertFails(setDoc(guildDoc('tavia'), guild('tavia')));
    await assertFails(setDoc(guildDoc('brenna'), guild('brenna')));
    await assertFails(setDoc(doc(asVisitor(env()), 'site', 'guild'), guild('x')));
  });

  it('recusa dados inválidos', async () => {
    const invalid = [
      { faction: 'neutro' },
      { foreverRulesets: ['normal', 'pve'] },
      { foreverRulesets: ['normal', 'normal'] },
      { history: 'x'.repeat(5001) },
      { values: 'x'.repeat(2001) },
      { retailServer: 'x'.repeat(41) },
      { extra: true },
      { updatedBy: 'tavia' },
      { updatedAt: new Date('2020-01-01') },
    ];
    for (const over of invalid) await assertFails(setDoc(guildDoc('ana'), guild('ana', over)));
  });

  it('ninguém remove o documento', async () => {
    await assertFails(deleteDoc(guildDoc('ana')));
  });
});

describe('site/social', () => {
  it('qualquer pessoa lê, inclusive visitantes', async () => {
    await assertSucceeds(getDoc(doc(asVisitor(env()), 'site', 'social')));
  });

  it('administrador ativo salva os links, apagando os que não quiser', async () => {
    await assertSucceeds(setDoc(socialDoc('ana'), social('ana')));
    await assertSucceeds(
      setDoc(
        socialDoc('ana'),
        social('ana', {
          links: links({ discord: null, instagram: null, youtube: null }),
        }),
      ),
    );
  });

  it('membro e visitante não salvam', async () => {
    await assertFails(setDoc(socialDoc('tavia'), social('tavia')));
    await assertFails(setDoc(doc(asVisitor(env()), 'site', 'social'), social('x')));
  });

  it('recusa links que não são https:// ou redes desconhecidas', async () => {
    const invalid = [
      links({ discord: 'http://discord.gg/abc' }),
      links({ discord: 'javascript:alert(1)' }),
      links({ discord: 'https://discord gg' }),
      links({ discord: 'https://localhost' }),
      links({ discord: `https://discord.gg/${'x'.repeat(300)}` }),
      links({ tiktok: 'https://tiktok.com/@x' }),
      { discord: 'https://discord.gg/abc' },
    ];
    for (const l of invalid)
      await assertFails(setDoc(socialDoc('ana'), social('ana', { links: l })));
  });

  it('ninguém remove o documento', async () => {
    await assertFails(deleteDoc(socialDoc('ana')));
  });
});
