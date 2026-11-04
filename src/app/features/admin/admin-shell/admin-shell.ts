import { ChangeDetectionStrategy, Component, effect, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { SessionService } from '../../../core/auth/session.service';
import { landingPathFor } from '../../../core/routing/paths';

/** Abas da administração. Cada história acrescenta a sua (Eventos). */
export const ADMIN_TABS = [
  { label: 'Candidaturas', path: '/admin/candidaturas' },
  { label: 'Membros', path: '/admin/membros' },
] as const;

@Component({
  selector: 'app-admin-shell',
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  template: `
    <div class="container admin">
      <nav class="tabs" aria-label="Administração">
        <ul class="tabs__list">
          @for (tab of tabs; track tab.path) {
            <li>
              <a
                class="tabs__link"
                [routerLink]="tab.path"
                routerLinkActive="tabs__link--active"
                ariaCurrentWhenActive="page"
                >{{ tab.label }}</a
              >
            </li>
          }
        </ul>
      </nav>
      <router-outlet />
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminShell {
  protected readonly tabs = ADMIN_TABS;

  constructor() {
    // Se a pessoa deixar de ser admin durante o uso (ex.: removeu a própria permissão), sai da área.
    const session = inject(SessionService);
    const router = inject(Router);
    effect(() => {
      const access = session.access();
      if (access !== 'admin' && access !== 'loading' && access !== 'blocked') {
        void router.navigateByUrl(landingPathFor(access));
      }
    });
  }
}
