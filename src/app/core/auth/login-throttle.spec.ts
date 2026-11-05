import { LoginThrottle, THROTTLE_BASE_MS, THROTTLE_MAX_MS } from './login-throttle';

describe('LoginThrottle', () => {
  const failTimes = (t: LoginThrottle, n: number, now = 0) => {
    for (let i = 0; i < n; i++) t.registerFailure(now);
  };

  it('libera as 4 primeiras falhas', () => {
    const t = new LoginThrottle();
    failTimes(t, 4);
    expect(t.remainingMs(0)).toBe(0);
  });

  it('bloqueia por 30 s na 5ª falha seguida', () => {
    const t = new LoginThrottle();
    failTimes(t, 5, 1000);
    expect(t.remainingMs(1000)).toBe(THROTTLE_BASE_MS);
    expect(t.remainingMs(1000 + THROTTLE_BASE_MS)).toBe(0);
  });

  it('dobra o bloqueio a cada nova falha, até 5 min', () => {
    const t = new LoginThrottle();
    failTimes(t, 6);
    expect(t.remainingMs(0)).toBe(THROTTLE_BASE_MS * 2);
    failTimes(t, 10);
    expect(t.remainingMs(0)).toBe(THROTTLE_MAX_MS);
  });

  it('um login bem-sucedido zera a contagem', () => {
    const t = new LoginThrottle();
    failTimes(t, 5);
    t.registerSuccess();
    expect(t.remainingMs(0)).toBe(0);
    failTimes(t, 4);
    expect(t.remainingMs(0)).toBe(0);
  });
});
