/** Situação da conta guardada em `users/{uid}`. */
export type AccountStatus = 'pendente' | 'ativo' | 'desativado';

/** Permissão do membro na guilda. */
export type Permission = 'membro' | 'admin';

export interface UserAccount {
  username: string;
  email: string;
  status: AccountStatus;
  role: Permission;
}

/**
 * Perfil efetivo de quem está navegando.
 * - `loading`: ainda resolvendo o login ou o documento da conta.
 * - `blocked`: conta desativada; a sessão deve ser encerrada.
 */
export type AccessLevel = 'loading' | 'visitor' | 'pending' | 'member' | 'admin' | 'blocked';
export type ResolvedAccess = Exclude<AccessLevel, 'loading'>;

/**
 * Calcula o perfil a partir do usuário do Auth e do documento da conta.
 * `undefined` significa "ainda carregando"; `null` significa "não existe".
 */
export function resolveAccess(
  authUser: unknown | null | undefined,
  account: UserAccount | null | undefined,
): AccessLevel {
  if (authUser === undefined) return 'loading';
  if (authUser === null) return 'visitor';
  if (account === undefined) return 'loading';
  if (account === null) return 'pending';

  switch (account.status) {
    case 'desativado':
      return 'blocked';
    case 'ativo':
      return account.role === 'admin' ? 'admin' : 'member';
    default:
      return 'pending';
  }
}

export function isMemberAccess(access: AccessLevel): boolean {
  return access === 'member' || access === 'admin';
}
