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
import {
  attendanceCountUpdate,
  retryCountRace,
  eventFromData,
  isFull,
  isUpcoming,
  type GuildEvent,
} from './events';
import { watchMembers, type MainCharacter, type MemberRow } from './members-admin';

export interface MyAttendance {
  confirmedAt: Date | null;
  /** Personagem com que confirmou (`null` em presenças anteriores à escolha do personagem). */
  character: MainCharacter | null;
}

export type AttendanceError =
  | 'already-confirmed'
  | 'character-not-found'
  | 'wrong-game'
  | 'not-confirmed'
  | 'full'
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
    (snap) =>
      next(
        snap.exists()
          ? { confirmedAt: toDate(snap.get('confirmedAt')), character: characterOf(snap.data()) }
          : null,
      ),
    error,
  );
}

/** Personagem gravado na presença (presenças antigas não têm). */
function characterOf(data: Record<string, unknown>): MainCharacter | null {
  const c = data['character'];
  return c && typeof c === 'object' ? (c as MainCharacter) : null;
}

export interface Attendee {
  uid: string;
  /** Vazio quando a conta foi excluída (o nome de usuário é removido). */
  username: string;
  /**
   * Personagem com que confirmou. Em presenças anteriores à escolha do personagem, o
   * personagem principal atual (ou o que ficou, na conta excluída).
   */
  character: MainCharacter | null;
  confirmedAt: Date | null;
  /** Conta excluída: a presença continua no histórico, com o personagem principal. */
  deleted: boolean;
}

/** Ordem de confirmação (quem confirmou primeiro, primeiro). */
function byConfirmation(a: Attendee, b: Attendee): number {
  return (a.confirmedAt?.getTime() ?? Infinity) - (b.confirmedAt?.getTime() ?? Infinity);
}

/**
 * Confirmados do evento (somente administradores), com o personagem de cada um.
 * Contas desativadas saem da lista, como nas demais listas da guilda. Contas excluídas
 * continuam no histórico (suas presenças em eventos futuros já foram canceladas), sem dados
 * pessoais.
 */
export function watchAttendees(
  db: Firestore,
  eventId: string,
  next: (attendees: Attendee[]) => void,
  error: (e: unknown) => void,
): () => void {
  let confirmed: Map<string, { confirmedAt: Date | null; character: MainCharacter | null }> | null =
    null;
  let members: Map<string, MemberRow> | null = null;
  let deleted: Map<string, MainCharacter | null> | null = null;
  const emit = () => {
    if (!confirmed || !members || !deleted) return;
    const people = members;
    const gone = deleted;
    const list: Attendee[] = [];
    for (const [uid, { confirmedAt, character }] of confirmed) {
      const m = people.get(uid);
      if (m?.status === 'ativo') {
        list.push({
          uid,
          username: m.username,
          character: character ?? m.mainCharacter,
          confirmedAt,
          deleted: false,
        });
      } else if (!m && gone.has(uid)) {
        list.push({
          uid,
          username: '',
          character: character ?? gone.get(uid)!,
          confirmedAt,
          deleted: true,
        });
      }
    }
    next(list.sort(byConfirmation));
  };

  const stopAttendees = onSnapshot(
    collection(db, 'events', eventId, 'attendees'),
    (snap) => {
      confirmed = new Map(
        snap.docs.map((d) => [
          d.id,
          { confirmedAt: toDate(d.get('confirmedAt')), character: characterOf(d.data()) },
        ]),
      );
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
  const stopDeleted = onSnapshot(
    collection(db, 'members'),
    (snap) => {
      deleted = new Map(
        snap.docs
          .filter((d) => d.get('deletedAt') !== undefined)
          .map((d) => [d.id, (d.get('mainCharacter') as MainCharacter | undefined) ?? null]),
      );
      emit();
    },
    error,
  );
  return () => {
    stopAttendees();
    stopMembers();
    stopDeleted();
  };
}

class Blocked extends Error {
  constructor(readonly reason: AttendanceError) {
    super(reason);
  }
}

/** Lê o evento na transação e garante que ainda aceita mudanças de presença. */
async function openEvent(tx: Transaction, db: Firestore, eventId: string): Promise<GuildEvent> {
  const snap = await tx.get(doc(db, 'events', eventId));
  if (!snap.exists()) throw new Blocked('not-found');
  const event = eventFromData(eventId, snap.data());
  if (event.status === 'cancelado') throw new Blocked('cancelled');
  if (!isUpcoming(event.startsAt)) throw new Blocked('past');
  return event;
}

/**
 * Lê, na transação, o personagem do membro: um personagem salvo (`characterId`) ou, com
 * `null`, o principal vindo da candidatura, que ainda não tem documento próprio.
 */
async function readCharacter(
  tx: Transaction,
  db: Firestore,
  uid: string,
  characterId: string | null,
): Promise<Record<string, unknown>> {
  if (characterId) {
    const snap = await tx.get(doc(db, 'members', uid, 'characters', characterId));
    if (!snap.exists()) throw new Blocked('character-not-found');
    return snap.data();
  }
  const main = (await tx.get(doc(db, 'members', uid))).get('mainCharacter') as
    Record<string, unknown> | undefined;
  if (!main) throw new Blocked('character-not-found');
  return main;
}

/**
 * Confirma a presença de `uid` (a pessoa autenticada) em um evento futuro e ativo, com vaga,
 * com um dos seus personagens (`characterId`; `null` = principal ainda sem documento próprio),
 * que precisa ser da versão do jogo do evento. O personagem é copiado para a presença, e o
 * contador de confirmados do evento sobe no mesmo lote.
 */
export async function confirmAttendance(
  db: Firestore,
  eventId: string,
  uid: string,
  characterId: string | null,
): Promise<AttendanceResult> {
  try {
    await retryCountRace(() =>
      runTransaction(db, async (tx) => {
        const event = await openEvent(tx, db, eventId);
        const ref = attendeeRef(db, eventId, uid);
        if ((await tx.get(ref)).exists()) throw new Blocked('already-confirmed');
        const character = await readCharacter(tx, db, uid, characterId);
        if (event.game && character['game'] !== event.game) throw new Blocked('wrong-game');
        if (isFull(event)) throw new Blocked('full');
        tx.set(ref, {
          confirmedAt: serverTimestamp(),
          character,
          ...(characterId ? { characterId } : {}),
        });
        tx.update(doc(db, 'events', eventId), attendanceCountUpdate(event, 'attendees', uid, 1));
      }),
    );
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
    await retryCountRace(() =>
      runTransaction(db, async (tx) => {
        const event = await openEvent(tx, db, eventId);
        const ref = attendeeRef(db, eventId, uid);
        if (!(await tx.get(ref)).exists()) throw new Blocked('not-confirmed');
        tx.delete(ref);
        tx.update(doc(db, 'events', eventId), attendanceCountUpdate(event, 'attendees', uid, -1));
      }),
    );
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
