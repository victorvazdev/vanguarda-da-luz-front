# Critérios de Aceite — Vanguarda da Luz

Nov 4, 2026 · @Victor Vaz de Oliveira

## Visão geral

As 26 histórias abaixo têm critérios verificáveis, agrupados por área. Uma história só está pronta quando todos os seus critérios forem atendidos.

| Perfil | Situação | Acesso |
| --- | --- | --- |
| Visitante | Sem conta ou não autenticado | Páginas públicas, cadastro e login |
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

## Conteúdo público da guilda

### Ver como ingressar

**Como visitante**, quero ver informações de como ingressar, para que eu possa seguir os passos e fazer parte da guilda.

- [ ] A página de ingresso pode ser acessada sem login.
- [ ] A página apresenta os requisitos e os passos de ingresso em ordem.
- [ ] A página informa que a entrada depende da aprovação de um administrador.
- [ ] Um botão leva ao cadastro quando o visitante não está autenticado.
- [ ] Um botão leva à candidatura quando o usuário cadastrado está autenticado.

### Ver redes sociais

**Como visitante**, quero ver quais são as redes sociais, para que eu possa aprender mais sobre a guilda por esses meios.

- [ ] Os links das redes sociais ficam visíveis em todas as páginas públicas.
- [ ] Cada link identifica a rede por nome ou ícone com texto alternativo.
- [ ] Cada link abre o perfil oficial correspondente em uma nova aba.
- [ ] Redes sem link cadastrado não são exibidas.

### Conhecer a guilda

**Como visitante**, quero conhecer a história, os valores e onde a guilda joga, para que eu possa decidir se quero fazer parte dela.

- [ ] A página pode ser acessada sem login e a partir do menu principal.
- [ ] A página apresenta a história, os valores, a facção, o servidor no Retail e os rulesets no WoW Forever.
- [ ] A página oferece um link para as instruções de ingresso.

### Ler as regras

**Como visitante**, quero ler as regras da guilda, para que eu saiba o que é esperado de um integrante.

- [ ] A página de regras pode ser acessada sem login.
- [ ] As regras são exibidas em seções ou itens identificáveis.
- [ ] A página informa a data da última atualização.
- [ ] A página de ingresso oferece um link para as regras.

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
- [ ] Nos dois jogos, o formulário solicita a classe, a função e o motivo do interesse.
- [ ] A classe e a função são escolhidas entre as opções válidas do jogo escolhido.
- [ ] O usuário deve confirmar que leu as regras antes de enviar.
- [ ] Campos obrigatórios vazios exibem mensagens junto ao campo.
- [ ] Após o envio, a candidatura aparece para os administradores como pendente.
- [ ] O usuário consegue acompanhar se a candidatura está pendente, aprovada ou recusada.
- [ ] Não é possível enviar uma nova candidatura enquanto houver outra pendente.
- [ ] Após uma recusa, o usuário pode enviar uma nova candidatura, partindo dos dados anteriores, e a decisão anterior fica registrada.

### Editar perfil e personagens

**Como membro**, quero editar meu perfil e meus personagens, para que a guilda saiba minha classe, função e nível.

- [ ] O membro pode editar somente o próprio perfil.
- [ ] O membro pode adicionar, editar e remover personagens.
- [ ] Cada personagem possui jogo, nome, classe, função e nível; no Retail, também o servidor; no WoW Forever, também o sobrenome e o ruleset.
- [ ] A classe e a função são escolhidas entre as opções válidas do jogo.
- [ ] O nível aceita somente valores numéricos dentro do limite do jogo.
- [ ] Um personagem deve ser marcado como principal quando houver ao menos um cadastrado.
- [ ] As alterações salvas aparecem imediatamente no perfil e na lista de membros.

## Eventos

### Acessar o calendário de eventos

**Como membro**, quero acessar um calendário de eventos, para que eu possa visualizar quais dias foram programados para algum evento.

- [ ] Somente membros e administradores acessam o calendário.
- [ ] Um visitante ou usuário pendente é redirecionado ao login ou recebe uma mensagem de acesso negado.
- [ ] O calendário abre no mês atual e permite navegar entre meses.
- [ ] Os dias com eventos ficam identificados.
- [ ] Ao selecionar um evento, o membro vê o título, a data, o horário, a descrição e o organizador.
- [ ] Datas e horários são exibidos no fuso definido para a guilda e esse fuso fica identificado.
- [ ] Eventos cancelados são identificados como cancelados.

### Confirmar presença

**Como membro**, quero acessar um calendário, para que eu possa confirmar minha presença para algum evento.

- [ ] O detalhe de um evento futuro e ativo oferece a ação de confirmar presença.
- [ ] A confirmação fica registrada para o membro autenticado.
- [ ] Após confirmar, o evento indica que a presença do membro está confirmada.
- [ ] O membro não pode confirmar a presença duas vezes no mesmo evento.
- [ ] Não é possível confirmar presença em eventos passados ou cancelados.

### Cancelar presença

**Como membro**, quero cancelar minha presença em um evento, para que os organizadores saibam que não poderei participar.

- [ ] A ação fica disponível somente quando há uma presença confirmada em um evento futuro.
- [ ] O membro precisa confirmar o cancelamento antes de concluí-lo.
- [ ] Após o cancelamento, o nome do membro sai da lista de confirmados.
- [ ] O membro pode confirmar presença novamente enquanto o evento estiver futuro e ativo.

## Administração

Todas as ações desta seção exigem permissão de administrador, verificada no servidor. Uma tentativa sem permissão é recusada e não altera os dados.

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

- [ ] O formulário solicita título, data, horário, descrição e organizador.
- [ ] Um novo evento não pode ter data e horário no passado.
- [ ] Um evento criado aparece no calendário dos membros.
- [ ] As alterações salvas aparecem no calendário e mantêm as presenças confirmadas.
- [ ] O cancelamento exige confirmação e mantém o evento no calendário como cancelado.

### Ver presenças confirmadas

**Como administrador**, quero ver quem confirmou presença em um evento, para que eu possa organizar sua realização.

- [ ] O detalhe do evento mostra o total de confirmados.
- [ ] A lista mostra o nome, o personagem principal, a classe e a função de cada confirmado.
- [ ] A lista reflete confirmações e cancelamentos já registrados.
- [ ] Uma mensagem é exibida quando ainda não há confirmados.

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
- [ ] O administrador pode ver os dados antes de decidir.
- [ ] Ao aprovar, o usuário passa a ser membro e acessa as funcionalidades de membros.
- [ ] Ao aprovar, os dados da candidatura viram o personagem principal do membro.
- [ ] Ao recusar, o usuário continua sem acesso às funcionalidades de membros e pode enviar uma nova candidatura.
- [ ] O usuário é informado do resultado na própria conta, sem e-mail automático.
- [ ] A decisão registra o administrador responsável e a data.

### Gerenciar membros e permissões

**Como administrador**, quero gerenciar os membros e suas permissões, para que o acesso continue adequado quando alguém mudar de função, sair ou voltar para a guilda.

- [ ] Uma lista mostra os membros, sua situação e sua permissão, com busca por nome.
- [ ] O administrador pode alterar a permissão entre membro e administrador.
- [ ] O administrador pode desativar um membro, com confirmação.
- [ ] Um membro desativado perde o acesso e sai da lista pública.
- [ ] O administrador pode reativar um membro desativado, com confirmação.
- [ ] Um membro reativado volta a acessar as funcionalidades de membros e a lista pública, sempre com a permissão de membro, mesmo que antes fosse administrador.
- [ ] A alteração de permissão vale a partir da próxima requisição do usuário.
- [ ] O sistema impede remover ou desativar o último administrador ativo.
