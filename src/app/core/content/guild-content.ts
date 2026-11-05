/**
 * Conteúdo público fixo da guilda. Textos entre colchetes ainda estão pendentes e devem
 * ser substituídos pelo conteúdo oficial. História, valores, facção, servidor, rulesets
 * e redes sociais são editados no painel administrativo (ver site-content.ts).
 */
export const GUILD = {
  name: 'Vanguarda da Luz',
  tagline: 'Guilda de World of Warcraft',
  intro:
    'Conheça a guilda, leia as regras e envie sua candidatura. Depois de aprovado, você acompanha os eventos e confirma sua presença pelo site.',
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
