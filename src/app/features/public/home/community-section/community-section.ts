import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { visibleSocialLinks } from '../../../../core/content/site-content';
import { SiteContentService } from '../../../../core/content/site-content.service';
import { PATHS } from '../../../../core/routing/paths';

/** Seção "Junte-se à comunidade" da página inicial, com os links definidos no painel. */
@Component({
  selector: 'app-community-section',
  imports: [NgTemplateOutlet, RouterLink],
  templateUrl: './community-section.html',
  styleUrl: './community-section.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CommunitySection {
  private readonly social = inject(SiteContentService).social();

  protected readonly rulesPath = PATHS.rules;

  /** Somente redes com link; nada é exibido enquanto carrega ou se falhar. */
  private readonly links = computed(() => {
    const links = this.social();
    return links ? visibleSocialLinks(links) : [];
  });

  protected readonly featured = computed(() => this.links().filter((n) => n.featured));
  protected readonly others = computed(() => this.links().filter((n) => !n.featured));
}
