import type { AppEnvironment } from './environment.model';

/**
 * Produção (projeto `vanguarda-da-luz`). `apiKey` e `appId` vêm da configuração do
 * app web (Console > Configurações do projeto > Seus apps) e precisam ser
 * preenchidos antes do primeiro deploy.
 */
export const environment: AppEnvironment = {
  production: true,
  useEmulators: false,
  firebase: {
    projectId: 'vanguarda-da-luz',
    apiKey: 'AIzaSyCa02nLIKpT-xY1uv2rUG8G9Nhh-l0inbg',
    authDomain: 'vanguarda-da-luz.firebaseapp.com',
    appId: '1:346692288233:web:d0edfc60fe0b6e70deba78',
  },
};
