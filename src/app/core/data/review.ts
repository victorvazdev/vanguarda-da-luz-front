// Fila de aprovação e decisões do administrador, sem dependência do Angular.
// Testado contra os emuladores (tests/integration/review.spec.ts).
import { FirebaseError } from 'firebase/app';
import {
  collection,
  doc,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  where,
  type Firestore,
} from 'firebase/firestore';
import { fromData, toDate, type Application } from './applications';

/** Conta pendente, com a candidatura pendente quando houver. */
export interface PendingAccount {
  uid: string;
  username: string;
  email: string;
  createdAt: Date | null;
  /** Candidatura aguardando avaliação. */
  application: Application | null;
  /** Data da recusa, quando a última candidatura foi recusada e não há outra pendente. */
  rejectedAt: Date | null;
}

export type DecisionError = 'already-decided' | 'not-allowed' | 'network' | 'unknown';
export type DecisionResult = { ok: true } | { ok: false; error: DecisionError };

/** Campos do personagem copiados da candidatura para o personagem principal do membro. */
export const CHARACTER_FIELDS = [
  'game',
  'characterName',
  'characterSurname',
  'server',
  'ruleset',
  'characterClass',
  'characterRole',
  'professions',
] as const;

/**
 * Junta contas pendentes e suas candidaturas (pendentes ou recusadas).
 * Candidaturas pendentes primeiro, da mais recente para a mais antiga (como no protótipo).
 */
export function buildQueue(
  accounts: { uid: string; username: string; email: string; createdAt: Date | null }[],
  applications: Application[],
): PendingAccount[] {
  const byUid = new Map(applications.map((a) => [a.uid, a]));
  return accounts
    .map((a) => {
      const app = byUid.get(a.uid);
      return {
        ...a,
        application: app?.status === 'pendente' ? app : null,
        rejectedAt: app?.status === 'recusada' ? (app.decidedAt ?? null) : null,
      };
    })
    .sort((a, b) => {
      if (!!a.application !== !!b.application) return a.application ? -1 : 1;
      const ta = (a.application?.submittedAt ?? a.createdAt)?.getTime() ?? 0;
      const tb = (b.application?.submittedAt ?? b.createdAt)?.getTime() ?? 0;
      return tb - ta;
    });
}

/** Acompanha a fila em tempo real. Devolve a função para parar. */
export function watchQueue(
  db: Firestore,
  next: (queue: PendingAccount[]) => void,
  error: (e: unknown) => void,
): () => void {
  let accounts: Parameters<typeof buildQueue>[0] | null = null;
  let applications: Application[] | null = null;
  const emit = () => {
    if (accounts && applications) next(buildQueue(accounts, applications));
  };

  const stopAccounts = onSnapshot(
    query(collection(db, 'users'), where('status', '==', 'pendente')),
    (snap) => {
      accounts = snap.docs.map((d) => ({
        uid: d.id,
        username: d.get('username') as string,
        email: d.get('email') as string,
        createdAt: toDate(d.get('createdAt')),
      }));
      emit();
    },
    error,
  );
  const stopApplications = onSnapshot(
    query(collection(db, 'applications'), where('status', 'in', ['pendente', 'recusada'])),
    (snap) => {
      applications = snap.docs.map((d) => fromData(d.id, d.data()));
      emit();
    },
    error,
  );
  return () => {
    stopAccounts();
    stopApplications();
  };
}

class Decided extends Error {}

function decisionError(error: unknown): DecisionResult {
  if (error instanceof Decided) return { ok: false, error: 'already-decided' };
  const code = error instanceof FirebaseError ? error.code : '';
  if (code === 'permission-denied') return { ok: false, error: 'not-allowed' };
  if (code === 'unavailable') return { ok: false, error: 'network' };
  return { ok: false, error: 'unknown' };
}

/**
 * Aprova: a candidatura fica aprovada (com admin e data), a conta é ativada e o
 * membro é criado com o personagem da candidatura como personagem principal.
 */
export async function approveApplication(
  db: Firestore,
  adminUid: string,
  uid: string,
): Promise<DecisionResult> {
  try {
    await runTransaction(db, async (tx) => {
      const appRef = doc(db, 'applications', uid);
      const userRef = doc(db, 'users', uid);
      const [app, user] = await Promise.all([tx.get(appRef), tx.get(userRef)]);
      if (app.get('status') !== 'pendente' || user.get('status') !== 'pendente') {
        throw new Decided();
      }
      const data = app.data()!;
      const mainCharacter = Object.fromEntries(
        CHARACTER_FIELDS.filter((f) => data[f] !== undefined).map((f) => [f, data[f]]),
      );
      tx.update(appRef, { status: 'aprovada', decidedBy: adminUid, decidedAt: serverTimestamp() });
      tx.update(userRef, { status: 'ativo' });
      tx.set(doc(db, 'members', uid), {
        username: user.get('username'),
        mainCharacter,
        active: true,
        joinedAt: serverTimestamp(),
        approvedBy: adminUid,
      });
    });
    return { ok: true };
  } catch (error) {
    return decisionError(error);
  }
}

/** Recusa: a candidatura fica recusada (com admin e data); a conta continua pendente. */
export async function rejectApplication(
  db: Firestore,
  adminUid: string,
  uid: string,
): Promise<DecisionResult> {
  try {
    await runTransaction(db, async (tx) => {
      const appRef = doc(db, 'applications', uid);
      const app = await tx.get(appRef);
      if (app.get('status') !== 'pendente') throw new Decided();
      tx.update(appRef, { status: 'recusada', decidedBy: adminUid, decidedAt: serverTimestamp() });
    });
    return { ok: true };
  } catch (error) {
    return decisionError(error);
  }
}
