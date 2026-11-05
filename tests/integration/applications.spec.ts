import { describe, expect, it } from 'vitest';
import { signUp } from '../../src/app/core/auth/sign-up';
import {
  getApplication,
  submitApplication,
  type ApplicationInput,
} from '../../src/app/core/data/applications';
import { adminGet, adminPatch, useEmulators, type Client } from './emulators';

const client = useEmulators();
const input: ApplicationInput = {
  game: 'retail',
  characterName: ' Elaris ',
  server: 'Azralon',
  characterClass: 'paladino',
  characterRole: 'cura',
  motivation: 'Quero participar das raids semanais.',
};

async function pendingUser(): Promise<Client & { uid: string }> {
  const c = client();
  const result = await signUp(c.auth, c.db, {
    username: 'Elaris',
    email: 'elaris@example.com',
    password: 'segredo123',
  });
  if (!result.ok) throw new Error(result.error);
  return { ...c, uid: result.uid };
}

describe('Candidatura (Firestore emulado)', () => {
  it('usuário pendente envia; a candidatura fica pendente para os administradores', async () => {
    const { db, uid } = await pendingUser();
    expect(await submitApplication(db, uid, input)).toEqual({ ok: true });

    const stored = await adminGet(`applications/${uid}`);
    expect(stored).toMatchObject({
      game: 'retail',
      characterName: 'Elaris',
      server: 'Azralon',
      characterClass: 'paladino',
      characterRole: 'cura',
      rulesAccepted: true,
      status: 'pendente',
    });
    expect(stored?.['submittedAt']).toBeTruthy();
  });

  it('envia candidatura do WoW Forever com nome, sobrenome e ruleset (sem servidor)', async () => {
    const { db, uid } = await pendingUser();
    const forever: ApplicationInput = {
      game: 'forever',
      characterName: 'Elaris',
      characterSurname: ' Aurora ',
      ruleset: 'jxj',
      characterClass: 'sacerdote',
      characterRole: 'cura',
      motivation: 'Quero jogar no Forever com a guilda.',
    };
    expect(await submitApplication(db, uid, forever)).toEqual({ ok: true });
    const stored = await adminGet(`applications/${uid}`);
    expect(stored).toMatchObject({ game: 'forever', characterSurname: 'Aurora', ruleset: 'jxj' });
    expect(stored).not.toHaveProperty('server');
    expect(await getApplication(db, uid)).toMatchObject({
      game: 'forever',
      characterSurname: 'Aurora',
      ruleset: 'jxj',
      server: null,
    });
  });

  it('o usuário acompanha a própria candidatura', async () => {
    const { db, uid } = await pendingUser();
    await submitApplication(db, uid, input);
    const mine = await getApplication(db, uid);
    expect(mine?.status).toBe('pendente');
    expect(mine?.submittedAt).toBeInstanceOf(Date);
  });

  it('não permite nova candidatura enquanto houver outra pendente', async () => {
    const { db, uid } = await pendingUser();
    await submitApplication(db, uid, input);
    expect(await submitApplication(db, uid, { ...input, characterName: 'Outro' })).toEqual({
      ok: false,
      error: 'already-pending',
    });
    expect((await adminGet(`applications/${uid}`))?.['characterName']).toBe('Elaris');
  });

  it('após recusa, o reenvio volta a pendente e guarda a decisão anterior', async () => {
    const { db, uid } = await pendingUser();
    await submitApplication(db, uid, input);
    const decidedAt = new Date('2026-11-05T12:00:00Z');
    await adminPatch(`applications/${uid}`, {
      status: 'recusada',
      decidedBy: 'admin-uid',
      decidedAt,
    });

    const refused = await getApplication(db, uid);
    expect(refused).toMatchObject({ status: 'recusada', decidedBy: 'admin-uid', decidedAt });

    expect(
      await submitApplication(db, uid, { ...input, motivation: 'Revisei meu pedido.' }),
    ).toEqual({
      ok: true,
    });
    const again = await getApplication(db, uid);
    expect(again).toMatchObject({ status: 'pendente', motivation: 'Revisei meu pedido.' });
    expect(again?.history).toEqual([
      { status: 'recusada', submittedAt: refused!.submittedAt, decidedBy: 'admin-uid', decidedAt },
    ]);
  });

  it('membro ativo não envia candidatura', async () => {
    const { db, uid } = await pendingUser();
    await adminPatch(`users/${uid}`, { status: 'ativo' });
    expect(await submitApplication(db, uid, input)).toEqual({ ok: false, error: 'not-allowed' });
  });
});
