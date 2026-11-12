// Eventos da guilda, sem dependência do Angular.
// Testado contra os emuladores (tests/integration/events.spec.ts).
import { FirebaseError } from 'firebase/app';
import {
  Timestamp,
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  where,
  writeBatch,
  type Firestore,
} from 'firebase/firestore';
import { isGame, type Game } from '../models/wow';
import { toDate } from './applications';

export type EventStatus = 'ativo' | 'cancelado';

export interface GuildEvent {
  id: string;
  title: string;
  startsAt: Date;
  description: string;
  organizer: string;
  status: EventStatus;
  /**
   * Versão do jogo do evento: visitantes confirmam com um personagem dela e membros, com um
   * personagem seu dela. `null` em eventos criados antes da escolha (aceitam os dois jogos).
   */
  game: Game | null;
  /** Visitantes podem confirmar presença (padrão: sim; eventos antigos não têm o campo). */
  guestsAllowed: boolean;
  /** Limite de confirmados, membros e visitantes (padrão: 40). */
  maxAttendees: number;
  /** Confirmados contados no evento (0 em eventos criados antes do contador). */
  attendeeCount: number;
}

export interface EventInput {
  title: string;
  game: Game;
  startsAt: Date;
  description: string;
  organizer: string;
  guestsAllowed: boolean;
  maxAttendees: number;
}

/** Tamanhos máximos (iguais aos de firestore.rules). */
export const EVENT_LIMITS = { title: 80, organizer: 40, description: 2000 } as const;

/** Limite de confirmados: padrão e faixa aceita (iguais aos de firestore.rules). */
export const DEFAULT_MAX_ATTENDEES = 40;
export const MAX_ATTENDEES_RANGE = { min: 1, max: 500 } as const;

/** O evento atingiu o limite de confirmados. */
export const isFull = (event: GuildEvent) => event.attendeeCount >= event.maxAttendees;

/** Vagas restantes (nunca negativo, mesmo se o limite foi reduzido abaixo do total). */
export const spotsLeft = (event: GuildEvent) =>
  Math.max(0, event.maxAttendees - event.attendeeCount);

export type EventActionError =
  | 'past'
  | 'cancelled'
  | 'not-cancelled'
  | 'game-locked'
  | 'not-found'
  | 'not-allowed'
  | 'network'
  | 'unknown';
interface EventActionFailure {
  ok: false;
  error: EventActionError;
}
export type EventActionResult = { ok: true } | EventActionFailure;
export type CreateEventResult = { ok: true; id: string } | EventActionFailure;

/** Um evento só pode ser criado, editado ou cancelado antes de começar. */
export const isUpcoming = (startsAt: Date, now = new Date()) => startsAt.getTime() > now.getTime();

/** Pode ser editado ou cancelado: ativo e ainda não começou. */
export const isChangeable = (event: GuildEvent, now = new Date()) =>
  event.status === 'ativo' && isUpcoming(event.startsAt, now);

/**
 * A versão do jogo só muda enquanto ninguém confirmou presença (os personagens confirmados são
 * dela). Eventos antigos, sem versão, podem recebê-la a qualquer momento.
 */
export const canChangeGame = (event: GuildEvent) =>
  event.game === null || event.attendeeCount === 0;

export function eventFromData(id: string, data: Record<string, unknown>): GuildEvent {
  return {
    id,
    title: data['title'] as string,
    startsAt: toDate(data['startsAt']) ?? new Date(0),
    description: data['description'] as string,
    organizer: data['organizer'] as string,
    status: data['status'] === 'cancelado' ? 'cancelado' : 'ativo',
    game: isGame(data['game']) ? data['game'] : null,
    guestsAllowed: data['guestsAllowed'] !== false,
    maxAttendees: positiveInt(data['maxAttendees']) ?? DEFAULT_MAX_ATTENDEES,
    attendeeCount: positiveInt(data['attendeeCount']) ?? 0,
  };
}

function positiveInt(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : null;
}

/**
 * Repete a transação de presença quando as rules a recusam por concorrência: outra pessoa
 * confirmou ou cancelou no mesmo instante, então o contador lido ficou velho e a escrita é
 * negada (o SDK só repete conflitos, não recusas). Na nova tentativa, a transação relê o
 * evento; se ele lotou, ela termina com "lotado". Recusas de verdade (sem permissão) são
 * repetidas poucas vezes e então devolvidas.
 */
export async function retryCountRace<T>(run: () => Promise<T>, attempts = 5): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await run();
    } catch (error) {
      const denied = error instanceof FirebaseError && error.code === 'permission-denied';
      if (!denied || attempt >= attempts) throw error;
      await new Promise((resolve) => setTimeout(resolve, 40 * attempt + Math.random() * 80));
    }
  }
}

export type PresenceKind = 'attendees' | 'guests';

/** ID do registro de cancelamento de uma presença (`events/{id}/cancellations`). */
export const cancellationId = (kind: PresenceKind, id: string) => `${kind}:${id}`;

export const cancellationRef = (db: Firestore, eventId: string, kind: PresenceKind, id: string) =>
  doc(db, 'events', eventId, 'cancellations', cancellationId(kind, id));

/**
 * Registro do cancelamento, gravado no mesmo lote em que a presença é apagada. Guarda quando a
 * presença foi cancelada no site, para a importação de presenças do addon não refazê-la com um
 * dado mais antigo do jogo (ver presence-import.ts).
 */
export function cancellationData(kind: PresenceKind, id: string): Record<string, unknown> {
  return { kind, id, cancelledAt: serverTimestamp() };
}

/**
 * Entrada (+1) ou saída (-1) de uma presença no contador do evento, no mesmo lote da
 * presença. `lastAttendance` aponta a presença alterada (as rules conferem os dois lados).
 * A saída nunca deixa o contador negativo (eventos antigos não tinham contador).
 */
export function attendanceCountUpdate(
  event: GuildEvent,
  kind: PresenceKind,
  id: string,
  delta: 1 | -1,
): { attendeeCount: number; lastAttendance: { kind: string; id: string } } {
  return {
    attendeeCount: Math.max(0, event.attendeeCount + delta),
    lastAttendance: { kind, id },
  };
}

const clean = (input: EventInput) => ({
  title: input.title.trim(),
  game: input.game,
  startsAt: Timestamp.fromDate(input.startsAt),
  description: input.description.trim(),
  organizer: input.organizer.trim(),
  guestsAllowed: input.guestsAllowed,
  maxAttendees: input.maxAttendees,
});

class ActionBlocked extends Error {
  constructor(readonly reason: EventActionError) {
    super(reason);
  }
}

function actionError(error: unknown): EventActionFailure {
  if (error instanceof ActionBlocked) return { ok: false, error: error.reason };
  const code = error instanceof FirebaseError ? error.code : '';
  if (code === 'permission-denied') return { ok: false, error: 'not-allowed' };
  if (code === 'unavailable') return { ok: false, error: 'network' };
  return { ok: false, error: 'unknown' };
}

/** Acompanha, em ordem cronológica, os eventos que começam a partir de `from`. */
export function watchEventsFrom(
  db: Firestore,
  from: Date,
  next: (events: GuildEvent[]) => void,
  error: (e: unknown) => void,
): () => void {
  return onSnapshot(
    query(
      collection(db, 'events'),
      where('startsAt', '>=', Timestamp.fromDate(from)),
      orderBy('startsAt'),
    ),
    (snap) => next(snap.docs.map((d) => eventFromData(d.id, d.data()))),
    error,
  );
}

/** Acompanha, em ordem cronológica, os eventos que começam em [from, to). */
export function watchEventsBetween(
  db: Firestore,
  from: Date,
  to: Date,
  next: (events: GuildEvent[]) => void,
  error: (e: unknown) => void,
): () => void {
  return onSnapshot(
    query(
      collection(db, 'events'),
      where('startsAt', '>=', Timestamp.fromDate(from)),
      where('startsAt', '<', Timestamp.fromDate(to)),
      orderBy('startsAt'),
    ),
    (snap) => next(snap.docs.map((d) => eventFromData(d.id, d.data()))),
    error,
  );
}

/** Acompanha um evento; `null` quando não existe. */
export function watchEvent(
  db: Firestore,
  id: string,
  next: (event: GuildEvent | null) => void,
  error: (e: unknown) => void,
): () => void {
  return onSnapshot(
    doc(db, 'events', id),
    (snap) => next(snap.exists() ? eventFromData(snap.id, snap.data()) : null),
    error,
  );
}

export async function createEvent(
  db: Firestore,
  adminUid: string,
  input: EventInput,
): Promise<CreateEventResult> {
  if (!isUpcoming(input.startsAt)) return { ok: false, error: 'past' };
  try {
    const ref = await addDoc(collection(db, 'events'), {
      ...clean(input),
      attendeeCount: 0,
      status: 'ativo',
      createdBy: adminUid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return { ok: true, id: ref.id };
  } catch (error) {
    return actionError(error);
  }
}

/** Salva alterações. As presenças (subcoleção) não são tocadas, então são mantidas. */
export async function updateEvent(
  db: Firestore,
  adminUid: string,
  id: string,
  input: EventInput,
): Promise<EventActionResult> {
  try {
    await runTransaction(db, async (tx) => {
      const ref = doc(db, 'events', id);
      const snap = await tx.get(ref);
      if (!snap.exists()) throw new ActionBlocked('not-found');
      const current = eventFromData(id, snap.data());
      if (current.status === 'cancelado') throw new ActionBlocked('cancelled');
      if (!isUpcoming(current.startsAt)) throw new ActionBlocked('past');
      const moved = current.startsAt.getTime() !== input.startsAt.getTime();
      if (moved && !isUpcoming(input.startsAt)) throw new ActionBlocked('past');
      if (current.game !== input.game && !canChangeGame(current)) {
        throw new ActionBlocked('game-locked');
      }
      tx.update(ref, { ...clean(input), updatedAt: serverTimestamp(), updatedBy: adminUid });
    });
    return { ok: true };
  } catch (error) {
    return actionError(error);
  }
}

/** Cancela: o evento continua no calendário, identificado como cancelado. */
export async function cancelEvent(
  db: Firestore,
  adminUid: string,
  id: string,
): Promise<EventActionResult> {
  try {
    await runTransaction(db, async (tx) => {
      const ref = doc(db, 'events', id);
      const snap = await tx.get(ref);
      if (!snap.exists()) throw new ActionBlocked('not-found');
      const current = eventFromData(id, snap.data());
      if (current.status === 'cancelado') throw new ActionBlocked('cancelled');
      if (!isUpcoming(current.startsAt)) throw new ActionBlocked('past');
      tx.update(ref, {
        status: 'cancelado',
        cancelledAt: serverTimestamp(),
        cancelledBy: adminUid,
      });
    });
    return { ok: true };
  } catch (error) {
    return actionError(error);
  }
}

/** Escritas por lote do Firestore (limite de 500, com folga para a exclusão do evento). */
const BATCH_SIZE = 450;

/**
 * Exclui um evento cancelado, as listas de confirmados, de membros e de visitantes, e o registro
 * de cancelamentos (subcoleções, que o Firestore não apaga sozinho). As presenças saem no mesmo lote do evento;
 * se houver mais do que cabe num lote, as restantes saem logo depois (as rules só permitem isso
 * nessas duas situações).
 */
export async function deleteCancelledEvent(db: Firestore, id: string): Promise<EventActionResult> {
  try {
    const ref = doc(db, 'events', id);
    const snap = await getDoc(ref);
    if (!snap.exists()) return { ok: false, error: 'not-found' };
    if (eventFromData(id, snap.data()).status !== 'cancelado') {
      return { ok: false, error: 'not-cancelled' };
    }

    const [members, guests, cancellations] = await Promise.all([
      getDocs(collection(db, 'events', id, 'attendees')),
      getDocs(collection(db, 'events', id, 'guests')),
      getDocs(collection(db, 'events', id, 'cancellations')),
    ]);
    const attendees = [...members.docs, ...guests.docs, ...cancellations.docs];
    const first = writeBatch(db);
    for (const a of attendees.slice(0, BATCH_SIZE)) first.delete(a.ref);
    first.delete(ref);
    await first.commit();
    for (let i = BATCH_SIZE; i < attendees.length; i += BATCH_SIZE) {
      const batch = writeBatch(db);
      for (const a of attendees.slice(i, i + BATCH_SIZE)) batch.delete(a.ref);
      await batch.commit();
    }
    return { ok: true };
  } catch (error) {
    return actionError(error);
  }
}
