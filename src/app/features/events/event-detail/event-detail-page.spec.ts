import { Component } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { Title } from '@angular/platform-browser';
import { Router, provideRouter } from '@angular/router';
import { provideSessionStub } from '../../../core/auth/session.stub';
import type { AttendanceResult, Attendee, MyAttendance } from '../../../core/data/attendance';
import type { EventActionResult, GuildEvent } from '../../../core/data/events';
import { EventsService } from '../../../core/data/events.service';
import type { Guest, GuestAttendanceResult, GuestInput } from '../../../core/data/guest-attendance';
import { ConfirmService } from '../../../shared/ui/confirm-dialog/confirm.service';
import { FlashService } from '../../../shared/ui/flash/flash.service';
import { EventDetailPage } from './event-detail-page';

@Component({ template: '' })
class Blank {}

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
  watchGuests(_id: string, next: (list: Guest[]) => void) {
    next([]);
    return () => undefined;
  }
  guestResult: GuestAttendanceResult = { ok: true, id: 'forever:Lunara:Sombraviva' };
  guests: [string, GuestInput][] = [];
  confirmGuest(eventId: string, input: GuestInput) {
    this.guests.push([eventId, input]);
    return Promise.resolve(this.guestResult);
  }
  watched: string[] = [];
  guestNext: ((g: Guest | null) => void) | null = null;
  watchGuest(_eventId: string, id: string, next: (g: Guest | null) => void) {
    this.watched.push(id);
    this.guestNext = next;
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
  deleteResult: EventActionResult = { ok: true };
  deleted: string[] = [];
  deleteCancelled(id: string) {
    this.deleted.push(id);
    // Como o Firestore: o listener do evento recebe `null` antes de a promessa resolver.
    if (this.deleteResult.ok) this.next?.(null);
    return Promise.resolve(this.deleteResult);
  }
}

const raid: GuildEvent = {
  id: 'raid',
  title: 'Raid semanal',
  startsAt: new Date('2099-11-08T00:00:00Z'),
  description: 'Linha 1\nLinha 2',
  organizer: 'Maren',
  status: 'ativo',
  guestsAllowed: true,
  maxAttendees: 40,
  attendeeCount: 0,
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
  localStorage.clear();
  events = new EventsStub();
  dialog = new ConfirmStub();
  const s = provideSessionStub('member');
  session = s.stub;
  TestBed.configureTestingModule({
    imports: [EventDetailPage],
    providers: [
      provideRouter([{ path: '**', component: Blank }]),
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
    expect(text('.attendees__note')).toBe('Limite: 40 pessoas · Visível para administradores');
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

    it('mostra as vagas disponíveis', async () => {
      await emit({ ...raid, attendeeCount: 39 });
      await attendance(null);
      expect(text('.presence__spots')).toBe('1 de 40 vaga disponível');
    });

    it('evento lotado não oferece a ação, mas quem já confirmou continua confirmado', async () => {
      await emit({ ...raid, attendeeCount: 40 });
      await attendance(null);
      expect(text('#titulo-presenca')).toBe('Evento lotado');
      expect(confirmButton()).toBeUndefined();
      await attendance({ confirmedAt: new Date() });
      expect(presence()).toContain('Presença confirmada');
    });

    it('avisa quando o evento lota antes da confirmação', async () => {
      await emit(raid);
      await attendance(null);
      events.confirmResult = { ok: false, error: 'full' };
      confirmButton()!.click();
      await fixture.whenStable();
      expect(text('.presence [role="alert"]')).toBe('Este evento atingiu o limite de confirmados.');
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

  describe('Excluir evento cancelado (administrador)', () => {
    const cancelled: GuildEvent = { ...raid, status: 'cancelado' };
    const removeButton = () =>
      [...el.querySelectorAll<HTMLButtonElement>('button')].find(
        (b) => b.textContent?.trim() === 'Excluir evento',
      );

    it('aparece somente para administradores e em eventos cancelados', async () => {
      await emit(cancelled);
      expect(removeButton()).toBeUndefined();
      session.access.set('admin');
      await emit(raid);
      expect(removeButton()).toBeUndefined();
      await emit(cancelled);
      expect(removeButton()).toBeDefined();
      expect(text('.event-detail__remove')).toContain('junto com a lista de confirmados');
    });

    it('pede confirmação e não exclui se o administrador mantiver o evento', async () => {
      session.access.set('admin');
      await emit(cancelled);
      dialog.answer = false;
      removeButton()!.click();
      await fixture.whenStable();
      expect(dialog.asked[0].title).toBe('Excluir evento?');
      expect(events.deleted).toHaveLength(0);
    });

    it('exclui, volta ao calendário do mês do evento e informa o resultado', async () => {
      session.access.set('admin');
      await emit(cancelled);
      removeButton()!.click();
      await fixture.whenStable();
      expect(events.deleted).toEqual(['raid']);
      expect(TestBed.inject(Router).url).toBe('/calendario?mes=2099-11');
      expect(TestBed.inject(FlashService).message()).toBe(
        'Raid semanal foi excluído do calendário.',
      );
      expect(text('h1')).not.toBe('Evento não encontrado');
    });

    it('mostra o erro e mantém a página quando a exclusão é recusada', async () => {
      session.access.set('admin');
      await emit(cancelled);
      events.deleteResult = { ok: false, error: 'not-allowed' };
      removeButton()!.click();
      await fixture.whenStable();
      expect(text('.event-detail__remove [role="alert"]')).toBe(
        'Você não tem permissão para excluir este evento.',
      );
      expect(removeButton()!.disabled).toBe(false);
    });
  });

  describe('Visitantes', () => {
    const presence = () => text('.presence');
    const q = <T extends HTMLElement>(sel: string) => el.querySelector<T>(sel);
    const buttonNamed = (label: string) =>
      [...el.querySelectorAll<HTMLButtonElement>('.presence button')].find(
        (b) => b.textContent?.trim() === label,
      );
    async function asVisitor(event: GuildEvent = raid, access: 'visitor' | 'pending' = 'visitor') {
      session.access.set(access);
      await emit(event);
    }
    async function choose(game: 'forever' | 'retail') {
      const label = game === 'forever' ? 'World of Warcraft Forever' : 'World of Warcraft Retail';
      const option = [...el.querySelectorAll('.guest-form .choice')].find(
        (l) => l.textContent?.trim() === label,
      );
      option!.querySelector<HTMLInputElement>('input')!.click();
      await fixture.whenStable();
    }
    async function type(id: string, value: string) {
      const input = q<HTMLInputElement>(`#visitante-${id}`)!;
      input.value = value;
      input.dispatchEvent(new Event('input'));
      await fixture.whenStable();
    }
    async function submit() {
      q<HTMLFormElement>('.guest-form')!.dispatchEvent(new Event('submit'));
      await fixture.whenStable();
    }

    it('veem o evento e o formulário de presença, sem a lista de confirmados', async () => {
      await asVisitor();
      expect(text('h1')).toBe('Raid semanal');
      expect(text('#titulo-presenca')).toBe('Você vai participar deste evento?');
      expect(el.querySelector('app-attendees-panel')).toBeNull();
    });

    it('informam o jogo antes de confirmar', async () => {
      await asVisitor();
      await submit();
      expect(text('#visitante-game-erro')).toBe('Escolha o jogo.');
      expect(events.guests).toHaveLength(0);
    });

    it('no WoW Forever, informam nome e sobrenome', async () => {
      await asVisitor();
      await choose('forever');
      expect(q('#visitante-characterSurname')).toBeTruthy();
      expect(q('#visitante-realm')).toBeNull();
      await submit();
      expect(text('#visitante-characterName-erro')).toBe('Informe o nome do personagem.');
      expect(text('#visitante-characterSurname-erro')).toBe('Informe o sobrenome do personagem.');

      await type('characterName', 'Lunara');
      await type('characterSurname', 'Sombraviva');
      await submit();
      expect(events.guests).toEqual([
        ['raid', { game: 'forever', characterName: 'Lunara', characterSurname: 'Sombraviva' }],
      ]);
      expect(presence()).toContain('Presença confirmada');
      expect(text('#visitante-status')).toBe(
        'Você confirmou presença com Lunara Sombraviva (WoW Forever).',
      );
      expect(document.activeElement?.id).toBe('visitante-status');
    });

    it('no Retail, informam nome e reino', async () => {
      await asVisitor();
      await choose('retail');
      expect(q('#visitante-characterSurname')).toBeNull();
      await type('characterName', 'Thalor');
      await type('realm', 'Az/ralon');
      await submit();
      expect(text('#visitante-realm-erro')).toBe('O reino não pode conter "/".');
      await type('realm', '  Tol   Barad ');
      events.guestResult = { ok: true, id: 'retail:Thalor:Tol Barad' };
      await submit();
      expect(events.guests).toEqual([
        ['raid', { game: 'retail', characterName: 'Thalor', realm: '  Tol   Barad ' }],
      ]);
      expect(text('#visitante-status')).toBe(
        'Você confirmou presença com Thalor-Tol Barad (Retail).',
      );
    });

    it('nome de personagem só com letras', async () => {
      await asVisitor();
      await choose('forever');
      await type('characterName', 'Lu na');
      await submit();
      expect(text('#visitante-characterName-erro')).toBe(
        'Use de 2 a 12 letras, sem espaços ou números.',
      );
    });

    it('a confirmação fica lembrada neste navegador e some se for cancelada', async () => {
      await asVisitor();
      await choose('forever');
      await type('characterName', 'Lunara');
      await type('characterSurname', 'Sombraviva');
      await submit();
      expect(events.watched).toEqual(['forever:Lunara:Sombraviva']);
      expect(localStorage.getItem('vanguarda:presenca-visitante:raid')).toBe(
        'forever:Lunara:Sombraviva',
      );
      // O administrador cancelou a presença: o formulário volta.
      events.guestNext!(null);
      await fixture.whenStable();
      expect(text('#titulo-presenca')).toBe('Você vai participar deste evento?');
      expect(localStorage.getItem('vanguarda:presenca-visitante:raid')).toBeNull();
    });

    it('personagem já confirmado não vira erro', async () => {
      await asVisitor();
      await choose('forever');
      await type('characterName', 'Lunara');
      await type('characterSurname', 'Sombraviva');
      events.guestResult = { ok: false, error: 'already-confirmed' };
      await submit();
      expect(el.querySelector('[role="alert"]')).toBeNull();
      expect(presence()).toContain('Presença confirmada');
    });

    it('mostra o motivo quando não é possível confirmar', async () => {
      await asVisitor();
      await choose('forever');
      await type('characterName', 'Lunara');
      await type('characterSurname', 'Sombraviva');
      events.guestResult = { ok: false, error: 'guests-closed' };
      await submit();
      expect(text('.guest-form [role="alert"]')).toContain('foi desativada neste evento');
    });

    it('evento lotado não oferece o formulário', async () => {
      await asVisitor({ ...raid, attendeeCount: 40 });
      expect(text('#titulo-presenca')).toBe('Evento lotado');
      expect(q('.guest-form')).toBeNull();
    });

    it('veem as vagas disponíveis', async () => {
      await asVisitor({ ...raid, attendeeCount: 10 });
      expect(text('.presence__spots')).toBe('30 de 40 vagas disponíveis');
    });

    it('com a confirmação de visitantes desativada, não oferecem a ação', async () => {
      await asVisitor({ ...raid, guestsAllowed: false });
      expect(text('#titulo-presenca')).toBe('Confirmação exclusiva para membros');
      expect(q('.guest-form')).toBeNull();
      expect(q('.presence a')!.getAttribute('href')).toBe('/cadastro');
    });

    it('conta pendente também confirma como visitante', async () => {
      await asVisitor(raid, 'pending');
      expect(q('.guest-form')).toBeTruthy();
      await asVisitor({ ...raid, guestsAllowed: false }, 'pending');
      expect(q('.presence a')!.getAttribute('href')).toBe('/candidatura');
    });

    it('evento passado ou cancelado não oferece a ação', async () => {
      await asVisitor({ ...raid, startsAt: new Date(Date.now() - 86_400_000) });
      expect(presence()).toContain('Este evento já aconteceu');
      expect(buttonNamed('Confirmar presença')).toBeUndefined();
      await emit({ ...raid, status: 'cancelado' });
      expect(el.querySelector('.presence')).toBeNull();
    });
  });
});
