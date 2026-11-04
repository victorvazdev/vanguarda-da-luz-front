/** De 3 a 20 caracteres: letras sem acento, números, `_` ou `-`. Igual à regra do Firestore. */
export const USERNAME_PATTERN = /^[A-Za-z0-9_-]{3,20}$/;

/** Chave de unicidade: sem espaços nas pontas e em minúsculas. */
export function usernameKey(username: string): string {
  return username.trim().toLowerCase();
}

export function isValidUsername(username: string): boolean {
  return USERNAME_PATTERN.test(username.trim());
}
