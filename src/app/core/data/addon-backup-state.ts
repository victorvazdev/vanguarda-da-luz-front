// Estado combinado dos backups do addon, sem dependências (nem Angular, nem Firebase).
// Testado em addon-backup-state.spec.ts.
//
// Os dados que só existem no jogo (profissões, item level e main, tempo jogado junto) e as
// presenças vindas dos backups são juntados como o addon faz na restauração: por personagem,
// vale o registro mais recente (`updatedAt`) e, no tempo junto, o maior total. Nada é apagado.
// A string de restauração (VDLB1, sem eventos) é montada a partir desse estado.
import type {
  AddonBackup,
  BackupItemLevel,
  BackupProfession,
  BackupProfessions,
  BackupTogether,
} from './addon-backup-format';
import type { PresenceEvent, PresenceStatus } from './addon-presence-format';

export interface CharacterState {
  /** Personagem → profissões lidas no jogo. */
  professions: Record<string, { updatedAt: number; professions: BackupProfession[] }>;
  /** Personagem → item level e main. */
  itemLevels: Record<string, { updatedAt: number; itemLevel: number; main: string }>;
  /** Personagem → segundos jogados junto. */
  together: Record<string, number>;
}

/** Presenças guardadas de um evento: personagem → status e horário no jogo. */
export type PresenceRecords = Record<string, { status: PresenceStatus; updatedAt: number }>;

export const emptyCharacterState = (): CharacterState => ({
  professions: {},
  itemLevels: {},
  together: {},
});

/** Junta um backup ao estado. `changed` diz se algo ficou diferente. */
export function mergeCharacters(
  state: CharacterState,
  data: Pick<AddonBackup, 'professions' | 'itemLevels' | 'together'>,
): { state: CharacterState; changed: boolean } {
  const next: CharacterState = {
    professions: { ...state.professions },
    itemLevels: { ...state.itemLevels },
    together: { ...state.together },
  };
  let changed = false;
  for (const p of data.professions) {
    const current = next.professions[p.character];
    if (!current || p.updatedAt > current.updatedAt) {
      next.professions[p.character] = { updatedAt: p.updatedAt, professions: p.professions };
      changed = true;
    }
  }
  for (const m of data.itemLevels) {
    const current = next.itemLevels[m.character];
    if (!current || m.updatedAt > current.updatedAt) {
      next.itemLevels[m.character] = {
        updatedAt: m.updatedAt,
        itemLevel: m.itemLevel,
        main: m.main,
      };
      changed = true;
    }
  }
  for (const t of data.together) {
    if (t.seconds > (next.together[t.character] ?? -1)) {
      next.together[t.character] = t.seconds;
      changed = true;
    }
  }
  return { state: next, changed };
}

/** Junta as presenças de um evento. `changed` diz se algo ficou diferente. */
export function mergePresences(
  stored: PresenceRecords,
  records: PresenceEvent['records'],
): { records: PresenceRecords; changed: boolean } {
  const next = { ...stored };
  let changed = false;
  for (const r of records) {
    const current = next[r.character];
    if (!current || r.updatedAt > current.updatedAt) {
      next[r.character] = { status: r.status, updatedAt: r.updatedAt };
      changed = true;
    }
  }
  return { records: next, changed };
}

/** Estado no formato das seções da string (para a restauração). */
export function characterSections(
  state: CharacterState,
): Pick<AddonBackup, 'professions' | 'itemLevels' | 'together'> {
  return {
    professions: Object.entries(state.professions).map(([character, p]): BackupProfessions => ({
      character,
      ...p,
    })),
    itemLevels: Object.entries(state.itemLevels).map(([character, m]): BackupItemLevel => ({
      character,
      ...m,
    })),
    together: Object.entries(state.together).map(([character, seconds]): BackupTogether => ({
      character,
      seconds,
    })),
  };
}

/** Backup de restauração: sem eventos (eles voltam pela VDL1) e sem autor. */
export function restoreBackup(
  state: CharacterState,
  presences: { eventId: string; records: PresenceRecords }[],
  exportNumber: number,
  now: Date,
): AddonBackup {
  return {
    version: 1,
    game: 'forever',
    generatedAt: Math.floor(now.getTime() / 1000),
    exportNumber,
    generatedBy: '',
    events: [],
    attendance: presences
      .map((p) => ({
        id: p.eventId,
        records: Object.entries(p.records).map(([character, r]) => ({ character, ...r })),
      }))
      .filter((p) => p.records.length > 0),
    ...characterSections(state),
  };
}

// ---------- Tabelas da página de dados ----------

export interface CharacterRow {
  character: string;
  /** Main da conta (`null`: não definido). */
  main: string | null;
  isAlt: boolean;
  itemLevel: number | null;
  itemLevelAt: number | null;
  professions: BackupProfession[];
  professionsAt: number | null;
  /** Tempo junto do próprio personagem. */
  together: number;
}

export interface TogetherRow {
  /** Main (ou o próprio personagem, sem main definido). */
  character: string;
  /** Alts somados no main. */
  alts: string[];
  seconds: number;
}

const byName = (a: string, b: string) => a.localeCompare(b, 'pt-BR');

/** Uma linha por personagem conhecido, em ordem alfabética. */
export function characterRows(state: CharacterState): CharacterRow[] {
  const names = new Set([
    ...Object.keys(state.professions),
    ...Object.keys(state.itemLevels),
    ...Object.keys(state.together),
  ]);
  return [...names].sort(byName).map((character) => {
    const m = state.itemLevels[character];
    const p = state.professions[character];
    const main = m?.main ? m.main : null;
    return {
      character,
      main,
      isAlt: main !== null && main !== character,
      itemLevel: m ? m.itemLevel : null,
      itemLevelAt: m ? m.updatedAt : null,
      professions: p?.professions ?? [],
      professionsAt: p ? p.updatedAt : null,
      together: state.together[character] ?? 0,
    };
  });
}

/** Tempo jogado junto, somando os alts no main (como o addon), do maior para o menor. */
export function togetherRows(state: CharacterState): TogetherRow[] {
  const rows = new Map<string, TogetherRow>();
  for (const [character, seconds] of Object.entries(state.together)) {
    const main = state.itemLevels[character]?.main || character;
    const row = rows.get(main) ?? { character: main, alts: [], seconds: 0 };
    row.seconds += seconds;
    if (main !== character) row.alts.push(character);
    rows.set(main, row);
  }
  return [...rows.values()]
    .map((r) => ({ ...r, alts: r.alts.sort(byName) }))
    .sort((a, b) => b.seconds - a.seconds || byName(a.character, b.character));
}

/** Nome padronizado para o filtro: sem acentos, espaços extras e maiúsculas. */
export const normalizeName = (value: string) =>
  value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLocaleLowerCase('pt-BR');
