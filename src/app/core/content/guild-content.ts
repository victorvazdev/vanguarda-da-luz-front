/**
 * Conteúdo público da guilda. Textos entre colchetes ainda estão pendentes
 * e devem ser substituídos pelo conteúdo oficial.
 */
export const GUILD = {
  name: 'Vanguarda da Luz',
  tagline: 'Guilda de World of Warcraft',
  intro:
    'Conheça a guilda, leia as regras e envie sua candidatura. Depois de aprovado, você acompanha os eventos e confirma sua presença pelo site.',
  history: '[HISTÓRIA DA GUILDA: como surgiu, quem fundou e o que a Vanguarda da Luz faz no jogo.]',
  values: '[VALORES DA GUILDA]',
  faction: 'Aliança',
  /** World of Warcraft Retail. */
  server: '[NOME DO SERVIDOR]',
  /** World of Warcraft Forever: no lugar de servidores, rulesets. */
  foreverRulesets: 'Normal e JxJ',
  requirements: '[REQUISITOS PARA ENTRAR NA GUILDA]',
} as const;

export const RULES = {
  updatedAt: '[DATA]',
  items: [
    'Fiel devoção à Aliança e à Vanguarda da Luz.',
    'Respeito absoluto a todos os irmãos e irmãs que caminham pela Luz.',
    'Caso tenha muitos alts (mais que 10) mantenha-os na guilda para alts. Consulte um Oficial para essa operação.',
    'As patentes são conquistadas por mérito, dedicação e serviço à guilda.',
    'Para participar do Core comunique com um Lorde ou Grão-Lorde apresentando o nome do seu personagem e nome do discord.',
    'É proibido divulgar outras guildas dentro dos domínios da Vanguarda da Luz (participar de outras guildas não é proibido).',
    'Em eventos, o uso do Tabardo da Vanguarda é obrigatório.',
    'Qualquer duelo fora da arena (x1) entre membros deve ser anunciado no chat.',
    'Sempre que possível, ajude iniciantes ou membros em dificuldade.',
    'Diversão acima de tudo. Qualquer problema ou insatisfação deve ser levado diretamente ao Grão-Lorde.',
  ],
} as const;

export const JOIN_STEPS = [
  { title: 'Leia as regras', text: 'Veja o que a guilda espera de cada integrante.' },
  { title: 'Crie sua conta', text: 'Informe nome de usuário, e-mail e senha.' },
  { title: 'Envie sua candidatura', text: 'Conte qual é seu personagem e por que quer entrar.' },
  { title: 'Aguarde a avaliação', text: 'Acompanhe o resultado na sua conta.' },
] as const;

export interface SocialLink {
  name: string;
  /** `null` = rede sem link cadastrado; não é exibida. */
  url: string | null;
}

export const SOCIAL_LINKS: readonly SocialLink[] = [
  { name: 'Discord', url: 'https://discord.gg/uGyPjtEsBw' },
  { name: 'WhatsApp', url: 'https://chat.whatsapp.com/CRwgWovy7T11aAI0mtrcfe' },
  { name: 'Instagram', url: 'https://www.instagram.com/vanguardaluz/' },
  { name: 'YouTube', url: 'https://www.youtube.com/@VanguardaDaLuz' },
];

/** Somente redes com link cadastrado (critério "Redes sem link não são exibidas"). */
export function visibleSocialLinks(
  links: readonly SocialLink[] = SOCIAL_LINKS,
): (SocialLink & { url: string })[] {
  return links.filter((l): l is SocialLink & { url: string } => !!l.url?.trim());
}
