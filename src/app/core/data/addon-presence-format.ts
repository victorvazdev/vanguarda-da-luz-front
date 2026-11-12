// Formato da string de presenças que o addon da guilda gera no jogo (versão 1).
// Especificação completa: docs/formato-string-presencas.md (cópia da do repositório do addon).
//
// Sem dependências (nem Angular, nem Firebase). É o caminho inverso da string de eventos
// (addon-format.ts): mesmo envelope e mesma codificação de campos.
//
//   VDLP1:<adler32 decimal>:<EncodeForPrint(deflate bruto(payload))>
//
// Payload: cabeçalho de 6 campos; por evento, `id` e `recordCount`; por registro, `character`,
// `status` e `updatedAt`.
import {
  AddonDecodeFailure,
  encodeFields,
  int,
  readFields,
  unwrapAddonString,
  wrapAddonString,
} from './addon-format';

export const PRESENCE_FORMAT_VERSION = 1;
const MARKER = 'VDLP';
const HEADER_FIELDS = 6;
const RECORD_FIELDS = 3;

/** Presença no jogo: `1` confirmada, `0` cancelada. */
export type PresenceStatus = 0 | 1;

export interface PresenceRecord {
  /** Personagem do WoW Forever: "Nome Sobrenome". */
  character: string;
  status: PresenceStatus;
  /** Horário da resposta no jogo, em segundos Unix (UTC). */
  updatedAt: number;
}

export interface PresenceEvent {
  /** ID do evento no site. */
  id: string;
  records: PresenceRecord[];
}

export interface PresenceExport {
  version: number;
  game: 'forever';
  /** Horário de geração, em segundos Unix (UTC). Strings mais novas têm número maior. */
  generatedAt: number;
  /** `exportNumber` da string VDL1 que o addon tinha (0 se nenhuma). Informativo. */
  exportNumber: number;
  events: PresenceEvent[];
}

const byText = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

/** Payload em texto, na ordem da especificação (eventos por `id`, registros por personagem). */
export function buildPresencePayload(data: PresenceExport): string {
  const events = [...data.events].sort((a, b) => byText(a.id, b.id));
  const fields: (string | number)[] = [
    MARKER,
    data.version,
    data.game,
    data.generatedAt,
    data.exportNumber,
    events.length,
  ];
  for (const e of events) {
    fields.push(e.id, e.records.length);
    for (const r of [...e.records].sort((a, b) => byText(a.character, b.character))) {
      fields.push(r.character, r.status, r.updatedAt);
    }
  }
  return encodeFields(fields);
}

export function parsePresencePayload(bytes: Uint8Array): PresenceExport {
  const f = readFields(bytes);
  if (f.length < HEADER_FIELDS || f[0] !== MARKER) throw new AddonDecodeFailure('payload');
  const version = int(f[1]);
  if (version !== PRESENCE_FORMAT_VERSION) throw new AddonDecodeFailure('version');
  if (f[2] !== 'forever') throw new AddonDecodeFailure('payload');
  const count = int(f[5]);
  const events: PresenceEvent[] = [];
  const ids = new Set<string>();
  let pos = HEADER_FIELDS;
  for (let i = 0; i < count; i++) {
    if (pos + 2 > f.length) throw new AddonDecodeFailure('payload');
    const id = f[pos];
    const recordCount = int(f[pos + 1]);
    pos += 2;
    if (!id || ids.has(id) || recordCount < 1) throw new AddonDecodeFailure('payload');
    ids.add(id);
    if (pos + recordCount * RECORD_FIELDS > f.length) throw new AddonDecodeFailure('payload');
    const records: PresenceRecord[] = [];
    const characters = new Set<string>();
    for (let r = 0; r < recordCount; r++, pos += RECORD_FIELDS) {
      const character = f[pos];
      const status = f[pos + 1];
      if (!character.trim() || characters.has(character)) throw new AddonDecodeFailure('payload');
      if (status !== '0' && status !== '1') throw new AddonDecodeFailure('payload');
      characters.add(character);
      records.push({ character, status: status === '1' ? 1 : 0, updatedAt: int(f[pos + 2]) });
    }
    events.push({ id, records });
  }
  if (pos !== f.length) throw new AddonDecodeFailure('payload');
  return { version, game: 'forever', generatedAt: int(f[3]), exportNumber: int(f[4]), events };
}

/** Gera a string (usado nos testes; quem gera de verdade é o addon). */
export function encodePresenceExport(data: PresenceExport): Promise<string> {
  return wrapAddonString(MARKER, PRESENCE_FORMAT_VERSION, buildPresencePayload(data));
}

/** Decodifica e valida uma string `VDLP1`. Lança `AddonDecodeFailure`. */
export async function decodePresenceExport(text: string): Promise<PresenceExport> {
  return parsePresencePayload(await unwrapAddonString(text, MARKER, PRESENCE_FORMAT_VERSION));
}
