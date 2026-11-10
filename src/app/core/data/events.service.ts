import { Injectable, inject } from '@angular/core';
import type { Firestore } from 'firebase/firestore';
import { SessionService } from '../auth/session.service';
import { FirestoreClient } from '../firebase/firebase.providers';
import {
  cancelAttendance,
  confirmAttendance,
  watchAttendees,
  watchMyAttendance,
  type Attendee,
  type AttendanceResult,
  type MyAttendance,
} from './attendance';
import {
  confirmGuestAttendance,
  removeGuestAttendance,
  watchGuest,
  watchGuests,
  type Guest,
  type GuestAttendanceResult,
  type GuestInput,
} from './guest-attendance';
import {
  cancelEvent,
  createEvent,
  deleteCancelledEvent,
  updateEvent,
  watchEvent,
  watchEventsBetween,
  watchEventsFrom,
  type CreateEventResult,
  type EventActionResult,
  type EventInput,
  type GuildEvent,
} from './events';

/** Eventos da guilda (calendário e administração). */
@Injectable({ providedIn: 'root' })
export class EventsService {
  private readonly firestore = inject(FirestoreClient);
  private readonly session = inject(SessionService);

  watchFrom(
    from: Date,
    next: (events: GuildEvent[]) => void,
    error: (e: unknown) => void,
  ): () => void {
    return this.whenReady((db) => watchEventsFrom(db, from, next, error), error);
  }

  watchBetween(
    from: Date,
    to: Date,
    next: (events: GuildEvent[]) => void,
    error: (e: unknown) => void,
  ): () => void {
    return this.whenReady((db) => watchEventsBetween(db, from, to, next, error), error);
  }

  watchOne(
    id: string,
    next: (event: GuildEvent | null) => void,
    error: (e: unknown) => void,
  ): () => void {
    return this.whenReady((db) => watchEvent(db, id, next, error), error);
  }

  async create(input: EventInput): Promise<CreateEventResult> {
    return createEvent(await this.firestore.get(), this.uid(), input);
  }

  async update(id: string, input: EventInput): Promise<EventActionResult> {
    return updateEvent(await this.firestore.get(), this.uid(), id, input);
  }

  async cancel(id: string): Promise<EventActionResult> {
    return cancelEvent(await this.firestore.get(), this.uid(), id);
  }

  /** Exclui um evento cancelado, com a lista de confirmados. */
  async deleteCancelled(id: string): Promise<EventActionResult> {
    return deleteCancelledEvent(await this.firestore.get(), id);
  }

  /** Presença da pessoa autenticada no evento. */
  watchMyAttendance(
    eventId: string,
    next: (attendance: MyAttendance | null) => void,
    error: (e: unknown) => void,
  ): () => void {
    const uid = this.uid();
    return this.whenReady((db) => watchMyAttendance(db, eventId, uid, next, error), error);
  }

  async confirmAttendance(eventId: string): Promise<AttendanceResult> {
    return confirmAttendance(await this.firestore.get(), eventId, this.uid());
  }

  async cancelAttendance(eventId: string): Promise<AttendanceResult> {
    return cancelAttendance(await this.firestore.get(), eventId, this.uid());
  }

  /** Confirmados do evento (somente administradores). */
  watchAttendees(
    eventId: string,
    next: (attendees: Attendee[]) => void,
    error: (e: unknown) => void,
  ): () => void {
    return this.whenReady((db) => watchAttendees(db, eventId, next, error), error);
  }

  /** Administrador cancela a presença de um confirmado. */
  async removeAttendee(eventId: string, uid: string): Promise<AttendanceResult> {
    return cancelAttendance(await this.firestore.get(), eventId, uid);
  }

  /** Visitante (sem conta de membro) confirma presença com o personagem informado. */
  async confirmGuest(eventId: string, input: GuestInput): Promise<GuestAttendanceResult> {
    return confirmGuestAttendance(await this.firestore.get(), eventId, input);
  }

  /** Acompanha uma presença de visitante pelo ID; `null` quando não existe mais. */
  watchGuest(
    eventId: string,
    guestId: string,
    next: (guest: Guest | null) => void,
    error: (e: unknown) => void,
  ): () => void {
    return this.whenReady((db) => watchGuest(db, eventId, guestId, next, error), error);
  }

  /** Visitantes confirmados (somente administradores). */
  watchGuests(
    eventId: string,
    next: (guests: Guest[]) => void,
    error: (e: unknown) => void,
  ): () => void {
    return this.whenReady((db) => watchGuests(db, eventId, next, error), error);
  }

  /** Administrador cancela a presença de um visitante. */
  async removeGuest(eventId: string, guestId: string): Promise<GuestAttendanceResult> {
    return removeGuestAttendance(await this.firestore.get(), eventId, guestId);
  }

  /** Inicia o listener quando o Firestore (carregado sob demanda) estiver pronto. */
  private whenReady(start: (db: Firestore) => () => void, error: (e: unknown) => void) {
    let stop: (() => void) | null = null;
    let stopped = false;
    void this.firestore.get().then((db) => {
      if (!stopped) stop = start(db);
    }, error);
    return () => {
      stopped = true;
      stop?.();
    };
  }

  private uid(): string {
    return this.session.user()?.uid ?? '';
  }
}
