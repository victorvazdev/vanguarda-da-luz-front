import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { Title } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { provideSessionStub } from '../../../core/auth/session.stub';
import type { AttendanceResult, Attendee, MyAttendance } from '../../../core/data/attendance';
import type { GuildEvent } from '../../../core/data/events';
import { EventsService } from '../../../core/data/events.service';
import { ConfirmService } from '../../../shared/ui/confirm-dialog/confirm.service';
import { EventDetailPage } from './event-detail-page';

class EventsStub {
  next: ((event: GuildEvent | null) => void) | null = null;
  ids: string[] = [];
  mine: ((a: MyAttendance | null) => void) | null = null;
  confirmResult: AttendanceResult = { ok: true };
  confirmed: string[] = [];
  watchOne(id: string, next: (event: GuildEvent | null) => void) {
    this.ids.push(id);
    this.next = next;
    return () => undefined;
  }
  watchAttendees(_id: string, next: (list: Attendee[]) => void) {
    next([]);
    return () => undefined;
  }
  watchMyAttendance(_id: string, next: (a: MyAttendance | null) => void) {
    this.mine = next;
    return () => undefined;
  }
  confirmAttendance(id: string) {
    this.confirmed.push(id);
    return Promise.resolve(this.confirmResult);
  }
  cancelResult: AttendanceResult = { ok: true };
  cancelled: string[] = [];
  cancelAttendance(id: string) {
    this.cancelled.push(id);
    return Promise.resolve(this.cancelResult);
  }
}

const raid: GuildEvent = {
  id: 'raid',
  title: 'Raid semanal',
  startsAt: new Date('2099-11-08T00:00:00Z'),
  description: 'Linha 1\nLinha 2',
  organizer: 'Maren',
  status: 'ativo',
};

let fixture: ComponentFixture<EventDetailPage>;
let el: HTMLElement;
let events: EventsStub;
let dialog: ConfirmStub;
let session: ReturnType<typeof provideSessionStub>['stub'];

class ConfirmStub {
  answer = true;
  asked: { title: string; message: string }[] = [];
  ask(o: { title: string; message: string }) {
    this.asked.push(o);
    return Promise.resolve(this.answer);
  }
}

beforeEach(async () => {
  events = new EventsStub();
  dialog = new ConfirmStub();
  const s = provideSessionStub('member');
  session = s.stub;
  TestBed.configureTestingModule({
    imports: [EventDetailPage],
    providers: [
      provideRouter([]),
      { provide: EventsService, useValue: events },
      { provide: ConfirmService, useValue: dialog },
      s.provider,
    ],
  });
  fixture = TestBed.createComponent(EventDetailPage);
  fixture.componentRef.setInput('id', 'raid');
  el = fixture.nativeElement;
  await fixture.whenStable();
});

async function emit(event: GuildEvent | null) {
  events.next!(event);
  await fixture.whenStable();
}

const text = (sel: string) => el.querySelector(sel)?.textContent?.replace(/\s+/g, ' ').trim();
const facts = () =>
  [...el.querySelectorAll('.event-detail__facts div')].map((d) => [
    d.querySelector('dt')?.textContent?.trim(),
    d.querySelector('dd')?.textContent?.trim(),
  ]);

describe('EventDetailPage', () => {
  it('mostra título, data, horário com o fuso, organizador e descrição', async () => {
    expect(events.ids).toEqual(['raid']);
    await emit(raid);
    expect(text('h1')).toBe('Raid semanal');
    expect(facts()).toEqual([
      ['Data', 'Sáb, 7 nov. 2099'],
      ['Horário', '21:00, Brasília'],
      ['Organizador', 'Maren'],
    ]);
    expect(el.querySelector('.event-detail__description')?.textContent).toBe('Linha 1\nLinha 2');
    expect(TestBed.inject(Title).getTitle()).toBe('Raid semanal | Vanguarda da Luz');
  });

  it('volta ao mês do evento', async () => {
    await emit(raid);
    expect(el.querySelector('.event-detail__back')!.getAttribute('href')).toBe(
      '/calendario?mes=2099-11',
    );
  });

  it('identifica evento cancelado', async () => {
    await emit({ ...raid, status: 'cancelado' });
    expect(text('.event-detail__badge')).toBe('Cancelado');
    expect(text('.event-detail__notice')).toContain('foi cancelado');
  });

  it('a lista de confirmados aparece somente para administradores', async () => {
    await emit(raid);
    expect(el.querySelector('app-attendees-panel')).toBeNull();
    session.access.set('admin');
    await fixture.whenStable();
    expect(text('#titulo-confirmados')).toBe('Confirmados: 0');
    expect(text('.attendees__note')).toBe('Visível para administradores');
  });

  it('avisa quando o evento não existe', async () => {
    await emit(null);
    expect(text('h1')).toBe('Evento não encontrado');
  });

  describe('Confirmar presença', () => {
    const presence = () => text('.presence');
    const confirmButton = () =>
      [...el.querySelectorAll<HTMLButtonElement>('.presence button')].find(
        (b) => b.textContent?.trim() === 'Confirmar presença',
      );
    async function attendance(a: MyAttendance | null) {
      events.mine!(a);
      await fixture.whenStable();
    }

    it('evento futuro e ativo oferece a ação, como no protótipo', async () => {
      await emit(raid);
      await attendance(null);
      expect(text('#titulo-presenca')).toBe('Você vai participar deste evento?');
      expect(confirmButton()).toBeTruthy();
    });

    it('não mostra a ação antes de saber se a pessoa já confirmou', async () => {
      await emit(raid);
      expect(el.querySelector('.presence')).toBeNull();
    });

    it('confirma e passa a indicar a presença confirmada, com o foco na mensagem', async () => {
      await emit(raid);
      await attendance(null);
      confirmButton()!.click();
      await fixture.whenStable();
      expect(events.confirmed).toEqual(['raid']);
      expect(presence()).toContain('Presença confirmada');
      expect(confirmButton()).toBeUndefined();
      expect(document.activeElement?.id).toBe('presenca-status');
    });

    it('presença já registrada aparece como confirmada, sem nova ação', async () => {
      await emit(raid);
      await attendance({ confirmedAt: new Date() });
      expect(presence()).toContain('Você confirmou presença neste evento.');
      expect(confirmButton()).toBeUndefined();
    });

    it('confirmação repetida (outra aba) não vira erro', async () => {
      await emit(raid);
      await attendance(null);
      events.confirmResult = { ok: false, error: 'already-confirmed' };
      confirmButton()!.click();
      await fixture.whenStable();
      expect(el.querySelector('[role="alert"]')).toBeNull();
      expect(presence()).toContain('Presença confirmada');
    });

    it('mostra o motivo quando não é possível confirmar', async () => {
      await emit(raid);
      await attendance(null);
      events.confirmResult = { ok: false, error: 'past' };
      confirmButton()!.click();
      await fixture.whenStable();
      expect(text('.presence [role="alert"]')).toContain('já começou');
      expect(confirmButton()).toBeTruthy();
    });

    it('evento passado não oferece a ação', async () => {
      await emit({ ...raid, startsAt: new Date(Date.now() - 86_400_000) });
      await attendance(null);
      expect(confirmButton()).toBeUndefined();
      expect(presence()).toContain('Este evento já aconteceu');
    });

    it('evento cancelado não oferece a ação', async () => {
      await emit({ ...raid, status: 'cancelado' });
      await attendance(null);
      expect(el.querySelector('.presence')).toBeNull();
    });
  });

  describe('Cancelar presença', () => {
    const buttonNamed = (label: string) =>
      [...el.querySelectorAll<HTMLButtonElement>('.presence button')].find(
        (b) => b.textContent?.trim() === label,
      );
    async function confirmedOn(event: GuildEvent) {
      await emit(event);
      events.mine!({ confirmedAt: new Date() });
      await fixture.whenStable();
    }

    it('fica disponível somente com presença confirmada em evento futuro', async () => {
      await emit(raid);
      events.mine!(null);
      await fixture.whenStable();
      expect(buttonNamed('Cancelar presença')).toBeUndefined();

      await confirmedOn(raid);
      expect(buttonNamed('Cancelar presença')).toBeTruthy();

      await confirmedOn({ ...raid, startsAt: new Date(Date.now() - 86_400_000) });
      expect(buttonNamed('Cancelar presença')).toBeUndefined();
    });

    it('pede confirmação e não cancela se a pessoa voltar', async () => {
      await confirmedOn(raid);
      dialog.answer = false;
      buttonNamed('Cancelar presença')!.click();
      await fixture.whenStable();
      expect(dialog.asked[0].title).toBe('Cancelar presença?');
      expect(dialog.asked[0].message).toContain('sairá da lista de confirmados de Raid semanal');
      expect(events.cancelled).toHaveLength(0);
    });

    it('cancela e oferece confirmar de novo, com o foco no aviso', async () => {
      await confirmedOn(raid);
      buttonNamed('Cancelar presença')!.click();
      await fixture.whenStable();
      expect(events.cancelled).toEqual(['raid']);
      expect(text('#presenca-status')).toBe('Sua presença foi cancelada.');
      expect(document.activeElement?.id).toBe('presenca-status');
      expect(buttonNamed('Confirmar presença')).toBeTruthy();
    });

    it('mostra o motivo quando não é possível cancelar', async () => {
      await confirmedOn(raid);
      events.cancelResult = { ok: false, error: 'past' };
      buttonNamed('Cancelar presença')!.click();
      await fixture.whenStable();
      expect(text('.presence [role="alert"]')).toContain('já começou');
      expect(buttonNamed('Cancelar presença')).toBeTruthy();
    });
  });
});
