import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import type { EventActionResult, GuildEvent } from '../../../core/data/events';
import { EventsService } from '../../../core/data/events.service';
import { ConfirmService } from '../../../shared/ui/confirm-dialog/confirm.service';
import { EventsAdminPage } from './events-admin-page';

class EventsStub {
  next: ((events: GuildEvent[]) => void) | null = null;
  from: Date | null = null;
  result: EventActionResult = { ok: true };
  cancelled: string[] = [];
  deleted: string[] = [];
  watchFrom(from: Date, next: (events: GuildEvent[]) => void) {
    this.from = from;
    this.next = next;
    return () => undefined;
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
const button = (label: string, scope: ParentNode = el) =>
  [...scope.querySelectorAll<HTMLButtonElement>('button')].find((b) =>
    b.textContent?.replace(/\s+/g, ' ').trim().startsWith(label),
  );

const link = (label: string, scope: ParentNode = el) =>
  [...scope.querySelectorAll<HTMLAnchorElement>('a')].find((a) =>
    a.textContent?.replace(/\s+/g, ' ').trim().startsWith(label),
  );

describe('EventsAdminPage (Criar, editar, cancelar e excluir eventos)', () => {
  it('lista os próximos eventos a partir de agora, com data e horário de Brasília', async () => {
    expect(events.from!.getTime()).toBeLessThanOrEqual(Date.now());
    await emit([raid]);
    expect(text('.event-row__title')).toBe('Raid semanal');
    expect(text('.event-row__meta')).toBe('Sáb, 7 nov. 2099, 21:00');
    expect(text('.events-admin__zone')).toBe('Horários de Brasília');
  });

  it('mostra a versão do jogo e o organizador de cada evento', async () => {
    await emit([raid, { ...raid, id: 'wf', game: 'forever' }, { ...raid, id: 'old', game: null }]);
    const meta = [...el.querySelectorAll('.event-row')].map((row) =>
      row.querySelectorAll('.event-row__meta')[1]?.textContent?.replace(/\s+/g, ' ').trim(),
    );
    expect(meta).toEqual([
      'Retail · Organizador: Maren',
      'WoW Forever · Organizador: Maren',
      'Versão do jogo não definida · Organizador: Maren',
    ]);
  });

  it('o título leva ao detalhe do evento no calendário', async () => {
    await emit([raid]);
    expect(q('.event-row__title a')!.getAttribute('href')).toBe('/calendario/raid');
  });

  it('avisa quando não há eventos', async () => {
    await emit([]);
    expect(el.textContent).toContain('Nenhum evento programado');
  });

  it('a criação e a edição abrem em página própria', async () => {
    await emit([raid]);
    expect(el.querySelector('form')).toBeNull();
    expect(link('Novo evento')!.getAttribute('href')).toBe('/novo');
    expect(link('Editar')!.getAttribute('href')).toBe('/raid/editar');
  });

  it('mostra quantos confirmaram de quantas vagas', async () => {
    await emit([{ ...raid, attendeeCount: 12, maxAttendees: 30 }]);
    expect(el.textContent).toContain('12 de 30 confirmados');
  });

  it('identifica os eventos em que somente membros confirmam presença', async () => {
    await emit([{ ...raid, guestsAllowed: false }]);
    expect(el.textContent).toContain('Somente membros confirmam presença');
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
      expect(link('Editar')).toBeUndefined();
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

  it('as ações dizem a qual evento se referem (leitores de tela)', async () => {
    await emit([raid]);
    expect(link('Editar')!.textContent?.replace(/\s+/g, ' ').trim()).toBe(
      'Editar Raid semanal, Sáb, 7 nov. 2099, 21:00',
    );
  });
});
