# Formato da string de exportação para o addon (versão 1)

Especificação da string que o site da Vanguarda da Luz gera em **Exportar para o addon** (administração de eventos ou detalhe de um evento) e que o addon da guilda importa no jogo.

Implementação de referência no site: [`src/app/core/data/addon-format.ts`](../src/app/core/data/addon-format.ts) (formato) e [`src/app/core/data/addon-export.ts`](../src/app/core/data/addon-export.ts) (seleção dos eventos). Exemplos para os testes do addon: [`docs/exemplos-addon/`](exemplos-addon/).

## Visão geral

```
VDL1:<checksum>:<dados>
```

| Parte        | Conteúdo                                                                 |
| ------------ | ------------------------------------------------------------------------ |
| `VDL1:`      | Prefixo fixo: `VDL` + versão do formato (`1`) + `:`                      |
| `<checksum>` | Adler-32 do payload descompactado, em **decimal** (sem zeros à esquerda) |
| `:`          | Separador                                                                |
| `<dados>`    | `LibDeflate:EncodeForPrint(deflate_bruto(payload))`                      |

A string tem somente caracteres ASCII: letras, dígitos, `:` e `(` `)`. Não tem espaços nem quebras de linha. Ao importar, ignore espaços e quebras de linha nas pontas, que podem aparecer ao colar.

Decodificação, passo a passo:

1. Remover espaços e caracteres de controle nas pontas.
2. Conferir o prefixo e a versão, com o padrão `^VDL(%d+):(%d+):(.+)$`. Versão diferente de `1` deve ser recusada.
3. `LibDeflate:DecodeForPrint(dados)`. O resultado `nil` indica codificação inválida.
4. `LibDeflate:DecompressDeflate(compactado)`. O resultado `nil` indica uma string incompleta ou corrompida.
5. Conferir `LibDeflate:Adler32(payload) == tonumber(checksum)`.
6. Ler os campos do payload, conforme a seção a seguir.

## Payload

O payload é um texto **UTF-8** formado por uma sequência de campos, sem separadores entre eles:

```
<tamanho>:<valor><tamanho>:<valor>...
```

- `<tamanho>` é o número de **bytes** do valor em UTF-8, em decimal (só dígitos). Em Lua 5.1 é o mesmo que `#valor`.
- `<valor>` vem logo depois do `:`, com exatamente esse número de bytes. Pode conter qualquer caractere, inclusive `:`, `|`, aspas e quebras de linha (`\n`), sem escape.
- Números (timestamps e quantidades) são inteiros não negativos em decimal.

Exemplo: os campos `VDL`, `1` e `Raid: Núcleo` ficam `3:VDL1:113:Raid: Núcleo`. "Núcleo" tem 7 bytes em UTF-8, por causa do `ú`.

### Ordem dos campos

**Cabeçalho**, com 7 campos sempre presentes:

| #   | Campo          | Tipo    | Descrição                                                                                                   |
| --- | -------------- | ------- | ----------------------------------------------------------------------------------------------------------- |
| 1   | marcador       | texto   | Sempre `VDL`                                                                                                |
| 2   | `version`      | inteiro | Versão do formato: `1`                                                                                      |
| 3   | `game`         | texto   | Versão do jogo dos eventos: `forever` (WoW Forever) ou `retail` (reservado para um addon do Retail)         |
| 4   | `exportNumber` | inteiro | Número da exportação: o horário de geração, em segundos Unix (UTC). Exportações mais novas têm número maior |
| 5   | `windowStart`  | inteiro | Início da janela exportada (inclusive), em segundos Unix (UTC): 00:00 de hoje no horário de Brasília        |
| 6   | `windowEnd`    | inteiro | Fim da janela (exclusivo), em segundos Unix (UTC): 00:00 do dia seguinte ao último dia incluído             |
| 7   | `count`        | inteiro | Quantidade de eventos (N)                                                                                   |

**Eventos**: N blocos de 7 campos, ordenados pelo início e, no empate, pelo ID:

| #   | Campo         | Tipo    | Descrição                                                                                       |
| --- | ------------- | ------- | ----------------------------------------------------------------------------------------------- |
| 1   | `id`          | texto   | ID estável do evento no site: 20 caracteres alfanuméricos, por enquanto. Trate como texto opaco |
| 2   | `title`       | texto   | Título, com até 80 caracteres                                                                   |
| 3   | `startsAt`    | inteiro | Data e hora de início, em segundos Unix (UTC)                                                   |
| 4   | `description` | texto   | Descrição, com até 2000 caracteres. Pode ter quebras de linha                                   |
| 5   | `organizer`   | texto   | Nome do organizador, com até 40 caracteres                                                      |
| 6   | `status`      | texto   | `ativo` ou `cancelado`                                                                          |
| 7   | `updatedAt`   | inteiro | Última alteração do evento (criação, edição ou cancelamento), em segundos Unix (UTC)            |

O total de campos é sempre `7 + 7 × count`. Qualquer diferença indica um payload inválido.

Os limites de tamanho são os do site, em caracteres. Um caractere acentuado ocupa mais de 1 byte.

## Quais eventos entram

- Somente eventos da versão do jogo indicada em `game`. Os eventos do site criados antes da escolha da versão ficam de fora.
- Eventos **ativos e cancelados**. Os cancelados existem para o addon cancelar os eventos que já criou no jogo.
- Eventos com início dentro da janela `[windowStart, windowEnd)`: de hoje (desde 00:00 no horário de Brasília, incluindo eventos que já começaram hoje) até os próximos N dias. N é escolhido pelo administrador, de 1 a 180; o padrão é 60.

### Como o addon deve aplicar uma exportação

A exportação é um **retrato completo da janela**:

- **Evento da exportação que o addon ainda não tem:** criar, se `status == "ativo"`. Os cancelados que o addon nunca criou podem ser ignorados.
- **Evento que o addon já tem (mesmo `id`):** atualizar se o `updatedAt` for maior que o registrado. Com `status == "cancelado"`, cancelar no jogo.
- **Evento que o addon tem, com início dentro de `[windowStart, windowEnd)`, mas que não veio na exportação:** foi excluído no site ou mudou de data para fora da janela. Deve ser removido ou cancelado no jogo.
- **Eventos do addon fora da janela:** não mexer.
- **Exportação com `exportNumber` menor ou igual ao da última importada:** é antiga e pode ser recusada.

## Dados que não entram

A string não traz dados pessoais nem de contas: nada de e-mail, BattleTag, nome de usuário, uid, candidaturas, lista de confirmados ou limite de vagas. O organizador é o nome digitado pelo administrador no evento, que já é público no calendário do site.

## Integridade e confiança

- **Compactação:** deflate bruto (RFC 1951, sem cabeçalho zlib nem gzip), que é o formato de `LibDeflate:CompressDeflate` e `LibDeflate:DecompressDeflate`. O site compacta com `CompressionStream('deflate-raw')`.
- **Texto imprimível:** o mesmo algoritmo de `LibDeflate:EncodeForPrint`. O alfabeto é `a-z`, `A-Z`, `0-9`, `(` e `)`, com 6 bits por caractere, cada 3 bytes virando 4 caracteres, do bit menos significativo para o mais significativo. Uma sobra de 1 ou 2 bytes vira 2 ou 3 caracteres. **Não é Base64 padrão.**
- **Checksum:** Adler-32 (RFC 1950) dos bytes do payload **descompactado**, o mesmo valor de `LibDeflate:Adler32(payload)`, escrito em decimal. Ele detecta strings cortadas ou alteradas por acidente.
- **Autenticidade:** o checksum **não garante autenticidade**. Qualquer pessoa pode montar uma string válida, porque os dados dos eventos são públicos no calendário do site. A confiança no jogo vem do **cargo de quem envia a string na guilda**: o addon deve aceitar importações e repasses somente de membros com cargo de oficial ou superior, conferido no roster da guilda.

## Limites

- **Tamanho máximo da string: 30.000 caracteres** (`ADDON_MAX_LENGTH`).
  - Colar no EditBox do jogo é instantâneo nesse tamanho.
  - Repassar para a guilda em mensagens de addon (até 255 bytes cada) dá no máximo cerca de 120 mensagens. Com o ChatThrottleLib, isso leva menos de um minuto.
  - Uma exportação típica de 60 dias fica bem abaixo desse limite. O exemplo com 3 eventos tem 561 caracteres.
- Se a string passar do limite, o site não a exibe e informa a maior janela de dias que cabe, para o administrador reduzir.
- O addon deve aceitar strings de pelo menos 30.000 caracteres.

## Versionamento

- A versão aparece no prefixo (`VDL1:`) e no campo 2 do cabeçalho. As duas são sempre iguais.
- Qualquer mudança incompatível (campos novos, outra ordem, outra codificação) gera uma nova versão (`VDL2:`). O addon deve recusar versões que não conhece, com uma mensagem pedindo para atualizar o addon.
- Um addon do Retail usaria o mesmo formato, com `game = "retail"`. Cada addon deve recusar exportações de outro jogo.

## Decodificador de referência (Lua 5.1)

Requer [LibDeflate](https://github.com/SafeteeWoW/LibDeflate). Retorna a tabela do formato de [`exemplos-addon/esperado.lua`](exemplos-addon/esperado.lua), ou `nil` e o motivo do erro.

```lua
local LibDeflate = LibStub:GetLibrary("LibDeflate")

local HEADER_FIELDS, EVENT_FIELDS = 7, 7

-- Campos "<bytes>:<valor>" do payload.
local function ReadFields(payload)
  local fields, pos, size = {}, 1, #payload
  while pos <= size do
    local colon = string.find(payload, ":", pos, true)
    if not colon then return nil end
    local digits = string.sub(payload, pos, colon - 1)
    if not string.find(digits, "^%d+$") then return nil end
    local last = colon + tonumber(digits)
    if last > size then return nil end
    fields[#fields + 1] = string.sub(payload, colon + 1, last)
    pos = last + 1
  end
  return fields
end

local function Int(value)
  if not value or not string.find(value, "^%d+$") then return nil end
  return tonumber(value)
end

-- Retorna a exportação decodificada ou nil, motivo
-- ("prefix", "version", "encoding", "compression", "checksum" ou "payload").
function VDL_Decode(text)
  text = string.gsub(text, "^[%c ]+", "")
  text = string.gsub(text, "[%c ]+$", "")
  local version, checksum, data = string.match(text, "^VDL(%d+):(%d+):(.+)$")
  if not version then return nil, "prefix" end
  if version ~= "1" then return nil, "version" end

  local compressed = LibDeflate:DecodeForPrint(data)
  if not compressed then return nil, "encoding" end
  local payload = LibDeflate:DecompressDeflate(compressed)
  if not payload then return nil, "compression" end
  if LibDeflate:Adler32(payload) ~= tonumber(checksum) then return nil, "checksum" end

  local f = ReadFields(payload)
  if not f or #f < HEADER_FIELDS or f[1] ~= "VDL" then return nil, "payload" end
  if f[2] ~= "1" then return nil, "version" end
  local count = Int(f[7])
  if not count or #f ~= HEADER_FIELDS + count * EVENT_FIELDS then return nil, "payload" end

  local result = {
    version = 1,
    game = f[3],
    exportNumber = Int(f[4]),
    windowStart = Int(f[5]),
    windowEnd = Int(f[6]),
    count = count,
    events = {},
  }
  if result.game ~= "forever" and result.game ~= "retail" then return nil, "payload" end
  if not (result.exportNumber and result.windowStart and result.windowEnd) then
    return nil, "payload"
  end

  for i = HEADER_FIELDS + 1, #f, EVENT_FIELDS do
    local event = {
      id = f[i],
      title = f[i + 1],
      startsAt = Int(f[i + 2]),
      description = f[i + 3],
      organizer = f[i + 4],
      status = f[i + 5],
      updatedAt = Int(f[i + 6]),
    }
    if not event.startsAt or not event.updatedAt
      or (event.status ~= "ativo" and event.status ~= "cancelado") then
      return nil, "payload"
    end
    result.events[#result.events + 1] = event
  end
  return result
end
```

Os horários são UTC. Para exibir no horário do jogador, use `date("%d/%m %H:%M", startsAt)`, que usa o fuso local, ou converta para o horário do servidor conforme a necessidade do addon.

## Exemplos para testes

Em [`docs/exemplos-addon/`](exemplos-addon/):

| Arquivo          | Conteúdo                                                                                                                 |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `valida.txt`     | String válida com 3 eventos do WoW Forever: 2 ativos e 1 cancelado, com acentos, `:` e `                                 | ` no título, e quebra de linha e aspas na descrição |
| `esperado.lua`   | Tabela Lua que `VDL_Decode` deve devolver para `valida.txt`                                                              |
| `payload.txt`    | Payload descompactado de `valida.txt`, para testar o leitor de campos isoladamente                                       |
| `corrompida.txt` | `valida.txt` cortada em 60%, como numa cópia incompleta. `VDL_Decode` deve devolver `nil` (em geral com `"compression"`) |

Os arquivos são conferidos pelos testes do site (`tests/addon/exemplos-addon.spec.ts`, executado em `npm run test:emulators`). Para gerá-los de novo após uma mudança no formato: `npm run addon:exemplos`. A string válida pode mudar de um gerador de deflate para outro, mas a decodificação continua igual a `esperado.lua`.
