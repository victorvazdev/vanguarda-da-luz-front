import type { GuildEvent } from '../../../core/data/events';
import {
  addMonths,
  currentMonth,
  eventsByDay,
  gridRange,
  monthGrid,
  monthParam,
  monthTitle,
  parseMonth,
} from './month';

const nov = { year: 2026, month: 11 };

describe('mês do calendário', () => {
  it('abre no mês atual de Brasília', () => {
    // 02:00 UTC de 1º de dezembro ainda é 30 de novembro em Brasília.
    expect(currentMonth(new Date('2026-12-01T02:00:00Z'))).toEqual(nov);
    expect(currentMonth(new Date('2026-12-01T03:00:00Z'))).toEqual({ year: 2026, month: 12 });
  });

  it('lê e escreve o parâmetro da URL', () => {
    expect(parseMonth('2026-11')).toEqual(nov);
    expect(parseMonth('2026-13')).toBeNull();
    expect(parseMonth('abc')).toBeNull();
    expect(parseMonth(null)).toBeNull();
    expect(monthParam({ year: 2027, month: 1 })).toBe('2027-01');
  });

  it('navega entre meses, inclusive na virada do ano', () => {
    expect(addMonths(nov, 1)).toEqual({ year: 2026, month: 12 });
    expect(addMonths(nov, 2)).toEqual({ year: 2027, month: 1 });
    expect(addMonths({ year: 2027, month: 1 }, -1)).toEqual({ year: 2026, month: 12 });
  });

  it('usa o título do protótipo', () => {
    expect(monthTitle(nov)).toBe('Novembro de 2026');
    expect(monthTitle({ year: 2027, month: 3 })).toBe('Março de 2027');
  });
});

describe('monthGrid', () => {
  it('monta semanas de domingo a sábado, como no protótipo de novembro de 2026', () => {
    const weeks = monthGrid(nov, '2026-11-04');
    expect(weeks).toHaveLength(5);
    expect(weeks[0].map((d) => d.day)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(weeks[4].map((d) => d.day)).toEqual([29, 30, 1, 2, 3, 4, 5]);
    expect(weeks[4].map((d) => d.inMonth)).toEqual([true, true, false, false, false, false, false]);
    expect(weeks[0][3]).toMatchObject({ key: '2026-11-04', isToday: true });
    expect(weeks[0][6].label).toBe('sábado, 7 de novembro de 2026');
  });

  it('completa com dias do mês anterior quando o mês não começa no domingo', () => {
    const weeks = monthGrid({ year: 2026, month: 12 }, '');
    expect(weeks[0].map((d) => d.key)[0]).toBe('2026-11-29');
    expect(weeks[0][2]).toMatchObject({ key: '2026-12-01', inMonth: true });
  });

  it('busca do primeiro ao último dia da grade, à meia-noite de Brasília', () => {
    const { from, to } = gridRange(monthGrid(nov, ''));
    expect(from.toISOString()).toBe('2026-11-01T03:00:00.000Z');
    expect(to.toISOString()).toBe('2026-12-06T03:00:00.000Z');
  });
});

describe('eventsByDay', () => {
  it('agrupa pelo dia de Brasília, não pelo dia UTC', () => {
    const event = (id: string, iso: string) =>
      ({ id, startsAt: new Date(iso) }) as unknown as GuildEvent;
    const map = eventsByDay([
      event('a', '2026-11-08T00:00:00Z'), // 7/11, 21:00 em Brasília
      event('b', '2026-11-08T02:30:00Z'), // 7/11, 23:30
      event('c', '2026-11-08T03:00:00Z'), // 8/11, 00:00
    ]);
    expect(map.get('2026-11-07')?.map((e) => e.id)).toEqual(['a', 'b']);
    expect(map.get('2026-11-08')?.map((e) => e.id)).toEqual(['c']);
  });
});
