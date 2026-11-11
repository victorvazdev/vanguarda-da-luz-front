import { Component } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import type {
  CreateEventResult,
  EventActionResult,
  EventInput,
  GuildEvent,
} from '../../../../core/data/events';
import { EventsService } from '../../../../core/data/events.service';
import { toBrasiliaInputs } from '../../../../core/time/brasilia';
import { FlashService } from '../../../../shared/ui/flash/flash.service';
import { EventFormPage } from './event-form-page';

@Component({ template: '' })
class Blank {}

class EventsStub {
  createResult: CreateEventResult = { ok: true, id: 'novo' };
  result: EventActionResult = { ok: true };
  created: EventInput[] = [];
  updated: [string, EventInput][] = [];
  ids: string[] = [];
  next: ((event: GuildEvent | null) => void) | null = null;
  watchOne(id: string, next: (event: GuildEvent | null) => void) {
    this.ids.push(id);
    this.next = next;
    return () => undefined;
  }
  create(input: EventInput) {
    this.created.push(input);
    return Promise.resolve(this.createResult);
  }
  update(id: string, input: EventInput) {
    this.updated.push([id, input]);
    return Promise.resolve(this.result);
  }
}

const DAY = 86_400_000;
/** Data futura, com horário redondo, em Brasília. */
const inDays = (days: number) => {
  const { date } = toBrasiliaInputs(new Date(Date.now() + days * DAY));
  return { date, time: '21:00' };
};

const raid: GuildEvent = {
  id: 'raid',
  title: 'Raid semanal',
  startsAt: new Date('2099-11-08T00:00:00Z'), // Sáb, 7 nov. 2099, 21:00 em Brasília
  description: '[DESCRIÇÃO DO EVENTO]',
  organizer: 'Maren',
  status: 'ativo',
  game: 'retail',
  guestsAllowed: true,
  maxAttendees: 40,
  attendeeCount: 0,
};

let fixture: ComponentFixture<EventFormPage>;
let el: HTMLElement;
let events: EventsStub;

async function open(id?: string, from?: 'calendar') {
  events = new EventsStub();
  TestBed.configureTestingModule({
    imports: [EventFormPage],
    providers: [
      provideRouter([{ path: '**', component: Blank }]),
      { provide: EventsService, useValue: events },
    ],
  });
  fixture = TestBed.createComponent(EventFormPage);
  if (id) fixture.componentRef.setInput('id', id);
  if (from) fixture.componentRef.setInput('from', from);
  el = fixture.nativeElement;
  await fixture.whenStable();
}

async function emit(event: GuildEvent | null) {
  events.next!(event);
  await fixture.whenStable();
}

const q = <T extends HTMLElement>(sel: string) => el.querySelector<T>(sel);
const text = (sel: string) => q(sel)?.textContent?.replace(/\s+/g, ' ').trim() ?? null;
const errorOf = (field: string) => text(`#evento-${field}-erro`);
const GAME_LABELS = { retail: 'World of Warcraft Retail', forever: 'World of Warcraft Forever' };
const gameOption = (game: 'retail' | 'forever') =>
  [...el.querySelectorAll('.choices .choice')]
    .find((l) => l.textContent?.trim() === GAME_LABELS[game])!
    .querySelector<HTMLInputElement>('input')!;

async function set(field: string, value: string) {
  const input = q<HTMLInputElement>(`#evento-${field}`)!;
  input.value = value;
  input.dispatchEvent(new Event('input'));
  await fixture.whenStable();
}

async function chooseGame(game: 'retail' | 'forever') {
  gameOption(game).click();
  await fixture.whenStable();
}

async function fill(over: Partial<Record<string, string>> = {}) {
  const when = inDays(3);
  const values = {
    title: 'Raid semanal',
    date: when.date,
    time: when.time,
    organizer: 'Maren',
    description: 'Traga poções.',
    ...over,
  };
  for (const [field, value] of Object.entries(values)) await set(field, value);
}

async function submit() {
  q<HTMLFormElement>('form')!.dispatchEvent(new Event('submit'));
  await fixture.whenStable();
}

describe('EventFormPage', () => {
  describe('Novo evento', () => {
    beforeEach(() => open());

    it('solicita título, versão do jogo, data, horário, organizador e descrição', () => {
      expect(text('h1')).toBe('Novo evento');
      const labels = [...el.querySelectorAll('.event-form label, .event-form legend')].map((l) =>
        l.textContent?.trim(),
      );
      expect(labels).toEqual([
        'Título',
        'Versão do jogo',
        'World of Warcraft Retail',
        'World of Warcraft Forever',
        'Data',
        'Horário',
        'Organizador',
        'Descrição',
        'Limite de confirmados',
        'Visitantes podem confirmar presença',
      ]);
      // Nenhuma versão vem escolhida: o administrador decide.
      expect(gameOption('retail').checked).toBe(false);
      expect(gameOption('forever').checked).toBe(false);
      // Por padrão, até 40 confirmados.
      expect(q<HTMLInputElement>('#evento-maxAttendees')!.value).toBe('40');
      // Por padrão, visitantes podem confirmar presença.
      expect(q<HTMLInputElement>('#evento-guestsAllowed')!.checked).toBe(true);
      expect(text('#evento-fuso')).toBe('Horário de Brasília.');
      expect(events.ids).toEqual([]);
    });

    it('não envia com campos vazios ou só com espaços', async () => {
      await set('title', '   ');
      await submit();
      expect(errorOf('title')).toBe('Informe o título.');
      expect(errorOf('game')).toBe('Escolha a versão do jogo.');
      expect(errorOf('date')).toBe('Informe a data.');
      expect(errorOf('time')).toBe('Informe o horário.');
      expect(errorOf('organizer')).toBe('Informe o organizador.');
      expect(errorOf('description')).toBe('Informe a descrição.');
      expect(events.created).toHaveLength(0);
    });

    it('não aceita data e horário no passado', async () => {
      const { date } = toBrasiliaInputs(new Date(Date.now() - DAY));
      await fill({ date });
      await chooseGame('retail');
      await submit();
      expect(errorOf('date')).toBe('Escolha uma data e um horário futuros.');
      expect(q('#evento-time')!.getAttribute('aria-invalid')).toBe('true');
      expect(events.created).toHaveLength(0);
    });

    it('impede escolher dias anteriores a hoje no seletor', () => {
      expect(q<HTMLInputElement>('#evento-date')!.min).toBe(toBrasiliaInputs(new Date()).date);
    });

    it('cria o evento com o horário de Brasília e volta à lista, avisando', async () => {
      await fill({ title: '  Raid semanal  ', date: '2099-11-07', time: '21:00' });
      await chooseGame('forever');
      await submit();
      expect(events.created).toEqual([
        {
          title: 'Raid semanal',
          game: 'forever',
          startsAt: new Date('2099-11-08T00:00:00Z'),
          organizer: 'Maren',
          description: 'Traga poções.',
          guestsAllowed: true,
          maxAttendees: 40,
        },
      ]);
      expect(TestBed.inject(Router).url).toBe('/admin/eventos');
      expect(TestBed.inject(FlashService).message()).toBe('Evento criado: Raid semanal.');
    });

    it('permite definir o limite de confirmados, de 1 a 500', async () => {
      await fill();
      await chooseGame('retail');
      for (const value of ['0', '501', '2.5', '']) {
        await set('maxAttendees', value);
        await submit();
        expect(errorOf('maxAttendees')).toMatch(/limite|número inteiro de 1 a 500/);
        expect(events.created).toHaveLength(0);
      }
      await set('maxAttendees', '12');
      await submit();
      expect(events.created[0].maxAttendees).toBe(12);
    });

    it('permite desativar a confirmação de presença de visitantes', async () => {
      await fill();
      await chooseGame('retail');
      q<HTMLInputElement>('#evento-guestsAllowed')!.click();
      await fixture.whenStable();
      await submit();
      expect(events.created[0].guestsAllowed).toBe(false);
    });

    it('mostra o erro do servidor sem perder os dados nem sair da página', async () => {
      events.createResult = { ok: false, error: 'not-allowed' };
      await fill();
      await chooseGame('retail');
      await submit();
      expect(text('.event-form [role="alert"]')).toBe('Você não tem permissão para esta ação.');
      expect(q<HTMLInputElement>('#evento-title')!.value).toBe('Raid semanal');
      expect(TestBed.inject(Router).url).toBe('/');
    });

    it('cancelar volta à lista de eventos', () => {
      const back = [...el.querySelectorAll('a')].find((a) => a.textContent?.trim() === 'Cancelar');
      expect(back!.getAttribute('href')).toBe('/admin/eventos');
    });
  });

  describe('Novo evento a partir do calendário', () => {
    beforeEach(() => open(undefined, 'calendar'));

    it('volta ao calendário, fora do painel administrativo', () => {
      expect(text('h1')).toBe('Novo evento');
      expect(q('.event-form-page')!.classList).toContain('container');
      const back = q<HTMLAnchorElement>('.event-form-page__back')!;
      expect(back.textContent?.trim()).toBe('Voltar ao calendário');
      expect(back.getAttribute('href')).toBe('/calendario');
      const cancel = [...el.querySelectorAll('a')].find(
        (a) => a.textContent?.trim() === 'Cancelar',
      );
      expect(cancel!.getAttribute('href')).toBe('/calendario');
    });

    it('ao criar, abre o detalhe do novo evento', async () => {
      events.createResult = { ok: true, id: 'abc' };
      await fill();
      await chooseGame('retail');
      await submit();
      expect(events.created).toHaveLength(1);
      expect(TestBed.inject(Router).url).toBe('/calendario/abc');
      expect(TestBed.inject(FlashService).message()).toBe('Evento criado: Raid semanal.');
    });
  });

  describe('Editar evento', () => {
    it('abre com os dados atuais do evento', async () => {
      await open('raid');
      expect(events.ids).toEqual(['raid']);
      expect(text('[role="status"]')).toBe('Carregando…');
      await emit(raid);
      expect(text('h1')).toBe('Editar evento');
      expect(q<HTMLInputElement>('#evento-title')!.value).toBe('Raid semanal');
      expect(gameOption('retail').checked).toBe(true);
      expect(q<HTMLInputElement>('#evento-date')!.value).toBe('2099-11-07');
      expect(q<HTMLInputElement>('#evento-time')!.value).toBe('21:00');
      expect(q<HTMLInputElement>('#evento-organizer')!.value).toBe('Maren');
    });

    it('salva as alterações no mesmo evento e volta à lista', async () => {
      await open('raid');
      await emit(raid);
      await set('title', 'Raid heroica');
      await chooseGame('forever');
      await submit();
      expect(events.updated).toEqual([
        [
          'raid',
          {
            title: 'Raid heroica',
            game: 'forever',
            startsAt: raid.startsAt,
            organizer: 'Maren',
            description: '[DESCRIÇÃO DO EVENTO]',
            guestsAllowed: true,
            maxAttendees: 40,
          },
        ],
      ]);
      expect(events.created).toHaveLength(0);
      expect(TestBed.inject(Router).url).toBe('/admin/eventos');
      expect(TestBed.inject(FlashService).message()).toBe('Alterações salvas em Raid heroica.');
    });

    it('novas leituras do evento não apagam o que foi digitado', async () => {
      await open('raid');
      await emit(raid);
      await set('title', 'Raid heroica');
      await emit({ ...raid, attendeeCount: 3 });
      expect(q<HTMLInputElement>('#evento-title')!.value).toBe('Raid heroica');
    });

    it('com presenças confirmadas, a versão do jogo não muda', async () => {
      await open('raid');
      await emit({ ...raid, attendeeCount: 2 });
      expect(gameOption('retail').checked).toBe(true);
      expect(gameOption('forever').disabled).toBe(true);
      expect(text('#evento-game-dica')).toContain('a versão do jogo não pode mais ser alterada');
      await submit();
      expect(events.updated[0][1].game).toBe('retail');
    });

    it('evento antigo, sem versão do jogo, exige escolher uma', async () => {
      await open('raid');
      await emit({ ...raid, game: null, attendeeCount: 5 });
      expect(gameOption('retail').disabled).toBe(false);
      await submit();
      expect(errorOf('game')).toBe('Escolha a versão do jogo.');
      await chooseGame('forever');
      await submit();
      expect(events.updated[0][1].game).toBe('forever');
    });

    it('abre com a opção de visitantes e o limite do evento e permite alterá-los', async () => {
      await open('raid');
      await emit({ ...raid, guestsAllowed: false });
      const toggle = q<HTMLInputElement>('#evento-guestsAllowed')!;
      expect(toggle.checked).toBe(false);
      await set('maxAttendees', '25');
      toggle.click();
      await fixture.whenStable();
      await submit();
      expect(events.updated[0][1].guestsAllowed).toBe(true);
      expect(events.updated[0][1].maxAttendees).toBe(25);
    });

    it('informa quando o evento foi cancelado por outra pessoa', async () => {
      await open('raid');
      await emit(raid);
      events.result = { ok: false, error: 'cancelled' };
      await submit();
      expect(text('.event-form [role="alert"]')).toContain('foi cancelado');
    });

    it('informa quando a versão do jogo foi travada por uma confirmação', async () => {
      await open('raid');
      await emit(raid);
      await chooseGame('forever');
      events.result = { ok: false, error: 'game-locked' };
      await submit();
      expect(text('.event-form [role="alert"]')).toContain('já há presenças confirmadas');
    });

    it('evento cancelado ou passado não abre para edição', async () => {
      await open('raid');
      await emit({ ...raid, status: 'cancelado' });
      expect(q('form')).toBeNull();
      expect(text('.notice')).toBe('Este evento foi cancelado e não pode mais ser alterado.');
    });

    it('avisa quando o evento não existe', async () => {
      await open('nao-existe');
      await emit(null);
      expect(text('h1')).toBe('Evento não encontrado');
    });
  });
});
