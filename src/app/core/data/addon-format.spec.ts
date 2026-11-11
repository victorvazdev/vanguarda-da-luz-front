import {
  ADDON_PREFIX,
  AddonDecodeFailure,
  adler32,
  buildPayload,
  decodeAddonExport,
  decodeForPrint,
  encodeAddonExport,
  encodeForPrint,
  type AddonExport,
} from './addon-format';

const bytes = (s: string) => new TextEncoder().encode(s);

const sample = (): AddonExport => ({
  version: 1,
  game: 'forever',
  exportNumber: 1_794_438_000,
  windowStart: 1_794_366_000,
  windowEnd: 1_799_636_400,
  events: [
    {
      id: 'b2',
      title: 'Masmorras: Ruínas',
      startsAt: 1_795_000_000,
      description: 'Linha 1\nLinha 2 — "aspas" | barra',
      organizer: 'Dorvan',
      status: 'cancelado',
      updatedAt: 1_794_400_000,
    },
    {
      id: 'a1',
      title: 'Raid semanal',
      startsAt: 1_794_500_000,
      description: 'Núcleo Derretido',
      organizer: 'Maren',
      status: 'ativo',
      updatedAt: 1_794_300_000,
    },
  ],
});

async function failure(text: string) {
  try {
    await decodeAddonExport(text);
    return null;
  } catch (e) {
    return e instanceof AddonDecodeFailure ? e.reason : 'other';
  }
}

describe('Adler-32 (igual a LibDeflate:Adler32)', () => {
  it('confere com os valores de referência', () => {
    expect(adler32(bytes(''))).toBe(1);
    expect(adler32(bytes('a'))).toBe(0x00620062);
    // Exemplo clássico da especificação: "Wikipedia" = 0x11E60398.
    expect(adler32(bytes('Wikipedia'))).toBe(0x11e60398);
  });

  it('fica sem sinal mesmo acima de 2^31', () => {
    const values = Array.from({ length: 200 }, (_, n) => adler32(bytes('x'.repeat(n * 37))));
    expect(values.some((v) => v > 2 ** 31)).toBe(true);
    expect(values.every((v) => Number.isInteger(v) && v >= 0 && v < 2 ** 32)).toBe(true);
  });
});

describe('Texto imprimível (igual a LibDeflate:EncodeForPrint)', () => {
  it('codifica 3 bytes em 4 caracteres, do bit menos significativo', () => {
    // "abc" = 97 + 98·256 + 99·65536 = 6513249 → 6 bits: 33, 9, 54, 24 → H j 2 y
    expect(encodeForPrint(bytes('abc'))).toBe('Hj2y');
  });

  it('sobra de 1 e 2 bytes vira 2 e 3 caracteres', () => {
    expect(encodeForPrint(bytes('a'))).toHaveLength(2);
    expect(encodeForPrint(bytes('ab'))).toHaveLength(3);
  });

  it('ida e volta com qualquer byte', () => {
    const all = Uint8Array.from({ length: 256 }, (_, i) => i);
    for (const n of [0, 1, 2, 3, 4, 5, 256]) {
      const slice = all.subarray(0, n);
      expect(decodeForPrint(encodeForPrint(slice))).toEqual(slice);
    }
  });

  it('usa somente letras, dígitos e parênteses', () => {
    expect(encodeForPrint(Uint8Array.from({ length: 300 }, (_, i) => i % 256))).toMatch(
      /^[a-zA-Z0-9()]+$/,
    );
  });

  it('recusa caracteres fora do alfabeto', () => {
    expect(() => decodeForPrint('abc!')).toThrow(AddonDecodeFailure);
  });
});

describe('Payload', () => {
  it('campos com o tamanho em bytes UTF-8, cabeçalho e eventos em ordem de início', () => {
    const payload = buildPayload({ ...sample(), events: sample().events.slice(1) });
    expect(payload).toBe(
      '3:VDL1:17:forever10:179443800010:179436600010:17996364001:1' +
        '2:a112:Raid semanal10:179450000017:Núcleo Derretido5:Maren5:ativo10:1794300000',
    );
  });

  it('ordena por início e, no empate, pelo ID', () => {
    const data = sample();
    data.events.push({ ...data.events[1], id: 'a0' });
    const ids = [...buildPayload(data).matchAll(/2:(a0|a1|b2)/g)].map((m) => m[1]);
    expect(ids).toEqual(['a0', 'a1', 'b2']);
  });
});

describe('String de exportação', () => {
  it('ida e volta preserva todos os dados', async () => {
    const text = await encodeAddonExport(sample());
    expect(text.startsWith(ADDON_PREFIX)).toBe(true);
    expect(text).toMatch(/^VDL1:\d+:[a-zA-Z0-9()]+$/);
    const decoded = await decodeAddonExport(text);
    expect(decoded).toEqual({
      ...sample(),
      events: [sample().events[1], sample().events[0]],
    });
  });

  it('checksum é o Adler-32 do payload descompactado', async () => {
    const data = sample();
    const text = await encodeAddonExport(data);
    expect(Number(text.split(':')[1])).toBe(adler32(bytes(buildPayload(data))));
  });

  it('exportação sem eventos também é válida', async () => {
    const decoded = await decodeAddonExport(await encodeAddonExport({ ...sample(), events: [] }));
    expect(decoded.events).toEqual([]);
  });

  it('detecta string incompleta, alterada ou de outra versão', async () => {
    const text = await encodeAddonExport(sample());
    const [prefix, sum, data] = text.split(':');
    expect(await failure(text.slice(0, Math.floor(text.length * 0.7)))).toMatch(
      /compression|checksum|payload/,
    );
    expect(await failure(`${prefix}:${Number(sum) + 1}:${data}`)).toBe('checksum');
    expect(await failure(`VDL2:${sum}:${data}`)).toBe('version');
    expect(await failure(`XYZ1:${sum}:${data}`)).toBe('prefix');
    expect(await failure(`${prefix}:${sum}:${data}!`)).toBe('encoding');
  });

  it('aceita espaços e quebras de linha nas pontas (colado do site)', async () => {
    const text = await encodeAddonExport(sample());
    expect((await decodeAddonExport(`  ${text}\n`)).events).toHaveLength(2);
  });
});
