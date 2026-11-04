import { formatBrasiliaDate } from './brasilia';

describe('formatBrasiliaDate', () => {
  it('usa o formato do protótipo', () => {
    expect(formatBrasiliaDate(new Date('2026-11-04T15:00:00Z'))).toBe('4 nov. 2026');
  });

  it('converte para o fuso de Brasília (UTC−3), não o do navegador', () => {
    // 02:00 UTC do dia 5 ainda é dia 4 em Brasília.
    expect(formatBrasiliaDate(new Date('2026-11-05T02:00:00Z'))).toBe('4 nov. 2026');
    expect(formatBrasiliaDate(new Date('2026-11-05T03:00:00Z'))).toBe('5 nov. 2026');
  });

  it('abrevia meses de nome curto com ponto', () => {
    expect(formatBrasiliaDate(new Date('2026-05-10T15:00:00Z'))).toBe('10 mai. 2026');
  });
});
