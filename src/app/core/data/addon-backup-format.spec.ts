import { AddonDecodeFailure, adler32, encodeFields, wrapAddonString } from './addon-format';
import {
  buildBackupPayload,
  decodeAddonBackup,
  encodeAddonBackup,
  type AddonBackup,
} from './addon-backup-format';

/**
 * Cópia de docs/exemplos-addon/backup.txt, gerada pelo addon (tests/addon confere que é igual
 * ao arquivo). Resultado esperado: docs/exemplos-addon/backup-esperado.lua; payload
 * descompactado: docs/exemplos-addon/backup-payload.txt.
 */
const EXEMPLO =
  'VDLB1:1574247512:1nvZUnnqq478uSQNGde5D96)MBH(ds00kdkkG42KKTPBj2B6yhtAfhGhbK4faXboJ4gx9Bcpjm2oPO4Q4dE9OVz)MVzMpRHjNm6fsqgbx5itLHKECqIwR84NDbEjQ2Gj2zLosmbVxckLh8YOzVEJAuwAc(Ms9KPxkloxd34w4urWyYyZDI5grAvkWxAPrmCzPHWzB5noQPiHXqQlVSntt(m(tYjmzn5ISOUbh8KXeUaZehL6Q)z9pAZ841eEK4tcZs7glzkgSN8caS0w52PFzaxhfOcKW(Tb3dRgf8XtLZVmQyO)IZcV(vEN70qHT04RHt3PN5OyXA7s(4P5UkN4Ahv)DY6EwxjcdKXXCROGJD58uSaffUPKrGIvu9V3yZqrPjBLJqMI)(5VjkDZDfIIMUzQj75v2CoEqamgRSyF5h3Slapoud1FHUdf1FT(p1)YSDp4)HX3M8(ztKtF7vVlIgLPsrgrQGtCufMlsnZjSR57yu69OfQ8bWMTYb2UnP9yn8)Rg2Qu)(vUdU1t10ijWfizYfJwF)wi)Tqsg1hKQMxbEXWWL3U2MzX916oBz3DuCUHAFEse4dmrXWzgIqYImqCid471cWKFHnNnGTUiwMhshSvjMJFOMSvChEshUu1xrhqEkEy0)pNEwv)2Hw)PQgcyg(h';

const ESPERADO: AddonBackup = {
  version: 1,
  game: 'forever',
  generatedAt: 1794420000,
  exportNumber: 1794409200,
  generatedBy: 'Victor Vaz',
  events: [
    {
      id: 'G7cQx2LmP9aRt4VbN1sK',
      origin: 'jogo',
      title: 'Treino de PvP: Vale Alterac',
      startsAt: 1794870000,
      description: 'Ponto de encontro em Altaforja.\nTragam "Poção de Cura" | elixires.',
      organizer: 'Victor Vaz',
      status: 'ativo',
      updatedAt: 1794415000,
      maxAttendees: 25,
      guestsAllowed: false,
      changedBy: 'Victor Vaz',
    },
    {
      id: 'pL5wE1dN7sA3gF6hJ0Ko',
      origin: 'site',
      title: 'Encontro da guilda (novo horário)',
      startsAt: 1796518800,
      description: 'Conversa sobre a próxima temporada — todos são bem-vindos.',
      organizer: 'Tavia',
      status: 'ativo',
      updatedAt: 1794418000,
      maxAttendees: 0,
      guestsAllowed: null,
      changedBy: 'Árya Ñúñez',
    },
  ],
  attendance: [
    {
      id: '3kTq9ZcV1bWfX7rLm2Pa',
      records: [
        { character: 'Dorvan Pedra', status: 0, updatedAt: 1794411000 },
        { character: 'Victor Vaz', status: 1, updatedAt: 1794410000 },
      ],
    },
    {
      id: 'G7cQx2LmP9aRt4VbN1sK',
      records: [{ character: 'Árya Ñúñez', status: 1, updatedAt: 1794416000 }],
    },
  ],
  professions: [
    { character: 'Dorvan Pedra', updatedAt: 1794200000, professions: [] },
    {
      character: 'Maren Luz',
      updatedAt: 1794300000,
      professions: [{ id: 0, level: 120, max: 150, name: 'Alquimia' }],
    },
    {
      character: 'Victor Vaz',
      updatedAt: 1794400000,
      professions: [
        { id: 164, level: 225, max: 300, name: 'Ferraria' },
        { id: 186, level: 230, max: 300, name: 'Mineração' },
      ],
    },
  ],
  itemLevels: [
    { character: 'Maren Luz', updatedAt: 1794300000, itemLevel: 28, main: '' },
    { character: 'Victor Alt', updatedAt: 1794390000, itemLevel: 12, main: 'Victor Vaz' },
    { character: 'Victor Vaz', updatedAt: 1794400000, itemLevel: 31, main: 'Victor Vaz' },
  ],
  together: [
    { character: 'Victor Vaz', seconds: 36000 },
    { character: 'Árya Ñúñez', seconds: 5400 },
  ],
};

async function failure(text: string) {
  try {
    await decodeAddonBackup(text);
    return null;
  } catch (e) {
    return e instanceof AddonDecodeFailure ? e.reason : 'other';
  }
}

/** String com o payload informado, já no envelope VDLB1 (para testar o payload). */
const withPayload = (fields: (string | number)[]) =>
  wrapAddonString('VDLB', 1, encodeFields(fields));

const HEADER = ['VDLB', 1, 'forever', 100, 0, 'Victor Vaz'];
/** Evento válido (11 campos). */
const EVENT = ['e1', 'jogo', 'Raid', 200, '', 'Maren Luz', 'ativo', 150, 40, '1', 'Maren Luz'];

describe('String de backup do addon (VDLB1)', () => {
  it('decodifica o exemplo gerado pelo addon', async () => {
    expect(await decodeAddonBackup(EXEMPLO)).toEqual(ESPERADO);
  });

  it('conta o tamanho dos campos em bytes UTF-8 (nomes com acentos)', () => {
    const payload = buildBackupPayload(ESPERADO);
    expect(new TextEncoder().encode('Árya Ñúñez')).toHaveLength(14);
    expect(new TextEncoder().encode('Mineração')).toHaveLength(11);
    expect(payload).toContain('14:Árya Ñúñez4:5400');
    expect(payload).toContain('11:Mineração');
    expect(payload.startsWith('4:VDLB1:17:forever10:179442000010:179440920010:Victor Vaz')).toBe(
      true,
    );
  });

  it('monta o mesmo payload do addon (mesmo checksum) e decodifica o que gera', async () => {
    // A compactação do addon (LibDeflate) e a do navegador podem diferir; o payload, não.
    expect(adler32(new TextEncoder().encode(buildBackupPayload(ESPERADO)))).toBe(1574247512);
    expect(await decodeAddonBackup(await encodeAddonBackup(ESPERADO))).toEqual(ESPERADO);
  });

  it('ordena eventos, presenças e personagens como o addon', () => {
    const reversed: AddonBackup = {
      ...ESPERADO,
      events: [...ESPERADO.events].reverse(),
      attendance: [...ESPERADO.attendance].reverse(),
      professions: [...ESPERADO.professions].reverse(),
      itemLevels: [...ESPERADO.itemLevels].reverse(),
      together: [...ESPERADO.together].reverse(),
    };
    expect(buildBackupPayload(reversed)).toBe(buildBackupPayload(ESPERADO));
  });

  it('ida e volta com um evento excluído no jogo', async () => {
    const deleted: AddonBackup = {
      ...ESPERADO,
      events: [{ ...ESPERADO.events[1], status: 'excluido', updatedAt: 1794419000 }],
    };
    const payload = buildBackupPayload(deleted);
    expect(payload).toContain('8:excluido10:1794419000');
    expect(await decodeAddonBackup(await encodeAddonBackup(deleted))).toEqual(deleted);
  });

  it('a string de eventos (VDL1) continua recusando "excluido"', async () => {
    const { decodeAddonExport } = await import('./addon-format');
    const vdl1 = (status: string) =>
      wrapAddonString(
        'VDL',
        1,
        encodeFields(['VDL', 1, 'forever', 1, 0, 9, 1, 'e1', 'Raid', 5, '', 'Maren', status, 3]),
      );
    await expect(decodeAddonExport(await vdl1('cancelado'))).resolves.toMatchObject({
      events: [{ status: 'cancelado' }],
    });
    await expect(decodeAddonExport(await vdl1('excluido'))).rejects.toBeInstanceOf(
      AddonDecodeFailure,
    );
  });

  it('aceita espaços e quebras de linha nas pontas', async () => {
    expect((await decodeAddonBackup(`  ${EXEMPLO}\n`)).events).toHaveLength(2);
  });

  it('recusa prefixo, versão, codificação e checksum inválidos', async () => {
    expect(await failure('VDLP1:1:abc')).toBe('prefix');
    expect(await failure('qualquer coisa')).toBe('prefix');
    expect(await failure(EXEMPLO.replace('VDLB1:', 'VDLB2:'))).toBe('version');
    expect(await failure(`${EXEMPLO}!`)).toBe('encoding');
    expect(await failure(EXEMPLO.replace(':1574247512:', ':1574247513:'))).toBe('checksum');
    expect(await failure(EXEMPLO.slice(0, Math.floor(EXEMPLO.length * 0.6)))).not.toBeNull();
  });

  it('aceita um backup sem nada (string de restauração vazia)', async () => {
    const empty = await decodeAddonBackup(await withPayload([...HEADER, 0, 0, 0, 0, 0]));
    expect(empty.events).toEqual([]);
    expect(empty.together).toEqual([]);
  });

  it('recusa payloads inconsistentes', async () => {
    const rest = [0, 0, 0, 0];
    const bad = async (fields: (string | number)[]) => failure(await withPayload(fields));
    // Campos sobrando e faltando.
    expect(await bad([...HEADER, 0, ...rest, 'x'])).toBe('payload');
    expect(await bad([...HEADER, 0, 0, 0, 0])).toBe('payload');
    // Contagem de eventos maior que o conteúdo.
    expect(await bad([...HEADER, 2, ...EVENT, ...rest])).toBe('payload');
    // Evento repetido.
    expect(await bad([...HEADER, 2, ...EVENT, ...EVENT, ...rest])).toBe('payload');
    // origin, status e guestsAllowed fora dos valores listados.
    const event = (i: number, v: string) => EVENT.map((f, k) => (k === i ? v : f));
    expect(await bad([...HEADER, 1, ...event(1, 'addon'), ...rest])).toBe('payload');
    expect(await bad([...HEADER, 1, ...event(6, 'ok'), ...rest])).toBe('payload');
    expect(await bad([...HEADER, 1, ...event(6, 'excluída'), ...rest])).toBe('payload');
    expect(await bad([...HEADER, 1, ...event(6, 'excluido'), ...rest])).toBeNull();
    expect(await bad([...HEADER, 1, ...event(9, 'sim'), ...rest])).toBe('payload');
    // Número inválido.
    expect(await bad([...HEADER, 1, ...event(3, '-5'), ...rest])).toBe('payload');
    // Mais de 2 profissões.
    const three = [3, 1, 1, 1, 'A', 2, 1, 1, 'B', 3, 1, 1, 'C'];
    expect(await bad([...HEADER, 0, 0, 1, 'Maren Luz', 5, ...three, 0, 0])).toBe('payload');
    // Personagem repetido na mesma seção (profissões, item level, tempo junto).
    expect(await bad([...HEADER, 0, 0, 2, 'Maren Luz', 5, 0, 'Maren Luz', 6, 0, 0, 0])).toBe(
      'payload',
    );
    expect(
      await bad([...HEADER, 0, 0, 0, 2, 'Maren Luz', 5, 20, '', 'Maren Luz', 6, 21, '', 0]),
    ).toBe('payload');
    expect(await bad([...HEADER, 0, 0, 0, 0, 2, 'Maren Luz', 5, 'Maren Luz', 6])).toBe('payload');
    // Presença inconsistente (evento sem registros).
    expect(await bad([...HEADER, 0, 1, 'e1', 0, 0, 0, 0])).toBe('payload');
    // Outro jogo e outro marcador.
    expect(await bad(['VDLB', 1, 'retail', 100, 0, '', 0, ...rest])).toBe('payload');
    expect(await bad(['VDLP', 1, 'forever', 100, 0, '', 0, ...rest])).toBe('payload');
    // Válido, para comparar.
    expect(await bad([...HEADER, 1, ...EVENT, ...rest])).toBeNull();
  });
});
