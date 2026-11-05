import type { AccessLevel } from '../../core/auth/access';
import { PATHS } from '../../core/routing/paths';

export interface NavItem {
  label: string;
  path: string;
  /** `cta` = botão dourado "Fazer parte". */
  kind: 'link' | 'cta';
  exact?: boolean;
}

/** Itens do menu principal por perfil. Administração só aparece para admins. */
export function navItemsFor(access: AccessLevel): NavItem[] {
  switch (access) {
    case 'loading':
      return [];
    case 'pending':
      return [{ label: 'Minha conta', path: PATHS.account, kind: 'link' }];
    case 'member':
      return [{ label: 'Calendário', path: PATHS.calendar, kind: 'link' }];
    case 'admin':
      return [
        { label: 'Calendário', path: PATHS.calendar, kind: 'link' },
        { label: 'Administração', path: PATHS.admin, kind: 'link' },
      ];
    default:
      return [
        { label: 'A guilda', path: PATHS.home, kind: 'link', exact: true },
        { label: 'Como ingressar', path: PATHS.join, kind: 'link' },
        { label: 'Regras', path: PATHS.rules, kind: 'link' },
        { label: 'Entrar', path: PATHS.signIn, kind: 'link' },
        { label: 'Fazer parte', path: PATHS.signUp, kind: 'cta' },
      ];
  }
}

export function showsSignOut(access: AccessLevel): boolean {
  return access === 'pending' || access === 'member' || access === 'admin';
}
