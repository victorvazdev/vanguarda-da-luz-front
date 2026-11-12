# Formato da string de presenças do addon para o site (versão 1)

Especificação da string que o addon da Vanguarda da Luz gera em **Exportar presenças** e que o site importa para atualizar as presenças dos eventos. É o caminho inverso da [string de exportação de eventos](formato-string-addon.md) (`VDL1`), que continua igual.

Implementação de referência no addon: [`VanguardaDaLuz/logic/PresenceCodec.lua`](../VanguardaDaLuz/logic/PresenceCodec.lua). Exemplo: [`exemplos-addon/presencas.txt`](exemplos-addon/presencas.txt), com o resultado esperado em [`exemplos-addon/presencas-esperado.lua`](exemplos-addon/presencas-esperado.lua).

## De onde vêm os dados

- No jogo, cada membro da guilda com o addon confirma ou cancela a presença com o personagem que está jogando.
- O addon sincroniza as respostas entre os membros pelo canal da guilda. Em cada personagem e evento vale a resposta mais recente.
- O Grão Lorde ou um Lorde gera a string. Ela leva as respostas que o addon dele conhece, inclusive os **cancelamentos**.
- Só entram eventos que vieram do site (pelo `id` do site) e que ainda não começaram na hora da geração.

## Visão geral

```
VDLP1:<checksum>:<dados>
```

| Parte        | Conteúdo                                                                 |
| ------------ | ------------------------------------------------------------------------ |
| `VDLP1:`     | Prefixo fixo: `VDLP` + versão do formato (`1`) + `:`                     |
| `<checksum>` | Adler-32 do payload descompactado, em **decimal** (sem zeros à esquerda) |
| `:`          | Separador                                                                |
| `<dados>`    | `LibDeflate:EncodeForPrint(deflate_bruto(payload))`                      |

Compactação, codificação imprimível e checksum são **idênticos** aos da string `VDL1` (seção "Integridade e confiança" de [formato-string-addon.md](formato-string-addon.md)). O site pode reaproveitar o mesmo código, trocando o prefixo.

Decodificação, passo a passo:

1. Remover espaços e caracteres de controle nas pontas.
2. Conferir o prefixo com o padrão `^VDLP(%d+):(%d+):(.+)$`. Versão diferente de `1` deve ser recusada.
3. `DecodeForPrint`, depois `DecompressDeflate`; `nil` em qualquer passo indica string inválida.
4. Conferir o Adler-32 do payload com o checksum.
5. Ler os campos do payload.

## Payload

Mesma codificação de campos da string `VDL1`: `<tamanho>:<valor>`, com o tamanho em **bytes** UTF-8, sem separadores entre os campos.

**Cabeçalho**, 6 campos:

| #   | Campo          | Tipo    | Descrição                                                                                                      |
| --- | -------------- | ------- | -------------------------------------------------------------------------------------------------------------- |
| 1   | marcador       | texto   | Sempre `VDLP`                                                                                                  |
| 2   | `version`      | inteiro | Versão do formato: `1`                                                                                         |
| 3   | `game`         | texto   | Versão do jogo: `forever`                                                                                      |
| 4   | `generatedAt`  | inteiro | Horário de geração, em segundos Unix (UTC). Strings mais novas têm número maior                                |
| 5   | `exportNumber` | inteiro | `exportNumber` da string `VDL1` que o addon tinha ao gerar (0 se nenhuma). Informativo                         |
| 6   | `eventCount`   | inteiro | Quantidade de eventos (E)                                                                                      |

**Eventos**: E blocos, em ordem alfabética de `id`. Cada bloco:

| #   | Campo         | Tipo    | Descrição                                          |
| --- | ------------- | ------- | -------------------------------------------------- |
| 1   | `id`          | texto   | ID do evento no site (o mesmo da string `VDL1`)    |
| 2   | `recordCount` | inteiro | Quantidade de registros do evento (R, pelo menos 1) |

Seguido de R **registros**, em ordem alfabética de personagem, 3 campos cada:

| #   | Campo       | Tipo    | Descrição                                                                                       |
| --- | ----------- | ------- | ----------------------------------------------------------------------------------------------- |
| 1   | `character` | texto   | Nome completo do personagem no WoW Forever: `"Nome Sobrenome"`, separados por um espaço, como no roster da guilda |
| 2   | `status`    | inteiro | `1` presença confirmada, `0` presença cancelada                                                 |
| 3   | `updatedAt` | inteiro | Horário da resposta no jogo, em segundos Unix (UTC)                                             |

O payload termina no último registro; campos sobrando, contagens que não batem, personagem repetido no mesmo evento ou `status` fora de `0`/`1` tornam a string inválida.

Exemplo de payload (do arquivo de exemplo, com quebras de linha só para leitura):

```
4:VDLP 1:1 7:forever 10:1794412800 10:1794409200 1:2
20:3kTq9ZcV1bWfX7rLm2Pa 1:3
  12:Dorvan Pedra 1:0 10:1794411000
  9:Maren Luz 1:1 10:1794410300
  10:Victor Vaz 1:1 10:1794410000
20:Hq2mB8xY4nRcT0vKs9Ue 1:1
  14:Árya Ñúñez 1:1 10:1794412000
```

## Como o site deve aplicar uma string

As regras abaixo foram decididas com a guilda e valem para o site:

- **Associação:** `character` é comparado com o nome e o sobrenome dos personagens do WoW Forever cadastrados pelos membros. Havendo correspondência, a presença é do membro dono do personagem, com aquele personagem.
- **Sem membro correspondente:** a presença entra como **visitante**, com o nome e o sobrenome do personagem.
- **Limite de vagas e duplicidade:** as regras do site continuam valendo. Uma confirmação que passaria do limite ou repetiria uma presença existente não é aplicada e aparece no relatório da importação.
- **Cancelamento:** `status = 0` cancela a presença desse personagem no evento, se existir no site.
- **Ordem:** um registro só é aplicado se o seu `updatedAt` for mais recente que a última alteração da presença no site. Strings com `generatedAt` menor ou igual ao da última importada podem ser recusadas.
- Eventos desconhecidos, passados ou cancelados no site são ignorados e aparecem no relatório.

## Autenticidade

Como na string `VDL1`, o checksum não garante autenticidade. A string só deve ser importada por administradores do site. No jogo, cada membro só anuncia a própria presença (o remetente das mensagens de addon é garantido pelo jogo), mas o repasse entre membros não é assinado.
