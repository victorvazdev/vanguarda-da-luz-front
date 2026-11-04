import {
  Injectable,
  InjectionToken,
  inject,
  makeEnvironmentProviders,
  type EnvironmentProviders,
} from '@angular/core';
import { initializeApp, type FirebaseApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, type Auth } from 'firebase/auth';
import type { Firestore } from 'firebase/firestore';
import { environment } from '../../../environments/environment';

export const FIREBASE_APP = new InjectionToken<FirebaseApp>('FIREBASE_APP');
export const FIREBASE_AUTH = new InjectionToken<Auth>('FIREBASE_AUTH');

const emulators = environment.useEmulators ? environment.emulators : undefined;

/**
 * Entrega o Firestore sob demanda. O SDK do Firestore só é baixado quando algo
 * precisa dele (usuário logado ou tela com dados), mantendo leve o carregamento
 * das páginas públicas.
 */
@Injectable({ providedIn: 'root' })
export class FirestoreClient {
  private readonly app = inject(FIREBASE_APP);
  private instance?: Promise<Firestore>;

  get(): Promise<Firestore> {
    this.instance ??= import('firebase/firestore').then(
      ({ getFirestore, connectFirestoreEmulator }) => {
        const db = getFirestore(this.app);
        if (emulators) connectFirestoreEmulator(db, emulators.host, emulators.firestorePort);
        return db;
      },
    );
    return this.instance;
  }
}

/** Inicializa o Firebase e, em desenvolvimento, conecta o Auth ao emulador. */
export function provideFirebase(): EnvironmentProviders {
  return makeEnvironmentProviders([
    { provide: FIREBASE_APP, useFactory: () => initializeApp(environment.firebase) },
    {
      provide: FIREBASE_AUTH,
      useFactory: () => {
        const auth = getAuth(inject(FIREBASE_APP));
        auth.languageCode = 'pt-BR';
        if (emulators) {
          connectAuthEmulator(auth, `http://${emulators.host}:${emulators.authPort}`, {
            disableWarnings: true,
          });
        }
        return auth;
      },
    },
  ]);
}
