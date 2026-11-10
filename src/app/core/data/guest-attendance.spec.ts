import {
  GUEST_NAME_PATTERN,
  guestData,
  guestDisplayName,
  guestKey,
  type GuestInput,
} from './guest-attendance';

/** Reino padronizado. */
function realm(value: string): string {
  const g = guestData({ game: 'retail', characterName: 'Thalor', realm: value });
  return g.game === 'retail' ? g.realm : '';
}

describe('presença de visitantes', () => {
  it('padroniza os nomes como no jogo: só a primeira letra maiúscula', () => {
    expect(
      guestData({ game: 'forever', characterName: ' lUNARA ', characterSurname: 'ÉLUNE' }),
    ).toEqual({ game: 'forever', characterName: 'Lunara', characterSurname: 'Élune' });
  });

  it('padroniza o reino: espaços simples e maiúscula no início de cada palavra', () => {
    expect(guestData({ game: 'retail', characterName: 'thalor', realm: '  tol   barad ' })).toEqual(
      { game: 'retail', characterName: 'Thalor', realm: 'Tol Barad' },
    );
    expect(realm("QUEL'THALAS")).toBe("Quel'Thalas");
    expect(realm('água')).toBe('Água');
  });

  it('o mesmo personagem gera sempre o mesmo ID, qualquer que seja a digitação', () => {
    const a: GuestInput = { game: 'forever', characterName: 'lunara', characterSurname: 'sombra' };
    const b: GuestInput = { game: 'forever', characterName: 'LUNARA', characterSurname: ' Sombra' };
    expect(guestKey(a)).toBe('forever:Lunara:Sombra');
    expect(guestKey(b)).toBe(guestKey(a));
    expect(guestKey({ game: 'retail', characterName: 'Lunara', realm: 'sombra' })).toBe(
      'retail:Lunara:Sombra',
    );
  });

  it('nomes padronizados seguem o formato aceito pelas Security Rules', () => {
    for (const name of ['lunara', 'ÉLUNE', 'ñandu', 'ab']) {
      const { characterName } = guestData({ game: 'retail', characterName: name, realm: 'x' });
      expect(GUEST_NAME_PATTERN.test(characterName)).toBe(true);
    }
  });

  it('exibe "Nome Sobrenome" no Forever e "Nome-Reino" no Retail', () => {
    expect(
      guestDisplayName({ game: 'forever', characterName: 'Lunara', characterSurname: 'Sombra' }),
    ).toBe('Lunara Sombra');
    expect(guestDisplayName({ game: 'retail', characterName: 'Thalor', realm: 'Azralon' })).toBe(
      'Thalor-Azralon',
    );
  });
});
