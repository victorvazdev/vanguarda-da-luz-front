// Exemplos da string de exportação para os testes do addon (docs/exemplos-addon).
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
