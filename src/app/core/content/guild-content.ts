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
 * Página do addon da guilda (Vanguarda da Luz Guild Hub), conforme a descrição do addon
 * no CurseForge. Os formatos das strings trocadas com o site estão em
 * `docs/formato-string-addon.md` e `docs/formato-string-presencas.md`.
 */
export const ADDON = {
  name: 'Vanguarda da Luz Guild Hub',
  downloadUrl: 'https://www.curseforge.com/wow/addons/vanguarda-da-luz-guild-hub',
  intro:
    'O addon da Vanguarda da Luz no WoW Forever. Ele leva o calendário de eventos da guilda para o jogo, permite que os membros confirmem presença, mostra as profissões de todos e permite que os oficiais enviem alertas de raide.',
  membersOnly:
    'Todas as funções exigem estar na guilda Vanguarda da Luz. Quem está fora da guilda vê apenas uma janela de boas-vindas com o convite para o Discord da guilda. A interface é em português do Brasil.',
  features: [
    {
      title: 'Início',
      items: [
        'Mostra a Mensagem do Dia e as Informações da Guilda.',
        'Os links desses textos são clicáveis: um clique coloca o link numa caixa selecionada, pronto para copiar com Ctrl+C.',
        'Mostra o próximo evento, com quantos membros confirmaram, e quantos membros estão online.',
      ],
    },
    {
      title: 'Calendário de eventos',
      items: [
        'Calendário mensal com os eventos da guilda, os eventos do dia e os detalhes completos de cada evento.',
        'Os eventos são criados no site da guilda. Um oficial importa uma vez a string de exportação do site, e o addon envia os eventos a todos os membros pelo canal de addon da guilda. Quem entra no jogo depois recebe os eventos automaticamente.',
        'Os horários aparecem no horário de Brasília (UTC−3), com o horário do servidor ao lado quando for diferente.',
        'A importação confere a string (formato, checksum e versão) e mostra um resumo dos eventos novos, alterados e cancelados antes de aplicar qualquer mudança.',
      ],
    },
    {
      title: 'Presença',
      items: [
        'Os membros confirmam ou cancelam a presença nos próximos eventos com um clique.',
        'As respostas são compartilhadas entre os membros, e todos veem quem confirmou.',
        'Os oficiais geram uma string de presenças para colar de volta no site da guilda.',
        'Para a presença do jogo ficar no seu nome no site, cadastre em Minha conta o personagem do WoW Forever com o mesmo nome e sobrenome do jogo. Sem essa correspondência, ela entra como presença de visitante.',
      ],
    },
    {
      title: 'Profissões',
      items: [
        'Lista todos os membros da guilda com as profissões primárias e o nível de cada uma (por exemplo, "Ferraria 88/150").',
        'As profissões vêm do roster da guilda no jogo. Os níveis são compartilhados pelos membros que usam o addon; quem não usa aparece com a profissão, sem o nível.',
        'Filtra por profissão (do maior para o menor nível), mostra só os membros online (o padrão) e abre um sussurro para um membro com um clique.',
      ],
    },
    {
      title: 'Alertas de raide',
      items: [
        'Os oficiais enviam um alerta que aparece no centro da tela de todos os membros online, com o som de aviso de raide, e é publicado uma vez no chat da guilda.',
        'Os envios têm limite de frequência e nunca acontecem durante encontros em que a comunicação de addons é restrita.',
      ],
    },
    {
      title: 'Janela da guilda',
      items: [
        'Acrescenta as abas Eventos, Profissões e Administração à janela Guilda e Comunidades (J), abaixo das abas da Blizzard.',
      ],
    },
  ],
  permissions: [
    {
      who: 'Mestre da guilda e cargo Lorde',
      what: 'Importam eventos, exportam as presenças e enviam alertas de raide. Os outros membros só aceitam dados e alertas desses cargos, conferidos no roster da guilda.',
    },
    {
      who: 'Todos os membros',
      what: 'Calendário, presença, profissões e sussurros.',
    },
  ],
  commands: [
    { command: '/vdl', description: 'Abre a janela do addon na aba Início' },
    { command: '/vdl importar', description: 'Importa a string de exportação do site (oficiais)' },
    { command: '/vdl sincronizar', description: 'Pede à guilda os eventos mais recentes' },
    { command: '/vdl presencas', description: 'Gera a string de presenças para o site (oficiais)' },
    { command: '/vdl profissoes', description: 'Abre a lista de profissões' },
    { command: '/vdl alerta [texto]', description: 'Envia um alerta de raide (oficiais)' },
    { command: '/vdl minimapa', description: 'Mostra ou esconde o botão do minimapa' },
  ],
  minimap:
    'O botão do minimapa e o compartimento de addons abrem a janela do addon. O clique direito abre um menu de atalhos: Início, Eventos, Profissões, Sincronizar, Administração (só oficiais) e esconder o botão do minimapa.',
  privacy: [
    'O addon nunca acessa a internet. Os dados só trafegam pelo canal de addon da guilda, dentro do jogo.',
    'Tudo é salvo por conta, nas SavedVariables do addon.',
  ],
} as const;
