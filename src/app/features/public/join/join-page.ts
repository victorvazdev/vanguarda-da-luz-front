import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SessionService } from '../../../core/auth/session.service';
import { JOIN_STEPS } from '../../../core/content/guild-content';
import { PATHS, joinPathFor } from '../../../core/routing/paths';

/** História "Ver como ingressar". */
@Component({
  selector: 'app-join-page',
  imports: [RouterLink],
  templateUrl: './join-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class JoinPage {
  private readonly session = inject(SessionService);

  protected readonly steps = JOIN_STEPS;
  protected readonly rulesPath = PATHS.rules;

  /** Visitante → cadastro; usuário cadastrado pendente → candidatura; membro → sem botão. */
  protected readonly primaryAction = computed(() => {
    const path = joinPathFor(this.session.access());
    if (!path) return null;
    const label = path === PATHS.application ? 'Enviar candidatura' : 'Criar minha conta';
    return { path, label };
  });
}
