import { signal } from '@angular/core';
import {
  DEFAULT_GUILD_INFO,
  DEFAULT_SOCIAL_LINKS,
  type GuildInfo,
  type GuildInfoInput,
  type SaveContentResult,
  type SocialLinks,
} from './site-content';
import { SiteContentService } from './site-content.service';

/** Substituto do SiteContentService para testes, sem Firebase. */
export function createSiteContentStub() {
  const guild = signal<GuildInfo | null | undefined>(DEFAULT_GUILD_INFO);
  const social = signal<SocialLinks | null | undefined>(DEFAULT_SOCIAL_LINKS);
  const stub = {
    guildState: guild,
    socialState: social,
    result: { ok: true } as SaveContentResult,
    savedGuild: [] as GuildInfoInput[],
    savedSocial: [] as SocialLinks[],
    guild: () => guild.asReadonly(),
    social: () => social.asReadonly(),
    saveGuild(input: GuildInfoInput) {
      stub.savedGuild.push(input);
      return Promise.resolve(stub.result);
    },
    saveSocial(links: SocialLinks) {
      stub.savedSocial.push(links);
      return Promise.resolve(stub.result);
    },
  };
  return stub;
}

export function provideSiteContentStub() {
  const stub = createSiteContentStub();
  return { stub, provider: { provide: SiteContentService, useValue: stub } };
}
