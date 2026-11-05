import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SessionService } from '../../../core/auth/session.service';
import { GUILD } from '../../../core/content/guild-content';
import { PATHS, joinPathFor } from '../../../core/routing/paths';

/** História "Conhecer a guilda". */
@Component({
  selector: 'app-home-page',
  imports: [RouterLink],
  templateUrl: './home-page.html',
  styleUrl: './home-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomePage {
  private readonly session = inject(SessionService);

  protected readonly guild = GUILD;
  protected readonly joinInfoPath = PATHS.join;
  protected readonly joinPath = computed(() => joinPathFor(this.session.access()));

  /** Partículas de luz decorativas do hero: posição, tamanho e ritmo variados, mas fixos. */
  protected readonly motes = Array.from({ length: 14 }, (_, i) => ({
    x: `${(i * 37 + 11) % 100}%`,
    size: `${2 + (i % 3)}px`,
    duration: `${8 + ((i * 5) % 7)}s`,
    delay: `${-((i * 1.7) % 10).toFixed(1)}s`,
    drift: `${((i % 5) - 2) * 12}px`,
  }));
}
