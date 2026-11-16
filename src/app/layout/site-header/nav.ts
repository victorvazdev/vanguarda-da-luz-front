import type { AccessLevel } from '../../core/auth/access';
import { PATHS } from '../../core/routing/paths';

export interface NavItem {
  label: string;
  path: string;
  /** `cta` = botão dourado "Fazer parte"; `highlight` = botão de contorno do addon. */
  kind: 'link' | 'cta' | 'highlight';
  exact?: boolean;
}

/** Página do addon, em destaque para todos os perfis. */
const ADDON_ITEM: NavItem = { label: 'Baixar addon', path: PATHS.addon, kind: 'highlight' };

/** Itens do menu principal por perfil. Administração só aparece para admins. */
export function navItemsFor(access: AccessLevel): NavItem[] {
  switch (access) {
    case 'loading':
      // Os demais itens dependem do perfil; o addon é igual para todos.
      return [ADDON_ITEM];
    case 'deleting':
      return [{ label: 'Minha conta', path: PATHS.account, kind: 'link' }, ADDON_ITEM];
    case 'pending':
      return [
        { label: 'Calendário', path: PATHS.calendar, kind: 'link' },
        { label: 'Minha conta', path: PATHS.account, kind: 'link' },
        ADDON_ITEM,
      ];
    case 'member':
      return [
        { label: 'Calendário', path: PATHS.calendar, kind: 'link' },
        { label: 'Minha conta', path: PATHS.account, kind: 'link' },
        ADDON_ITEM,
      ];
    case 'admin':
      return [
        { label: 'Calendário', path: PATHS.calendar, kind: 'link' },
        { label: 'Minha conta', path: PATHS.account, kind: 'link' },
        { label: 'Administração', path: PATHS.admin, kind: 'link' },
        ADDON_ITEM,
      ];
    default:
      return [
        { label: 'A guilda', path: PATHS.home, kind: 'link', exact: true },
        { label: 'Como ingressar', path: PATHS.join, kind: 'link' },
        { label: 'Regras', path: PATHS.rules, kind: 'link' },
        { label: 'Calendário', path: PATHS.calendar, kind: 'link' },
        { label: 'Entrar', path: PATHS.signIn, kind: 'link' },
        ADDON_ITEM,
        { label: 'Fazer parte', path: PATHS.signUp, kind: 'cta' },
      ];
  }
}

export function showsSignOut(access: AccessLevel): boolean {
  return access === 'pending' || access === 'member' || access === 'admin' || access === 'deleting';
}
