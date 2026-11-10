import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import type { Firestore } from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach } from 'vitest';

export const PROJECT_ID = 'demo-vanguarda-da-luz';

/** Cria o ambiente de teste das rules e limpa o Firestore entre os testes. */
export function useRulesEnv(): () => RulesTestEnvironment {
  let env: RulesTestEnvironment;

  beforeAll(async () => {
    env = await initializeTestEnvironment({
      projectId: PROJECT_ID,
      firestore: { rules: readFileSync('firestore.rules', 'utf8') },
    });
  });

  beforeEach(async () => {
    await env.clearFirestore();
  });

  afterAll(async () => {
    await env.cleanup();
  });

  return () => env;
}

// O rules-unit-testing devolve o tipo "compat"; em execução é o mesmo Firestore modular.
const modular = (db: unknown) => db as Firestore;

/** Contexto autenticado com e-mail no token, como no Firebase Auth. */
export function asUser(env: RulesTestEnvironment, uid: string): Firestore {
  return modular(env.authenticatedContext(uid, { email: `${uid}@example.com` }).firestore());
}

/**
 * Contexto autenticado com o horário do login (`auth_time`, em segundos) — padrão: agora.
 * As rules de exclusão de conta exigem login recente.
 */
export function asFreshUser(
  env: RulesTestEnvironment,
  uid: string,
  loggedInSecondsAgo = 0,
): Firestore {
  const authTime = Math.floor(Date.now() / 1000) - loggedInSecondsAgo;
  return modular(
    env.authenticatedContext(uid, { email: `${uid}@example.com`, auth_time: authTime }).firestore(),
  );
}

/** Visitante sem login. */
export function asVisitor(env: RulesTestEnvironment): Firestore {
  return modular(env.unauthenticatedContext().firestore());
}

/** Grava documentos ignorando as rules (estado inicial dos testes). */
export async function seed(
  env: RulesTestEnvironment,
  docs: Record<string, Record<string, unknown>>,
): Promise<void> {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const { doc, setDoc } = await import('firebase/firestore');
    const db = modular(ctx.firestore());
    for (const [path, data] of Object.entries(docs)) await setDoc(doc(db, path), data);
  });
}

/** Documento de conta no formato gravado pelo cadastro. */
export function account(uid: string, over: Record<string, unknown> = {}) {
  return {
    username: uid,
    usernameKey: uid,
    email: `${uid}@example.com`,
    status: 'pendente',
    role: 'membro',
    createdAt: new Date('2026-11-01T12:00:00Z'),
    ...over,
  };
}

/**
 * Confirma (`data`) ou cancela (`null`) uma presença junto com o contador de confirmados do
 * evento, num único lote, como o app faz. `attendeeCount` é o novo valor do contador.
 */
export async function presenceWithCount(
  db: Firestore,
  eventId: string,
  kind: 'attendees' | 'guests',
  id: string,
  data: Record<string, unknown> | null,
  attendeeCount: number,
): Promise<void> {
  const { doc, writeBatch } = await import('firebase/firestore');
  const batch = writeBatch(db);
  const ref = doc(db, 'events', eventId, kind, id);
  if (data) batch.set(ref, data);
  else batch.delete(ref);
  batch.update(doc(db, 'events', eventId), { attendeeCount, lastAttendance: { kind, id } });
  return batch.commit();
}
