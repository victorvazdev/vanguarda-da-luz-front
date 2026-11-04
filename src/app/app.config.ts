import { registerLocaleData } from '@angular/common';
import localePt from '@angular/common/locales/pt';
import {
  LOCALE_ID,
  provideBrowserGlobalErrorListeners,
  type ApplicationConfig,
} from '@angular/core';
import {
  TitleStrategy,
  provideRouter,
  withComponentInputBinding,
  withInMemoryScrolling,
} from '@angular/router';
import { routes } from './app.routes';
import { provideFirebase } from './core/firebase/firebase.providers';
import { GuildTitleStrategy } from './core/routing/title.strategy';

registerLocaleData(localePt, 'pt-BR');

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(
      routes,
      withComponentInputBinding(),
      withInMemoryScrolling({ scrollPositionRestoration: 'top', anchorScrolling: 'enabled' }),
    ),
    { provide: TitleStrategy, useClass: GuildTitleStrategy },
    { provide: LOCALE_ID, useValue: 'pt-BR' },
    provideFirebase(),
  ],
};
