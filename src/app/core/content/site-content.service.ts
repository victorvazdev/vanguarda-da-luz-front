import { Injectable, inject, signal } from '@angular/core';
import { SessionService } from '../auth/session.service';
import { FirestoreClient } from '../firebase/firebase.providers';
import type { GuildInfo, GuildInfoInput, SaveContentResult, SocialLinks } from './site-content';

/** `undefined` = carregando; `null` = não foi possível carregar. */
type Loaded<T> = T | null | undefined;

/**
 * Conteúdo editável no painel (informações da guilda e redes sociais). Cada documento tem
 * um único listener, iniciado na primeira leitura e compartilhado pelo site inteiro: o que
 * um administrador salva aparece na hora em todas as páginas abertas.
 */
@Injectable({ providedIn: 'root' })
export class SiteContentService {
  private readonly firestore = inject(FirestoreClient);
  private readonly session = inject(SessionService);

  private readonly guildState = signal<Loaded<GuildInfo>>(undefined);
  private readonly socialState = signal<Loaded<SocialLinks>>(undefined);
  private guildStarted = false;
  private socialStarted = false;

  /** Informações da guilda (página "A guilda"). */
  guild() {
    if (!this.guildStarted) {
      this.guildStarted = true;
      void this.listen((store, db) =>
        store.watchGuildInfo(
          db,
          (info) => this.guildState.set(info),
          () => this.guildState.set(null),
        ),
      ).catch(() => this.guildState.set(null));
    }
    return this.guildState.asReadonly();
  }

  /** Links das redes sociais (rodapé). */
  social() {
    if (!this.socialStarted) {
      this.socialStarted = true;
      void this.listen((store, db) =>
        store.watchSocialLinks(
          db,
          (links) => this.socialState.set(links),
          () => this.socialState.set(null),
        ),
      ).catch(() => this.socialState.set(null));
    }
    return this.socialState.asReadonly();
  }

  async saveGuild(input: GuildInfoInput): Promise<SaveContentResult> {
    const [store, db] = await this.load();
    return store.saveGuildInfo(db, this.uid(), input);
  }

  async saveSocial(links: SocialLinks): Promise<SaveContentResult> {
    const [store, db] = await this.load();
    return store.saveSocialLinks(db, this.uid(), links);
  }

  private load() {
    return Promise.all([import('./site-content.store'), this.firestore.get()]);
  }

  private async listen(
    start: (
      store: typeof import('./site-content.store'),
      db: Awaited<ReturnType<FirestoreClient['get']>>,
    ) => void,
  ): Promise<void> {
    const [store, db] = await this.load();
    start(store, db);
  }

  private uid(): string {
    return this.session.user()?.uid ?? '';
  }
}
