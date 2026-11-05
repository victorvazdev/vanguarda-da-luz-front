import {
  MAX_PROFESSIONS,
  characterDisplayName,
  isValidProfessions,
  professionsFor,
  professionsText,
  classLabel,
  classesFor,
  gameLabel,
  isClassInGame,
  isValidCombination,
  roleLabel,
  rolesFor,
  rulesetLabel,
} from './wow';

const ids = (list: readonly { id: string }[]) => list.map((x) => x.id);

describe('dados de WoW', () => {
  it('Retail tem 13 classes e Forever as 9 do Classic, em ordem alfabética', () => {
    expect(classesFor('retail')).toHaveLength(13);
    expect(ids(classesFor('forever'))).toEqual([
      'bruxo',
      'cacador',
      'druida',
      'guerreiro',
      'ladino',
      'mago',
      'paladino',
      'sacerdote',
      'xama',
    ]);
    for (const game of ['retail', 'forever'] as const) {
      const labels = classesFor(game).map((c) => c.label);
      expect(labels).toEqual([...labels].sort((a, b) => a.localeCompare(b, 'pt-BR')));
    }
  });

  it('sem jogo escolhido não há classes', () => {
    expect(classesFor(null)).toEqual([]);
  });

  it('classes exclusivas do Retail não existem no Forever', () => {
    for (const id of ['monge', 'cacador-de-demonios', 'cavaleiro-da-morte', 'conjurante']) {
      expect(isClassInGame('retail', id)).toBe(true);
      expect(isClassInGame('forever', id)).toBe(false);
    }
  });

  it('todas as classes causam dano nos dois jogos', () => {
    for (const game of ['retail', 'forever'] as const) {
      for (const c of classesFor(game)) expect(c.roles).toContain('dano');
    }
  });

  it('filtra funções pela classe e pelo jogo', () => {
    expect(ids(rolesFor('retail', 'mago'))).toEqual(['dano']);
    expect(ids(rolesFor('forever', 'paladino'))).toEqual(['tanque', 'cura', 'dano']);
    expect(ids(rolesFor('forever', 'xama'))).toEqual(['cura', 'dano']);
    expect(ids(rolesFor('forever', null))).toEqual(['tanque', 'cura', 'dano']);
  });

  it('valida combinações por jogo', () => {
    expect(isValidCombination('retail', 'mago', 'tanque')).toBe(false);
    expect(isValidCombination('forever', 'sacerdote', 'cura')).toBe(true);
    expect(isValidCombination('forever', 'monge', 'dano')).toBe(false);
  });

  it('traduz rótulos', () => {
    expect(classLabel('xama')).toBe('Xamã');
    expect(roleLabel('cura')).toBe('Cura');
    expect(gameLabel('forever')).toBe('WoW Forever');
    expect(rulesetLabel('jxj')).toBe('JxJ');
  });

  it('nome exibido inclui o sobrenome quando houver', () => {
    expect(characterDisplayName({ characterName: 'Elaris' })).toBe('Elaris');
    expect(characterDisplayName({ characterName: 'Elaris', characterSurname: 'Aurora' })).toBe(
      'Elaris Aurora',
    );
  });
});

describe('profissões', () => {
  it('Retail tem as 11 profissões primárias; o Classic não tem Escrivania nem Joalheria', () => {
    expect(ids(professionsFor('retail'))).toHaveLength(11);
    expect(ids(professionsFor('forever'))).toEqual([
      'alfaiataria',
      'alquimia',
      'couraria',
      'encantamento',
      'engenharia',
      'esfolamento',
      'ferraria',
      'herborismo',
      'mineracao',
    ]);
    expect(professionsFor(null)).toEqual([]);
  });

  it('limita a 2 profissões, sem repetição e do jogo escolhido', () => {
    expect(MAX_PROFESSIONS).toBe(2);
    expect(isValidProfessions('retail', [])).toBe(true);
    expect(isValidProfessions('retail', ['joalheria', 'mineracao'])).toBe(true);
    expect(isValidProfessions('retail', ['alquimia', 'herborismo', 'mineracao'])).toBe(false);
    expect(isValidProfessions('retail', ['alquimia', 'alquimia'])).toBe(false);
    expect(isValidProfessions('forever', ['joalheria'])).toBe(false);
    expect(isValidProfessions('forever', ['pesca'])).toBe(false);
  });

  it('descreve profissões, ausência de profissão e personagens antigos', () => {
    expect(professionsText(['alquimia', 'mineracao'])).toBe('Alquimia, Mineração');
    expect(professionsText([])).toBe('Sem profissão');
    expect(professionsText(null)).toBe('Profissões não informadas');
  });
});
