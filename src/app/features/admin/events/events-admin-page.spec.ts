import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import type {
  CreateEventResult,
  EventActionResult,
  EventInput,
  GuildEvent,
} from '../../../core/data/events';
import { EventsService } from '../../../core/data/events.service';
import { toBrasiliaInputs } from '../../../core/time/brasilia';
import { ConfirmService } from '../../../shared/ui/confirm-dialog/confirm.service';
import { EventsAdminPage } from './events-admin-page';

class EventsStub {
  next: ((events: GuildEvent[]) => void) | null = null;
  from: Date | null = null;
  createResult: CreateEventResult = { ok: true, id: 'novo' };
  result: EventActionResult = { ok: true };
  created: EventInput[] = [];
  updated: [string, EventInput][] = [];
  cancelled: string[] = [];
  deleted: string[] = [];
  watchFrom(from: Date, next: (events: GuildEvent[]) => void) {
    this.from = from;
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
  cancel(id: string) {
    this.cancelled.push(id);
    return Promise.resolve(this.result);
  }
  deleteCancelled(id: string) {
    this.deleted.push(id);
    return Promise.resolve(this.result);
  }
}

class ConfirmStub {
  answer = true;
  asked: { title: string; message: string }[] = [];
  ask(o: { title: string; message: string }) {
    this.asked.push(o);
    return Promise.resolve(this.answer);
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
};

let fixture: ComponentFixture<EventsAdminPage>;
let el: HTMLElement;
let events: EventsStub;
let confirm: ConfirmStub;

beforeEach(async () => {
  events = new EventsStub();
  confirm = new ConfirmStub();
  TestBed.configureTestingModule({
    imports: [EventsAdminPage],
    providers: [
      provideRouter([]),
      { provide: EventsService, useValue: events },
      { provide: ConfirmService, useValue: confirm },
    ],
  });
  fixture = TestBed.createComponent(EventsAdminPage);
  el = fixture.nativeElement;
  await fixture.whenStable();
});

async function emit(list: GuildEvent[]) {
  events.next!(list);
  await fixture.whenStable();
}

const q = <T extends HTMLElement>(sel: string) => el.querySelector<T>(sel);
const text = (sel: string) => q(sel)?.textContent?.replace(/\s+/g, ' ').trim() ?? null;
const errorOf = (field: string) => text(`#evento-${field}-erro`);
const button = (label: string, scope: ParentNode = el) =>
  [...scope.querySelectorAll<HTMLButtonElement>('button')].find((b) =>
    b.textContent?.replace(/\s+/g, ' ').trim().startsWith(label),
  );

async function set(field: string, value: string) {
  const input = q<HTMLInputElement>(`#evento-${field}`)!;
  input.value = value;
  input.dispatchEvent(new Event('input'));
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

describe('EventsAdminPage (Criar, editar, cancelar e excluir eventos)', () => {
  it('lista os próximos eventos a partir de agora, com data e horário de Brasília', async () => {
    expect(events.from!.getTime()).toBeLessThanOrEqual(Date.now());
    await emit([raid]);
    expect(text('.event-row__title')).toBe('Raid semanal');
    expect(text('.event-row__meta')).toBe('Sáb, 7 nov. 2099, 21:00');
    expect(text('.events-admin__zone')).toBe('Horários de Brasília');
  });

  it('o título leva ao detalhe do evento no calendário', async () => {
    await emit([raid]);
    expect(q('.event-row__title a')!.getAttribute('href')).toBe('/calendario/raid');
  });

  it('avisa quando não há eventos', async () => {
    await emit([]);
    expect(el.textContent).toContain('Nenhum evento programado');
  });

  describe('Novo evento', () => {
    it('solicita título, data, horário, organizador e descrição', async () => {
      await emit([]);
      const labels = [...el.querySelectorAll('.event-form label')].map((l) =>
        l.textContent?.trim(),
      );
      expect(labels).toEqual(['Título', 'Data', 'Horário', 'Organizador', 'Descrição']);
      expect(text('#evento-fuso')).toBe('Horário de Brasília.');
    });

    it('não envia com campos vazios ou só com espaços', async () => {
      await emit([]);
      await set('title', '   ');
      await submit();
      expect(errorOf('title')).toBe('Informe o título.');
      expect(errorOf('date')).toBe('Informe a data.');
      expect(errorOf('time')).toBe('Informe o horário.');
      expect(errorOf('organizer')).toBe('Informe o organizador.');
      expect(errorOf('description')).toBe('Informe a descrição.');
      expect(events.created).toHaveLength(0);
    });

    it('não aceita data e horário no passado', async () => {
      await emit([]);
      const { date } = toBrasiliaInputs(new Date(Date.now() - DAY));
      await fill({ date });
      await submit();
      expect(errorOf('date')).toBe('Escolha uma data e um horário futuros.');
      expect(q('#evento-time')!.getAttribute('aria-invalid')).toBe('true');
      expect(events.created).toHaveLength(0);
    });

    it('impede escolher dias anteriores a hoje no seletor', async () => {
      expect(q<HTMLInputElement>('#evento-date')!.min).toBe(toBrasiliaInputs(new Date()).date);
    });

    it('cria o evento com o horário interpretado em Brasília e limpa o formulário', async () => {
      await emit([]);
      await fill({ title: '  Raid semanal  ', date: '2099-11-07', time: '21:00' });
      await submit();
      expect(events.created).toEqual([
        {
          title: 'Raid semanal',
          startsAt: new Date('2099-11-08T00:00:00Z'),
          organizer: 'Maren',
          description: 'Traga poções.',
        },
      ]);
      expect(text('.notice')).toBe('Evento criado: Raid semanal.');
      expect(q<HTMLInputElement>('#evento-title')!.value).toBe('');
    });

    it('mostra o erro do servidor sem perder os dados', async () => {
      await emit([]);
      events.createResult = { ok: false, error: 'not-allowed' };
      await fill();
      await submit();
      expect(text('.event-form [role="alert"]')).toBe('Você não tem permissão para esta ação.');
      expect(q<HTMLInputElement>('#evento-title')!.value).toBe('Raid semanal');
    });
  });

  describe('Editar', () => {
    it('abre o formulário com os dados atuais do evento', async () => {
      await emit([raid]);
      button('Editar')!.click();
      await fixture.whenStable();
      expect(text('#titulo-form-evento')).toBe('Editar evento');
      expect(q<HTMLInputElement>('#evento-title')!.value).toBe('Raid semanal');
      expect(q<HTMLInputElement>('#evento-date')!.value).toBe('2099-11-07');
      expect(q<HTMLInputElement>('#evento-time')!.value).toBe('21:00');
      expect(q<HTMLInputElement>('#evento-organizer')!.value).toBe('Maren');
      expect(text('.event-row--editing .event-row__editing')).toBe('Em edição');
    });

    it('salva as alterações no mesmo evento', async () => {
      await emit([raid]);
      button('Editar')!.click();
      await fixture.whenStable();
      await set('title', 'Raid heroica');
      await submit();
      expect(events.updated).toEqual([
        [
          'raid',
          {
            title: 'Raid heroica',
            startsAt: raid.startsAt,
            organizer: 'Maren',
            description: '[DESCRIÇÃO DO EVENTO]',
          },
        ],
      ]);
      expect(events.created).toHaveLength(0);
      expect(text('.notice')).toBe('Alterações salvas em Raid heroica.');
      expect(text('#titulo-form-evento')).toBe('Novo evento');
    });

    it('descartar volta ao formulário de novo evento sem salvar', async () => {
      await emit([raid]);
      button('Editar')!.click();
      await fixture.whenStable();
      button('Descartar alterações')!.click();
      await fixture.whenStable();
      expect(text('#titulo-form-evento')).toBe('Novo evento');
      expect(q<HTMLInputElement>('#evento-title')!.value).toBe('');
      expect(events.updated).toHaveLength(0);
    });

    it('informa quando o evento foi cancelado por outra pessoa', async () => {
      await emit([raid]);
      button('Editar')!.click();
      await fixture.whenStable();
      events.result = { ok: false, error: 'cancelled' };
      await submit();
      expect(text('.event-form [role="alert"]')).toContain('foi cancelado');
      expect(text('#titulo-form-evento')).toBe('Novo evento');
    });
  });

  describe('Cancelar', () => {
    it('pede confirmação e não cancela se a pessoa voltar', async () => {
      await emit([raid]);
      confirm.answer = false;
      button('Cancelar')!.click();
      await fixture.whenStable();
      expect(confirm.asked[0].title).toBe('Cancelar evento?');
      expect(confirm.asked[0].message).toContain('continuará no calendário');
      expect(events.cancelled).toHaveLength(0);
    });

    it('cancela após a confirmação', async () => {
      await emit([raid]);
      button('Cancelar')!.click();
      await fixture.whenStable();
      expect(events.cancelled).toEqual(['raid']);
      expect(text('.notice')).toContain('continua no calendário como cancelado');
    });

    it('evento cancelado aparece identificado, sem editar nem cancelar', async () => {
      await emit([{ ...raid, status: 'cancelado' }]);
      expect(text('.event-row__badge')).toBe('Cancelado');
      expect(button('Editar')).toBeUndefined();
      expect(button('Cancelar')).toBeUndefined();
    });
  });

  describe('Excluir evento cancelado', () => {
    const cancelled: GuildEvent = { ...raid, status: 'cancelado' };

    it('a opção existe somente para eventos cancelados', async () => {
      await emit([raid, { ...cancelled, id: 'outro' }]);
      const rows = [...el.querySelectorAll<HTMLElement>('.event-row')];
      expect(button('Excluir', rows[0])).toBeUndefined();
      expect(button('Excluir', rows[1])!.textContent?.replace(/\s+/g, ' ').trim()).toBe(
        'Excluir Raid semanal, Sáb, 7 nov. 2099, 21:00',
      );
    });

    it('pede confirmação e não exclui se a pessoa mantiver o evento', async () => {
      await emit([cancelled]);
      confirm.answer = false;
      button('Excluir')!.click();
      await fixture.whenStable();
      expect(confirm.asked[0].title).toBe('Excluir evento?');
      expect(confirm.asked[0].message).toContain('sairá do calendário');
      expect(confirm.asked[0].message).toContain('lista de confirmados');
      expect(events.deleted).toHaveLength(0);
    });

    it('exclui após a confirmação e informa o resultado', async () => {
      await emit([cancelled]);
      button('Excluir')!.click();
      await fixture.whenStable();
      expect(events.deleted).toEqual(['raid']);
      expect(text('.notice')).toBe('Raid semanal foi excluído do calendário.');
    });

    it('mostra o erro quando a exclusão é recusada', async () => {
      events.result = { ok: false, error: 'not-allowed' };
      await emit([cancelled]);
      button('Excluir')!.click();
      await fixture.whenStable();
      expect(text('.form-alert')).toBe('Você não tem permissão para esta ação.');
    });
  });

  it('os botões dizem a qual evento se referem (leitores de tela)', async () => {
    await emit([raid]);
    expect(button('Editar')!.textContent?.replace(/\s+/g, ' ').trim()).toBe(
      'Editar Raid semanal, Sáb, 7 nov. 2099, 21:00',
    );
  });
});
