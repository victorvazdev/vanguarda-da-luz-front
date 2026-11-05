import {
  brasiliaToDate,
  formatBrasiliaDate,
  formatEventDateTime,
  toBrasiliaInputs,
} from './brasilia';

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

describe('brasiliaToDate', () => {
  it('interpreta data e horário no fuso de Brasília', () => {
    expect(brasiliaToDate('2026-11-07', '21:00')?.toISOString()).toBe('2026-11-08T00:00:00.000Z');
    expect(brasiliaToDate('2026-01-01', '00:30')?.toISOString()).toBe('2026-01-01T03:30:00.000Z');
  });

  it('recusa valores inválidos', () => {
    expect(brasiliaToDate('', '21:00')).toBeNull();
    expect(brasiliaToDate('2026-02-30', '21:00')).toBeNull();
    expect(brasiliaToDate('2026-11-07', '24:00')).toBeNull();
    expect(brasiliaToDate('2026-11-07', '')).toBeNull();
  });

  it('faz o caminho inverso para preencher o formulário', () => {
    expect(toBrasiliaInputs(new Date('2026-11-08T00:00:00Z'))).toEqual({
      date: '2026-11-07',
      time: '21:00',
    });
  });
});

describe('formatEventDateTime', () => {
  it('usa o formato do protótipo', () => {
    expect(formatEventDateTime(new Date('2026-11-08T00:00:00Z'))).toBe('Sáb, 7 nov. 2026, 21:00');
    expect(formatEventDateTime(new Date('2026-11-11T23:00:00Z'))).toBe('Qua, 11 nov. 2026, 20:00');
  });
});
