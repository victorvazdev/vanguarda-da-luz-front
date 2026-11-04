import { PATHS } from './paths';

const ACCOUNT_SCREENS: readonly string[] = [
  PATHS.signIn,
  PATHS.signUp,
  PATHS.forgotPassword,
  PATHS.resetPassword,
];

/**
 * Aceita somente caminhos internos do próprio site (evita redirecionamento aberto)
 * e ignora as próprias telas de conta.
 */
export function safeReturnUrl(url: string | null | undefined): string | null {
  if (!url || !url.startsWith('/') || url.startsWith('//') || url.startsWith('/\\')) return null;
  const path = url.split(/[?#]/)[0];
  return ACCOUNT_SCREENS.includes(path) ? null : url;
}
