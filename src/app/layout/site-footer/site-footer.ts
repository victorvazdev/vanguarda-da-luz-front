import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { GUILD } from '../../core/content/guild-content';
import { visibleSocialLinks } from '../../core/content/site-content';
import { SiteContentService } from '../../core/content/site-content.service';

@Component({
  selector: 'app-site-footer',
  templateUrl: './site-footer.html',
  styleUrl: './site-footer.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SiteFooter {
  private readonly social = inject(SiteContentService).social();

  protected readonly guildName = GUILD.name;
  /** Links definidos no painel; nada é exibido enquanto carrega ou se falhar. */
  protected readonly links = computed(() => {
    const links = this.social();
    return links ? visibleSocialLinks(links) : [];
  });
}
