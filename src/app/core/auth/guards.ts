import { inject } from '@angular/core';
import { Router, type CanActivateFn, type UrlTree } from '@angular/router';
import { PATHS, landingPathFor } from '../routing/paths';
import type { ResolvedAccess } from './access';
import { SessionService } from './session.service';

type Decision = (access: ResolvedAccess, url: string, router: Router) => true | UrlTree;

function guardFrom(decide: Decision): CanActivateFn {
  return async (_route, state) => {
    const router = inject(Router);
    const access = await inject(SessionService).resolvedAccess();
    return decide(access, state.url, router);
  };
}

const toSignIn = (router: Router, url: string) =>
  router.createUrlTree([PATHS.signIn], { queryParams: { returnUrl: url } });

/** Telas de conta (cadastro, login, recuperação): somente quem não está logado. */
export const guestGuard = guardFrom((access, _url, router) =>
  access === 'visitor' || access === 'blocked' ? true : router.parseUrl(landingPathFor(access)),
);

/** Qualquer conta ativa ou pendente. */
export const authGuard = guardFrom((access, url, router) =>
  access === 'pending' || access === 'member' || access === 'admin' ? true : toSignIn(router, url),
);

/** Somente conta pendente (ex.: candidatura). */
export const pendingGuard = guardFrom((access, url, router) => {
  if (access === 'pending') return true;
  if (access === 'member' || access === 'admin') return router.parseUrl(landingPathFor(access));
  return toSignIn(router, url);
});

/** Funcionalidades de membros: membros e administradores. */
export const memberGuard = guardFrom((access, url, router) => {
  if (access === 'member' || access === 'admin') return true;
  if (access === 'pending') return router.parseUrl(PATHS.accessDenied);
  return toSignIn(router, url);
});

/** Área administrativa. */
export const adminGuard = guardFrom((access, url, router) => {
  if (access === 'admin') return true;
  if (access === 'member' || access === 'pending') return router.parseUrl(PATHS.accessDenied);
  return toSignIn(router, url);
});
