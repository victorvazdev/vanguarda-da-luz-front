import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PATHS } from '../../../core/routing/paths';

/** Destino de usuários sem permissão para uma área (ex.: pendente tentando abrir o calendário). */
@Component({
  selector: 'app-access-denied-page',
  imports: [RouterLink],
  template: `
    <article class="container container--narrow page">
      <header class="page__header">
        <h1>Acesso restrito</h1>
        <p class="muted">
          Esta área é exclusiva para membros da guilda. O acesso é liberado depois que um
          administrador aprovar sua candidatura.
        </p>
      </header>
      <div class="actions">
        <a class="btn btn--primary" [routerLink]="accountPath">Ver minha conta</a>
        <a class="btn btn--outline" [routerLink]="joinPath">Ver como ingressar</a>
      </div>
    </article>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccessDeniedPage {
  protected readonly accountPath = PATHS.account;
  protected readonly joinPath = PATHS.join;
}
