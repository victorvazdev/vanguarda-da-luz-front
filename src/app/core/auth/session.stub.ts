import { computed, signal } from '@angular/core';
import type { AccessLevel, ResolvedAccess, UserAccount } from './access';
import { SessionService } from './session.service';

/** Substituto do SessionService para testes, sem Firebase. */
export function createSessionStub(initial: AccessLevel = 'visitor') {
  const access = signal<AccessLevel>(initial);
  const notice = signal<string | null>(null);
  const user = signal<{ uid: string } | null>(initial === 'visitor' ? null : { uid: 'me' });
  const account = signal<UserAccount | null | undefined>(
    initial === 'visitor'
      ? null
      : { username: 'Elaris', email: 'elaris@example.com', status: 'ativo', role: 'membro' },
  );
  let signOutCalls = 0;
  const stub = {
    access,
    user,
    account,
    notice,
    clearNotice: () => notice.set(null),
    isAuthenticated: computed(() => !['visitor', 'loading'].includes(access())),
    resolvedAccess: () => Promise.resolve(access() as ResolvedAccess),
    signOut: () => {
      signOutCalls++;
      access.set('visitor');
      return Promise.resolve();
    },
    get signOutCalls() {
      return signOutCalls;
    },
  };
  return stub;
}

export function provideSessionStub(initial: AccessLevel = 'visitor') {
  const stub = createSessionStub(initial);
  return { stub, provider: { provide: SessionService, useValue: stub } };
}
