import {
  characterDisplayName,
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
