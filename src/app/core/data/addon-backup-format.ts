// Formato da string de backup que o addon da guilda gera no jogo (versão 1).
// Especificação completa: docs/formato-string-backup.md (cópia da do repositório do addon).
//
// Sem dependências (nem Angular, nem Firebase). Mesmo envelope e mesma codificação de campos das
// strings de eventos (addon-format.ts) e de presenças (addon-presence-format.ts); o site também
// gera esta string, sem eventos, para restaurar os dados no jogo.
//
//   VDLB1:<adler32 decimal>:<EncodeForPrint(deflate bruto(payload))>
//
// Payload: cabeçalho de 6 campos e cinco seções, sempre nesta ordem, cada uma começando pela
// quantidade de itens: eventos (11 campos), presenças (corpo da VDLP1), profissões, item level e
// main, e tempo jogado junto.
import {
  AddonDecodeFailure,
  encodeFields,
  int,
  readFields,
  unwrapAddonString,
  wrapAddonString,
  type AddonEventStatus,
} from './addon-format';
import {
  byText,
  presenceSectionFields,
  readPresenceSection,
  type PresenceEvent,
} from './addon-presence-format';

export const BACKUP_FORMAT_VERSION = 1;
const MARKER = 'VDLB';
const HEADER_FIELDS = 6;
const EVENT_FIELDS = 11;
const PROFESSION_FIELDS = 4;
/** Profissões primárias por personagem. */
export const MAX_PROFESSIONS = 2;

export type BackupEventOrigin = 'jogo' | 'site';

/** Situação do evento no backup: além das da VDL1, `excluido` (cancelado e excluído no jogo). */
export type BackupEventStatus = AddonEventStatus | 'excluido';

/** Evento criado ou alterado no jogo, ainda aguardando o site. */
export interface BackupEvent {
  /** ID do evento. Nos criados no jogo, 20 letras e dígitos: o site cria o evento com ele. */
  id: string;
  origin: BackupEventOrigin;
  title: string;
  /** Início, em segundos Unix (UTC). */
  startsAt: number;
  description: string;
  organizer: string;
  status: BackupEventStatus;
  /** Horário da alteração no jogo, em segundos Unix (UTC). */
  updatedAt: number;
  /** Limite de confirmados; `0` = sem alteração (o addon não conhece o do site). */
  maxAttendees: number;
  /** Aceita visitantes; `null` = sem alteração. */
  guestsAllowed: boolean | null;
  /** Personagem que fez a alteração no jogo. */
  changedBy: string;
}

export interface BackupProfession {
  /** ID da linha de habilidade no jogo, igual em todos os idiomas; `0` = desconhecido. */
  id: number;
  level: number;
  max: number;
  /** Nome no idioma do jogo de quem anunciou. */
  name: string;
}

export interface BackupProfessions {
  character: string;
  /** Horário da leitura no jogo, em segundos Unix (UTC). */
  updatedAt: number;
  professions: BackupProfession[];
}

export interface BackupItemLevel {
  character: string;
  updatedAt: number;
  itemLevel: number;
  /** Main da conta: igual a `character` = é o main; vazio = não definido; outro nome = alt dele. */
  main: string;
}

export interface BackupTogether {
  character: string;
  /** Segundos em grupo com outro membro da guilda (total acumulado, só cresce). */
  seconds: number;
}

export interface AddonBackup {
  version: number;
  game: 'forever';
  /** Horário de geração, em segundos Unix (UTC). Backups mais novos têm número maior. */
  generatedAt: number;
  /** `exportNumber` da VDL1 que o addon tinha (0 se nenhuma). Informativo. */
  exportNumber: number;
  /** Personagem que gerou o backup (pode ser vazio). */
  generatedBy: string;
  events: BackupEvent[];
  attendance: PresenceEvent[];
  professions: BackupProfessions[];
  itemLevels: BackupItemLevel[];
  together: BackupTogether[];
}

const byCharacter = <T extends { character: string }>(list: T[]) =>
  [...list].sort((a, b) => byText(a.character, b.character));

/** Payload em texto, na ordem da especificação. */
export function buildBackupPayload(data: AddonBackup): string {
  const fields: (string | number)[] = [
    MARKER,
    data.version,
    data.game,
    data.generatedAt,
    data.exportNumber,
    data.generatedBy,
  ];
  const events = [...data.events].sort((a, b) => byText(a.id, b.id));
  fields.push(events.length);
  for (const e of events) {
    fields.push(
      e.id,
      e.origin,
      e.title,
      e.startsAt,
      e.description,
      e.organizer,
      e.status,
      e.updatedAt,
      e.maxAttendees,
      e.guestsAllowed === null ? '' : e.guestsAllowed ? '1' : '0',
      e.changedBy,
    );
  }
  fields.push(...presenceSectionFields(data.attendance));
  const professions = byCharacter(data.professions);
  fields.push(professions.length);
  for (const p of professions) {
    fields.push(p.character, p.updatedAt, p.professions.length);
    for (const x of p.professions) fields.push(x.id, x.level, x.max, x.name);
  }
  const itemLevels = byCharacter(data.itemLevels);
  fields.push(itemLevels.length);
  for (const m of itemLevels) fields.push(m.character, m.updatedAt, m.itemLevel, m.main);
  const together = byCharacter(data.together);
  fields.push(together.length);
  for (const t of together) fields.push(t.character, t.seconds);
  return encodeFields(fields);
}

/** Lê os campos em sequência, recusando o payload quando faltam campos. */
class Cursor {
  pos: number;
  constructor(
    private readonly f: string[],
    start: number,
  ) {
    this.pos = start;
  }
  text(): string {
    if (this.pos >= this.f.length) throw new AddonDecodeFailure('payload');
    return this.f[this.pos++];
  }
  int(): number {
    return int(this.text());
  }
  /** Personagem: não vazio e sem repetição na seção. */
  character(seen: Set<string>): string {
    const value = this.text();
    if (!value.trim() || seen.has(value)) throw new AddonDecodeFailure('payload');
    seen.add(value);
    return value;
  }
}

function readEvent(c: Cursor): BackupEvent {
  const id = c.text();
  const origin = c.text();
  if (!id || (origin !== 'jogo' && origin !== 'site')) throw new AddonDecodeFailure('payload');
  const title = c.text();
  const startsAt = c.int();
  const description = c.text();
  const organizer = c.text();
  const status = c.text();
  if (status !== 'ativo' && status !== 'cancelado' && status !== 'excluido') {
    throw new AddonDecodeFailure('payload');
  }
  const updatedAt = c.int();
  const maxAttendees = c.int();
  const guests = c.text();
  if (guests !== '1' && guests !== '0' && guests !== '') throw new AddonDecodeFailure('payload');
  return {
    id,
    origin,
    title,
    startsAt,
    description,
    organizer,
    status,
    updatedAt,
    maxAttendees,
    guestsAllowed: guests === '' ? null : guests === '1',
    changedBy: c.text(),
  };
}

export function parseBackupPayload(bytes: Uint8Array): AddonBackup {
  const f = readFields(bytes);
  if (f.length < HEADER_FIELDS || f[0] !== MARKER) throw new AddonDecodeFailure('payload');
  const version = int(f[1]);
  if (version !== BACKUP_FORMAT_VERSION) throw new AddonDecodeFailure('version');
  if (f[2] !== 'forever') throw new AddonDecodeFailure('payload');
  const c = new Cursor(f, HEADER_FIELDS);

  // 1. Eventos
  const eventCount = c.int();
  const events: BackupEvent[] = [];
  const eventIds = new Set<string>();
  for (let i = 0; i < eventCount; i++) {
    if (c.pos + EVENT_FIELDS > f.length) throw new AddonDecodeFailure('payload');
    const event = readEvent(c);
    if (eventIds.has(event.id)) throw new AddonDecodeFailure('payload');
    eventIds.add(event.id);
    events.push(event);
  }

  // 2. Presenças (corpo da VDLP1)
  const attendance = readPresenceSection(f, c.pos);
  c.pos = attendance.pos;

  // 3. Profissões
  const professions: BackupProfessions[] = [];
  let seen = new Set<string>();
  for (let i = 0, n = c.int(); i < n; i++) {
    const character = c.character(seen);
    const updatedAt = c.int();
    const count = c.int();
    if (count > MAX_PROFESSIONS || c.pos + count * PROFESSION_FIELDS > f.length) {
      throw new AddonDecodeFailure('payload');
    }
    const list: BackupProfession[] = [];
    for (let p = 0; p < count; p++) {
      list.push({ id: c.int(), level: c.int(), max: c.int(), name: c.text() });
    }
    professions.push({ character, updatedAt, professions: list });
  }

  // 4. Item level e main
  const itemLevels: BackupItemLevel[] = [];
  seen = new Set<string>();
  for (let i = 0, n = c.int(); i < n; i++) {
    itemLevels.push({
      character: c.character(seen),
      updatedAt: c.int(),
      itemLevel: c.int(),
      main: c.text(),
    });
  }

  // 5. Tempo jogado junto
  const together: BackupTogether[] = [];
  seen = new Set<string>();
  for (let i = 0, n = c.int(); i < n; i++) {
    together.push({ character: c.character(seen), seconds: c.int() });
  }

  if (c.pos !== f.length) throw new AddonDecodeFailure('payload');
  return {
    version,
    game: 'forever',
    generatedAt: int(f[3]),
    exportNumber: int(f[4]),
    generatedBy: f[5],
    events,
    attendance: attendance.events,
    professions,
    itemLevels,
    together,
  };
}

/** Gera a string `VDLB1` (a de restauração, no site; a de backup, no addon e nos testes). */
export function encodeAddonBackup(data: AddonBackup): Promise<string> {
  return wrapAddonString(MARKER, BACKUP_FORMAT_VERSION, buildBackupPayload(data));
}

/** Decodifica e valida uma string `VDLB1`. Lança `AddonDecodeFailure`. */
export async function decodeAddonBackup(text: string): Promise<AddonBackup> {
  return parseBackupPayload(await unwrapAddonString(text, MARKER, BACKUP_FORMAT_VERSION));
}
