import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-not-found-page',
  imports: [RouterLink],
  template: `
    <article class="container container--narrow page">
      <div class="sigil" aria-hidden="true">
        <img class="sigil__logo" src="images/logo-256.webp" alt="" width="120" height="120" />
        <span class="sigil__spark"></span>
      </div>
      <header class="page__header">
        <h1>Página não encontrada</h1>
        <p class="muted">O endereço acessado não existe ou foi removido.</p>
      </header>
      <div class="actions">
        <a class="btn btn--primary" routerLink="/">Voltar para o início</a>
      </div>
    </article>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NotFoundPage {}
