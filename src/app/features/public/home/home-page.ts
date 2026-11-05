import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SessionService } from '../../../core/auth/session.service';
import { GUILD } from '../../../core/content/guild-content';
import { factionLabel, rulesetsLabel } from '../../../core/content/site-content';
import { SiteContentService } from '../../../core/content/site-content.service';
import { PATHS, joinPathFor } from '../../../core/routing/paths';
import { formatBrasiliaDate } from '../../../core/time/brasilia';
import { RichText } from '../../../shared/ui/rich-text/rich-text';

/** História "Conhecer a guilda". História, valores e onde joga vêm do painel administrativo. */
@Component({
  selector: 'app-home-page',
  imports: [RouterLink, RichText],
  templateUrl: './home-page.html',
  styleUrl: './home-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomePage {
  private readonly session = inject(SessionService);
  private readonly info = inject(SiteContentService).guild();

  protected readonly guild = GUILD;
  protected readonly joinInfoPath = PATHS.join;
  protected readonly joinPath = computed(() => joinPathFor(this.session.access()));

  /** `undefined` = carregando; `null` = erro. Informações sem conteúdo não são exibidas. */
  protected readonly about = computed(() => {
    const info = this.info();
    if (!info) return info;
    return {
      history: info.history,
      values: info.values,
      faction: factionLabel(info.faction),
      server: info.retailServer,
      rulesets: rulesetsLabel(info.foreverRulesets),
      updatedAt: info.updatedAt ? formatBrasiliaDate(info.updatedAt) : null,
    };
  });

  /** Partículas de luz decorativas do hero: posição, tamanho e ritmo variados, mas fixos. */
  protected readonly motes = Array.from({ length: 14 }, (_, i) => ({
    x: `${(i * 37 + 11) % 100}%`,
    size: `${2 + (i % 3)}px`,
    duration: `${8 + ((i * 5) % 7)}s`,
    delay: `${-((i * 1.7) % 10).toFixed(1)}s`,
    drift: `${((i % 5) - 2) * 12}px`,
  }));
}
