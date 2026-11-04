// Candidaturas sem dependência do Angular, testadas contra os emuladores
// (tests/integration/applications.spec.ts).
import { FirebaseError } from 'firebase/app';
import {
  Timestamp,
  doc,
  getDoc,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  type Firestore,
  type Unsubscribe,
} from 'firebase/firestore';
import {
  isGame,
  type CharacterClass,
  type CharacterRole,
  type Game,
  type Ruleset,
} from '../models/wow';

export type ApplicationStatus = 'pendente' | 'aprovada' | 'recusada';

/** Personagem por jogo: Retail tem servidor; Forever tem sobrenome e ruleset. */
export type GameCharacter =
  | { game: 'retail'; characterName: string; server: string }
  | { game: 'forever'; characterName: string; characterSurname: string; ruleset: Ruleset };

export type ApplicationInput = GameCharacter & {
  characterClass: CharacterClass;
  characterRole: CharacterRole;
  motivation: string;
};

export interface PastDecision {
  status: ApplicationStatus;
  submittedAt: Date;
  decidedBy: string | null;
  decidedAt: Date | null;
}

export interface Application {
  uid: string;
  game: Game;
  characterName: string;
  /** Somente no WoW Forever. */
  characterSurname: string | null;
  /** Somente no Retail. */
  server: string | null;
  /** Somente no WoW Forever. */
  ruleset: Ruleset | null;
  characterClass: CharacterClass;
  characterRole: CharacterRole;
  motivation: string;
  status: ApplicationStatus;
  submittedAt: Date;
  decidedBy: string | null;
  decidedAt: Date | null;
  history: PastDecision[];
}

export type SubmitError =
  'already-pending' | 'already-approved' | 'not-allowed' | 'network' | 'unknown';
export type SubmitResult = { ok: true } | { ok: false; error: SubmitError };

/** Pode enviar (ou reenviar) quando não há candidatura ou a última foi recusada. */
export function canSubmit(application: Application | null): boolean {
  return !application || application.status === 'recusada';
}

export const toDate = (value: unknown): Date | null =>
  value instanceof Timestamp ? value.toDate() : null;

export function fromData(uid: string, data: Record<string, unknown>): Application {
  const history = (data['history'] as Record<string, unknown>[] | undefined) ?? [];
  return {
    uid,
    game: isGame(data['game']) ? data['game'] : 'retail',
    characterName: data['characterName'] as string,
    characterSurname: (data['characterSurname'] as string | undefined) ?? null,
    server: (data['server'] as string | undefined) ?? null,
    ruleset: (data['ruleset'] as Ruleset | undefined) ?? null,
    characterClass: data['characterClass'] as CharacterClass,
    characterRole: data['characterRole'] as CharacterRole,
    motivation: data['motivation'] as string,
    status: data['status'] as ApplicationStatus,
    // Sem data ainda = escrita local aguardando o servidor.
    submittedAt: toDate(data['submittedAt']) ?? new Date(),
    decidedBy: (data['decidedBy'] as string | undefined) ?? null,
    decidedAt: toDate(data['decidedAt']),
    history: history.map((h) => ({
      status: h['status'] as ApplicationStatus,
      submittedAt: toDate(h['submittedAt']) ?? new Date(0),
      decidedBy: (h['decidedBy'] as string | null) ?? null,
      decidedAt: toDate(h['decidedAt']),
    })),
  };
}

export async function getApplication(db: Firestore, uid: string): Promise<Application | null> {
  const snap = await getDoc(doc(db, 'applications', uid));
  return snap.exists() ? fromData(uid, snap.data()) : null;
}

/** Acompanha a candidatura em tempo real (o resultado aparece assim que o admin decide). */
export function watchApplication(
  db: Firestore,
  uid: string,
  next: (application: Application | null) => void,
  error: (e: unknown) => void,
): Unsubscribe {
  return onSnapshot(
    doc(db, 'applications', uid),
    (snap) => next(snap.exists() ? fromData(uid, snap.data()) : null),
    error,
  );
}

class SubmitBlocked extends Error {
  constructor(readonly reason: SubmitError) {
    super(reason);
  }
}

/**
 * Envia a candidatura (pendente). Se a anterior foi recusada, substitui os dados
 * e acrescenta a decisão anterior ao histórico — exatamente como as rules exigem.
 */
export async function submitApplication(
  db: Firestore,
  uid: string,
  input: ApplicationInput,
): Promise<SubmitResult> {
  const ref = doc(db, 'applications', uid);
  const character =
    input.game === 'retail'
      ? { game: 'retail', characterName: input.characterName.trim(), server: input.server.trim() }
      : {
          game: 'forever',
          characterName: input.characterName.trim(),
          characterSurname: input.characterSurname.trim(),
          ruleset: input.ruleset,
        };
  const data = {
    ...character,
    characterClass: input.characterClass,
    characterRole: input.characterRole,
    motivation: input.motivation.trim(),
    rulesAccepted: true,
    status: 'pendente',
    submittedAt: serverTimestamp(),
  };

  try {
    await runTransaction(db, async (tx) => {
      const current = await tx.get(ref);
      if (!current.exists()) {
        tx.set(ref, data);
        return;
      }
      const previous = current.data();
      if (previous['status'] === 'pendente') throw new SubmitBlocked('already-pending');
      if (previous['status'] === 'aprovada') throw new SubmitBlocked('already-approved');
      const history = [
        ...((previous['history'] as unknown[] | undefined) ?? []),
        {
          status: previous['status'],
          submittedAt: previous['submittedAt'],
          decidedBy: previous['decidedBy'] ?? null,
          decidedAt: previous['decidedAt'] ?? null,
        },
      ];
      tx.set(ref, { ...data, history });
    });
    return { ok: true };
  } catch (error) {
    if (error instanceof SubmitBlocked) return { ok: false, error: error.reason };
    const code = error instanceof FirebaseError ? error.code : '';
    if (code === 'permission-denied') return { ok: false, error: 'not-allowed' };
    if (code === 'unavailable') return { ok: false, error: 'network' };
    return { ok: false, error: 'unknown' };
  }
}
