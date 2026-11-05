import { Injectable, inject } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { TitleStrategy, type RouterStateSnapshot } from '@angular/router';
import { GUILD } from '../content/guild-content';

/** Título da aba: "Página | Vanguarda da Luz". */
@Injectable()
export class GuildTitleStrategy extends TitleStrategy {
  private readonly title = inject(Title);

  override updateTitle(snapshot: RouterStateSnapshot): void {
    const page = this.buildTitle(snapshot);
    this.title.setTitle(page ? `${page} | ${GUILD.name}` : GUILD.name);
  }
}
