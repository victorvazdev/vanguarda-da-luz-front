import { FormControl, FormGroup } from '@angular/forms';
import { battleTagFormat, isValidBattleTag, passwordsMatch, usernameFormat } from './validators';

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

describe('BattleTag', () => {
  it.each(['Elaris#1234', 'Élaris#12345', 'Abc#123456', 'Tavia2026#9876', 'Ação#1234'])(
    'aceita %s',
    (value) => {
      expect(isValidBattleTag(value)).toBe(true);
    },
  );

  it.each([
    '',
    'Elaris',
    'Elaris#',
    'Elaris#123',
    'Elaris#1234567',
    'El#1234',
    'Elarisaurora1#1234',
    '1Elaris#1234',
    'Ela ris#1234',
    'Ela_ris#1234',
    'Elaris#12a4',
    'Elaris##1234',
  ])('recusa %s', (value) => {
    expect(isValidBattleTag(value)).toBe(false);
  });

  it('o validador ignora vazio (fica com required) e espaços nas pontas', () => {
    expect(battleTagFormat(new FormControl(''))).toBeNull();
    expect(battleTagFormat(new FormControl(' Elaris#1234 '))).toBeNull();
    expect(battleTagFormat(new FormControl('Elaris'))).toEqual({ battleTag: true });
  });
});
