import type { AppEnvironment } from './environment.model';

/** Desenvolvimento: conecta aos emuladores do Firebase (projeto demo, sem nuvem). */
export const environment: AppEnvironment = {
  production: false,
  useEmulators: true,
  firebase: {
    projectId: 'demo-vanguarda-da-luz',
    apiKey: 'demo-api-key',
    authDomain: 'demo-vanguarda-da-luz.firebaseapp.com',
    appId: 'demo-app-id',
  },
  emulators: {
    host: '127.0.0.1',
    authPort: 9099,
    firestorePort: 8080,
  },
};
