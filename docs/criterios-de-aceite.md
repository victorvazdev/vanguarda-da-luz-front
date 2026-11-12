# Critérios de Aceite — Vanguarda da Luz

Nov 5, 2026 · @Victor Vaz de Oliveira

## Visão geral

As 32 histórias abaixo têm critérios verificáveis, agrupados por área. Uma história só está pronta quando todos os seus critérios forem atendidos.

| Perfil | Situação | Acesso |
| --- | --- | --- |
| Visitante | Sem conta ou não autenticado | Páginas públicas (inclusive o calendário de eventos), confirmação de presença como visitante, cadastro e login |
| Usuário cadastrado | Autenticado e aguardando aprovação | Páginas públicas, candidatura e própria conta |
| Membro | Aprovado por um administrador | Funcionalidades de membros |
| Administrador | Permissão administrativa | Funcionalidades de membros e área administrativa |

**Jogos**

A guilda está presente em duas versões de World of Warcraft:

| Jogo | Personagem | Onde joga | Classes |
| --- | --- | --- | --- |
| World of Warcraft Retail | Nome | Servidor | As 13 classes atuais |
| World of Warcraft Forever | Nome e sobrenome | Ruleset: Normal ou JxJ | As 9 classes do Classic |

**Premissas a validar**

- O cadastro cria uma conta pendente; ela não concede acesso imediato às funcionalidades de membros.
- A candidatura é enviada por um usuário cadastrado e aprovada na mesma fila dos cadastros.
- Cada usuário tem uma candidatura por vez, para um dos dois jogos. Ao ser aprovada, ela vira o personagem principal do membro.
- A recusa vale para a candidatura: a conta continua pendente e o usuário pode enviar uma nova candidatura.
- Somente uma conta desativada é impedida de entrar.
- A senha tem no mínimo 8 caracteres.
- O link de recuperação de senha vale por 1 hora e pode ser usado uma única vez.
- A listagem de artigos exibe 10 itens por página.
- O site mantém ao menos um administrador ativo.
- O BattleTag é um dado privado da conta: somente a própria pessoa e os administradores o veem.
- Cada personagem tem no máximo 2 profissões primárias, nos dois jogos; o WoW Forever (Classic) não tem Escrivania nem Joalheria.

## Conteúdo público da guilda

### Ver como ingressar

**Como visitante**, quero ver informações de como ingressar, para que eu possa seguir os passos e fazer parte da guilda.

- [ ] A página de ingresso pode ser acessada sem login.
- [ ] A página apresenta os passos de ingresso em ordem.
- [ ] A página informa que a entrada depende da aprovação de um administrador.
- [ ] Um botão leva ao cadastro quando o visitante não está autenticado.
- [ ] Um botão leva à candidatura quando o usuário cadastrado está autenticado.

### Ver redes sociais

**Como visitante**, quero ver quais são as redes sociais, para que eu possa aprender mais sobre a guilda por esses meios.

- [ ] Os links das redes sociais ficam visíveis no rodapé de todas as páginas públicas.
- [ ] A página inicial apresenta a seção "Junte-se à comunidade" logo abaixo da história da guilda.
- [ ] Na seção, Discord e WhatsApp aparecem em destaque, com cartões maiores e botão dourado; Instagram e YouTube aparecem em segundo plano, com cartões menores e botão de contorno.
- [ ] Na seção, cada rede exibe o logotipo, o nome, uma frase curta sobre seu uso e um botão de ação.
- [ ] Cada link identifica a rede por nome ou ícone com texto alternativo.
- [ ] Cada link abre o perfil oficial correspondente em uma nova aba.
- [ ] Os links exibidos são os definidos no painel administrativo.
- [ ] Redes sem link cadastrado não são exibidas.

### Conhecer a guilda

**Como visitante**, quero conhecer a história, os valores e onde a guilda joga, para que eu possa decidir se quero fazer parte dela.

- [ ] A página pode ser acessada sem login e a partir do menu principal.
- [ ] A página apresenta a história, os valores, a facção, o servidor no Retail e os rulesets no WoW Forever.
- [ ] As informações exibidas são as definidas no painel administrativo.
- [ ] Uma informação sem conteúdo cadastrado não é exibida.
- [ ] A página oferece um link para as instruções de ingresso.

### Ler as regras

**Como visitante**, quero ler as regras da guilda, para que eu saiba o que é esperado de um integrante.

- [ ] A página de regras pode ser acessada sem login.
- [ ] As regras são exibidas em seções ou itens identificáveis.
- [ ] A página de ingresso oferece um link para as regras.
- [ ] No cadastro e na candidatura, o link das regras abre um modal com as regras completas, sem sair da página e sem perder os dados já preenchidos.
- [ ] O modal fecha pelo botão, pela tecla Esc e por um clique no fundo.
- [ ] Ao abrir, o foco entra no modal e permanece nele enquanto estiver aberto; ao fechar, volta ao link.
- [ ] O texto das regras é o mesmo da página de regras, mantido em um único lugar.

### Ver a lista de membros

**Como visitante**, quero ver a lista de membros, para que eu possa conhecer quem faz parte da guilda.

- [ ] A lista pode ser acessada sem login.
- [ ] Somente membros ativos e administradores são exibidos.
- [ ] Cada item mostra o nome do personagem principal, a classe, a função e o cargo na guilda.
- [ ] E-mail e outros dados da conta não são exibidos.
- [ ] É possível buscar por nome e filtrar por classe ou função.
- [ ] Uma mensagem é exibida quando nenhum resultado é encontrado.

### Ver membros em destaque

**Como visitante**, quero visualizar os membros em destaque, para que eu possa conhecer quem são os melhores.

- [ ] A seção pode ser acessada sem login.
- [ ] Somente membros marcados como destaque são exibidos.
- [ ] Cada destaque mostra o nome do personagem, a classe, a função e o motivo do reconhecimento.
- [ ] A seção não é exibida quando não há destaques ativos.

### Ver a lista de procurados

**Como visitante**, quero visualizar uma lista de procurados, para que eu possa saber quem é o procurado e sua recompensa.

- [ ] A lista pode ser acessada sem login.
- [ ] Somente procurados ativos são exibidos.
- [ ] Cada item mostra o nome, o motivo e a recompensa.
- [ ] A recompensa informa o valor e a moeda ou o item oferecido.
- [ ] Uma mensagem é exibida quando não há procurados ativos.

## Blog

### Ler o blog de artigos

**Como visitante**, quero ler o blog de artigos, para saber das últimas novidades da guilda.

- [ ] O blog pode ser acessado sem login.
- [ ] A listagem exibe somente artigos publicados, do mais recente para o mais antigo.
- [ ] Cada item mostra o título, o resumo, a categoria e a data de publicação.
- [ ] A listagem exibe 10 artigos por página e oferece paginação.
- [ ] Ao abrir um artigo, o visitante vê o conteúdo completo, a categoria, o autor e a data.
- [ ] Um artigo removido ou inexistente exibe uma página de conteúdo não encontrado.
- [ ] Uma mensagem é exibida quando ainda não há artigos publicados.

### Ler categorias de artigos

**Como visitante**, quero ler diferentes categorias de artigos, para aprender mais de conteúdos específicos.

- [ ] O blog exibe as categorias que têm ao menos um artigo publicado.
- [ ] Ao selecionar uma categoria, somente os artigos dela são listados.
- [ ] A categoria selecionada fica destacada e pode ser limpa para voltar à lista completa.
- [ ] A categoria possui uma URL própria que pode ser compartilhada.
- [ ] A ordenação e a paginação continuam funcionando dentro da categoria.

## Conta e acesso

### Cadastrar-se

**Como visitante**, quero me cadastrar, para que eu possa participar das funcionalidades de membros.

- [ ] O formulário solicita nome de usuário, e-mail, senha e confirmação de senha.
- [ ] Campos obrigatórios vazios ou inválidos exibem mensagens junto ao campo.
- [ ] O cadastro é bloqueado se o e-mail ou o nome de usuário já estiver em uso.
- [ ] A senha deve ter no mínimo 8 caracteres e coincidir com a confirmação.
- [ ] A senha é armazenada somente em formato de hash.
- [ ] Após o envio, a conta fica com a situação pendente.
- [ ] O usuário é informado de que precisa de aprovação para acessar as funcionalidades de membros.

### Entrar na conta

**Como visitante**, quero entrar na minha conta, para que eu possa participar das funcionalidades de membros.

- [ ] O login solicita e-mail e senha.
- [ ] Credenciais válidas autenticam o usuário e o levam à página adequada ao seu perfil.
- [ ] Credenciais inválidas exibem uma mensagem genérica, sem indicar qual dado está incorreto.
- [ ] Uma conta pendente entra, mas não acessa as funcionalidades de membros.
- [ ] Uma conta desativada não entra e recebe uma mensagem explicativa.
- [ ] Uma conta desativada durante o uso tem a sessão encerrada e recebe a mesma mensagem.
- [ ] Um usuário com candidatura recusada entra e vê o resultado na própria conta.
- [ ] Tentativas repetidas de login são limitadas.
- [ ] A página oferece um link para recuperar a senha.

### Recuperar a senha

**Como usuário cadastrado**, quero recuperar minha senha, para que eu possa voltar a acessar minha conta caso a esqueça.

- [ ] O usuário solicita a recuperação informando o e-mail.
- [ ] A resposta é a mesma para e-mails cadastrados e não cadastrados.
- [ ] Um e-mail cadastrado recebe um link de redefinição válido por 1 hora.
- [ ] O link só pode ser usado uma vez.
- [ ] Um link expirado ou inválido exibe uma mensagem e permite solicitar outro.
- [ ] A nova senha segue as mesmas regras do cadastro.
- [ ] Após a alteração, a senha antiga deixa de funcionar.

### Enviar candidatura

**Como usuário cadastrado**, quero enviar uma candidatura, para que eu possa solicitar minha entrada na guilda pelo site.

- [ ] Somente um usuário autenticado e pendente pode enviar a candidatura.
- [ ] O usuário escolhe o jogo: World of Warcraft Retail ou World of Warcraft Forever.
- [ ] No Retail, o formulário solicita o nome do personagem e o servidor.
- [ ] No WoW Forever, o formulário solicita o nome e o sobrenome do personagem e o ruleset, Normal ou JxJ.
- [ ] Nos dois jogos, o formulário solicita a classe, a função, as profissões, o BattleTag e o motivo do interesse.
- [ ] A classe e a função são escolhidas entre as opções válidas do jogo escolhido.
- [ ] As profissões são escolhidas entre as profissões primárias do jogo escolhido, no máximo 2; é possível informar que o personagem não tem profissão.
- [ ] O BattleTag é obrigatório e segue o formato Nome#1234 (3 a 12 letras ou números, começando por letra, e 4 a 6 dígitos); vazio ou inválido bloqueia o envio e exibe a mensagem junto ao campo, também validado no servidor.
- [ ] O BattleTag fica na conta: a candidatura parte do BattleTag já informado, e um novo envio o atualiza.
- [ ] O BattleTag não aparece em páginas públicas nem nas listas vistas pelos membros.
- [ ] O usuário deve confirmar que leu as regras antes de enviar.
- [ ] Campos obrigatórios vazios exibem mensagens junto ao campo.
- [ ] Após o envio, a candidatura aparece para os administradores como pendente.
- [ ] O usuário consegue acompanhar se a candidatura está pendente, aprovada ou recusada.
- [ ] Não é possível enviar uma nova candidatura enquanto houver outra pendente.
- [ ] Após uma recusa, o usuário pode enviar uma nova candidatura, partindo dos dados anteriores, e a decisão anterior fica registrada.

### Editar perfil e personagens

**Como membro**, quero editar meu perfil e meus personagens, para que a guilda saiba minha classe, função e nível e para que meus dados de acesso fiquem atualizados.

**Perfil e dados da conta**

- [ ] O perfil fica em "Minha conta", que aparece no menu para membros e administradores.
- [ ] O membro pode editar somente o próprio perfil.
- [ ] O nome de usuário pode ser alterado seguindo as regras do cadastro.
- [ ] Um nome de usuário em uso por outra pessoa é recusado.
- [ ] Após a troca, o nome antigo fica livre para outras pessoas e o novo aparece nas listas da guilda.
- [ ] O e-mail pode ser alterado mediante a senha atual.
- [ ] O novo e-mail recebe um link de confirmação, e a troca só vale depois que o link for aberto.
- [ ] O e-mail anterior é avisado da troca e pode desfazê-la.
- [ ] Depois da troca de e-mail, a sessão é encerrada e o usuário entra novamente com o novo e-mail.
- [ ] A senha pode ser alterada mediante a senha atual, e a nova senha segue as regras do cadastro.
- [ ] Uma senha atual incorreta impede a alteração do e-mail ou da senha e exibe uma mensagem junto ao campo.
- [ ] O BattleTag pode ser informado ou alterado em "Minha conta", seguindo o mesmo formato da candidatura; um formato inválido exibe a mensagem junto ao campo e é recusado também no servidor.
- [ ] Somente a própria pessoa altera o seu BattleTag.
- [ ] Um usuário cadastrado que aguarda aprovação também pode alterar o nome de usuário, o BattleTag, o e-mail e a senha.
- [ ] Uma conta desativada não altera nenhum dado.

**Personagens**

- [ ] O membro pode adicionar, editar e remover personagens.
- [ ] Cada personagem possui jogo, nome, classe, função, profissões e nível; no Retail, também o servidor; no WoW Forever, também o sobrenome e o ruleset.
- [ ] As profissões seguem as mesmas regras da candidatura; personagens salvos antes da escolha de profissões continuam válidos e informam as profissões ao serem editados.
- [ ] A classe e a função são escolhidas entre as opções válidas do jogo.
- [ ] O nível aceita somente números inteiros de 1 até o limite do jogo: 90 no Retail e 60 no WoW Forever.
- [ ] O personagem da candidatura aprovada é o primeiro personagem principal; o perfil pede que o membro informe o nível dele.
- [ ] Sempre há um personagem marcado como principal, e o membro pode escolher outro personagem cadastrado como principal.
- [ ] Enquanto o nível do personagem da candidatura não for informado, não é possível escolher outro personagem como principal.
- [ ] O personagem principal não pode ser removido; para removê-lo, o membro escolhe outro principal antes.
- [ ] A remoção de um personagem exige confirmação.
- [ ] As alterações salvas aparecem imediatamente no perfil e na lista de membros.

### Excluir a conta

**Como usuário cadastrado ou membro**, quero excluir minha conta, para que meus dados pessoais deixem de ser guardados pela guilda.

- [ ] "Minha conta" oferece a opção "Excluir conta" para contas pendentes e ativas.
- [ ] Um modal explica o que será removido e o que será mantido.
- [ ] A exclusão exige confirmação explícita e a senha atual (nova autenticação), também verificada no servidor.
- [ ] São removidos o login no Firebase Authentication, o e-mail, o nome de usuário, o BattleTag, a candidatura (com o motivo) e os demais dados privados da conta.
- [ ] O nome de usuário e o e-mail ficam livres para uma nova conta.
- [ ] As presenças em eventos futuros e ativos são canceladas e saem das listas de confirmados.
- [ ] Os personagens e o histórico de eventos passados são mantidos, sem nome de usuário, e-mail ou outro dado pessoal; nos eventos passados, a presença aparece como "Conta excluída", com o personagem principal.
- [ ] As telas de histórico continuam funcionando depois da exclusão.
- [ ] O último administrador ativo não pode excluir a conta e recebe uma mensagem explicando o motivo.
- [ ] Após a exclusão, a sessão é encerrada e a pessoa vai para a página inicial, que informa que a conta foi excluída.
- [ ] Se a exclusão for interrompida, a conta perde o acesso de membro e, no próximo login, só é possível concluir a exclusão, que continua de onde parou.
- [ ] Somente a própria pessoa pode excluir a sua conta; tentativas de outras pessoas, inclusive administradores, são recusadas pelo servidor.

## Eventos

### Acessar o calendário de eventos

**Como membro ou visitante**, quero acessar um calendário de eventos, para que eu possa visualizar quais dias foram programados para algum evento.

- [ ] O calendário e o detalhe dos eventos são públicos: visitantes, usuários pendentes, membros e administradores os acessam.
- [ ] O menu de visitantes e de usuários pendentes inclui o calendário.
- [ ] O calendário abre no mês atual e permite navegar entre meses.
- [ ] Os dias com eventos ficam identificados.
- [ ] Ao selecionar um evento, a pessoa vê o título, a data, o horário, a versão do jogo, a descrição e o organizador.
- [ ] A lista de eventos do mês identifica a versão do jogo de cada evento.
- [ ] Datas e horários são exibidos no fuso definido para a guilda e esse fuso fica identificado.
- [ ] Eventos cancelados são identificados como cancelados.

### Confirmar presença

**Como membro**, quero acessar um calendário, para que eu possa confirmar minha presença para algum evento.

- [ ] O detalhe de um evento futuro e ativo oferece a ação de confirmar presença.
- [ ] O membro escolhe com qual dos seus personagens confirma; somente personagens da versão do jogo do evento são oferecidos, e o personagem principal vem escolhido quando é dessa versão.
- [ ] Sem personagem da versão do jogo do evento, o detalhe orienta o membro a adicionar um em Minha conta.
- [ ] A confirmação fica registrada para o membro autenticado, com o personagem escolhido; o servidor recusa personagens de outra versão do jogo ou que não sejam do membro.
- [ ] Após confirmar, o evento indica que a presença do membro está confirmada e com qual personagem.
- [ ] O membro não pode confirmar a presença duas vezes no mesmo evento.
- [ ] Não é possível confirmar presença em eventos passados ou cancelados.
- [ ] O detalhe do evento mostra quantas vagas restam; quando o limite de confirmados é atingido, o evento aparece como lotado e não aceita novas confirmações.

### Cancelar presença

**Como membro**, quero cancelar minha presença em um evento, para que os organizadores saibam que não poderei participar.

- [ ] A ação fica disponível somente quando há uma presença confirmada em um evento futuro.
- [ ] O membro precisa confirmar o cancelamento antes de concluí-lo.
- [ ] Após o cancelamento, o nome do membro sai da lista de confirmados.
- [ ] O membro pode confirmar presença novamente enquanto o evento estiver futuro e ativo.

### Confirmar presença como visitante

**Como visitante**, quero confirmar minha presença em um evento da guilda, para que os organizadores saibam que vou participar mesmo sem ser membro.

- [ ] Visitantes (sem conta ou não autenticados) e usuários pendentes podem confirmar presença em eventos futuros e ativos, quando o administrador permitir.
- [ ] O visitante confirma com um personagem da versão do jogo do evento, sem escolher o jogo; o servidor recusa personagens de outra versão.
- [ ] Em eventos do WoW Forever, o visitante informa o nome e o sobrenome do personagem; em eventos do Retail, o nome e o reino.
- [ ] Eventos criados antes da escolha da versão do jogo aceitam personagens dos dois jogos (o visitante escolhe o jogo; o membro, qualquer personagem seu) até o administrador definir a versão.
- [ ] Os nomes têm de 2 a 12 letras, sem espaços ou números, e são gravados como no jogo (só a primeira letra maiúscula); o reino tem até 40 caracteres, sem "/".
- [ ] Após confirmar, o evento indica a presença confirmada com o personagem informado; neste navegador, a confirmação continua indicada ao voltar à página.
- [ ] O mesmo personagem não pode confirmar duas vezes no mesmo evento.
- [ ] Visitantes ocupam vagas do mesmo limite de confirmados dos membros; com o evento lotado, o formulário não é oferecido.
- [ ] Não é possível confirmar presença em eventos passados ou cancelados.
- [ ] Quando a confirmação de visitantes está desativada no evento, o detalhe informa que ela é exclusiva para membros e oferece o botão para fazer parte da guilda.
- [ ] Membros confirmam presença com a própria conta, não como visitantes.
- [ ] O visitante não cancela a própria presença; ele pede o cancelamento à administração.

## Administração

Todas as ações desta seção exigem permissão de administrador, verificada no servidor. Uma tentativa sem permissão é recusada e não altera os dados.

### Editar informações da guilda

**Como administrador**, quero escrever a história, os valores, a facção e onde a guilda joga no painel administrativo, para que a página de apresentação fique atualizada sem alterar o código do site.

- [ ] O painel administrativo oferece um formulário com a história, os valores, a facção, o nome do servidor no Retail e os rulesets no WoW Forever.
- [ ] O formulário abre com as informações atuais.
- [ ] A história e os valores aceitam texto com parágrafos e formatação básica.
- [ ] A facção é escolhida entre Aliança e Horda.
- [ ] O nome do servidor no Retail é um texto livre.
- [ ] Os rulesets no WoW Forever são escolhidos entre Normal e JxJ, e mais de um pode ser marcado.
- [ ] As alterações salvas aparecem imediatamente na página de apresentação.
- [ ] A página de apresentação informa a data da última atualização e o administrador responsável fica registrado.

### Gerenciar redes sociais

**Como administrador**, quero modificar os links das redes sociais no painel administrativo, para que o rodapé e a página inicial apontem sempre para os perfis oficiais da guilda.

- [ ] O painel administrativo lista as redes sociais disponíveis com o link atual de cada uma.
- [ ] O administrador pode adicionar, alterar ou apagar o link de cada rede.
- [ ] O link deve ser uma URL válida começando com https://; um link inválido exibe uma mensagem junto ao campo e impede o salvamento.
- [ ] Uma rede com o link apagado deixa de aparecer no rodapé e na página inicial.
- [ ] As alterações salvas aparecem imediatamente no rodapé de todas as páginas públicas e na página inicial.

### Adicionar artigo

**Como administrador**, quero adicionar um artigo, para que os visitantes sejam informados das últimas novidades.

- [ ] O formulário solicita título, resumo e conteúdo.
- [ ] O artigo não pode ser publicado com campos obrigatórios vazios.
- [ ] O administrador pode salvar como rascunho ou publicar.
- [ ] Rascunhos não aparecem no blog público.
- [ ] Ao publicar, o artigo registra o autor e a data e passa a aparecer no blog.

### Categorizar artigo

**Como administrador**, quero categorizar um artigo, para que os visitantes sejam informados de conteúdos específicos.

- [ ] O administrador pode criar uma categoria com nome único.
- [ ] O administrador pode associar uma categoria ao criar ou editar um artigo.
- [ ] Um artigo publicado deve ter ao menos uma categoria.
- [ ] A categoria associada aparece no artigo e no filtro do blog.

### Editar e remover artigos

**Como administrador**, quero editar e remover artigos, para que eu possa corrigir ou retirar conteúdos publicados.

- [ ] O formulário de edição abre com os dados atuais do artigo.
- [ ] As alterações salvas aparecem no blog.
- [ ] A remoção exige confirmação.
- [ ] Um artigo removido deixa de aparecer na listagem, nas categorias e no acesso direto.

### Criar, editar e cancelar eventos

**Como administrador**, quero criar, editar e cancelar eventos, para que os membros vejam a programação atualizada da guilda.

- [ ] A criação e a edição de eventos abrem em página própria, separada da lista de eventos; ao salvar, a página volta à lista e informa o resultado.
- [ ] O administrador também cria eventos direto do calendário, sem passar pelo painel administrativo; ao criar, o detalhe do novo evento é aberto.
- [ ] O formulário solicita título, versão do jogo (World of Warcraft Retail ou Forever), data, horário, descrição e organizador.
- [ ] A versão do jogo pode ser alterada enquanto ninguém confirmou presença; depois, fica bloqueada. Eventos antigos, sem versão, recebem uma ao serem editados.
- [ ] A administração de eventos mostra a versão do jogo de cada evento.
- [ ] O formulário permite habilitar ou desabilitar a confirmação de presença de visitantes; por padrão, ela vem habilitada.
- [ ] Eventos criados antes dessa opção aceitam a confirmação de visitantes.
- [ ] O formulário solicita o limite de confirmados (membros e visitantes somados), de 1 a 500; por padrão, 40.
- [ ] O limite é verificado no servidor, inclusive com confirmações simultâneas; um cancelamento libera a vaga.
- [ ] A administração de eventos mostra quantos confirmaram de quantas vagas.
- [ ] A administração de eventos identifica os eventos em que somente membros confirmam presença.
- [ ] Um novo evento não pode ter data e horário no passado.
- [ ] Um evento criado aparece no calendário dos membros.
- [ ] As alterações salvas aparecem no calendário e mantêm as presenças confirmadas.
- [ ] O cancelamento exige confirmação e mantém o evento no calendário como cancelado.
- [ ] Um evento cancelado pode ser excluído pelo administrador, na administração de eventos ou no detalhe do evento, inclusive depois da data.
- [ ] A exclusão exige confirmação, remove o evento do calendário e apaga a lista de confirmados (membros e visitantes).
- [ ] Eventos ativos não podem ser excluídos; um evento cancelado que não foi excluído mantém a lista de confirmados.

### Exportar eventos para o addon

**Como administrador**, quero gerar uma string com os próximos eventos, para que o addon da guilda no WoW Forever crie, atualize e cancele esses eventos no jogo.

- [ ] A administração de eventos e o detalhe de um evento oferecem o botão "Exportar para o addon", somente para administradores.
- [ ] O botão abre um modal com a string em um campo somente leitura, o botão "Copiar", a quantidade de eventos incluídos, a data e a hora da geração e instruções curtas de importação.
- [ ] A exportação inclui os eventos ativos e cancelados do WoW Forever com início entre hoje e os próximos 60 dias; a quantidade de dias pode ser alterada no modal (de 1 a 180).
- [ ] Cada evento leva o ID, o título, o início, a descrição, o organizador, a situação e a data da última alteração; nenhum dado pessoal ou de conta é exportado.
- [ ] A string segue o formato versionado de `docs/formato-string-addon.md`, com checksum para detectar strings incompletas ou corrompidas.
- [ ] Acima do limite de tamanho, a string não é exibida e o modal informa a maior quantidade de dias que cabe.

### Importar presenças do addon

**Como administrador**, quero colar a string de presenças gerada pelo addon da guilda no WoW Forever, para que as confirmações e os cancelamentos feitos no jogo apareçam no site.

- [ ] A administração de eventos oferece o botão "Importar presenças do addon", somente para administradores, que abre uma página para colar a string `VDLP1`.
- [ ] A string segue o formato de `docs/formato-string-presencas.md`; uma string incompleta, corrompida, de outra versão ou com conteúdo inválido é recusada com o motivo.
- [ ] Antes de aplicar, a página mostra uma prévia por evento: confirmações de membros, confirmações de visitantes, cancelamentos e registros recusados, com o motivo de cada recusa.
- [ ] O personagem do jogo ("Nome Sobrenome") é comparado com os personagens do WoW Forever dos membros, sem diferenciar espaços e maiúsculas e mantendo os acentos. Havendo correspondência, a presença é do membro, com aquele personagem; sem correspondência, entra como visitante.
- [ ] Um personagem de mesmo nome e sobrenome em mais de um membro não é aplicado e aparece como recusado, com os membros envolvidos, para o administrador confirmar manualmente. Personagens de contas desativadas ou excluídas também são recusados.
- [ ] Uma confirmação continua sujeita ao limite de vagas (membros e visitantes somados), à confirmação de visitantes do evento e à duplicidade: o membro não tem duas presenças no evento e o mesmo personagem não confirma duas vezes, como membro ou visitante. O que violaria essas regras é recusado e aparece no relatório.
- [ ] Um cancelamento no jogo cancela no site a presença daquele personagem no evento, de membro ou de visitante.
- [ ] Um registro só é aplicado se for mais recente que a última alteração da presença no site (confirmação ou cancelamento), para que uma alteração feita no site depois não seja desfeita por um dado mais antigo do jogo.
- [ ] Eventos desconhecidos, já iniciados, cancelados ou que não são do WoW Forever são ignorados, com aviso.
- [ ] Uma string gerada antes ou no mesmo horário da última string importada é recusada.
- [ ] Ao confirmar, cada alteração é revalidada e aplicada; a página mostra o relatório do que foi aplicado e do que não foi, com o motivo.
- [ ] As presenças importadas ficam marcadas como vindas do addon na lista de confirmados, e o membro vê no detalhe do evento que a presença veio do jogo, podendo cancelá-la no site.

### Ver presenças confirmadas

**Como administrador**, quero ver quem confirmou presença em um evento, para que eu possa organizar sua realização.

- [ ] O detalhe do evento mostra o total de confirmados, somando membros e visitantes, e o limite do evento.
- [ ] A lista mostra o nome, o personagem com que confirmou, a classe e a função de cada confirmado (em presenças anteriores à escolha do personagem, o personagem principal).
- [ ] Os visitantes aparecem em uma lista própria, com o personagem (nome e sobrenome no WoW Forever; nome e reino no Retail) e o jogo.
- [ ] A lista reflete confirmações e cancelamentos já registrados.
- [ ] Uma mensagem é exibida quando ainda não há confirmados.
- [ ] O administrador pode cancelar a presença de um confirmado (membro ou visitante), com confirmação, enquanto o evento estiver futuro e ativo.
- [ ] A pessoa que teve a presença cancelada pode confirmar novamente enquanto o evento estiver futuro e ativo.

### Gerenciar procurados

**Como administrador**, quero adicionar, editar e remover procurados, para que a lista e as recompensas permaneçam atualizadas.

- [ ] O formulário solicita nome, motivo e recompensa.
- [ ] Campos obrigatórios vazios impedem o salvamento.
- [ ] Um procurado adicionado aparece na lista pública.
- [ ] As alterações salvas aparecem na lista pública.
- [ ] A remoção exige confirmação e retira o procurado da lista pública.

### Definir membros em destaque

**Como administrador**, quero definir os membros em destaque, para que os visitantes conheçam quem foi reconhecido pela guilda.

- [ ] Somente membros ativos podem ser selecionados.
- [ ] O administrador deve informar o motivo do destaque.
- [ ] O destaque aparece na área pública após ser salvo.
- [ ] O administrador pode remover um destaque.
- [ ] Um membro desativado deixa de aparecer como destaque.

### Aprovar ou recusar cadastros

**Como administrador**, quero aprovar ou recusar cadastros, para que somente integrantes da guilda acessem as funcionalidades de membros.

- [ ] Uma lista mostra os cadastros pendentes e suas candidaturas, quando houver, com o jogo de cada uma.
- [ ] O administrador pode ver os dados antes de decidir, incluindo as profissões e o BattleTag.
- [ ] Ao aprovar, o usuário passa a ser membro e acessa as funcionalidades de membros.
- [ ] Ao aprovar, os dados da candidatura viram o personagem principal do membro, com as profissões e sem o BattleTag.
- [ ] Ao recusar, o usuário continua sem acesso às funcionalidades de membros e pode enviar uma nova candidatura.
- [ ] O usuário é informado do resultado na própria conta, sem e-mail automático.
- [ ] A decisão registra o administrador responsável e a data.

### Gerenciar membros e permissões

**Como administrador**, quero gerenciar os membros e suas permissões, para que o acesso continue adequado quando alguém mudar de função, sair ou voltar para a guilda.

- [ ] Uma lista mostra os membros, seu BattleTag, sua situação e sua permissão, com busca por nome.
- [ ] Um membro que ainda não informou o BattleTag aparece como "Não informado".
- [ ] O administrador pode alterar a permissão entre membro e administrador.
- [ ] O administrador pode desativar um membro, com confirmação.
- [ ] Um membro desativado perde o acesso e sai da lista pública.
- [ ] O administrador pode reativar um membro desativado, com confirmação.
- [ ] Um membro reativado volta a acessar as funcionalidades de membros e a lista pública, sempre com a permissão de membro, mesmo que antes fosse administrador.
- [ ] A alteração de permissão vale a partir da próxima requisição do usuário.
- [ ] O sistema impede remover ou desativar o último administrador ativo.
