import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { filter } from 'rxjs';
import { SessionService } from '../../core/auth/session.service';
import { GUILD } from '../../core/content/guild-content';
import { PATHS } from '../../core/routing/paths';
import { navItemsFor, showsSignOut } from './nav';

@Component({
  selector: 'app-site-header',
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './site-header.html',
  styleUrl: './site-header.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:keydown.escape)': 'closeMenu()' },
})
export class SiteHeader {
  private readonly session = inject(SessionService);
  private readonly router = inject(Router);

  protected readonly guildName = GUILD.name;
  protected readonly homePath = PATHS.home;
  protected readonly items = computed(() => navItemsFor(this.session.access()));
  protected readonly canSignOut = computed(() => showsSignOut(this.session.access()));
  protected readonly menuOpen = signal(false);

  constructor() {
    this.router.events
      .pipe(
        filter((e) => e instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe(() => this.closeMenu());
  }

  protected toggleMenu(): void {
    this.menuOpen.update((open) => !open);
  }

  protected closeMenu(): void {
    this.menuOpen.set(false);
  }

  protected async signOut(): Promise<void> {
    await this.session.signOut();
    this.closeMenu();
    await this.router.navigateByUrl(PATHS.home);
  }
}
