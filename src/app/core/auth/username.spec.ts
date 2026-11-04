import { isValidUsername, usernameKey } from './username';

describe('nome de usuário', () => {
  it('a chave de unicidade ignora maiúsculas e espaços nas pontas', () => {
    expect(usernameKey('  Elaris ')).toBe('elaris');
    expect(usernameKey('ELARIS')).toBe(usernameKey('elaris'));
  });

  it.each(['abc', 'Elaris_01', 'a-b-c', 'x'.repeat(20)])('aceita "%s"', (name) => {
    expect(isValidUsername(name)).toBe(true);
  });

  it.each(['ab', 'x'.repeat(21), 'com espaço', 'acentuação', 'e@mail', ''])(
    'recusa "%s"',
    (name) => {
      expect(isValidUsername(name)).toBe(false);
    },
  );
});
