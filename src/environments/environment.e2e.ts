import type { AppEnvironment } from './environment.model';

/**
 * Testes no navegador: usa os emuladores isolados de firebase.test.json,
 * sem tocar nos dados do emulador de desenvolvimento.
 */
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
    authPort: 9199,
    firestorePort: 8180,
  },
};
