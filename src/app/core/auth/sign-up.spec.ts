import { FirebaseError } from 'firebase/app';
import { signUpErrorFrom } from './sign-up';

describe('signUpErrorFrom', () => {
  it.each([
    ['auth/email-already-in-use', 'email-in-use'],
    ['auth/invalid-email', 'invalid-email'],
    ['auth/weak-password', 'weak-password'],
    ['auth/too-many-requests', 'too-many-requests'],
    ['auth/network-request-failed', 'network'],
    ['auth/qualquer-outro', 'unknown'],
  ])('%s → %s', (code, expected) => {
    expect(signUpErrorFrom(new FirebaseError(code, 'x'))).toBe(expected);
  });

  it('erros desconhecidos viram "unknown"', () => {
    expect(signUpErrorFrom(new Error('boom'))).toBe('unknown');
  });
});
