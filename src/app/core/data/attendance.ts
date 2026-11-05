// Presenças em eventos, sem dependência do Angular.
// Testado contra os emuladores (tests/integration/attendance.spec.ts).
import { FirebaseError } from 'firebase/app';
import {
  collection,
  doc,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  type Firestore,
  type Transaction,
} from 'firebase/firestore';
import { toDate } from './applications';
import { eventFromData, isUpcoming } from './events';
import { watchMembers, type MainCharacter, type MemberRow } from './members-admin';

export interface MyAttendance {
  confirmedAt: Date | null;
}

export type AttendanceError =
  | 'already-confirmed'
  | 'not-confirmed'
  | 'past'
  | 'cancelled'
  | 'not-found'
  | 'not-allowed'
  | 'network'
  | 'unknown';
export type AttendanceResult = { ok: true } | { ok: false; error: AttendanceError };

const attendeeRef = (db: Firestore, eventId: string, uid: string) =>
  doc(db, 'events', eventId, 'attendees', uid);

/** Acompanha a presença da pessoa no evento; `null` se não confirmou. */
export function watchMyAttendance(
  db: Firestore,
  eventId: string,
  uid: string,
  next: (attendance: MyAttendance | null) => void,
  error: (e: unknown) => void,
): () => void {
  return onSnapshot(
    attendeeRef(db, eventId, uid),
    (snap) => next(snap.exists() ? { confirmedAt: toDate(snap.get('confirmedAt')) } : null),
    error,
  );
}

export interface Attendee {
  uid: string;
  username: string;
  mainCharacter: MainCharacter | null;
  confirmedAt: Date | null;
}

/** Ordem de confirmação (quem confirmou primeiro, primeiro). */
function byConfirmation(a: Attendee, b: Attendee): number {
  return (a.confirmedAt?.getTime() ?? Infinity) - (b.confirmedAt?.getTime() ?? Infinity);
}

/**
 * Confirmados do evento (somente administradores), com o personagem principal atual de cada um.
 * Contas desativadas saem da lista, como nas demais listas da guilda.
 */
export function watchAttendees(
  db: Firestore,
  eventId: string,
  next: (attendees: Attendee[]) => void,
  error: (e: unknown) => void,
): () => void {
  let confirmed: Map<string, Date | null> | null = null;
  let members: Map<string, MemberRow> | null = null;
  const emit = () => {
    if (!confirmed || !members) return;
    const people = members;
    const list: Attendee[] = [];
    for (const [uid, confirmedAt] of confirmed) {
      const m = people.get(uid);
      if (m?.status !== 'ativo') continue;
      list.push({ uid, username: m.username, mainCharacter: m.mainCharacter, confirmedAt });
    }
    next(list.sort(byConfirmation));
  };

  const stopAttendees = onSnapshot(
    collection(db, 'events', eventId, 'attendees'),
    (snap) => {
      confirmed = new Map(snap.docs.map((d) => [d.id, toDate(d.get('confirmedAt'))]));
      emit();
    },
    error,
  );
  const stopMembers = watchMembers(
    db,
    (rows) => {
      members = new Map(rows.map((r) => [r.uid, r]));
      emit();
    },
    error,
  );
  return () => {
    stopAttendees();
    stopMembers();
  };
}

class Blocked extends Error {
  constructor(readonly reason: AttendanceError) {
    super(reason);
  }
}

/** Lê o evento na transação e garante que ainda aceita mudanças de presença. */
async function openEvent(tx: Transaction, db: Firestore, eventId: string): Promise<void> {
  const snap = await tx.get(doc(db, 'events', eventId));
  if (!snap.exists()) throw new Blocked('not-found');
  const event = eventFromData(eventId, snap.data());
  if (event.status === 'cancelado') throw new Blocked('cancelled');
  if (!isUpcoming(event.startsAt)) throw new Blocked('past');
}

/** Confirma a presença de `uid` (a pessoa autenticada) em um evento futuro e ativo. */
export async function confirmAttendance(
  db: Firestore,
  eventId: string,
  uid: string,
): Promise<AttendanceResult> {
  try {
    await runTransaction(db, async (tx) => {
      await openEvent(tx, db, eventId);
      const ref = attendeeRef(db, eventId, uid);
      if ((await tx.get(ref)).exists()) throw new Blocked('already-confirmed');
      tx.set(ref, { confirmedAt: serverTimestamp() });
    });
    return { ok: true };
  } catch (error) {
    return failure(error);
  }
}

/**
 * Cancela a presença de `uid` enquanto o evento estiver ativo e futuro: a própria (membro)
 * ou a de qualquer confirmado (administrador). As rules decidem quem pode.
 */
export async function cancelAttendance(
  db: Firestore,
  eventId: string,
  uid: string,
): Promise<AttendanceResult> {
  try {
    await runTransaction(db, async (tx) => {
      await openEvent(tx, db, eventId);
      const ref = attendeeRef(db, eventId, uid);
      if (!(await tx.get(ref)).exists()) throw new Blocked('not-confirmed');
      tx.delete(ref);
    });
    return { ok: true };
  } catch (error) {
    return failure(error);
  }
}

function failure(error: unknown): AttendanceResult {
  if (error instanceof Blocked) return { ok: false, error: error.reason };
  const code = error instanceof FirebaseError ? error.code : '';
  if (code === 'permission-denied') return { ok: false, error: 'not-allowed' };
  if (code === 'unavailable') return { ok: false, error: 'network' };
  return { ok: false, error: 'unknown' };
}
