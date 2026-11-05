/**
 * Limite de tentativas no navegador, complementar ao limite do próprio Firebase Auth
 * (que responde `auth/too-many-requests`). A partir da 5ª falha seguida, bloqueia
 * por 30 s, dobrando a cada nova falha, até 5 min. Um login bem-sucedido zera a contagem.
 */
export const THROTTLE_FREE_ATTEMPTS = 5;
export const THROTTLE_BASE_MS = 30_000;
export const THROTTLE_MAX_MS = 5 * 60_000;

export class LoginThrottle {
  private failures = 0;
  private lockedUntil = 0;

  /** Milissegundos restantes de bloqueio (0 = liberado). */
  remainingMs(now: number): number {
    return Math.max(0, this.lockedUntil - now);
  }

  registerFailure(now: number): void {
    this.failures++;
    if (this.failures >= THROTTLE_FREE_ATTEMPTS) {
      const exponent = this.failures - THROTTLE_FREE_ATTEMPTS;
      const lock = Math.min(THROTTLE_BASE_MS * 2 ** exponent, THROTTLE_MAX_MS);
      this.lockedUntil = now + lock;
    }
  }

  registerSuccess(): void {
    this.failures = 0;
    this.lockedUntil = 0;
  }
}
