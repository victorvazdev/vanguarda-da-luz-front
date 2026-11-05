import { signOut } from 'firebase/auth';
import { describe, expect, it } from 'vitest';
import {
  applyEmailAction,
  changePassword,
  changeUsername,
  requestEmailChange,
  syncAccountEmail,
} from '../../src/app/core/auth/account-settings';
import { signIn } from '../../src/app/core/auth/sign-in';
import { signUp } from '../../src/app/core/auth/sign-up';
import { submitApplication } from '../../src/app/core/data/applications';
import {
  removeCharacter,
  saveCharacter,
  setMainCharacter,
  watchCharacters,
  type Character,
} from '../../src/app/core/data/characters';
import { approveApplication } from '../../src/app/core/data/review';
import { adminGet, adminPatch, lastOobCode, useEmulators, type Client } from './emulators';

const client = useEmulators();

type Person = Client & { uid: string; email: string };

async function register(username: string, email = `${username.toLowerCase()}@example.com`) {
  const c = client();
  const result = await signUp(c.auth, c.db, { username, email, password: 'segredo123' });
  if (!result.ok) throw new Error(result.error);
  return { ...c, uid: result.uid, email } as Person;
}

async function firstAdmin(): Promise<Person> {
  const a = await register('Maren');
  await adminPatch(`users/${a.uid}`, { status: 'ativo', role: 'admin' });
  await adminPatch('config/admins', { activeAdminUids: [a.uid] });
  return a;
}

async function approvedMember(username: string): Promise<Person> {
  const admin = await firstAdmin();
  const m = await register(username);
  await submitApplication(m.db, m.uid, {
    game: 'retail',
    characterName: username,
    server: 'Azralon',
    characterClass: 'sacerdote',
    characterRole: 'cura',
    motivation: 'Quero entrar.',
  });
  const result = await approveApplication(admin.db, admin.uid, m.uid);
  if (!result.ok) throw new Error(result.error);
  return m;
}

/** Espera a lista de personagens satisfazer a condição. */
function charactersWhen(p: Person, ready: (list: Character[]) => boolean): Promise<Character[]> {
  return new Promise((resolve, reject) => {
    const stop = watchCharacters(
      p.db,
      p.uid,
      (list) => {
        if (!ready(list)) return;
        stop();
        resolve(list);
      },
      reject,
    );
  });
}

describe('Editar perfil: nome de usuário (emuladores)', () => {
  it('troca o nome, atualiza o membro e libera o nome antigo', async () => {
    const tavia = await approvedMember('Tavia');
    expect(await changeUsername(tavia.db, tavia.uid, 'Tavinha')).toEqual({ ok: true });

    expect((await adminGet(`users/${tavia.uid}`))?.['username']).toBe('Tavinha');
    expect((await adminGet(`users/${tavia.uid}`))?.['usernameKey']).toBe('tavinha');
    expect((await adminGet(`members/${tavia.uid}`))?.['username']).toBe('Tavinha');
    expect((await adminGet('usernames/tavinha'))?.['uid']).toBe(tavia.uid);
    expect(await adminGet('usernames/tavia')).toBeNull();

    // O nome antigo fica livre para outra pessoa.
    const outra = await register('Tavia', 'outra@example.com');
    expect(outra.uid).not.toBe(tavia.uid);
  });

  it('recusa um nome já usado e conta pendente também troca o nome', async () => {
    await register('Dorvan');
    const novo = await register('Novato');
    expect(await changeUsername(novo.db, novo.uid, 'dorvan')).toEqual({
      ok: false,
      error: 'username-taken',
    });
    expect(await changeUsername(novo.db, novo.uid, 'Novata')).toEqual({ ok: true });
    expect((await adminGet(`users/${novo.uid}`))?.['username']).toBe('Novata');
  });
});

describe('Editar perfil: senha e e-mail (emuladores)', () => {
  it('troca a senha somente com a senha atual correta', async () => {
    const p = await register('Elaris');
    expect(await changePassword(p.auth, 'errada123', 'novasenha1')).toEqual({
      ok: false,
      error: 'wrong-password',
    });
    expect(await changePassword(p.auth, 'segredo123', 'novasenha1')).toEqual({ ok: true });

    await signOut(p.auth);
    expect((await signIn(p.auth, p.db, p.email, 'segredo123')).ok).toBe(false);
    expect((await signIn(p.auth, p.db, p.email, 'novasenha1')).ok).toBe(true);
  });

  it('troca o e-mail depois da confirmação pelo link e sincroniza a conta', async () => {
    const p = await register('Elaris');
    expect(await requestEmailChange(p.auth, 'segredo123', p.email)).toEqual({
      ok: false,
      error: 'same-email',
    });
    expect(await requestEmailChange(p.auth, 'errada123', 'novo@example.com')).toEqual({
      ok: false,
      error: 'wrong-password',
    });
    expect(await requestEmailChange(p.auth, 'segredo123', 'novo@example.com')).toEqual({
      ok: true,
    });

    const { oobCode } = await lastOobCode('VERIFY_AND_CHANGE_EMAIL');
    const browser = client(); // o link pode ser aberto em outro navegador
    expect(await applyEmailAction(browser.auth, oobCode)).toEqual({ ok: true, action: 'changed' });
    expect(await applyEmailAction(browser.auth, oobCode)).toEqual({
      ok: false,
      error: 'invalid-link',
    });

    const again = client();
    const result = await signIn(again.auth, again.db, 'novo@example.com', 'segredo123');
    expect(result.ok).toBe(true);
    await syncAccountEmail(again.db, p.uid, 'novo@example.com');
    expect((await adminGet(`users/${p.uid}`))?.['email']).toBe('novo@example.com');
  });
});

describe('Editar perfil: personagens (emuladores)', () => {
  it('parte do principal da candidatura, sem nível, até o membro salvá-lo', async () => {
    const tavia = await approvedMember('Tavia');
    const [legacy] = await charactersWhen(tavia, (l) => l.length > 0);
    expect(legacy).toMatchObject({ id: null, isMain: true, level: null, characterName: 'Tavia' });

    const saved = await saveCharacter(
      tavia.db,
      tavia.uid,
      null,
      {
        game: 'retail',
        characterName: 'Tavia',
        server: 'Azralon',
        characterClass: 'sacerdote',
        characterRole: 'cura',
        level: 80,
      },
      true,
    );
    expect(saved.ok).toBe(true);
    const list = await charactersWhen(tavia, (l) => l.some((c) => c.id !== null));
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ isMain: true, level: 80 });
    const member = await adminGet(`members/${tavia.uid}`);
    expect(member?.['mainCharacterId']).toBe(list[0].id);
  });

  it('adiciona, troca o principal e remove personagens', async () => {
    const tavia = await approvedMember('Tavia');
    const main = await saveCharacter(
      tavia.db,
      tavia.uid,
      null,
      {
        game: 'retail',
        characterName: 'Tavia',
        server: 'Azralon',
        characterClass: 'sacerdote',
        characterRole: 'cura',
        level: 80,
      },
      true,
    );
    const alt = await saveCharacter(
      tavia.db,
      tavia.uid,
      null,
      {
        game: 'forever',
        characterName: 'Brisa',
        characterSurname: 'Aurora',
        ruleset: 'normal',
        characterClass: 'druida',
        characterRole: 'tanque',
        level: 42,
      },
      false,
    );
    if (!main.ok || !alt.ok) throw new Error('falha ao salvar');

    expect(await removeCharacter(tavia.db, tavia.uid, { id: main.id, isMain: true })).toEqual({
      ok: false,
      error: 'is-main',
    });
    expect((await setMainCharacter(tavia.db, tavia.uid, alt.id)).ok).toBe(true);
    const member = await adminGet(`members/${tavia.uid}`);
    expect(member?.['mainCharacterId']).toBe(alt.id);

    expect((await removeCharacter(tavia.db, tavia.uid, { id: main.id, isMain: false })).ok).toBe(
      true,
    );
    const list = await charactersWhen(tavia, (l) => l.length === 1);
    expect(list[0]).toMatchObject({ id: alt.id, isMain: true, characterSurname: 'Aurora' });
  });
});
