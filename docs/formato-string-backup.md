# Formato da string de backup do addon (versão 1)

Especificação da string que o addon da Vanguarda da Luz gera em **Administração > Backup do addon > Gerar backup**. O site guarda essa string e a aplica, e depois a devolve para **Restaurar** no jogo. As strings [`VDL1`](formato-string-addon.md) (eventos do site para o addon) e [`VDLP1`](formato-string-presencas.md) (presenças do addon para o site) continuam iguais.

Implementação de referência no addon: [`VanguardaDaLuz/logic/BackupCodec.lua`](../VanguardaDaLuz/logic/BackupCodec.lua), com as regras dos eventos em [`logic/GameEvents.lua`](../VanguardaDaLuz/logic/GameEvents.lua). Exemplo: [`exemplos-addon/backup.txt`](exemplos-addon/backup.txt), com o resultado esperado em [`exemplos-addon/backup-esperado.lua`](exemplos-addon/backup-esperado.lua) e o payload descompactado em [`exemplos-addon/backup-payload.txt`](exemplos-addon/backup-payload.txt).

## De onde vêm os dados

- **Eventos criados ou alterados no jogo.** O Grão Lorde ou um Lorde pode, no jogo:
  - criar um evento;
  - editar ou cancelar um evento ativo que ainda não começou, seja do site ou criado no jogo.

  A alteração vai na hora para os membros da guilda, pelo canal do addon. Ela fica **aguardando o site** até voltar numa exportação `VDL1` com `updatedAt` igual ou maior.
- **Presenças.** Confirmações e cancelamentos do jogo, como na `VDLP1`.
- **Profissões.** Profissões primárias e nível de cada personagem da guilda, anunciados pelo addon de cada um.
- **Item level e main.** Item level equipado de cada personagem e o main da conta.
- **Tempo jogado junto.** Segundos que cada personagem passou em grupo com outro membro da guilda.

O backup leva tudo o que o addon de quem o gera conhece. Ficam de fora as configurações pessoais (minimapa, atalho) e os eventos do site sem alteração no jogo, que o site já tem.

## Visão geral

```
VDLB1:<checksum>:<dados>
```

| Parte        | Conteúdo                                                                 |
| ------------ | ------------------------------------------------------------------------ |
| `VDLB1:`     | Prefixo fixo: `VDLB` + versão do formato (`1`) + `:`                     |
| `<checksum>` | Adler-32 do payload descompactado, em **decimal** (sem zeros à esquerda) |
| `:`          | Separador                                                                |
| `<dados>`    | `LibDeflate:EncodeForPrint(deflate_bruto(payload))`                      |

Compactação, codificação imprimível e checksum são **idênticos** aos da string `VDL1` (seção "Integridade e confiança" de [formato-string-addon.md](formato-string-addon.md)). Decodificação, passo a passo:

1. Remover espaços e caracteres de controle nas pontas.
2. Conferir o prefixo com o padrão `^VDLB(%d+):(%d+):(.+)$`. Versão diferente de `1` deve ser recusada.
3. `DecodeForPrint`, depois `DecompressDeflate`. Um `nil` em qualquer passo indica string inválida.
4. Conferir o Adler-32 do payload com o checksum.
5. Ler os campos do payload, seção por seção.

Não há limite de tamanho no formato. Um backup de uma guilda com 200 personagens fica na casa de poucos milhares de caracteres.

## Payload

Usa a mesma codificação de campos da `VDL1`: `<tamanho>:<valor>`, com o tamanho em **bytes** UTF-8 e sem separadores entre os campos. Números são inteiros não negativos em decimal, e horários são segundos Unix (UTC). Um personagem é o nome completo no WoW Forever, `"Nome Sobrenome"`, como no roster da guilda.

O payload tem um cabeçalho e cinco seções, sempre nesta ordem. Cada seção começa pela quantidade de itens, que pode ser `0`.

### Cabeçalho (6 campos)

| #   | Campo          | Tipo    | Descrição                                                                    |
| --- | -------------- | ------- | ---------------------------------------------------------------------------- |
| 1   | marcador       | texto   | Sempre `VDLB`                                                                |
| 2   | `version`      | inteiro | Versão do formato: `1`                                                       |
| 3   | `game`         | texto   | Versão do jogo: `forever`                                                    |
| 4   | `generatedAt`  | inteiro | Horário de geração. Backups mais novos têm número maior                      |
| 5   | `exportNumber` | inteiro | `exportNumber` da `VDL1` que o addon tinha ao gerar (0 se nenhuma). Informativo |
| 6   | `generatedBy`  | texto   | Personagem que gerou o backup (pode ser vazio)                               |

### 1. Eventos

Contém `eventCount` e depois os blocos de **11 campos**, em ordem alfabética de `id`. Entram só os eventos que **aguardam o site**.

| #   | Campo           | Tipo    | Descrição                                                                                                                                                  |
| --- | --------------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `id`            | texto   | ID do evento. Nos criados no jogo, são 20 letras e dígitos gerados pelo addon, no mesmo formato dos IDs do site. **O site deve criar o evento com este ID** |
| 2   | `origin`        | texto   | `jogo` (criado no jogo) ou `site` (evento do site alterado no jogo)                                                                                         |
| 3   | `title`         | texto   | Título, com até 80 caracteres                                                                                                                              |
| 4   | `startsAt`      | inteiro | Início                                                                                                                                                     |
| 5   | `description`   | texto   | Descrição, com até 2000 caracteres. Pode ter quebras de linha                                                                                              |
| 6   | `organizer`     | texto   | Organizador, com até 40 caracteres                                                                                                                         |
| 7   | `status`        | texto   | `ativo` ou `cancelado`                                                                                                                                     |
| 8   | `updatedAt`     | inteiro | Horário da alteração no jogo                                                                                                                               |
| 9   | `maxAttendees`  | inteiro | Limite de confirmados (1 a 500). `0` = sem alteração (eventos do site: o addon não conhece o limite)                                                     |
| 10  | `guestsAllowed` | texto   | `1` aceita visitantes, `0` não aceita, vazio = sem alteração (eventos do site)                                                                            |
| 11  | `changedBy`     | texto   | Personagem que fez a alteração no jogo                                                                                                                     |

### 2. Presenças

Igual ao corpo da `VDLP1`. Contém `eventCount` e depois, em ordem alfabética de `id`, cada evento: `id` e `recordCount` (R ≥ 1). Em seguida vêm R registros, em ordem alfabética de personagem, com `character`, `status` (`1` confirmado, `0` cancelado) e `updatedAt`.

O `id` pode ser de um evento do site ou de um evento criado no jogo (seção 1 deste backup ou de um backup anterior). Entram todas as presenças que o addon conhece, inclusive as de eventos passados.

### 3. Profissões

Contém `characterCount` e depois, em ordem alfabética de personagem:

| #   | Campo             | Tipo    | Descrição                                     |
| --- | ----------------- | ------- | --------------------------------------------- |
| 1   | `character`       | texto   | Personagem                                    |
| 2   | `updatedAt`       | inteiro | Horário da leitura no jogo                    |
| 3   | `professionCount` | inteiro | Quantidade de profissões primárias (P, 0 a 2) |

Seguem P profissões, 4 campos cada:

| #   | Campo   | Tipo    | Descrição                                                                    |
| --- | ------- | ------- | ---------------------------------------------------------------------------- |
| 1   | `id`    | inteiro | ID da linha de habilidade no jogo, igual em todos os idiomas. `0` = desconhecido |
| 2   | `level` | inteiro | Nível atual                                                                  |
| 3   | `max`   | inteiro | Nível máximo atual                                                           |
| 4   | `name`  | texto   | Nome no idioma do jogo de quem anunciou                                      |

### 4. Item level e main

Contém `characterCount` e depois, em ordem alfabética, 4 campos por personagem:

| #   | Campo       | Tipo    | Descrição                                                                 |
| --- | ----------- | ------- | ------------------------------------------------------------------------- |
| 1   | `character` | texto   | Personagem                                                                |
| 2   | `updatedAt` | inteiro | Horário da leitura                                                        |
| 3   | `itemLevel` | inteiro | Item level equipado, arredondado                                          |
| 4   | `main`      | texto   | Main da conta. Igual a `character`: é o main. Vazio: não definido. Outro nome: é alt dele |

### 5. Tempo jogado junto

Contém `characterCount` e depois, em ordem alfabética, 2 campos por personagem: `character` e `seconds` (total acumulado, que só cresce).

O payload termina no último campo da seção 5. Qualquer um destes casos torna a string inválida:
- campos sobrando;
- contagens que não batem;
- um personagem repetido na mesma seção;
- um evento repetido;
- `origin`, `status` ou `guestsAllowed` fora dos valores listados;
- mais de 2 profissões num personagem.

Exemplo de payload, do arquivo de exemplo, com quebras de linha só para leitura. A descrição do primeiro evento tem uma quebra de linha real:

```
4:VDLB 1:1 7:forever 10:1794420000 10:1794409200 10:Victor Vaz
1:2
  20:G7cQx2LmP9aRt4VbN1sK 4:jogo 27:Treino de PvP: Vale Alterac 10:1794870000 68:Ponto de… 10:Victor Vaz
    5:ativo 10:1794415000 2:25 1:0 10:Victor Vaz
  20:pL5wE1dN7sA3gF6hJ0Ko 4:site 34:Encontro da guilda (novo horário) 10:1796518800 62:Conversa… 5:Tavia
    5:ativo 10:1794418000 1:0 0: 14:Árya Ñúñez
1:2
  20:3kTq9ZcV1bWfX7rLm2Pa 1:2 12:Dorvan Pedra 1:0 10:1794411000 10:Victor Vaz 1:1 10:1794410000
  20:G7cQx2LmP9aRt4VbN1sK 1:1 14:Árya Ñúñez 1:1 10:1794416000
1:3
  12:Dorvan Pedra 10:1794200000 1:0
  9:Maren Luz 10:1794300000 1:1 1:0 3:120 3:150 8:Alquimia
  10:Victor Vaz 10:1794400000 1:2 3:164 3:225 3:300 8:Ferraria 3:186 3:230 3:300 11:Mineração
1:3
  9:Maren Luz 10:1794300000 2:28 0:
  10:Victor Alt 10:1794390000 2:12 10:Victor Vaz
  10:Victor Vaz 10:1794400000 2:31 10:Victor Vaz
1:2
  10:Victor Vaz 5:36000 14:Árya Ñúñez 4:5400
```

## Como o site deve aplicar um backup

### Eventos

Para cada evento da seção 1:

- **`origin = jogo` e o ID não existe no site:** criar o evento **com este ID** como ID do documento.
  - Campos: `game = forever`, os campos da string, `maxAttendees` e `guestsAllowed` (padrão 40 e sim, se vierem sem valor).
  - Um evento que chega já cancelado e nunca existiu no site pode ser ignorado, com aviso no relatório.
  - Como o ID é o mesmo, quando o evento voltar na próxima `VDL1` o addon o reconhece. Ele deixa de aguardar o site, sem duplicar.
- **O evento já existe no site** (`origin = site`, ou `jogo` com um backup já aplicado):
  - Aplicar só se `updatedAt` for **mais recente** que a última alteração do evento no site. Se não for, o evento aparece como **conflito** no relatório, e vale o site.
  - `maxAttendees = 0` e `guestsAllowed` vazio mantêm os valores do site.
  - Valem as regras do site: só eventos ativos que ainda não começaram são editados ou cancelados; o limite de vagas não fica abaixo dos confirmados; e as demais.
- **Depois de aplicar**, a próxima `VDL1` traz o evento com o `updatedAt` gravado pelo site, que é igual ou maior que o do jogo. Assim, o addon para de marcá-lo como aguardando o site.

### Presenças

Mesmas regras da importação da `VDLP1`:
- associação ao membro pelo personagem, ou visitante;
- limite de vagas e duplicidade;
- cancelamento com `status = 0`;
- só registros mais novos que a última alteração no site;
- eventos desconhecidos, passados ou cancelados são ignorados, com relatório.

As presenças de eventos criados no jogo são aplicadas depois da criação desses eventos, no mesmo backup.

### Profissões, item level, main e tempo junto

Esses dados não alteram nada no site. Ficam **guardados como backup**, visíveis só para administradores, junto com a string original. Para a restauração, vale por personagem o registro mais recente (`updatedAt`) e, no tempo junto, o maior total.

### Ordem e repetição

Aplicar o mesmo backup duas vezes não muda nada, porque cada registro só vale se for mais recente. Um backup com `generatedAt` menor ou igual ao do último aplicado pode ser aplicado mesmo assim: ele pode trazer dados que o outro não tinha, já que cada Lorde conhece o que o próprio addon recebeu. Nesse caso, o site deve avisar.

## Restauração (site → addon)

O site devolve uma string `VDLB1`, no mesmo formato, para colar no jogo em **Administração > Backup do addon > Restaurar**. Ela pode ser:

- **a string original de um backup guardado;**
- **uma string combinada gerada pelo site**, com:
  - os dados mais recentes de cada personagem, juntando os backups guardados;
  - as presenças mais recentes;
  - nenhum evento (os eventos voltam pela `VDL1`).

  `generatedAt` é o horário da geração, `exportNumber` é o da última `VDL1` gerada pelo site (ou `0`), e `generatedBy` é vazio ou o nome do administrador.

O addon só **junta** os dados.
- **Eventos:** entra só uma alteração mais nova que a que o addon tem. Ela fica aguardando o site.
- **Presenças, profissões e item level:** vale o registro mais recente de cada personagem.
- **Tempo junto:** vale o maior total.

Nada do que o addon tem é apagado. Depois de restaurar, o addon oferece os dados aos outros membros pela sincronização normal.

## Integridade e confiança

Como nas outras strings, o checksum **não garante autenticidade**. No site, só administradores podem aplicar ou guardar um backup. No jogo, só o Grão Lorde e os Lordes geram e restauram backups.

As alterações de eventos entre os membros são aceitas só de remetentes com esses cargos, conferidos no roster. Elas viajam como uma `VDLB1` só com eventos, nas mensagens `E` e `C` do addon.
