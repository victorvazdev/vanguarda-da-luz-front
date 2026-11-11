import { Timestamp } from 'firebase/firestore';
import { addonEventFromData, buildAddonExport, exportWindow, inWindow } from './addon-export';
import { decodeAddonExport, type AddonEvent } from './addon-format';

const s = (iso: string) => Math.floor(new Date(iso).getTime() / 1000);
const ts = (iso: string) => Timestamp.fromDate(new Date(iso));

const event = (id: string, iso: string, over: Partial<AddonEvent> = {}): AddonEvent => ({
  id,
  title: 'Raid semanal',
  startsAt: s(iso),
  description: 'Descrição '.repeat(20),
  organizer: 'Maren',
  status: 'ativo',
  updatedAt: s('2026-11-01T12:00:00Z'),
  ...over,
});

describe('Janela de exportação', () => {
  it('de 00:00 de hoje até o fim do último dia, no horário de Brasília', () => {
    // 11/11/2026, 23:30 em Brasília (02:30 UTC do dia 12).
    const w = exportWindow(new Date('2026-11-12T02:30:00Z'), 60);
    expect(w.from.toISOString()).toBe('2026-11-11T03:00:00.000Z');
    // Hoje + 60 dias: o último dia incluído é 10/01/2027.
    expect(w.to.toISOString()).toBe('2027-01-11T03:00:00.000Z');
  });

  it('inclui eventos que já começaram hoje e exclui os do dia seguinte ao último', () => {
    const w = exportWindow(new Date('2026-11-11T15:00:00Z'), 1);
    const list = [
      event('ontem', '2026-11-11T02:59:00Z'),
      event('hoje-cedo', '2026-11-11T03:00:00Z'),
      event('amanha', '2026-11-13T02:59:00Z'),
      event('depois', '2026-11-13T03:00:00Z'),
    ];
    expect(inWindow(list, w).map((e) => e.id)).toEqual(['hoje-cedo', 'amanha']);
  });
});

describe('Evento a partir do Firestore', () => {
  const data = {
    title: 'Raid semanal',
    game: 'forever',
    startsAt: ts('2026-11-20T00:00:00Z'),
    description: 'Traga poções.',
    organizer: 'Maren',
    status: 'ativo',
    createdBy: 'uid-admin',
    createdAt: ts('2026-11-01T12:00:00Z'),
    updatedAt: ts('2026-11-02T12:00:00Z'),
    guestsAllowed: true,
    maxAttendees: 40,
    attendeeCount: 3,
  };

  it('leva somente os campos do formato, sem dados de contas', () => {
    expect(addonEventFromData('ev1', data, 'forever')).toEqual({
      id: 'ev1',
      title: 'Raid semanal',
      startsAt: s('2026-11-20T00:00:00Z'),
      description: 'Traga poções.',
      organizer: 'Maren',
      status: 'ativo',
      updatedAt: s('2026-11-02T12:00:00Z'),
    });
  });

  it('cancelamento conta como a última alteração', () => {
    const cancelled = {
      ...data,
      status: 'cancelado',
      cancelledAt: ts('2026-11-05T12:00:00Z'),
      cancelledBy: 'uid-admin',
    };
    expect(addonEventFromData('ev1', cancelled, 'forever')).toMatchObject({
      status: 'cancelado',
      updatedAt: s('2026-11-05T12:00:00Z'),
    });
  });

  it('somente eventos da versão do jogo pedida (antigos, sem versão, ficam de fora)', () => {
    expect(addonEventFromData('ev1', { ...data, game: 'retail' }, 'forever')).toBeNull();
    const legacy: Record<string, unknown> = { ...data };
    delete legacy['game'];
    expect(addonEventFromData('ev1', legacy, 'forever')).toBeNull();
    expect(addonEventFromData('ev1', { ...data, game: 'retail' }, 'retail')).not.toBeNull();
  });
});

describe('Geração da string', () => {
  const now = new Date('2026-11-11T15:00:00Z');

  it('gera a string com cabeçalho, quantidade e eventos ativos e cancelados', async () => {
    const list = [
      event('a', '2026-11-20T00:00:00Z'),
      event('c', '2026-11-25T00:00:00Z', { status: 'cancelado' }),
      event('fora', '2027-03-01T00:00:00Z'),
    ];
    const result = await buildAddonExport(list, 'forever', 60, now);
    if (!result.ok) throw new Error('esperava sucesso');
    expect(result.count).toBe(2);
    expect(result.generatedAt).toBe(now);
    const decoded = await decodeAddonExport(result.text);
    expect(decoded).toMatchObject({
      version: 1,
      game: 'forever',
      exportNumber: s('2026-11-11T15:00:00Z'),
      windowStart: s('2026-11-11T03:00:00Z'),
      windowEnd: s('2027-01-11T03:00:00Z'),
    });
    expect(decoded.events.map((e) => [e.id, e.status])).toEqual([
      ['a', 'ativo'],
      ['c', 'cancelado'],
    ]);
  });

  it('acima do limite, informa o tamanho e a maior janela que cabe', async () => {
    // Um evento por dia, com descrição sem repetição (compacta pouco).
    const list = Array.from({ length: 30 }, (_, i) =>
      event(`e${i}`, new Date(now.getTime() + (i + 1) * 86_400_000).toISOString(), {
        description: Array.from({ length: 60 }, (_, k) =>
          ((i * 7919 + k * 104729) % 99991).toString(36),
        ).join(' '),
      }),
    );
    const whole = await buildAddonExport(list, 'forever', 30, now, 1_000_000);
    if (!whole.ok) throw new Error('esperava sucesso');
    const limit = Math.floor(whole.text.length / 2);

    const result = await buildAddonExport(list, 'forever', 30, now, limit);
    if (result.ok) throw new Error('esperava limite excedido');
    expect(result.length).toBe(whole.text.length);
    expect(result.maxDays).toBeGreaterThanOrEqual(1);
    expect(result.maxDays).toBeLessThan(30);
    const fits = await buildAddonExport(list, 'forever', result.maxDays!, now, limit);
    expect(fits.ok).toBe(true);
    const tooMany = await buildAddonExport(list, 'forever', result.maxDays! + 1, now, limit);
    expect(tooMany.ok).toBe(false);
  });

  it('sem nenhuma janela que caiba, não sugere dias', async () => {
    const result = await buildAddonExport(
      [event('a', '2026-11-11T20:00:00Z')],
      'forever',
      5,
      now,
      10,
    );
    expect(result).toMatchObject({ ok: false, error: 'too-long', maxDays: null });
  });
});
