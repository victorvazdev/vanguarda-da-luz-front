import { ChangeDetectionStrategy, Component, ElementRef, inject, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, NavigationStart, Router, RouterOutlet } from '@angular/router';
import { filter, skip } from 'rxjs';
import { SiteFooter } from './layout/site-footer/site-footer';
import { SiteHeader } from './layout/site-header/site-header';
import { ConfirmDialogHost } from './shared/ui/confirm-dialog/confirm-dialog-host';
import { FlashService } from './shared/ui/flash/flash.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, SiteHeader, SiteFooter, ConfirmDialogHost],
  template: `
    <a class="skip-link" href="#conteudo" (click)="focusMain($event)">Pular para o conteúdo</a>
    <app-site-header />
    <main id="conteudo" class="site-main" tabindex="-1" #main>
      @if (flash.message(); as message) {
        <div class="container flash">
          <p class="notice flash__message" role="status">{{ message }}</p>
        </div>
      }
      <router-outlet />
    </main>
    <app-site-footer />
    <app-confirm-dialog-host />
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  private readonly main = viewChild.required<ElementRef<HTMLElement>>('main');
  protected readonly flash = inject(FlashService);

  constructor() {
    // O aviso vale para a página seguinte; some na próxima navegação.
    inject(Router)
      .events.pipe(
        filter((e) => e instanceof NavigationStart),
        takeUntilDestroyed(),
      )
      .subscribe(() => this.flash.clear());

    // Após cada navegação (exceto a primeira), leva o foco ao conteúdo para leitores de tela.
    inject(Router)
      .events.pipe(
        filter((e) => e instanceof NavigationEnd),
        skip(1),
        takeUntilDestroyed(),
      )
      .subscribe(() => this.main().nativeElement.focus({ preventScroll: true }));
  }

  protected focusMain(event: Event): void {
    event.preventDefault();
    this.main().nativeElement.focus();
  }
}
