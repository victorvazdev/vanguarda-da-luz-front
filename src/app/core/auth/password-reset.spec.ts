import { FirebaseError } from 'firebase/app';
import { resetErrorFrom } from './password-reset';

describe('resetErrorFrom', () => {
  it.each(['auth/expired-action-code', 'auth/invalid-action-code', 'auth/user-disabled'])(
    '%s → link inválido',
    (code) => {
      expect(resetErrorFrom(new FirebaseError(code, 'x'))).toBe('invalid-link');
    },
  );

  it.each([
    ['auth/weak-password', 'weak-password'],
    ['auth/too-many-requests', 'too-many-requests'],
    ['auth/network-request-failed', 'network'],
    ['auth/outro', 'unknown'],
  ])('%s → %s', (code, expected) => {
    expect(resetErrorFrom(new FirebaseError(code, 'x'))).toBe(expected);
  });
});
