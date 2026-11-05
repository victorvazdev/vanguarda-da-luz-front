import { FirebaseError } from 'firebase/app';
import { signInErrorFrom } from './sign-in';

describe('signInErrorFrom', () => {
  it.each([
    'auth/invalid-credential',
    'auth/invalid-login-credentials',
    'auth/user-not-found',
    'auth/wrong-password',
    'auth/invalid-email',
  ])('%s vira o mesmo erro genérico (não revela qual dado está errado)', (code) => {
    expect(signInErrorFrom(new FirebaseError(code, 'x'))).toBe('invalid-credentials');
  });

  it.each([
    ['auth/user-disabled', 'disabled'],
    ['auth/too-many-requests', 'too-many-requests'],
    ['auth/network-request-failed', 'network'],
    ['auth/outro', 'unknown'],
  ])('%s → %s', (code, expected) => {
    expect(signInErrorFrom(new FirebaseError(code, 'x'))).toBe(expected);
  });
});
