// Exemplos da string de exportação para os testes do addon (docs/exemplos-addon) e exemplos da
// strings de presenças e de backup vindos do addon.
// Confere os arquivos versionados; com ATUALIZAR_EXEMPLOS=1, gera-os de novo
// (`npm run addon:exemplos`).
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  AddonDecodeFailure,
  buildPayload,
  decodeAddonExport,
  encodeAddonExport,
  type AddonExport,
} from '../../src/app/core/data/addon-format';
import {
  buildBackupPayload,
  decodeAddonBackup,
  encodeAddonBackup,
  type AddonBackup,
} from '../../src/app/core/data/addon-backup-format';
import { decodePresenceExport } from '../../src/app/core/data/addon-presence-format';

const DIR = 'docs/exemplos-addon';
const UPDATE = process.env['ATUALIZAR_EXEMPLOS'] === '1';
const s = (iso: string) => Date.parse(iso) / 1000;

/** Dados fictícios: acentos, ":" e "|" no título, quebras de linha e aspas na descrição. */
const EXAMPLE: AddonExport = {
  version: 1,
  game: 'forever',
  exportNumber: s('2026-11-11T15:00:00Z'),
  windowStart: s('2026-11-11T03:00:00Z'),
  windowEnd: s('2027-01-11T03:00:00Z'),
  events: [
    {
      id: '3kTq9ZcV1bWfX7rLm2Pa',
      title: 'Raid: Núcleo Derretido',
      startsAt: s('2026-11-14T00:00:00Z'),
      description:
        'Concentração às 20h45 na entrada da masmorra.\nTraga poções de resistência ao fogo e "Água Gelada".',
      organizer: 'Maren',
      status: 'ativo',
      updatedAt: s('2026-11-05T18:20:00Z'),
    },
    {
      id: 'Hq2mB8xY4nRcT0vKs9Ue',
      title: 'Masmorras em grupo | Iniciantes',
      startsAt: s('2026-11-18T23:00:00Z'),
      description: 'Cancelado: muitos membros viajando no feriado.',
      organizer: 'Dorvan',
      status: 'cancelado',
      updatedAt: s('2026-11-10T21:05:00Z'),
    },
    {
      id: 'pL5wE1dN7sA3gF6hJ0Ko',
      title: 'Encontro da guilda',
      startsAt: s('2026-12-05T23:00:00Z'),
      description: 'Conversa sobre a próxima temporada — todos são bem-vindos.',
      organizer: 'Tavia',
      status: 'ativo',
      updatedAt: s('2026-11-08T12:00:00Z'),
    },
  ],
};

/** Texto em Lua 5.1 entre aspas: escapa \\, " e caracteres de controle (UTF-8 fica como está). */
function luaString(value: string): string {
  return (
    '"' +
    value.replace(/[\\"\x00-\x1f]/g, (ch) =>
      ch === '\\' ? '\\\\' : ch === '"' ? '\\"' : ch === '\n' ? '\\n' : `\\${ch.charCodeAt(0)}`,
    ) +
    '"'
  );
}

/** Tabela Lua igual à devolvida pelo decodificador de referência (docs/formato-string-addon.md). */
function toLuaTable(data: AddonExport): string {
  const events = data.events
    .map(
      (e) => `    {
      id = ${luaString(e.id)},
      title = ${luaString(e.title)},
      startsAt = ${e.startsAt},
      description = ${luaString(e.description)},
      organizer = ${luaString(e.organizer)},
      status = ${luaString(e.status)},
      updatedAt = ${e.updatedAt},
    },`,
    )
    .join('\n');
  return `-- Dados esperados após decodificar valida.txt (docs/formato-string-addon.md).
-- Gerado por \`npm run addon:exemplos\`; não edite à mão.
return {
  version = ${data.version},
  game = ${luaString(data.game)},
  exportNumber = ${data.exportNumber},
  windowStart = ${data.windowStart},
  windowEnd = ${data.windowEnd},
  count = ${data.events.length},
  events = {
${events}
  },
}
`;
}

const read = (name: string) => readFileSync(`${DIR}/${name}`, 'utf8');

describe('Exemplos para o addon (docs/exemplos-addon)', () => {
  it.runIf(UPDATE)('gera os arquivos de exemplo', async () => {
    if (!existsSync(DIR)) mkdirSync(DIR, { recursive: true });
    const valid = await encodeAddonExport(EXAMPLE);
    // Cópia incompleta: a string cortada no meio, como num Ctrl+C parcial.
    const corrupted = valid.slice(0, Math.floor(valid.length * 0.6));
    writeFileSync(`${DIR}/valida.txt`, `${valid}\n`);
    writeFileSync(`${DIR}/payload.txt`, buildPayload(EXAMPLE));
    writeFileSync(`${DIR}/esperado.lua`, toLuaTable(EXAMPLE));
    writeFileSync(`${DIR}/corrompida.txt`, `${corrupted}\n`);
  });

  it('valida.txt decodifica para os dados de esperado.lua e payload.txt', async () => {
    const decoded = await decodeAddonExport(read('valida.txt'));
    expect(decoded).toEqual(EXAMPLE);
    expect(read('esperado.lua')).toBe(toLuaTable(decoded));
    expect(read('payload.txt')).toBe(buildPayload(decoded));
  });

  it('corrompida.txt é recusada', async () => {
    const error = await decodeAddonExport(read('corrompida.txt')).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(AddonDecodeFailure);
  });

  it('corrompida.txt é a válida cortada (detectável também pelo addon)', () => {
    const valid = read('valida.txt').trim();
    const corrupted = read('corrompida.txt').trim();
    expect(valid.startsWith(corrupted)).toBe(true);
    expect(corrupted.length).toBeLessThan(valid.length);
  });
});

// ---------- String de presenças (VDLP1), gerada pelo addon ----------
// Os arquivos vêm do repositório do addon (docs/exemplos-addon); aqui só conferimos que o site
// os decodifica como o addon espera.

/** Lê `presencas-esperado.lua`: { [id] = { ["Nome Sobrenome"] = { s = 0|1, t = n } } }. */
function parseExpectedPresences(lua: string) {
  const header = (key: string) => Number(new RegExp(`${key} = (\\d+)`).exec(lua)![1]);
  const events: Record<string, Record<string, { status: number; updatedAt: number }>> = {};
  let current: Record<string, { status: number; updatedAt: number }> | null = null;
  for (const line of lua.split('\n')) {
    const event = /^\s*\["([^"]+)"\] = \{$/.exec(line);
    if (event) events[event[1]] = current = {};
    const record = /^\s*\["([^"]+)"\] = \{ s = (\d), t = (\d+) \},$/.exec(line);
    if (record && current) {
      current[record[1]] = { status: Number(record[2]), updatedAt: Number(record[3]) };
    }
  }
  return {
    game: /game = "(\w+)"/.exec(lua)![1],
    generatedAt: header('generatedAt'),
    exportNumber: header('exportNumber'),
    events,
  };
}

describe('Exemplos de presenças do addon (docs/exemplos-addon)', () => {
  it('presencas.txt decodifica para os dados de presencas-esperado.lua', async () => {
    const decoded = await decodePresenceExport(read('presencas.txt'));
    const expected = parseExpectedPresences(read('presencas-esperado.lua'));
    expect(Object.keys(expected.events)).toHaveLength(2);
    expect({
      game: decoded.game,
      generatedAt: decoded.generatedAt,
      exportNumber: decoded.exportNumber,
      events: Object.fromEntries(
        decoded.events.map((e) => [
          e.id,
          Object.fromEntries(
            e.records.map((r) => [r.character, { status: r.status, updatedAt: r.updatedAt }]),
          ),
        ]),
      ),
    }).toEqual(expected);
  });

  it('os eventos de presencas.txt são os de valida.txt', async () => {
    const presences = await decodePresenceExport(read('presencas.txt'));
    const events = await decodeAddonExport(read('valida.txt'));
    const ids = new Set(events.events.map((e) => e.id));
    expect(presences.events.every((e) => ids.has(e.id))).toBe(true);
  });

  it('o teste unitário do decodificador usa a mesma string de presencas.txt', () => {
    const spec = readFileSync('src/app/core/data/addon-presence-format.spec.ts', 'utf8');
    expect(spec).toContain(`'${read('presencas.txt').trim()}'`);
  });
});

// ---------- String de backup (VDLB1), gerada pelo addon ----------
// Os arquivos vêm do repositório do addon (docs/exemplos-addon); aqui conferimos que o site os
// decodifica como o addon espera e que monta o mesmo payload, byte a byte.

/** Texto Lua entre aspas → string (escapes \n, \" e \\). */
const unLua = (value: string) =>
  JSON.parse(
    value.replace(/\\(\d{1,3})/g, (_, n) => `\\u${Number(n).toString(16).padStart(4, '0')}`),
  );

/** Lê `backup-esperado.lua`, seção por seção, no formato do decodificador de referência. */
function parseExpectedBackup(lua: string) {
  const header = (key: string) => new RegExp(`^  ${key} = (.+),$`, 'm').exec(lua)![1];
  const sections: Record<string, string[]> = {};
  let current: string[] | null = null;
  for (const line of lua.split('\n')) {
    const open = /^ {2}(\w+) = \{$/.exec(line);
    if (open) sections[open[1]] = current = [];
    else if (/^ {2}\},$/.test(line)) current = null;
    else current?.push(line);
  }
  const str = '"(?:[^"\\\\]|\\\\.)*"';
  const events = sections['events']
    .join('\n')
    .split(/^ {4}\},?$/m)
    .flatMap((block) => {
      const fields = Object.fromEntries(
        [...block.matchAll(new RegExp(`^ {6}(\\w+) = (${str}|\\d+|true|false),$`, 'gm'))].map(
          (m) => [
            m[1],
            m[2].startsWith('"')
              ? unLua(m[2])
              : m[2] === 'true' || (m[2] === 'false' ? false : Number(m[2])),
          ],
        ),
      );
      return Object.keys(fields).length ? [fields] : [];
    });
  const attendance: Record<string, Record<string, { s: number; t: number }>> = {};
  let event = '';
  for (const line of sections['attendance']) {
    const e = /^ {4}\["([^"]+)"\] = \{$/.exec(line);
    if (e) attendance[(event = e[1])] = {};
    const r = /^ {6}\["([^"]+)"\] = \{ s = (\d), t = (\d+) \},$/.exec(line);
    if (r) attendance[event][r[1]] = { s: Number(r[2]), t: Number(r[3]) };
  }
  const professions: Record<string, { t: number; p: Record<string, unknown>[] }> = {};
  let character = '';
  for (const line of sections['professions']) {
    const c = /^ {4}\["([^"]+)"\] = \{ t = (\d+), p = \{(\} \},)?$/.exec(line);
    if (c) professions[(character = c[1])] = { t: Number(c[2]), p: [] };
    const p = /^ {6}\{ n = ("[^"]+"), l = (\d+), m = (\d+)(?:, i = (\d+))? \},$/.exec(line);
    if (p) {
      professions[character].p.push({
        n: unLua(p[1]),
        l: Number(p[2]),
        m: Number(p[3]),
        ...(p[4] ? { i: Number(p[4]) } : {}),
      });
    }
  }
  const members: Record<string, { t: number; i: number; m?: string }> = {};
  for (const line of sections['members']) {
    const m = /^ {4}\["([^"]+)"\] = \{ t = (\d+), i = (\d+)(?:, m = ("[^"]+"))? \},$/.exec(line);
    if (m)
      members[m[1]] = { t: Number(m[2]), i: Number(m[3]), ...(m[4] ? { m: unLua(m[4]) } : {}) };
  }
  const together: Record<string, number> = {};
  for (const line of sections['together']) {
    const t = /^ {4}\["([^"]+)"\] = (\d+),$/.exec(line);
    if (t) together[t[1]] = Number(t[2]);
  }
  return {
    game: unLua(header('game')),
    generatedAt: Number(header('generatedAt')),
    exportNumber: Number(header('exportNumber')),
    generatedBy: unLua(header('generatedBy')),
    events,
    attendance,
    professions,
    members,
    together,
  };
}

/** Dados decodificados pelo site no formato do decodificador de referência (Lua). */
function asReference(data: AddonBackup) {
  return {
    game: data.game,
    generatedAt: data.generatedAt,
    exportNumber: data.exportNumber,
    generatedBy: data.generatedBy,
    events: data.events.map((e) => ({
      id: e.id,
      origin: e.origin,
      title: e.title,
      startsAt: e.startsAt,
      description: e.description,
      organizer: e.organizer,
      status: e.status,
      updatedAt: e.updatedAt,
      ...(e.maxAttendees ? { max: e.maxAttendees } : {}),
      ...(e.guestsAllowed === null ? {} : { guests: e.guestsAllowed }),
      by: e.changedBy,
    })),
    attendance: Object.fromEntries(
      data.attendance.map((e) => [
        e.id,
        Object.fromEntries(e.records.map((r) => [r.character, { s: r.status, t: r.updatedAt }])),
      ]),
    ),
    professions: Object.fromEntries(
      data.professions.map((p) => [
        p.character,
        {
          t: p.updatedAt,
          p: p.professions.map((x) => ({
            n: x.name,
            l: x.level,
            m: x.max,
            ...(x.id ? { i: x.id } : {}),
          })),
        },
      ]),
    ),
    members: Object.fromEntries(
      data.itemLevels.map((m) => [
        m.character,
        { t: m.updatedAt, i: m.itemLevel, ...(m.main ? { m: m.main } : {}) },
      ]),
    ),
    together: Object.fromEntries(data.together.map((t) => [t.character, t.seconds])),
  };
}

describe('Exemplo de backup do addon (docs/exemplos-addon)', () => {
  it('backup.txt decodifica para os dados de backup-esperado.lua', async () => {
    const decoded = await decodeAddonBackup(read('backup.txt'));
    const expected = parseExpectedBackup(read('backup-esperado.lua'));
    expect(expected.events).toHaveLength(2);
    expect(Object.keys(expected.professions)).toHaveLength(3);
    expect(asReference(decoded)).toEqual(expected);
  });

  it('o site monta o mesmo payload de backup-payload.txt, byte a byte', async () => {
    const decoded = await decodeAddonBackup(read('backup.txt'));
    const payload = readFileSync(`${DIR}/backup-payload.txt`);
    expect(Buffer.from(buildBackupPayload(decoded), 'utf8').equals(payload)).toBe(true);
    // E o que o site gera também volta igual.
    const again = await decodeAddonBackup(await encodeAddonBackup(decoded));
    expect(Buffer.from(buildBackupPayload(again), 'utf8').equals(payload)).toBe(true);
  });

  it('o teste unitário do decodificador usa a mesma string de backup.txt', () => {
    const spec = readFileSync('src/app/core/data/addon-backup-format.spec.ts', 'utf8');
    expect(spec).toContain(`'${read('backup.txt').trim()}'`);
  });
});
