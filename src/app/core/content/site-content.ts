// Conteúdo editável no painel administrativo (informações da guilda e redes sociais).
// Sem Firebase nem Angular: é importado pelo rodapé de todas as páginas, então a leitura
// e a gravação ficam em site-content.store.ts, carregado sob demanda.
import { RULESETS, type Ruleset } from '../models/wow';

// ---------- Informações da guilda (site/guild) ----------

export type Faction = 'alianca' | 'horda';

export const FACTIONS: readonly { id: Faction; label: string }[] = [
  { id: 'alianca', label: 'Aliança' },
  { id: 'horda', label: 'Horda' },
];

export const factionLabel = (id: Faction) => FACTIONS.find((f) => f.id === id)?.label ?? id;

export interface GuildInfoInput {
  history: string;
  values: string;
  faction: Faction;
  retailServer: string;
  foreverRulesets: Ruleset[];
}

export interface GuildInfo extends GuildInfoInput {
  /** `null` enquanto nenhum administrador salvou as informações. */
  updatedAt: Date | null;
}

/** Tamanhos máximos (iguais aos de firestore.rules). */
export const GUILD_INFO_LIMITS = { history: 5000, values: 2000, retailServer: 40 } as const;

/** Antes do primeiro salvamento: somente o que já é conhecido; o resto não é exibido. */
export const DEFAULT_GUILD_INFO: GuildInfo = {
  history: '',
  values: '',
  faction: 'alianca',
  retailServer: '',
  foreverRulesets: ['normal', 'jxj'],
  updatedAt: null,
};

const isRuleset = (v: unknown): v is Ruleset => RULESETS.some((r) => r.id === v);
const text = (v: unknown) => (typeof v === 'string' ? v : '');

/** Timestamp do Firestore (ou Date) → Date. */
function toDate(value: unknown): Date | null {
  if (value instanceof Date) return value;
  const ts = value as { toDate?: () => Date } | null;
  return typeof ts?.toDate === 'function' ? ts.toDate() : null;
}

export function guildInfoFromData(data: Record<string, unknown> | undefined): GuildInfo {
  if (!data) return DEFAULT_GUILD_INFO;
  const rulesets = Array.isArray(data['foreverRulesets'])
    ? data['foreverRulesets'].filter(isRuleset)
    : [];
  return {
    history: text(data['history']),
    values: text(data['values']),
    faction: data['faction'] === 'horda' ? 'horda' : 'alianca',
    retailServer: text(data['retailServer']),
    // Sempre na ordem de RULESETS, sem repetições.
    foreverRulesets: RULESETS.map((r) => r.id).filter((id) => rulesets.includes(id)),
    updatedAt: toDate(data['updatedAt']),
  };
}

/** "Normal e JxJ", "Normal" ou "" (nenhum). */
export function rulesetsLabel(ids: readonly Ruleset[]): string {
  const labels = RULESETS.filter((r) => ids.includes(r.id)).map((r) => r.label);
  return labels.length > 1
    ? `${labels.slice(0, -1).join(', ')} e ${labels[labels.length - 1]}`
    : (labels[0] ?? '');
}

// ---------- Redes sociais (site/social) ----------

export type SocialNetworkId = 'discord' | 'whatsapp' | 'instagram' | 'youtube';

export interface SocialNetwork {
  id: SocialNetworkId;
  name: string;
  /** Frase curta sobre o uso da rede (seção "Junte-se à comunidade" da página inicial). */
  description: string;
  /** Texto do botão de ação. */
  action: string;
  /** Em destaque: cartão maior com botão dourado. */
  featured: boolean;
}

export const SOCIAL_NETWORKS: readonly SocialNetwork[] = [
  {
    id: 'discord',
    name: 'Discord',
    description: 'Nosso ponto de encontro: chamadas de voz, avisos e organização dos eventos.',
    action: 'Entrar no Discord',
    featured: true,
  },
  {
    id: 'whatsapp',
    name: 'WhatsApp',
    description: 'Avisos rápidos e conversa do dia a dia com a guilda.',
    action: 'Entrar no grupo',
    featured: true,
  },
  {
    id: 'instagram',
    name: 'Instagram',
    description: 'Fotos, artes e momentos da guilda.',
    action: 'Seguir no Instagram',
    featured: false,
  },
  {
    id: 'youtube',
    name: 'YouTube',
    description: 'Vídeos de raides, eventos e guias.',
    action: 'Ver o canal',
    featured: false,
  },
];

/** `null` = rede sem link cadastrado; não é exibida. */
export type SocialLinks = Record<SocialNetworkId, string | null>;

export const SOCIAL_URL_MAX = 300;

/** Links oficiais usados até um administrador salvar os links no painel. */
export const DEFAULT_SOCIAL_LINKS: SocialLinks = {
  discord: 'https://discord.gg/uGyPjtEsBw',
  whatsapp: 'https://chat.whatsapp.com/CRwgWovy7T11aAI0mtrcfe',
  instagram: 'https://www.instagram.com/vanguardaluz/',
  youtube: 'https://www.youtube.com/@VanguardaDaLuz',
};

/** URL completa com https:// e um domínio (igual à validação de firestore.rules). */
export function isValidSocialUrl(value: string): boolean {
  if (value.length > SOCIAL_URL_MAX || !/^https:\/\/[^\s/?#]+\.[^\s/?#]+(?:[/?#]\S*)?$/.test(value))
    return false;
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

export function socialLinksFromData(data: Record<string, unknown> | undefined): SocialLinks {
  if (!data) return DEFAULT_SOCIAL_LINKS;
  const links = (data['links'] ?? {}) as Record<string, unknown>;
  return Object.fromEntries(
    SOCIAL_NETWORKS.map(({ id }) => {
      const url = text(links[id]).trim();
      return [id, url && isValidSocialUrl(url) ? url : null];
    }),
  ) as SocialLinks;
}

/** Somente redes com link cadastrado (critério "Redes sem link não são exibidas"). */
export function visibleSocialLinks(links: SocialLinks): (SocialNetwork & { url: string })[] {
  return SOCIAL_NETWORKS.flatMap((network) => {
    const url = links[network.id];
    return url ? [{ ...network, url }] : [];
  });
}

export function cleanGuildInfo(input: GuildInfoInput): GuildInfoInput {
  return {
    history: input.history.trim(),
    values: input.values.trim(),
    faction: input.faction,
    retailServer: input.retailServer.trim(),
    foreverRulesets: RULESETS.map((r) => r.id).filter((id) => input.foreverRulesets.includes(id)),
  };
}

export function isValidGuildInfo(input: GuildInfoInput): boolean {
  return (
    input.history.length <= GUILD_INFO_LIMITS.history &&
    input.values.length <= GUILD_INFO_LIMITS.values &&
    input.retailServer.length <= GUILD_INFO_LIMITS.retailServer &&
    FACTIONS.some((f) => f.id === input.faction)
  );
}

/** Remove espaços; link vazio vira `null`. */
export function cleanSocialLinks(links: SocialLinks): SocialLinks {
  return Object.fromEntries(
    SOCIAL_NETWORKS.map(({ id }) => [id, links[id]?.trim() || null]),
  ) as SocialLinks;
}

export const areValidSocialLinks = (links: SocialLinks) =>
  Object.values(links).every((url) => url === null || isValidSocialUrl(url));

// ---------- Resultado da gravação ----------

export type SaveContentError = 'invalid' | 'not-allowed' | 'network' | 'unknown';
export type SaveContentResult = { ok: true } | { ok: false; error: SaveContentError };

export const SAVE_CONTENT_ERRORS: Record<SaveContentError, string> = {
  invalid: 'Revise os campos destacados.',
  'not-allowed': 'Você não tem permissão para esta ação.',
  network: 'Não foi possível conectar. Verifique sua internet e tente novamente.',
  unknown: 'Não foi possível salvar. Tente novamente.',
};
