// Presenças de visitantes em eventos, sem dependência do Angular.
// Testado contra os emuladores (tests/integration/guest-attendance.spec.ts).
//
// Quem não é membro (visitante sem login ou conta pendente) confirma presença informando o
// personagem da versão do jogo do evento: no WoW Forever, nome e sobrenome; no Retail, nome e
// reino. As presenças ficam em
// `events/{id}/guests/{guestKey}`; o ID determinístico impede que o mesmo personagem confirme
// duas vezes. Somente administradores listam e cancelam essas presenças.
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

export type GuestInput =
  | { game: 'forever'; characterName: string; characterSurname: string }
  | { game: 'retail'; characterName: string; realm: string };

export type Guest = GuestInput & {
  /** ID da presença (ver `guestKey`). */
  id: string;
  confirmedAt: Date | null;
};

export type GuestAttendanceError =
  | 'already-confirmed'
  | 'not-confirmed'
  | 'guests-closed'
  | 'wrong-game'
  | 'full'
  | 'past'
  | 'cancelled'
  | 'not-found'
  | 'not-allowed'
  | 'network'
  | 'unknown';
export type GuestAttendanceResult =
  { ok: true; id: string } | { ok: false; error: GuestAttendanceError };

/** Reino do Retail: até 40 caracteres, sem "/" (igual às Security Rules). */
export const REALM_MAX_LENGTH = 40;
export const REALM_PATTERN = /^[^\s/]+( [^\s/]+)*$/u;

/** Nome gravado: só a primeira letra maiúscula, como no jogo (igual às Security Rules). */
export const GUEST_NAME_PATTERN = /^\p{Lu}\p{Ll}{1,11}$/u;

/** Espaços nas pontas removidos e espaços seguidos reduzidos a um só. */
const tidy = (value: string) => value.trim().replace(/\s+/gu, ' ');

/** "lUNARA" → "Lunara": o jogo grava nomes assim. */
function nameCase(value: string): string {
  const name = value.trim().toLocaleLowerCase('pt-BR');
  return name.charAt(0).toLocaleUpperCase('pt-BR') + name.slice(1);
}

/**
 * "tol barad" → "Tol Barad", "quel'thalas" → "Quel'Thalas": maiúscula no início de cada
 * palavra (depois de espaço, hífen ou apóstrofo), para o mesmo reino gerar sempre o mesmo ID.
 */
function realmCase(value: string): string {
  return tidy(value)
    .toLocaleLowerCase('pt-BR')
    .replace(
      /(^|[\s'’-])(\p{Ll})/gu,
      (_, sep: string, ch: string) => sep + ch.toLocaleUpperCase('pt-BR'),
    );
}

/** Dados exatamente como gravados (e validados pelas rules), sem o horário. */
export function guestData(input: GuestInput): GuestInput {
  return input.game === 'forever'
    ? {
        game: 'forever',
        characterName: nameCase(input.characterName),
        characterSurname: nameCase(input.characterSurname),
      }
    : {
        game: 'retail',
        characterName: nameCase(input.characterName),
        realm: realmCase(input.realm),
      };
}

/**
 * ID da presença: jogo, nome e sobrenome (Forever) ou reino (Retail), já padronizados.
 * O mesmo personagem gera sempre o mesmo ID, então não confirma duas vezes.
 */
export function guestKey(input: GuestInput): string {
  const g = guestData(input);
  return `${g.game}:${g.characterName}:${g.game === 'forever' ? g.characterSurname : g.realm}`;
}

/** Nome exibido: "Nome Sobrenome" no Forever; "Nome-Reino" no Retail. */
export function guestDisplayName(guest: GuestInput): string {
  return guest.game === 'forever'
    ? `${guest.characterName} ${guest.characterSurname}`
    : `${guest.characterName}-${guest.realm}`;
}

export function guestFromData(id: string, data: Record<string, unknown>): Guest {
  const confirmedAt = toDate(data['confirmedAt']);
  const characterName = String(data['characterName'] ?? '');
  return data['game'] === 'retail'
    ? { id, game: 'retail', characterName, realm: String(data['realm'] ?? ''), confirmedAt }
    : {
        id,
        game: 'forever',
        characterName,
        characterSurname: String(data['characterSurname'] ?? ''),
        confirmedAt,
      };
}

const guestRef = (db: Firestore, eventId: string, id: string) =>
  doc(db, 'events', eventId, 'guests', id);

class Blocked extends Error {
  constructor(readonly reason: GuestAttendanceError) {
    super(reason);
  }
}

/** Lê o evento na transação e garante que ainda aceita mudanças de presença. */
async function openEvent(
  tx: Transaction,
  db: Firestore,
  eventId: string,
  forGuests: boolean,
): Promise<GuildEvent> {
  const snap = await tx.get(doc(db, 'events', eventId));
  if (!snap.exists()) throw new Blocked('not-found');
  const event = eventFromData(eventId, snap.data());
  if (event.status === 'cancelado') throw new Blocked('cancelled');
  if (!isUpcoming(event.startsAt)) throw new Blocked('past');
  if (forGuests && !event.guestsAllowed) throw new Blocked('guests-closed');
  return event;
}

/**
 * Visitante confirma presença com o personagem informado, se houver vaga. O contador de
 * confirmados do evento sobe no mesmo lote.
 */
export async function confirmGuestAttendance(
  db: Firestore,
  eventId: string,
  input: GuestInput,
): Promise<GuestAttendanceResult> {
  const id = guestKey(input);
  try {
    await retryCountRace(() =>
      runTransaction(db, async (tx) => {
        const event = await openEvent(tx, db, eventId, true);
        if (event.game && input.game !== event.game) throw new Blocked('wrong-game');
        const ref = guestRef(db, eventId, id);
        if ((await tx.get(ref)).exists()) throw new Blocked('already-confirmed');
        if (isFull(event)) throw new Blocked('full');
        tx.set(ref, { ...guestData(input), confirmedAt: serverTimestamp() });
        tx.update(doc(db, 'events', eventId), attendanceCountUpdate(event, 'guests', id, 1));
      }),
    );
    return { ok: true, id };
  } catch (error) {
    return failure(error);
  }
}

/** Administrador cancela a presença de um visitante (evento ativo e futuro). */
export async function removeGuestAttendance(
  db: Firestore,
  eventId: string,
  id: string,
): Promise<GuestAttendanceResult> {
  try {
    await retryCountRace(() =>
      runTransaction(db, async (tx) => {
        const event = await openEvent(tx, db, eventId, false);
        const ref = guestRef(db, eventId, id);
        if (!(await tx.get(ref)).exists()) throw new Blocked('not-confirmed');
        tx.delete(ref);
        tx.update(doc(db, 'events', eventId), attendanceCountUpdate(event, 'guests', id, -1));
      }),
    );
    return { ok: true, id };
  } catch (error) {
    return failure(error);
  }
}

/** Acompanha uma presença de visitante; `null` quando não existe (ou foi cancelada). */
export function watchGuest(
  db: Firestore,
  eventId: string,
  id: string,
  next: (guest: Guest | null) => void,
  error: (e: unknown) => void,
): () => void {
  return onSnapshot(
    guestRef(db, eventId, id),
    (snap) => next(snap.exists() ? guestFromData(snap.id, snap.data()) : null),
    error,
  );
}

/** Visitantes confirmados (somente administradores), na ordem de confirmação. */
export function watchGuests(
  db: Firestore,
  eventId: string,
  next: (guests: Guest[]) => void,
  error: (e: unknown) => void,
): () => void {
  return onSnapshot(
    collection(db, 'events', eventId, 'guests'),
    (snap) =>
      next(
        snap.docs
          .map((d) => guestFromData(d.id, d.data()))
          .sort(
            (a, b) =>
              (a.confirmedAt?.getTime() ?? Infinity) - (b.confirmedAt?.getTime() ?? Infinity),
          ),
      ),
    error,
  );
}

function failure(error: unknown): GuestAttendanceResult {
  if (error instanceof Blocked) return { ok: false, error: error.reason };
  const code = error instanceof FirebaseError ? error.code : '';
  if (code === 'permission-denied') return { ok: false, error: 'not-allowed' };
  if (code === 'unavailable') return { ok: false, error: 'network' };
  return { ok: false, error: 'unknown' };
}
