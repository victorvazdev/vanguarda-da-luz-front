import { Injectable, inject } from '@angular/core';
import { FIREBASE_AUTH, FirestoreClient } from '../firebase/firebase.providers';
import {
  approveApplication,
  rejectApplication,
  watchQueue,
  type DecisionResult,
  type PendingAccount,
} from './review';

/** Fila de aprovação para a área administrativa. */
@Injectable({ providedIn: 'root' })
export class ReviewService {
  private readonly auth = inject(FIREBASE_AUTH);
  private readonly firestore = inject(FirestoreClient);

  watchQueue(next: (q: PendingAccount[]) => void, error: (e: unknown) => void): () => void {
    let stop: (() => void) | null = null;
    let stopped = false;
    void this.firestore.get().then((db) => {
      if (!stopped) stop = watchQueue(db, next, error);
    }, error);
    return () => {
      stopped = true;
      stop?.();
    };
  }

  async approve(uid: string): Promise<DecisionResult> {
    return approveApplication(await this.firestore.get(), this.adminUid(), uid);
  }

  async reject(uid: string): Promise<DecisionResult> {
    return rejectApplication(await this.firestore.get(), this.adminUid(), uid);
  }

  private adminUid(): string {
    const uid = this.auth.currentUser?.uid;
    if (!uid) throw new Error('Usuário não autenticado');
    return uid;
  }
}
