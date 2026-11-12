import { AddonDecodeFailure } from './addon-format';
import {
  buildPresencePayload,
  decodePresenceExport,
  encodePresenceExport,
  type PresenceExport,
} from './addon-presence-format';

/**
 * Cópia de docs/exemplos-addon/presencas.txt, gerada pelo addon (tests/addon confere que é
 * igual ao arquivo). Resultado esperado: docs/exemplos-addon/presencas-esperado.lua.
 */
const EXEMPLO =
  'VDLP1:1970290092:v5ytkimmqu4RsocZKgOnZsPleScfPg)zxSMcI0w6Owu35rWJIBDBUygfSqNDFZBE8nkYKMLJegtvTSR3XieaTsHYea(dGwgaskbk6yrNEBPb3TQADmNvlZTifHskTL7TnIC3EoSzOlIaaAAULDnISl3dYgIGOFomhkp3YcJDCyyccN2jRNKCDJQzrzb0p7KEP77zkY)GVzf(N(3(xUrvdFl85d';

const ESPERADO: PresenceExport = {
  version: 1,
  game: 'forever',
  generatedAt: 1794412800,
  exportNumber: 1794409200,
  events: [
    {
      id: '3kTq9ZcV1bWfX7rLm2Pa',
      records: [
        { character: 'Dorvan Pedra', status: 0, updatedAt: 1794411000 },
        { character: 'Maren Luz', status: 1, updatedAt: 1794410300 },
        { character: 'Victor Vaz', status: 1, updatedAt: 1794410000 },
      ],
    },
    {
      id: 'Hq2mB8xY4nRcT0vKs9Ue',
      records: [{ character: 'Árya Ñúñez', status: 1, updatedAt: 1794412000 }],
    },
  ],
};

async function failure(text: string) {
  try {
    await decodePresenceExport(text);
    return null;
  } catch (e) {
    return e instanceof AddonDecodeFailure ? e.reason : 'other';
  }
}

/** String com o payload informado, já no envelope VDLP1 (para testar o payload). */
async function withPayload(fields: (string | number)[]) {
  const { wrapAddonString, encodeFields } = await import('./addon-format');
  return wrapAddonString('VDLP', 1, encodeFields(fields));
}

describe('String de presenças do addon (VDLP1)', () => {
  it('decodifica o exemplo gerado pelo addon', async () => {
    expect(await decodePresenceExport(EXEMPLO)).toEqual(ESPERADO);
  });

  it('conta o tamanho dos campos em bytes UTF-8 (nome com acentos)', () => {
    const payload = buildPresencePayload(ESPERADO);
    expect(new TextEncoder().encode('Árya Ñúñez')).toHaveLength(14);
    expect(payload).toContain('14:Árya Ñúñez1:110:1794412000');
    expect(payload.startsWith('4:VDLP1:17:forever10:179441280010:17944092001:2')).toBe(true);
  });

  it('monta o mesmo payload do addon (mesmo checksum) e decodifica o que gera', async () => {
    // A compactação do addon (LibDeflate) e a do navegador podem diferir; o payload, não.
    const { adler32 } = await import('./addon-format');
    expect(adler32(new TextEncoder().encode(buildPresencePayload(ESPERADO)))).toBe(1970290092);
    expect(await decodePresenceExport(await encodePresenceExport(ESPERADO))).toEqual(ESPERADO);
  });

  it('aceita espaços e quebras de linha nas pontas', async () => {
    expect((await decodePresenceExport(`  ${EXEMPLO}\n`)).events).toHaveLength(2);
  });

  it('recusa prefixo, versão, codificação e checksum inválidos', async () => {
    expect(await failure('VDL1:1:abc')).toBe('prefix');
    expect(await failure('qualquer coisa')).toBe('prefix');
    expect(await failure(EXEMPLO.replace('VDLP1:', 'VDLP2:'))).toBe('version');
    expect(await failure(`${EXEMPLO}!`)).toBe('encoding');
    expect(await failure(EXEMPLO.replace(':1970290092:', ':1970290093:'))).toBe('checksum');
    expect(await failure(EXEMPLO.slice(0, Math.floor(EXEMPLO.length * 0.6)))).not.toBeNull();
  });

  it('recusa payloads inconsistentes', async () => {
    const header = ['VDLP', 1, 'forever', 100, 0];
    // Contagem de eventos maior que o conteúdo.
    expect(await failure(await withPayload([...header, 2, 'e1', 1, 'A B', 1, 5]))).toBe('payload');
    // Campos sobrando.
    expect(await failure(await withPayload([...header, 1, 'e1', 1, 'A B', 1, 5, 'x']))).toBe(
      'payload',
    );
    // Status fora de 0/1.
    expect(await failure(await withPayload([...header, 1, 'e1', 1, 'A B', 2, 5]))).toBe('payload');
    // Personagem repetido no evento.
    expect(
      await failure(await withPayload([...header, 1, 'e1', 2, 'A B', 1, 5, 'A B', 0, 6])),
    ).toBe('payload');
    // Evento sem registros.
    expect(await failure(await withPayload([...header, 1, 'e1', 0]))).toBe('payload');
    // Outro jogo e outro marcador.
    expect(await failure(await withPayload(['VDLP', 1, 'retail', 100, 0, 0]))).toBe('payload');
    expect(await failure(await withPayload(['VDL', 1, 'forever', 100, 0, 0]))).toBe('payload');
    // Sem eventos é válida.
    expect((await decodePresenceExport(await withPayload([...header, 0]))).events).toEqual([]);
  });
});
