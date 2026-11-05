import { ChangeDetectionStrategy, Component } from '@angular/core';
import { GUILD, visibleSocialLinks } from '../../core/content/guild-content';

@Component({
  selector: 'app-site-footer',
  templateUrl: './site-footer.html',
  styleUrl: './site-footer.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SiteFooter {
  protected readonly guildName = GUILD.name;
  protected readonly links = visibleSocialLinks();
}
