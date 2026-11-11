import type { ResolvedAccess } from '../auth/access';

/** Caminhos usados por guards, menus e botões. */
export const PATHS = {
  home: '/',
  join: '/como-ingressar',
  rules: '/regras',
  signUp: '/cadastro',
  signIn: '/entrar',
  forgotPassword: '/recuperar-senha',
  resetPassword: '/redefinir-senha',
  emailAction: '/confirmar-email',
  application: '/candidatura',
  account: '/minha-conta',
  calendar: '/calendario',
  /** Novo evento a partir do calendário (somente administradores). */
  newEvent: '/calendario/novo',
  admin: '/admin',
  accessDenied: '/acesso-negado',
} as const;

/** Página inicial adequada a cada perfil (após login ou redirecionamentos). */
export function landingPathFor(access: ResolvedAccess): string {
  switch (access) {
    case 'pending':
    case 'deleting':
      return PATHS.account;
    case 'member':
    case 'admin':
      return PATHS.calendar;
    default:
      return PATHS.home;
  }
}

/** Destino dos botões "Fazer parte": cadastro para visitante, candidatura para pendente. */
export function joinPathFor(access: ResolvedAccess | 'loading'): string | null {
  switch (access) {
    case 'visitor':
    case 'blocked':
    case 'loading':
      return PATHS.signUp;
    case 'pending':
      return PATHS.application;
    default:
      return null;
  }
}
