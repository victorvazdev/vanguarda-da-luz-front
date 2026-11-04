// Recuperação de senha sem dependência do Angular, testada contra os emuladores
// (tests/integration/password-reset.spec.ts).
//
// O Firebase Auth gera o link (válido por 1 hora e de uso único) e envia o e-mail.
// O link aponta para /redefinir-senha (URL de ação personalizada no Console), onde
// a nova senha segue as mesmas regras do cadastro.
import { FirebaseError } from 'firebase/app';
import {
  confirmPasswordReset,
  sendPasswordResetEmail,
  verifyPasswordResetCode,
  type Auth,
} from 'firebase/auth';

export type ResetError =
  'invalid-link' | 'weak-password' | 'too-many-requests' | 'network' | 'unknown';

export type Result<T = object> = ({ ok: true } & T) | { ok: false; error: ResetError };

function codeOf(error: unknown): string {
  return error instanceof FirebaseError ? error.code : '';
}

export function resetErrorFrom(error: unknown): ResetError {
  switch (codeOf(error)) {
    case 'auth/expired-action-code':
    case 'auth/invalid-action-code':
    case 'auth/user-disabled':
    case 'auth/user-not-found':
    case 'auth/argument-error':
      return 'invalid-link';
    case 'auth/weak-password':
      return 'weak-password';
    case 'auth/too-many-requests':
      return 'too-many-requests';
    case 'auth/network-request-failed':
      return 'network';
    default:
      return 'unknown';
  }
}

/** Erros que revelariam se o e-mail existe; tratados como sucesso. */
const SILENT_REQUEST_ERRORS = ['auth/user-not-found', 'auth/invalid-email', 'auth/missing-email'];

/** Solicita o link. A resposta é a mesma para e-mails cadastrados e não cadastrados. */
export async function requestPasswordReset(auth: Auth, email: string): Promise<Result> {
  try {
    await sendPasswordResetEmail(auth, email.trim());
  } catch (error) {
    if (!SILENT_REQUEST_ERRORS.includes(codeOf(error))) {
      return { ok: false, error: resetErrorFrom(error) };
    }
  }
  return { ok: true };
}

/** Confere se o código do link ainda vale; devolve o e-mail da conta. */
export async function checkResetCode(
  auth: Auth,
  code: string | null | undefined,
): Promise<Result<{ email: string }>> {
  if (!code) return { ok: false, error: 'invalid-link' };
  try {
    return { ok: true, email: await verifyPasswordResetCode(auth, code) };
  } catch (error) {
    return { ok: false, error: resetErrorFrom(error) };
  }
}

/** Grava a nova senha e consome o código (uso único). */
export async function resetPassword(
  auth: Auth,
  code: string,
  newPassword: string,
): Promise<Result> {
  try {
    await confirmPasswordReset(auth, code, newPassword);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: resetErrorFrom(error) };
  }
}
