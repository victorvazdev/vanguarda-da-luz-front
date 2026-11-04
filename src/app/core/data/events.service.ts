import { Injectable, inject } from '@angular/core';
import { SessionService } from '../auth/session.service';
import { FirestoreClient } from '../firebase/firebase.providers';
import {
  cancelEvent,
  createEvent,
  updateEvent,
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
    let stop: (() => void) | null = null;
    let stopped = false;
    void this.firestore.get().then((db) => {
      if (!stopped) stop = watchEventsFrom(db, from, next, error);
    }, error);
    return () => {
      stopped = true;
      stop?.();
    };
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

  private uid(): string {
    return this.session.user()?.uid ?? '';
  }
}
