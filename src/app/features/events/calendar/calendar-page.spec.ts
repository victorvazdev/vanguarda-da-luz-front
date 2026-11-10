import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import type { GuildEvent } from '../../../core/data/events';
import { EventsService } from '../../../core/data/events.service';
import { CalendarPage } from './calendar-page';
import { currentMonth, monthParam, monthTitle } from './month';

class EventsStub {
  next: ((events: GuildEvent[]) => void) | null = null;
  error: ((e: unknown) => void) | null = null;
  ranges: [string, string][] = [];
  stopped = 0;
  watchBetween(
    from: Date,
    to: Date,
    next: (events: GuildEvent[]) => void,
    error: (e: unknown) => void,
  ) {
    this.ranges.push([from.toISOString(), to.toISOString()]);
    this.next = next;
    this.error = error;
    return () => this.stopped++;
  }
}

const event = (id: string, iso: string, over: Partial<GuildEvent> = {}): GuildEvent => ({
  id,
  title: 'Raid semanal',
  startsAt: new Date(iso),
  description: '[DESCRIÇÃO DO EVENTO]',
  organizer: 'Maren',
  status: 'ativo',
  guestsAllowed: true,
  ...over,
});

let fixture: ComponentFixture<CalendarPage>;
let el: HTMLElement;
let events: EventsStub;

async function setup(mes?: string) {
  events = new EventsStub();
  TestBed.configureTestingModule({
    imports: [CalendarPage],
    providers: [provideRouter([]), { provide: EventsService, useValue: events }],
  });
  fixture = TestBed.createComponent(CalendarPage);
  if (mes !== undefined) fixture.componentRef.setInput('mes', mes);
  el = fixture.nativeElement;
  await fixture.whenStable();
}

async function emit(list: GuildEvent[]) {
  events.next!(list);
  await fixture.whenStable();
}

const text = (sel: string) => el.querySelector(sel)?.textContent?.replace(/\s+/g, ' ').trim();
const link = (label: string) =>
  [...el.querySelectorAll<HTMLAnchorElement>('.calendar-page__nav a')].find(
    (a) => a.textContent?.trim() === label,
  );
const cell = (day: number) =>
  [...el.querySelectorAll('.calendar__cell:not(.calendar__cell--outside)')].find(
    (td) => td.querySelector('.calendar__day [aria-hidden]')?.textContent?.trim() === String(day),
  )!;

describe('CalendarPage (Acessar o calendário de eventos)', () => {
  it('abre no mês atual, com o fuso identificado', async () => {
    await setup();
    expect(text('h1')).toBe(monthTitle(currentMonth()));
    expect(text('.calendar-page__zone')).toBe('Horários de Brasília');
    expect(link('Mês atual')).toBeUndefined();
    expect(el.querySelector('[aria-current="date"]')).toBeTruthy();
  });

  it('navega entre meses pela URL (?mes=)', async () => {
    await setup('2099-01');
    expect(text('h1')).toBe('Janeiro de 2099');
    expect(link('Mês anterior')!.getAttribute('href')).toBe('/calendario?mes=2098-12');
    expect(link('Próximo mês')!.getAttribute('href')).toBe('/calendario?mes=2099-02');
    expect(link('Mês atual')!.getAttribute('href')).toBe(
      `/calendario?mes=${monthParam(currentMonth())}`,
    );
  });

  it('mês inválido na URL abre o mês atual', async () => {
    await setup('2026-99');
    expect(text('h1')).toBe(monthTitle(currentMonth()));
  });

  it('busca os eventos da grade e troca a busca ao mudar de mês', async () => {
    await setup('2026-11');
    expect(events.ranges).toEqual([['2026-11-01T03:00:00.000Z', '2026-12-06T03:00:00.000Z']]);
    fixture.componentRef.setInput('mes', '2026-12');
    await fixture.whenStable();
    expect(events.stopped).toBe(1);
    expect(events.ranges[1][0]).toBe('2026-11-29T03:00:00.000Z');
  });

  it('identifica os dias com eventos e leva ao detalhe', async () => {
    await setup('2026-11');
    await emit([event('raid', '2026-11-08T00:00:00Z')]); // 7/11, 21:00 em Brasília
    const day = cell(7);
    expect(day.classList).toContain('calendar__cell--has-events');
    expect(day.querySelector('.sr-only')?.textContent).toContain('1 evento');
    const a = day.querySelector<HTMLAnchorElement>('.calendar__event')!;
    expect(a.textContent?.replace(/\s+/g, ' ').trim()).toBe('21:00 Raid semanal');
    expect(a.getAttribute('href')).toBe('/calendario/raid');
    expect(cell(8).classList).not.toContain('calendar__cell--has-events');
  });

  it('identifica eventos cancelados', async () => {
    await setup('2026-11');
    await emit([event('encontro', '2026-11-22T23:00:00Z', { status: 'cancelado' })]);
    const a = cell(22).querySelector('.calendar__event')!;
    expect(a.classList).toContain('calendar__event--cancelled');
    expect(a.textContent).toContain('Cancelado');
    expect(text('.agenda__item--cancelled .agenda__badge')).toBe('Cancelado');
  });

  it('lista os eventos do mês (versão para celular)', async () => {
    await setup('2026-11');
    await emit([
      event('raid', '2026-11-08T00:00:00Z'),
      event('dez', '2026-12-02T00:00:00Z', { title: 'Fora do mês' }),
    ]);
    const items = [...el.querySelectorAll('.agenda__item')].map((a) =>
      a.textContent?.replace(/\s+/g, ' ').trim(),
    );
    expect(items).toEqual(['Sáb, 7 nov. 2026, 21:00 Raid semanal']);
  });

  it('avisa quando o mês não tem eventos', async () => {
    await setup('2026-11');
    await emit([]);
    expect(text('.calendar-page__empty')).toBe('Nenhum evento programado em novembro de 2026.');
  });

  it('informa erro ao carregar', async () => {
    await setup('2026-11');
    events.error!(new Error('x'));
    await fixture.whenStable();
    expect(text('[role="alert"]')).toContain('Não foi possível carregar os eventos');
  });
});
