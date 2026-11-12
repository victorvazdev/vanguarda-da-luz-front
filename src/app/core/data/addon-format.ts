// Formato da string de exportação de eventos para o addon da guilda (versão 1).
// Especificação completa: docs/formato-string-addon.md.
//
// Sem dependências (nem Angular, nem Firebase): usado pelo site e pelos testes, inclusive o que
// gera e confere os exemplos em docs/exemplos-addon (`npm run addon:exemplos`).
//
//   VDL1:<adler32 decimal>:<EncodeForPrint(deflate bruto(payload))>
//
// O payload é uma sequência de campos `<bytes>:<valor>` (tamanho em bytes UTF-8), sem
// separadores: cabeçalho de 7 campos e 7 campos por evento.

export const ADDON_FORMAT_VERSION = 1;
export const ADDON_PREFIX = `VDL${ADDON_FORMAT_VERSION}:`;
const MARKER = 'VDL';
const HEADER_FIELDS = 7;
const EVENT_FIELDS = 7;

/** Tamanho máximo da string, em caracteres (ver "Limites" na especificação). */
export const ADDON_MAX_LENGTH = 30_000;

export type AddonGame = 'forever' | 'retail';
export type AddonEventStatus = 'ativo' | 'cancelado';

export interface AddonEvent {
  /** ID do documento do evento no site (estável). */
  id: string;
  title: string;
  /** Início, em segundos Unix (UTC). */
  startsAt: number;
  description: string;
  organizer: string;
  status: AddonEventStatus;
  /** Última alteração (edição ou cancelamento), em segundos Unix (UTC). */
  updatedAt: number;
}

export interface AddonExport {
  version: number;
  /** Versão do jogo dos eventos exportados. */
  game: AddonGame;
  /** Número da exportação: o horário de geração, em segundos Unix (UTC). */
  exportNumber: number;
  /** Janela exportada: início (inclusive) e fim (exclusivo), em segundos Unix (UTC). */
  windowStart: number;
  windowEnd: number;
  events: AddonEvent[];
}

export type AddonDecodeError =
  'prefix' | 'version' | 'encoding' | 'compression' | 'checksum' | 'payload';

export class AddonDecodeFailure extends Error {
  constructor(readonly reason: AddonDecodeError) {
    super(`String do addon inválida: ${reason}`);
  }
}

/** Ordem dos eventos na exportação: início e, no empate, ID. */
export function sortAddonEvents(events: AddonEvent[]): AddonEvent[] {
  return [...events].sort(
    (a, b) => a.startsAt - b.startsAt || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  );
}

// ---------- Payload ----------

const utf8 = new TextEncoder();
const fromUtf8 = new TextDecoder('utf-8', { fatal: true });

/** Payload em texto: campos `<bytes>:<valor>`, na ordem da especificação. */
export function buildPayload(data: AddonExport): string {
  const events = sortAddonEvents(data.events);
  const fields: (string | number)[] = [
    MARKER,
    data.version,
    data.game,
    data.exportNumber,
    data.windowStart,
    data.windowEnd,
    events.length,
  ];
  for (const e of events) {
    fields.push(e.id, e.title, e.startsAt, e.description, e.organizer, e.status, e.updatedAt);
  }
  return encodeFields(fields);
}

/** Campos `<bytes>:<valor>`, sem separadores (tamanho em bytes UTF-8). */
export function encodeFields(fields: (string | number)[]): string {
  return fields
    .map((f) => {
      const value = String(f);
      return `${utf8.encode(value).length}:${value}`;
    })
    .join('');
}

/** Lê os campos do payload (bytes UTF-8). Também usado pela string de presenças (VDLP1). */
export function readFields(bytes: Uint8Array): string[] {
  const COLON = 0x3a;
  const fields: string[] = [];
  let pos = 0;
  while (pos < bytes.length) {
    const colon = bytes.indexOf(COLON, pos);
    if (colon < 0) throw new AddonDecodeFailure('payload');
    const digits = fromUtf8.decode(bytes.subarray(pos, colon));
    if (!/^\d+$/.test(digits)) throw new AddonDecodeFailure('payload');
    const end = colon + 1 + Number(digits);
    if (end > bytes.length) throw new AddonDecodeFailure('payload');
    try {
      fields.push(fromUtf8.decode(bytes.subarray(colon + 1, end)));
    } catch {
      throw new AddonDecodeFailure('payload');
    }
    pos = end;
  }
  return fields;
}

export function int(value: string): number {
  if (!/^\d+$/.test(value)) throw new AddonDecodeFailure('payload');
  return Number(value);
}

export function parsePayload(bytes: Uint8Array): AddonExport {
  const f = readFields(bytes);
  if (f.length < HEADER_FIELDS || f[0] !== MARKER) throw new AddonDecodeFailure('payload');
  const version = int(f[1]);
  if (version !== ADDON_FORMAT_VERSION) throw new AddonDecodeFailure('version');
  const game = f[2];
  if (game !== 'forever' && game !== 'retail') throw new AddonDecodeFailure('payload');
  const count = int(f[6]);
  if (f.length !== HEADER_FIELDS + count * EVENT_FIELDS) throw new AddonDecodeFailure('payload');
  const events: AddonEvent[] = [];
  for (let i = HEADER_FIELDS; i < f.length; i += EVENT_FIELDS) {
    const status = f[i + 5];
    if (status !== 'ativo' && status !== 'cancelado') throw new AddonDecodeFailure('payload');
    events.push({
      id: f[i],
      title: f[i + 1],
      startsAt: int(f[i + 2]),
      description: f[i + 3],
      organizer: f[i + 4],
      status,
      updatedAt: int(f[i + 6]),
    });
  }
  return {
    version,
    game,
    exportNumber: int(f[3]),
    windowStart: int(f[4]),
    windowEnd: int(f[5]),
    events,
  };
}

// ---------- Adler-32 (igual a LibDeflate:Adler32) ----------

export function adler32(bytes: Uint8Array): number {
  const MOD = 65521;
  let a = 1;
  let b = 0;
  for (const byte of bytes) {
    a = (a + byte) % MOD;
    b = (b + a) % MOD;
  }
  return b * 65536 + a;
}

// ---------- Texto imprimível (igual a LibDeflate:EncodeForPrint / DecodeForPrint) ----------

const ALPHABET = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789()';
const VALUE_OF = new Map([...ALPHABET].map((ch, i) => [ch, i]));

/** Cada 3 bytes viram 4 caracteres, 6 bits por caractere, do bit menos significativo. */
export function encodeForPrint(bytes: Uint8Array): string {
  let out = '';
  let i = 0;
  for (; i + 2 < bytes.length; i += 3) {
    let cache = bytes[i] + bytes[i + 1] * 256 + bytes[i + 2] * 65536;
    for (let k = 0; k < 4; k++) {
      out += ALPHABET[cache % 64];
      cache = Math.floor(cache / 64);
    }
  }
  // Sobra de 1 ou 2 bytes: 2 ou 3 caracteres.
  let cache = 0;
  let bits = 0;
  for (; i < bytes.length; i++) {
    cache += bytes[i] * 2 ** bits;
    bits += 8;
  }
  while (bits > 0) {
    out += ALPHABET[cache % 64];
    cache = Math.floor(cache / 64);
    bits -= 6;
  }
  return out;
}

export function decodeForPrint(text: string): Uint8Array {
  const str = text.trim();
  if (str.length === 1) throw new AddonDecodeFailure('encoding');
  const out: number[] = [];
  let cache = 0;
  let bits = 0;
  for (const ch of str) {
    const value = VALUE_OF.get(ch);
    if (value === undefined) throw new AddonDecodeFailure('encoding');
    cache += value * 2 ** bits;
    bits += 6;
    while (bits >= 8) {
      const byte = cache % 256;
      out.push(byte);
      cache = (cache - byte) / 256;
      bits -= 8;
    }
  }
  return Uint8Array.from(out);
}

// ---------- Deflate bruto (CompressionStream, nativo no navegador e no Node) ----------

async function pipe(bytes: Uint8Array, stream: CompressionStream | DecompressionStream) {
  const writer = stream.writable.getWriter();
  const written = writer.write(bytes as Uint8Array<ArrayBuffer>).then(() => writer.close());
  const chunks: Uint8Array[] = [];
  const read = (async () => {
    const reader = stream.readable.getReader();
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      chunks.push(value);
    }
  })();
  // Os dois lados falham juntos em dados inválidos; espera ambos para não deixar erro solto.
  const [w, r] = await Promise.allSettled([written, read]);
  if (r.status === 'rejected') throw r.reason;
  if (w.status === 'rejected') throw w.reason;
  const out = new Uint8Array(chunks.reduce((n, c) => n + c.length, 0));
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.length;
  }
  return out;
}

export const deflateRaw = (bytes: Uint8Array) => pipe(bytes, new CompressionStream('deflate-raw'));
export const inflateRaw = (bytes: Uint8Array) =>
  pipe(bytes, new DecompressionStream('deflate-raw'));

// ---------- String completa ----------

export async function encodeAddonExport(data: AddonExport): Promise<string> {
  return wrapAddonString('VDL', ADDON_FORMAT_VERSION, buildPayload(data));
}

/** Decodifica e valida uma string (como o addon faz). Lança `AddonDecodeFailure`. */
export async function decodeAddonExport(text: string): Promise<AddonExport> {
  return parsePayload(await unwrapAddonString(text, 'VDL', ADDON_FORMAT_VERSION));
}

// ---------- Envelope comum: <prefixo><versão>:<adler32>:<EncodeForPrint(deflate(payload))> ----------
// Usado pela string de eventos (VDL1) e pela de presenças (VDLP1).

export async function wrapAddonString(
  prefix: string,
  version: number,
  payloadText: string,
): Promise<string> {
  const payload = utf8.encode(payloadText);
  const compressed = await deflateRaw(payload);
  return `${prefix}${version}:${adler32(payload)}:${encodeForPrint(compressed)}`;
}

/**
 * Confere prefixo, versão, codificação, compactação e checksum, e devolve o payload em bytes.
 * Lança `AddonDecodeFailure`.
 */
export async function unwrapAddonString(
  text: string,
  prefix: string,
  version: number,
): Promise<Uint8Array> {
  const match = new RegExp(`^${prefix}(\\d+):(\\d+):(.+)$`, 's').exec(text.trim());
  if (!match) throw new AddonDecodeFailure('prefix');
  if (Number(match[1]) !== version) throw new AddonDecodeFailure('version');
  const compressed = decodeForPrint(match[3]);
  let payload: Uint8Array;
  try {
    payload = await inflateRaw(compressed);
  } catch {
    throw new AddonDecodeFailure('compression');
  }
  if (adler32(payload) !== Number(match[2])) throw new AddonDecodeFailure('checksum');
  return payload;
}
