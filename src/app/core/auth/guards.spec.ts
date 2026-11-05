import { TestBed } from '@angular/core/testing';
import {
  Router,
  provideRouter,
  type ActivatedRouteSnapshot,
  type CanActivateFn,
  type RouterStateSnapshot,
  type UrlTree,
} from '@angular/router';
import type { ResolvedAccess } from './access';
import { adminGuard, authGuard, guestGuard, memberGuard, pendingGuard } from './guards';
import { provideSessionStub } from './session.stub';

async function run(guard: CanActivateFn, access: ResolvedAccess, url = '/destino') {
  const { provider } = provideSessionStub(access);
  TestBed.configureTestingModule({ providers: [provideRouter([]), provider] });
  const result = await TestBed.runInInjectionContext(() =>
    guard({} as ActivatedRouteSnapshot, { url } as RouterStateSnapshot),
  );
  if (result === true) return true;
  return TestBed.inject(Router).serializeUrl(result as UrlTree);
}

const signIn = '/entrar?returnUrl=%2Fdestino';

describe('guards', () => {
  describe('guestGuard', () => {
    it.each<[ResolvedAccess, true | string]>([
      ['visitor', true],
      ['blocked', true],
      ['pending', '/minha-conta'],
      ['member', '/calendario'],
      ['admin', '/calendario'],
      ['deleting', '/minha-conta'],
    ])('%s → %s', async (access, expected) => {
      expect(await run(guestGuard, access)).toBe(expected);
    });
  });

  describe('authGuard', () => {
    it.each<[ResolvedAccess, true | string]>([
      ['visitor', signIn],
      ['blocked', signIn],
      ['pending', true],
      ['member', true],
      ['admin', true],
      ['deleting', true],
    ])('%s → %s', async (access, expected) => {
      expect(await run(authGuard, access)).toBe(expected);
    });
  });

  describe('pendingGuard', () => {
    it.each<[ResolvedAccess, true | string]>([
      ['visitor', signIn],
      ['blocked', signIn],
      ['pending', true],
      ['member', '/calendario'],
      ['admin', '/calendario'],
      ['deleting', '/minha-conta'],
    ])('%s → %s', async (access, expected) => {
      expect(await run(pendingGuard, access)).toBe(expected);
    });
  });

  describe('memberGuard', () => {
    it.each<[ResolvedAccess, true | string]>([
      ['visitor', signIn],
      ['blocked', signIn],
      ['pending', '/acesso-negado'],
      ['member', true],
      ['admin', true],
      ['deleting', '/minha-conta'],
    ])('%s → %s', async (access, expected) => {
      expect(await run(memberGuard, access)).toBe(expected);
    });
  });

  describe('adminGuard', () => {
    it.each<[ResolvedAccess, true | string]>([
      ['visitor', signIn],
      ['blocked', signIn],
      ['pending', '/acesso-negado'],
      ['member', '/acesso-negado'],
      ['admin', true],
      ['deleting', '/minha-conta'],
    ])('%s → %s', async (access, expected) => {
      expect(await run(adminGuard, access)).toBe(expected);
    });
  });
});
