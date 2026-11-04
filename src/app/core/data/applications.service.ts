import { Injectable, inject } from '@angular/core';
import { FIREBASE_AUTH, FirestoreClient } from '../firebase/firebase.providers';
import {
  getApplication,
  submitApplication,
  watchApplication,
  type Application,
  type ApplicationInput,
  type SubmitResult,
} from './applications';

/** Candidatura do usuário logado. */
@Injectable({ providedIn: 'root' })
export class ApplicationsService {
  private readonly auth = inject(FIREBASE_AUTH);
  private readonly firestore = inject(FirestoreClient);

  private uid(): string {
    const uid = this.auth.currentUser?.uid;
    if (!uid) throw new Error('Usuário não autenticado');
    return uid;
  }

  async mine(): Promise<Application | null> {
    return getApplication(await this.firestore.get(), this.uid());
  }

  /** Devolve a função para parar de acompanhar. */
  watchMine(next: (a: Application | null) => void, error: (e: unknown) => void): () => void {
    let stop: (() => void) | null = null;
    let stopped = false;
    const uid = this.uid();
    void this.firestore.get().then((db) => {
      if (!stopped) stop = watchApplication(db, uid, next, error);
    }, error);
    return () => {
      stopped = true;
      stop?.();
    };
  }

  async submit(input: ApplicationInput): Promise<SubmitResult> {
    return submitApplication(await this.firestore.get(), this.uid(), input);
  }
}
