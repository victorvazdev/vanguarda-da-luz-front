/**
 * Jogos, classes e funções de World of Warcraft. IDs iguais aos validados nas Security Rules.
 *
 * - Retail: 13 classes, funções conforme o jogo atual.
 * - Forever: 9 classes do Classic e funções do Classic. Personagem tem nome e sobrenome,
 *   e no lugar de servidores há rulesets (a guilda está em Normal e JxJ).
 */
export type Game = 'retail' | 'forever';
export type CharacterRole = 'tanque' | 'cura' | 'dano';
export type Ruleset = 'normal' | 'jxj';

export type CharacterClass =
  | 'guerreiro'
  | 'paladino'
  | 'cacador'
  | 'ladino'
  | 'sacerdote'
  | 'xama'
  | 'mago'
  | 'bruxo'
  | 'monge'
  | 'druida'
  | 'cacador-de-demonios'
  | 'cavaleiro-da-morte'
  | 'conjurante';

export interface ClassInfo {
  id: CharacterClass;
  label: string;
  /** Funções que a classe pode exercer neste jogo. */
  roles: readonly CharacterRole[];
}

export const GAMES: readonly { id: Game; label: string; short: string }[] = [
  { id: 'retail', label: 'World of Warcraft Retail', short: 'Retail' },
  { id: 'forever', label: 'World of Warcraft Forever', short: 'WoW Forever' },
];

/** Rulesets do WoW Forever em que a guilda está presente. */
export const RULESETS: readonly { id: Ruleset; label: string }[] = [
  { id: 'normal', label: 'Normal' },
  { id: 'jxj', label: 'JxJ' },
];

/** Nível máximo de personagem em cada jogo (Retail: Midnight; Forever: Classic). */
export const MAX_LEVEL: Record<Game, number> = { retail: 90, forever: 60 };

export const ROLES: readonly { id: CharacterRole; label: string }[] = [
  { id: 'tanque', label: 'Tanque' },
  { id: 'cura', label: 'Cura' },
  { id: 'dano', label: 'Dano' },
];

const RETAIL_CLASSES: readonly ClassInfo[] = [
  { id: 'bruxo', label: 'Bruxo', roles: ['dano'] },
  { id: 'cacador', label: 'Caçador', roles: ['dano'] },
  { id: 'cacador-de-demonios', label: 'Caçador de Demônios', roles: ['tanque', 'dano'] },
  { id: 'cavaleiro-da-morte', label: 'Cavaleiro da Morte', roles: ['tanque', 'dano'] },
  { id: 'conjurante', label: 'Conjurante', roles: ['cura', 'dano'] },
  { id: 'druida', label: 'Druida', roles: ['tanque', 'cura', 'dano'] },
  { id: 'guerreiro', label: 'Guerreiro', roles: ['tanque', 'dano'] },
  { id: 'ladino', label: 'Ladino', roles: ['dano'] },
  { id: 'mago', label: 'Mago', roles: ['dano'] },
  { id: 'monge', label: 'Monge', roles: ['tanque', 'cura', 'dano'] },
  { id: 'paladino', label: 'Paladino', roles: ['tanque', 'cura', 'dano'] },
  { id: 'sacerdote', label: 'Sacerdote', roles: ['cura', 'dano'] },
  { id: 'xama', label: 'Xamã', roles: ['cura', 'dano'] },
];

const FOREVER_CLASSES: readonly ClassInfo[] = [
  { id: 'bruxo', label: 'Bruxo', roles: ['dano'] },
  { id: 'cacador', label: 'Caçador', roles: ['dano'] },
  { id: 'druida', label: 'Druida', roles: ['tanque', 'cura', 'dano'] },
  { id: 'guerreiro', label: 'Guerreiro', roles: ['tanque', 'dano'] },
  { id: 'ladino', label: 'Ladino', roles: ['dano'] },
  { id: 'mago', label: 'Mago', roles: ['dano'] },
  { id: 'paladino', label: 'Paladino', roles: ['tanque', 'cura', 'dano'] },
  { id: 'sacerdote', label: 'Sacerdote', roles: ['cura', 'dano'] },
  { id: 'xama', label: 'Xamã', roles: ['cura', 'dano'] },
];

const CLASSES_BY_GAME: Record<Game, readonly ClassInfo[]> = {
  retail: RETAIL_CLASSES,
  forever: FOREVER_CLASSES,
};

export function classesFor(game: Game | null | undefined): readonly ClassInfo[] {
  return game ? CLASSES_BY_GAME[game] : [];
}

export function isGame(value: unknown): value is Game {
  return value === 'retail' || value === 'forever';
}

export function gameLabel(id: string): string {
  return GAMES.find((g) => g.id === id)?.short ?? id;
}

export function rulesetLabel(id: string): string {
  return RULESETS.find((r) => r.id === id)?.label ?? id;
}

export function classLabel(id: string): string {
  return RETAIL_CLASSES.find((c) => c.id === id)?.label ?? id;
}

export function roleLabel(id: string): string {
  return ROLES.find((r) => r.id === id)?.label ?? id;
}

/** Funções disponíveis para a classe no jogo (todas, se a classe ainda não foi escolhida). */
export function rolesFor(
  game: Game | null | undefined,
  classId: string | null | undefined,
): readonly { id: CharacterRole; label: string }[] {
  const info = classesFor(game).find((c) => c.id === classId);
  return info ? ROLES.filter((r) => info.roles.includes(r.id)) : ROLES;
}

export function isClassInGame(game: Game, classId: string): boolean {
  return classesFor(game).some((c) => c.id === classId);
}

export function isValidCombination(game: Game, classId: string, roleId: string): boolean {
  return !!classesFor(game)
    .find((c) => c.id === classId)
    ?.roles.includes(roleId as CharacterRole);
}

/** Nome exibido do personagem: no Forever, nome e sobrenome. */
export function characterDisplayName(character: {
  characterName: string;
  characterSurname?: string | null;
}): string {
  return [character.characterName, character.characterSurname].filter(Boolean).join(' ');
}
