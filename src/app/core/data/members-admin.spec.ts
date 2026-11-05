import { activeAdminCount, matchesSearch, sortMembers, type MemberRow } from './members-admin';

const row = (over: Partial<MemberRow>): MemberRow => ({
  uid: 'u',
  username: 'user',
  email: 'u@x.com',
  battleTag: null,
  status: 'ativo',
  role: 'membro',
  mainCharacter: {
    game: 'retail',
    characterName: 'Dorvan',
    server: 'Azralon',
    characterClass: 'sacerdote',
    characterRole: 'cura',
  },
  ...over,
});

describe('gestão de membros', () => {
  it('busca por nome do personagem, sobrenome ou usuário, ignorando acentos e maiúsculas', () => {
    const forever = row({
      username: 'brenninha',
      mainCharacter: {
        game: 'forever',
        characterName: 'Brenna',
        characterSurname: 'Forjaférro',
        ruleset: 'jxj',
        characterClass: 'guerreiro',
        characterRole: 'tanque',
      },
    });
    expect(matchesSearch(forever, 'bren')).toBe(true);
    expect(matchesSearch(forever, 'FORJAFERRO')).toBe(true);
    expect(matchesSearch(forever, 'brenninha')).toBe(true);
    expect(matchesSearch(forever, 'maren')).toBe(false);
    expect(matchesSearch(forever, '  ')).toBe(true);
  });

  it('conta administradores ativos', () => {
    expect(
      activeAdminCount([
        row({ role: 'admin' }),
        row({ role: 'admin', status: 'desativado' }),
        row({}),
      ]),
    ).toBe(1);
  });

  it('ordena ativos primeiro e depois por nome', () => {
    const named = (uid: string, name: string, status: MemberRow['status'] = 'ativo') =>
      row({ uid, status, mainCharacter: { ...row({}).mainCharacter!, characterName: name } });
    expect(
      sortMembers([named('a', 'Tavia'), named('b', 'Ana', 'desativado'), named('c', 'Dorvan')]).map(
        (r) => r.uid,
      ),
    ).toEqual(['c', 'a', 'b']);
  });
});
