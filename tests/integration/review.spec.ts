import { signOut } from 'firebase/auth';
import { describe, expect, it } from 'vitest';
import { signIn } from '../../src/app/core/auth/sign-in';
import { signUp } from '../../src/app/core/auth/sign-up';
import {
  getApplication,
  submitApplication,
  type ApplicationInput,
} from '../../src/app/core/data/applications';
import {
  approveApplication,
  rejectApplication,
  watchQueue,
  type PendingAccount,
} from '../../src/app/core/data/review';
import { adminGet, adminPatch, useEmulators, type Client } from './emulators';

const client = useEmulators();

const forever: ApplicationInput = {
  game: 'forever',
  characterName: 'Elaris',
  characterSurname: 'Aurora',
  ruleset: 'jxj',
  characterClass: 'sacerdote',
  characterRole: 'cura',
  professions: ['alquimia'],
  battleTag: 'Jogador#1234',
  motivation: 'Quero jogar com a guilda.',
};

async function register(username: string): Promise<Client & { uid: string; email: string }> {
  const c = client();
  const email = `${username.toLowerCase()}@example.com`;
  const result = await signUp(c.auth, c.db, { username, email, password: 'segredo123' });
  if (!result.ok) throw new Error(result.error);
  return { ...c, uid: result.uid, email };
}

async function admin() {
  const a = await register('Maren');
  await adminPatch(`users/${a.uid}`, { status: 'ativo', role: 'admin' });
  return a;
}

async function applicant(input: ApplicationInput = forever) {
  const u = await register('Elaris');
  const result = await submitApplication(u.db, u.uid, input);
  if (!result.ok) throw new Error(result.error);
  return u;
}

describe('Aprovar ou recusar cadastros (emuladores)', () => {
  it('a fila mostra cadastros pendentes com e sem candidatura', async () => {
    const a = await admin();
    const withApp = await applicant();
    const withoutApp = await register('Lioren');

    const queue = await new Promise<PendingAccount[]>((resolve, reject) => {
      const stop = watchQueue(a.db, (q) => (stop(), resolve(q)), reject);
    });
    expect(queue.map((q) => [q.uid, q.application?.characterName ?? null])).toEqual([
      [withApp.uid, 'Elaris'],
      [withoutApp.uid, null],
    ]);
    expect(queue[0]).toMatchObject({ username: 'Elaris', email: 'elaris@example.com' });
    expect(queue[1].rejectedAt).toBeNull();
  });

  it('aprovar torna o usuário membro, com o personagem da candidatura e o registro da decisão', async () => {
    const a = await admin();
    const u = await applicant();

    expect(await approveApplication(a.db, a.uid, u.uid)).toEqual({ ok: true });

    expect(await adminGet(`users/${u.uid}`)).toMatchObject({ status: 'ativo', role: 'membro' });
    const app = await getApplication(a.db, u.uid);
    expect(app).toMatchObject({ status: 'aprovada', decidedBy: a.uid });
    expect(app?.decidedAt).toBeInstanceOf(Date);

    const member = await adminGet(`members/${u.uid}`);
    expect(member).toMatchObject({ username: 'Elaris', active: true, approvedBy: a.uid });
    // mapValue do REST: confere o personagem principal campo a campo.
    const res = await fetch(
      `http://${process.env['FIRESTORE_EMULATOR_HOST'] ?? '127.0.0.1:8180'}/v1/projects/demo-vanguarda-da-luz/databases/(default)/documents/members/${u.uid}`,
      { headers: { Authorization: 'Bearer owner' } },
    );
    const fields = (
      (await res.json()) as {
        fields: Record<string, { mapValue: { fields: Record<string, { stringValue: string }> } }>;
      }
    ).fields['mainCharacter'].mapValue.fields;
    expect(Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, v.stringValue]))).toEqual({
      game: 'forever',
      characterName: 'Elaris',
      characterSurname: 'Aurora',
      ruleset: 'jxj',
      characterClass: 'sacerdote',
      characterRole: 'cura',
    });

    await signOut(u.auth);
    const again = client();
    expect(await signIn(again.auth, again.db, u.email, 'segredo123')).toEqual({
      ok: true,
      access: 'member',
    });
  });

  it('recusar mantém a conta pendente e permite nova candidatura', async () => {
    const a = await admin();
    const u = await applicant();

    expect(await rejectApplication(a.db, a.uid, u.uid)).toEqual({ ok: true });
    expect(await adminGet(`users/${u.uid}`)).toMatchObject({ status: 'pendente' });
    expect(await getApplication(u.db, u.uid)).toMatchObject({
      status: 'recusada',
      decidedBy: a.uid,
    });
    expect(await adminGet(`members/${u.uid}`)).toBeNull();

    const queue = await new Promise<PendingAccount[]>((resolve, reject) => {
      const stop = watchQueue(a.db, (q) => (stop(), resolve(q)), reject);
    });
    expect(queue).toHaveLength(1);
    expect(queue[0].application).toBeNull();
    expect(queue[0].rejectedAt).toBeInstanceOf(Date);

    expect(await submitApplication(u.db, u.uid, { ...forever, motivation: 'Revisei.' })).toEqual({
      ok: true,
    });
  });

  it('uma candidatura já avaliada não é decidida de novo', async () => {
    const a = await admin();
    const u = await applicant();
    await rejectApplication(a.db, a.uid, u.uid);
    expect(await approveApplication(a.db, a.uid, u.uid)).toEqual({
      ok: false,
      error: 'already-decided',
    });
  });

  it('quem não é administrador não decide', async () => {
    const u = await applicant();
    const other = await register('Dorvan');
    await adminPatch(`users/${other.uid}`, { status: 'ativo' });
    expect(await approveApplication(other.db, other.uid, u.uid)).toEqual({
      ok: false,
      error: 'not-allowed',
    });
    expect(await rejectApplication(u.db, u.uid, u.uid)).toEqual({
      ok: false,
      error: 'not-allowed',
    });
  });
});
