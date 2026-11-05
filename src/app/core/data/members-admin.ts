// Gestão de membros e permissões, sem dependência do Angular.
// Testado contra os emuladores (tests/integration/members-admin.spec.ts).
import { FirebaseError } from 'firebase/app';
import {
  collection,
  doc,
  onSnapshot,
  query,
  runTransaction,
  where,
  type Firestore,
} from 'firebase/firestore';
import type { AccountStatus, Permission } from '../auth/access';
import type { CharacterClass, CharacterRole, Game, Profession, Ruleset } from '../models/wow';

export interface MainCharacter {
  game: Game;
  characterName: string;
  characterSurname?: string;
  server?: string;
  ruleset?: Ruleset;
  characterClass: CharacterClass;
  characterRole: CharacterRole;
  /** Ausente em personagens salvos antes da escolha de profissões existir. */
  professions?: Profession[];
  /** Ausente enquanto o membro não informa o nível (personagem vindo da candidatura). */
  level?: number;
}

export interface MemberRow {
  uid: string;
  username: string;
  email: string;
  /** BattleTag da conta (`null` se ainda não informado). Dado privado. */
  battleTag: string | null;
  status: Extract<AccountStatus, 'ativo' | 'desativado'>;
  role: Permission;
  mainCharacter: MainCharacter | null;
}

export type MemberActionError =
  'last-admin' | 'not-active' | 'not-inactive' | 'not-allowed' | 'network' | 'unknown';
export type MemberActionResult = { ok: true } | { ok: false; error: MemberActionError };

/** Administradores ativos na lista exibida. */
export function activeAdminCount(rows: MemberRow[]): number {
  return rows.filter((r) => r.status === 'ativo' && r.role === 'admin').length;
}

/** Busca por nome do personagem ou nome de usuário, sem diferenciar acentos e maiúsculas. */
export function matchesSearch(row: MemberRow, term: string): boolean {
  const normalize = (s: string) =>
    s
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .toLowerCase()
      .trim();
  const needle = normalize(term);
  if (!needle) return true;
  const c = row.mainCharacter;
  const names = [row.username, c?.characterName, c?.characterSurname].filter(Boolean).join(' ');
  return normalize(names).includes(needle);
}

/** Ativos primeiro; depois pelo nome exibido. */
export function sortMembers(rows: MemberRow[]): MemberRow[] {
  const name = (r: MemberRow) => r.mainCharacter?.characterName ?? r.username;
  return [...rows].sort(
    (a, b) =>
      Number(a.status !== 'ativo') - Number(b.status !== 'ativo') ||
      name(a).localeCompare(name(b), 'pt-BR'),
  );
}

/** Acompanha membros (contas ativas e desativadas) em tempo real. */
export function watchMembers(
  db: Firestore,
  next: (rows: MemberRow[]) => void,
  error: (e: unknown) => void,
): () => void {
  let users: Omit<MemberRow, 'mainCharacter'>[] | null = null;
  let characters: Map<string, MainCharacter> | null = null;
  const emit = () => {
    if (!users || !characters) return;
    const chars = characters;
    next(sortMembers(users.map((u) => ({ ...u, mainCharacter: chars.get(u.uid) ?? null }))));
  };

  const stopUsers = onSnapshot(
    query(collection(db, 'users'), where('status', 'in', ['ativo', 'desativado'])),
    (snap) => {
      users = snap.docs.map((d) => ({
        uid: d.id,
        username: d.get('username') as string,
        email: d.get('email') as string,
        battleTag: (d.get('battleTag') as string | undefined) ?? null,
        status: d.get('status') as MemberRow['status'],
        role: d.get('role') as Permission,
      }));
      emit();
    },
    error,
  );
  const stopMembers = onSnapshot(
    collection(db, 'members'),
    (snap) => {
      characters = new Map(snap.docs.map((d) => [d.id, d.get('mainCharacter') as MainCharacter]));
      emit();
    },
    error,
  );
  return () => {
    stopUsers();
    stopMembers();
  };
}

class ActionBlocked extends Error {
  constructor(readonly reason: MemberActionError) {
    super(reason);
  }
}

function actionError(error: unknown): MemberActionResult {
  if (error instanceof ActionBlocked) return { ok: false, error: error.reason };
  const code = error instanceof FirebaseError ? error.code : '';
  if (code === 'permission-denied') return { ok: false, error: 'not-allowed' };
  if (code === 'unavailable') return { ok: false, error: 'network' };
  return { ok: false, error: 'unknown' };
}

const adminsRef = (db: Firestore) => doc(db, 'config', 'admins');

/** Altera a permissão (membro ↔ administrador) e mantém a lista de admins ativos. */
export async function changeRole(
  db: Firestore,
  uid: string,
  role: Permission,
): Promise<MemberActionResult> {
  try {
    await runTransaction(db, async (tx) => {
      const userRef = doc(db, 'users', uid);
      const [user, admins] = await Promise.all([tx.get(userRef), tx.get(adminsRef(db))]);
      if (user.get('status') !== 'ativo') throw new ActionBlocked('not-active');
      if (user.get('role') === role) return;

      const current = (admins.get('activeAdminUids') as string[] | undefined) ?? [];
      const next = role === 'admin' ? [...current, uid] : current.filter((u) => u !== uid);
      if (next.length === 0) throw new ActionBlocked('last-admin');

      tx.update(userRef, { role });
      tx.update(adminsRef(db), { activeAdminUids: next });
    });
    return { ok: true };
  } catch (error) {
    return actionError(error);
  }
}

/**
 * Reativa um membro desativado: a conta volta ativa com permissão de membro (mesmo que
 * fosse admin antes) e o membro volta às listas.
 */
export async function reactivateMember(db: Firestore, uid: string): Promise<MemberActionResult> {
  try {
    await runTransaction(db, async (tx) => {
      const userRef = doc(db, 'users', uid);
      const memberRef = doc(db, 'members', uid);
      const [user, member] = await Promise.all([tx.get(userRef), tx.get(memberRef)]);
      if (user.get('status') !== 'desativado') throw new ActionBlocked('not-inactive');
      tx.update(userRef, { status: 'ativo', role: 'membro' });
      if (member.exists()) tx.update(memberRef, { active: true });
    });
    return { ok: true };
  } catch (error) {
    return actionError(error);
  }
}

/** Desativa: a conta perde o acesso, o membro sai das listas e, se admin, sai da lista de admins. */
export async function deactivateMember(db: Firestore, uid: string): Promise<MemberActionResult> {
  try {
    await runTransaction(db, async (tx) => {
      const userRef = doc(db, 'users', uid);
      const memberRef = doc(db, 'members', uid);
      const [user, member, admins] = await Promise.all([
        tx.get(userRef),
        tx.get(memberRef),
        tx.get(adminsRef(db)),
      ]);
      if (user.get('status') !== 'ativo') throw new ActionBlocked('not-active');

      const current = (admins.get('activeAdminUids') as string[] | undefined) ?? [];
      if (current.includes(uid)) {
        const next = current.filter((u) => u !== uid);
        if (next.length === 0) throw new ActionBlocked('last-admin');
        tx.update(adminsRef(db), { activeAdminUids: next });
      }
      tx.update(userRef, { status: 'desativado' });
      if (member.exists()) tx.update(memberRef, { active: false });
    });
    return { ok: true };
  } catch (error) {
    return actionError(error);
  }
}
