import type { AbstractControl } from '@angular/forms';

/** Mensagens por código de erro de validação, na ordem de prioridade. */
export type ErrorMessages = Readonly<Record<string, string>>;

/** Primeira mensagem aplicável ao controle, ou `null` se válido. */
export function firstError(
  control: AbstractControl | null,
  messages: ErrorMessages,
  extraErrors: Readonly<Record<string, unknown>> | null = null,
): string | null {
  const errors = { ...(control?.errors ?? {}), ...(extraErrors ?? {}) };
  for (const [code, message] of Object.entries(messages)) {
    if (errors[code]) return message;
  }
  return null;
}
