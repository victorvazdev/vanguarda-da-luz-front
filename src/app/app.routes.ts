import type { Routes } from '@angular/router';
import { adminGuard, authGuard, guestGuard, pendingGuard } from './core/auth/guards';

/**
 * Rotas da aplicação. Cada história adiciona suas rotas aqui, com lazy loading
 * e o guard do perfil exigido (ver core/auth/guards.ts).
 */
export const routes: Routes = [
  {
    path: '',
    title: 'A guilda',
    loadComponent: () => import('./features/public/home/home-page').then((m) => m.HomePage),
  },
  {
    path: 'como-ingressar',
    title: 'Como ingressar',
    loadComponent: () => import('./features/public/join/join-page').then((m) => m.JoinPage),
  },
  {
    path: 'regras',
    title: 'Regras da guilda',
    loadComponent: () => import('./features/public/rules/rules-page').then((m) => m.RulesPage),
  },
  {
    // Público: qualquer perfil baixa o addon.
    path: 'addon',
    title: 'Addon da guilda',
    loadComponent: () => import('./features/public/addon/addon-page').then((m) => m.AddonPage),
  },
  {
    path: 'cadastro',
    title: 'Crie sua conta',
    canActivate: [guestGuard],
    loadComponent: () => import('./features/auth/sign-up/sign-up-page').then((m) => m.SignUpPage),
  },
  {
    path: 'entrar',
    title: 'Entrar',
    canActivate: [guestGuard],
    loadComponent: () => import('./features/auth/sign-in/sign-in-page').then((m) => m.SignInPage),
  },
  {
    path: 'recuperar-senha',
    title: 'Recuperar senha',
    canActivate: [guestGuard],
    loadComponent: () =>
      import('./features/auth/forgot-password/forgot-password-page').then(
        (m) => m.ForgotPasswordPage,
      ),
  },
  {
    // Destino do link enviado por e-mail (URL de ação personalizada no Firebase Console).
    path: 'redefinir-senha',
    title: 'Redefinir senha',
    loadComponent: () =>
      import('./features/auth/reset-password/reset-password-page').then((m) => m.ResetPasswordPage),
  },
  {
    // Links de troca de e-mail (confirmar o novo ou desfazer pelo antigo).
    path: 'confirmar-email',
    title: 'Confirmar e-mail',
    loadComponent: () =>
      import('./features/auth/email-action/email-action-page').then((m) => m.EmailActionPage),
  },
  {
    path: 'candidatura',
    title: 'Envie sua candidatura',
    canActivate: [pendingGuard],
    loadComponent: () =>
      import('./features/account/application-form/application-form-page').then(
        (m) => m.ApplicationFormPage,
      ),
  },
  {
    path: 'minha-conta',
    title: 'Minha conta',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/account/my-account/my-account-page').then((m) => m.MyAccountPage),
  },
  {
    path: 'calendario',
    title: 'Calendário',
    // Público: visitantes também veem os eventos e confirmam presença.
    loadComponent: () =>
      import('./features/events/calendar/calendar-page').then((m) => m.CalendarPage),
  },
  {
    // Administradores criam eventos direto do calendário, fora do painel administrativo.
    path: 'calendario/novo',
    title: 'Novo evento',
    canActivate: [adminGuard],
    data: { from: 'calendar' },
    loadComponent: () =>
      import('./features/admin/events/event-form/event-form-page').then((m) => m.EventFormPage),
  },
  {
    path: 'calendario/:id',
    title: 'Evento',
    // Público: visitantes também veem os eventos e confirmam presença.
    loadComponent: () =>
      import('./features/events/event-detail/event-detail-page').then((m) => m.EventDetailPage),
  },
  {
    path: 'admin',
    canActivate: [adminGuard],
    loadComponent: () =>
      import('./features/admin/admin-shell/admin-shell').then((m) => m.AdminShell),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'candidaturas' },
      {
        path: 'candidaturas',
        title: 'Candidaturas',
        loadComponent: () =>
          import('./features/admin/applications/applications-admin-page').then(
            (m) => m.ApplicationsAdminPage,
          ),
      },
      {
        path: 'membros',
        title: 'Membros',
        loadComponent: () =>
          import('./features/admin/members/members-admin-page').then((m) => m.MembersAdminPage),
      },
      {
        path: 'eventos',
        title: 'Eventos',
        loadComponent: () =>
          import('./features/admin/events/events-admin-page').then((m) => m.EventsAdminPage),
      },
      {
        path: 'eventos/novo',
        title: 'Novo evento',
        loadComponent: () =>
          import('./features/admin/events/event-form/event-form-page').then((m) => m.EventFormPage),
      },
      {
        path: 'eventos/importar-presencas',
        title: 'Importar presenças do addon',
        loadComponent: () =>
          import('./features/admin/events/presence-import/presence-import-page').then(
            (m) => m.PresenceImportPage,
          ),
      },
      {
        path: 'eventos/:id/editar',
        title: 'Editar evento',
        loadComponent: () =>
          import('./features/admin/events/event-form/event-form-page').then((m) => m.EventFormPage),
      },
      {
        path: 'guilda',
        title: 'Informações da guilda',
        loadComponent: () =>
          import('./features/admin/guild/guild-admin-page').then((m) => m.GuildAdminPage),
      },
      {
        path: 'redes-sociais',
        title: 'Redes sociais',
        loadComponent: () =>
          import('./features/admin/social/social-admin-page').then((m) => m.SocialAdminPage),
      },
    ],
  },
  {
    path: 'acesso-negado',
    title: 'Acesso restrito',
    loadComponent: () =>
      import('./features/system/access-denied/access-denied-page').then((m) => m.AccessDeniedPage),
  },
  {
    path: '**',
    title: 'Página não encontrada',
    loadComponent: () =>
      import('./features/system/not-found/not-found-page').then((m) => m.NotFoundPage),
  },
];
