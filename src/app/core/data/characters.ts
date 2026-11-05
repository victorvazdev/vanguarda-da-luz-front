// Personagens do membro, sem dependência do Angular.
// Testado contra os emuladores (tests/integration/profile.spec.ts).
//
// Os personagens ficam em `members/{uid}/characters/{id}`. O principal é copiado para
// `members/{uid}.mainCharacter` (com `mainCharacterId`), que é o que as listas da guilda leem.
// Um membro recém-aprovado tem só a cópia vinda da candidatura, ainda sem nível e sem
// documento próprio: ele aparece aqui com `id: null` até ser salvo pela primeira vez.
import { FirebaseError } from 'firebase/app';
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  runTransaction,
  writeBatch,
  type Firestore,
} from 'firebase/firestore';
import {
  MAX_LEVEL,
  isGame,
  type CharacterClass,
  type CharacterRole,
  type Game,
  type Profession,
  type Ruleset,
} from '../models/wow';
import type { GameCharacter } from './applications';
import type { MainCharacter } from './members-admin';

export type CharacterInput = GameCharacter & {
  characterClass: CharacterClass;
  characterRole: CharacterRole;
  /** Profissões primárias; `[]` quando o personagem não tem profissão. */
  professions: Profession[];
  level: number;
};

export interface Character {
  /** `null` = personagem principal vindo da candidatura, ainda não salvo pelo membro. */
  id: string | null;
  game: Game;
  characterName: string;
  characterSurname: string | null;
  server: string | null;
  ruleset: Ruleset | null;
  characterClass: CharacterClass;
  characterRole: CharacterRole;
  /** `null` em personagens salvos antes da escolha de profissões existir. */
  professions: Profession[] | null;
  level: number | null;
  isMain: boolean;
}

export type CharacterError = 'is-main' | 'not-found' | 'not-allowed' | 'network' | 'unknown';
export type CharacterResult = { ok: true; id: string } | { ok: false; error: CharacterError };

export function isValidLevel(game: Game, level: number): boolean {
  return Number.isInteger(level) && level >= 1 && level <= MAX_LEVEL[game];
}

/** Documento gravado, exatamente como as rules validam (e igual à cópia do principal). */
export function characterData(input: CharacterInput): Record<string, unknown> {
  const common = {
    characterClass: input.characterClass,
    characterRole: input.characterRole,
    professions: input.professions,
    level: input.level,
  };
  return input.game === 'retail'
    ? {
        game: 'retail',
        characterName: input.characterName.trim(),
        server: input.server.trim(),
        ...common,
      }
    : {
        game: 'forever',
        characterName: input.characterName.trim(),
        characterSurname: input.characterSurname.trim(),
        ruleset: input.ruleset,
        ...common,
      };
}

function fromData(id: string | null, data: Record<string, unknown>, isMain: boolean): Character {
  return {
    id,
    game: isGame(data['game']) ? data['game'] : 'retail',
    characterName: data['characterName'] as string,
    characterSurname: (data['characterSurname'] as string | undefined) ?? null,
    server: (data['server'] as string | undefined) ?? null,
    ruleset: (data['ruleset'] as Ruleset | undefined) ?? null,
    characterClass: data['characterClass'] as CharacterClass,
    characterRole: data['characterRole'] as CharacterRole,
    professions: Array.isArray(data['professions']) ? (data['professions'] as Profession[]) : null,
    level: typeof data['level'] === 'number' ? data['level'] : null,
    isMain,
  };
}

/** Principal primeiro; depois pelo nome. */
export function sortCharacters(list: Character[]): Character[] {
  return [...list].sort(
    (a, b) =>
      Number(b.isMain) - Number(a.isMain) ||
      a.characterName.localeCompare(b.characterName, 'pt-BR'),
  );
}

/** Junta o documento do membro e a subcoleção de personagens. */
export function buildCharacters(
  member: { mainCharacterId?: string; mainCharacter?: MainCharacter } | null,
  docs: { id: string; data: Record<string, unknown> }[],
): Character[] {
  const mainId = member?.mainCharacterId ?? null;
  const list = docs.map((d) => fromData(d.id, d.data, d.id === mainId));
  if (!mainId && member?.mainCharacter) {
    list.push(fromData(null, member.mainCharacter as unknown as Record<string, unknown>, true));
  }
  return sortCharacters(list);
}

const memberRef = (db: Firestore, uid: string) => doc(db, 'members', uid);
const charactersRef = (db: Firestore, uid: string) => collection(db, 'members', uid, 'characters');

/** Acompanha os personagens do membro em tempo real. */
export function watchCharacters(
  db: Firestore,
  uid: string,
  next: (characters: Character[]) => void,
  error: (e: unknown) => void,
): () => void {
  let member: Parameters<typeof buildCharacters>[0] | undefined;
  let docs: Parameters<typeof buildCharacters>[1] | undefined;
  const emit = () => {
    if (member !== undefined && docs) next(buildCharacters(member, docs));
  };
  const stopMember = onSnapshot(
    memberRef(db, uid),
    (snap) => {
      member = snap.exists() ? (snap.data() as Parameters<typeof buildCharacters>[0]) : null;
      emit();
    },
    error,
  );
  const stopCharacters = onSnapshot(
    charactersRef(db, uid),
    (snap) => {
      docs = snap.docs.map((d) => ({ id: d.id, data: d.data() }));
      emit();
    },
    error,
  );
  return () => {
    stopMember();
    stopCharacters();
  };
}

function failure(error: unknown): CharacterResult {
  if (error instanceof Blocked) return { ok: false, error: error.reason };
  const code = error instanceof FirebaseError ? error.code : '';
  if (code === 'permission-denied') return { ok: false, error: 'not-allowed' };
  if (code === 'unavailable') return { ok: false, error: 'network' };
  return { ok: false, error: 'unknown' };
}

class Blocked extends Error {
  constructor(readonly reason: CharacterError) {
    super(reason);
  }
}

/**
 * Adiciona (`id` nulo) ou edita um personagem. Com `asMain`, ele passa a ser o principal
 * (ou continua sendo, com a cópia atualizada) no mesmo lote.
 */
export async function saveCharacter(
  db: Firestore,
  uid: string,
  id: string | null,
  input: CharacterInput,
  asMain: boolean,
): Promise<CharacterResult> {
  const ref = id ? doc(charactersRef(db, uid), id) : doc(charactersRef(db, uid));
  const data = characterData(input);
  try {
    const batch = writeBatch(db);
    batch.set(ref, data);
    if (asMain) batch.update(memberRef(db, uid), { mainCharacter: data, mainCharacterId: ref.id });
    await batch.commit();
    return { ok: true, id: ref.id };
  } catch (error) {
    return failure(error);
  }
}

/** Torna principal um personagem já salvo, copiando os dados gravados. */
export async function setMainCharacter(
  db: Firestore,
  uid: string,
  id: string,
): Promise<CharacterResult> {
  try {
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(doc(charactersRef(db, uid), id));
      if (!snap.exists()) throw new Blocked('not-found');
      tx.update(memberRef(db, uid), { mainCharacter: snap.data(), mainCharacterId: id });
    });
    return { ok: true, id };
  } catch (error) {
    return failure(error);
  }
}

/** Remove um personagem que não é o principal. */
export async function removeCharacter(
  db: Firestore,
  uid: string,
  character: Pick<Character, 'id' | 'isMain'>,
): Promise<CharacterResult> {
  if (character.isMain || !character.id) return { ok: false, error: 'is-main' };
  try {
    await deleteDoc(doc(charactersRef(db, uid), character.id));
    return { ok: true, id: character.id };
  } catch (error) {
    return failure(error);
  }
}
