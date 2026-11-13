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
} as const;

export const RULES = {
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
  { title: 'Aguarde o contato e avaliação', text: 'Acompanhe o resultado na sua conta.' },
] as const;

/**
 * Página do addon da guilda. O texto segue `docs/formato-string-addon.md` e
 * `docs/formato-string-presencas.md`; o que ainda não se conhece fica entre colchetes.
 */
export const ADDON = {
  downloadUrl: 'https://www.curseforge.com/wow/addons/vanguarda-da-luz-guild-hub',
  intro:
    'O addon da guilda no WoW Forever leva os eventos do site para o jogo e traz de volta para o site as presenças confirmadas no jogo.',
  features: [
    {
      title: 'Eventos do site no jogo',
      text: 'Os administradores exportam do site os próximos eventos do WoW Forever. Um oficial importa a exportação no jogo, e o addon cria, atualiza e cancela esses eventos.',
    },
    {
      title: 'Presença confirmada no jogo',
      text: 'Com o addon, cada membro confirma ou cancela a presença com o personagem que está jogando. As respostas são sincronizadas entre os membros pelo canal da guilda.',
    },
    {
      title: 'Presenças de volta no site',
      text: 'Um Grão-Lorde ou um Lorde gera no addon a string de presenças, e os administradores a importam no site. As presenças aparecem na lista de confirmados do evento, marcadas como vindas do jogo.',
    },
  ],
  notes: [
    'O addon é do WoW Forever: eventos do Retail não vão para o jogo.',
    'Para a presença do jogo ficar no seu nome, cadastre em Minha conta o personagem do WoW Forever com o mesmo nome e sobrenome do jogo. Sem essa correspondência, ela entra como presença de visitante.',
  ],
  install: '[INSTRUÇÕES DE INSTALAÇÃO E USO DO ADDON]',
} as const;
