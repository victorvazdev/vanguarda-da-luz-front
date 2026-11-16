import { decodeAddonBackup } from './addon-backup-format';
import {
  characterRows,
  emptyCharacterState,
  mergeCharacters,
  mergePresences,
  restoreBackup,
  togetherRows,
  type CharacterState,
} from './addon-backup-state';

const state = (): CharacterState => ({
  professions: {
    'Victor Vaz': {
      updatedAt: 100,
      professions: [{ id: 164, level: 200, max: 225, name: 'Ferraria' }],
    },
  },
  itemLevels: {
    'Victor Vaz': { updatedAt: 100, itemLevel: 30, main: 'Victor Vaz' },
    'Victor Alt': { updatedAt: 100, itemLevel: 12, main: 'Victor Vaz' },
  },
  together: { 'Victor Vaz': 1000, 'Victor Alt': 200, 'Maren Luz': 500 },
});

describe('Estado combinado dos backups', () => {
  it('vale o registro mais recente de cada personagem e o maior tempo junto', () => {
    const { state: next, changed } = mergeCharacters(state(), {
      professions: [
        { character: 'Victor Vaz', updatedAt: 90, professions: [] },
        { character: 'Maren Luz', updatedAt: 50, professions: [] },
      ],
      itemLevels: [{ character: 'Victor Vaz', updatedAt: 150, itemLevel: 31, main: 'Victor Vaz' }],
      together: [
        { character: 'Victor Vaz', seconds: 900 },
        { character: 'Maren Luz', seconds: 800 },
      ],
    });
    expect(changed).toBe(true);
    expect(next.professions['Victor Vaz'].updatedAt).toBe(100);
    expect(next.professions['Maren Luz']).toEqual({ updatedAt: 50, professions: [] });
    expect(next.itemLevels['Victor Vaz'].itemLevel).toBe(31);
    expect(next.together).toEqual({ 'Victor Vaz': 1000, 'Victor Alt': 200, 'Maren Luz': 800 });
  });

  it('juntar o mesmo dado de novo não muda nada', () => {
    const first = mergeCharacters(emptyCharacterState(), {
      professions: [{ character: 'A B', updatedAt: 5, professions: [] }],
      itemLevels: [{ character: 'A B', updatedAt: 5, itemLevel: 1, main: '' }],
      together: [{ character: 'A B', seconds: 5 }],
    });
    const again = mergeCharacters(first.state, {
      professions: [{ character: 'A B', updatedAt: 5, professions: [] }],
      itemLevels: [{ character: 'A B', updatedAt: 5, itemLevel: 1, main: '' }],
      together: [{ character: 'A B', seconds: 5 }],
    });
    expect(again.changed).toBe(false);
    expect(again.state).toEqual(first.state);
  });

  it('junta as presenças pelo registro mais recente', () => {
    const merged = mergePresences({ 'Maren Luz': { status: 1, updatedAt: 10 } }, [
      { character: 'Maren Luz', status: 0, updatedAt: 9 },
      { character: 'Victor Vaz', status: 1, updatedAt: 8 },
    ]);
    expect(merged.changed).toBe(true);
    expect(merged.records).toEqual({
      'Maren Luz': { status: 1, updatedAt: 10 },
      'Victor Vaz': { status: 1, updatedAt: 8 },
    });
    expect(
      mergePresences(merged.records, [{ character: 'Maren Luz', status: 1, updatedAt: 10 }]),
    ).toMatchObject({ changed: false });
  });
});

describe('String de restauração', () => {
  it('leva o estado e as presenças, sem eventos e sem autor', async () => {
    const now = new Date('2026-11-16T12:00:00Z');
    const backup = restoreBackup(
      state(),
      [
        { eventId: 'e1', records: { 'Maren Luz': { status: 1, updatedAt: 10 } } },
        { eventId: 'e2', records: {} },
      ],
      1794409200,
      now,
    );
    expect(backup).toMatchObject({
      generatedAt: now.getTime() / 1000,
      exportNumber: 1794409200,
      generatedBy: '',
      events: [],
      attendance: [{ id: 'e1', records: [{ character: 'Maren Luz', status: 1, updatedAt: 10 }] }],
    });
    // Volta igual depois de codificar (formato válido para o addon).
    const { encodeAddonBackup } = await import('./addon-backup-format');
    const decoded = await decodeAddonBackup(await encodeAddonBackup(backup));
    expect(decoded.together).toHaveLength(3);
    expect(decoded.itemLevels.map((m) => m.character)).toEqual(['Victor Alt', 'Victor Vaz']);
  });
});

describe('Tabelas dos dados do addon', () => {
  it('uma linha por personagem, com main e alt', () => {
    const rows = characterRows(state());
    expect(rows.map((r) => r.character)).toEqual(['Maren Luz', 'Victor Alt', 'Victor Vaz']);
    expect(rows[1]).toMatchObject({ main: 'Victor Vaz', isAlt: true, itemLevel: 12 });
    expect(rows[2]).toMatchObject({ isAlt: false, professions: [{ name: 'Ferraria' }] });
    expect(rows[0]).toMatchObject({ main: null, itemLevel: null, together: 500 });
  });

  it('tempo junto soma os alts no main', () => {
    expect(togetherRows(state())).toEqual([
      { character: 'Victor Vaz', alts: ['Victor Alt'], seconds: 1200 },
      { character: 'Maren Luz', alts: [], seconds: 500 },
    ]);
  });
});
