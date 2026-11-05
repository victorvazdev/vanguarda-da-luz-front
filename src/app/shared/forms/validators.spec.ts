import { FormControl, FormGroup } from '@angular/forms';
import { passwordsMatch, usernameFormat } from './validators';

describe('usernameFormat', () => {
  it('ignora vazio (fica com required)', () => {
    expect(usernameFormat(new FormControl(''))).toBeNull();
  });

  it('aponta formato inválido', () => {
    expect(usernameFormat(new FormControl('a b'))).toEqual({ usernameFormat: true });
    expect(usernameFormat(new FormControl('Elaris'))).toBeNull();
  });
});

describe('passwordsMatch', () => {
  const group = (password: string, confirm: string) =>
    new FormGroup(
      { password: new FormControl(password), confirm: new FormControl(confirm) },
      { validators: passwordsMatch('password', 'confirm') },
    );

  it('é válido quando coincidem', () => {
    expect(group('segredo123', 'segredo123').errors).toBeNull();
  });

  it('acusa diferença', () => {
    expect(group('segredo123', 'segredo124').errors).toEqual({ passwordMismatch: true });
  });

  it('não acusa enquanto a confirmação está vazia', () => {
    expect(group('segredo123', '').errors).toBeNull();
  });
});
