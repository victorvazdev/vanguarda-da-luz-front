import type { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';
import { isValidUsername } from '../../core/auth/username';

export const PASSWORD_MIN_LENGTH = 8;

/** Formato do nome de usuário. Vazio fica a cargo de `Validators.required`. */
export const usernameFormat: ValidatorFn = (control) => {
  const value = String(control.value ?? '');
  return !value.trim() || isValidUsername(value) ? null : { usernameFormat: true };
};

/** Erro `passwordMismatch` no grupo quando a confirmação difere da senha. */
export function passwordsMatch(passwordKey: string, confirmKey: string): ValidatorFn {
  return (group: AbstractControl): ValidationErrors | null => {
    const password = group.get(passwordKey)?.value;
    const confirm = group.get(confirmKey)?.value;
    return confirm && password !== confirm ? { passwordMismatch: true } : null;
  };
}

/** Mensagens de senha compartilhadas entre cadastro e redefinição (mesmas regras). */
export const PASSWORD_MESSAGES = {
  required: 'Informe a senha.',
  minlength: `A senha deve ter no mínimo ${PASSWORD_MIN_LENGTH} caracteres.`,
} as const;

export const CONFIRM_PASSWORD_MESSAGES = {
  required: 'Confirme a senha.',
  passwordMismatch: 'As senhas não coincidem.',
} as const;

/** Nome de personagem do WoW: de 2 a 12 letras (acentos permitidos), sem espaços ou números. */
export const CHARACTER_NAME_PATTERN = /^\p{L}{2,12}$/u;

export const characterNameFormat: ValidatorFn = (control) => {
  const value = String(control.value ?? '').trim();
  return !value || CHARACTER_NAME_PATTERN.test(value) ? null : { characterName: true };
};

/**
 * BattleTag da Blizzard: 3 a 12 letras ou números, começando por letra (acentos permitidos),
 * seguidos de `#` e do número (4 a 6 dígitos). Igual às Security Rules.
 */
export const BATTLETAG_PATTERN = /^\p{L}[\p{L}\p{N}]{2,11}#[0-9]{4,6}$/u;

export function isValidBattleTag(value: string): boolean {
  return BATTLETAG_PATTERN.test(value);
}

export const battleTagFormat: ValidatorFn = (control) => {
  const value = String(control.value ?? '').trim();
  return !value || isValidBattleTag(value) ? null : { battleTag: true };
};

/** Texto obrigatório que não aceita só espaços (erro `required`). */
export const requiredText: ValidatorFn = (control) =>
  String(control.value ?? '').trim() ? null : { required: true };
