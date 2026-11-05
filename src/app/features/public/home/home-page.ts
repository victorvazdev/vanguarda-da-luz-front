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
}
