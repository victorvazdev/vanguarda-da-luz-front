import { TestBed, type ComponentFixture } from '@angular/core/testing';
import type { AttendanceResult, Attendee } from '../../../core/data/attendance';
import { EventsService } from '../../../core/data/events.service';
import { ConfirmService } from '../../../shared/ui/confirm-dialog/confirm.service';
import { AttendeesPanel } from './attendees-panel';

class EventsStub {
  next: ((list: Attendee[]) => void) | null = null;
  ids: string[] = [];
  result: AttendanceResult = { ok: true };
  removed: [string, string][] = [];
  watchAttendees(id: string, next: (list: Attendee[]) => void) {
    this.ids.push(id);
    this.next = next;
    return () => undefined;
  }
  removeAttendee(eventId: string, uid: string) {
    this.removed.push([eventId, uid]);
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

const maren: Attendee = {
  uid: 'maren',
  username: 'Maren',
  confirmedAt: new Date('2026-11-01T12:00:00Z'),
  mainCharacter: {
    game: 'retail',
    characterName: 'Maren',
    server: 'Azralon',
    characterClass: 'guerreiro',
    characterRole: 'tanque',
  },
};
const tavia: Attendee = {
  uid: 'tavia',
  username: 'TaviaB',
  confirmedAt: new Date('2026-11-02T12:00:00Z'),
  mainCharacter: {
    game: 'forever',
    characterName: 'Tavia',
    characterSurname: 'Brasaluz',
    ruleset: 'normal',
    characterClass: 'mago',
    characterRole: 'dano',
  },
};

let fixture: ComponentFixture<AttendeesPanel>;
let el: HTMLElement;
let events: EventsStub;
let dialog: ConfirmStub;

async function setup(open = true) {
  events = new EventsStub();
  dialog = new ConfirmStub();
  TestBed.configureTestingModule({
    imports: [AttendeesPanel],
    providers: [
      { provide: EventsService, useValue: events },
      { provide: ConfirmService, useValue: dialog },
    ],
  });
  fixture = TestBed.createComponent(AttendeesPanel);
  fixture.componentRef.setInput('eventId', 'raid');
  fixture.componentRef.setInput('eventTitle', 'Raid semanal');
  fixture.componentRef.setInput('open', open);
  el = fixture.nativeElement;
  await fixture.whenStable();
}

async function emit(list: Attendee[]) {
  events.next!(list);
  await fixture.whenStable();
}

const text = (sel: string) => el.querySelector(sel)?.textContent?.replace(/\s+/g, ' ').trim();
const items = () =>
  [...el.querySelectorAll('.attendees__item')].map((li) =>
    [...li.querySelectorAll('strong, span:not(.sr-only)')].map((n) => n.textContent?.trim()),
  );
const removeButton = (name: string) =>
  [...el.querySelectorAll<HTMLButtonElement>('.attendees__remove')].find((b) =>
    b.textContent?.includes(name),
  );

describe('AttendeesPanel (Ver presenças confirmadas)', () => {
  it('mostra o total e cada confirmado com personagem principal, classe e função', async () => {
    await setup();
    expect(events.ids).toEqual(['raid']);
    await emit([maren, tavia]);
    expect(text('#titulo-confirmados')).toBe('Confirmados: 2');
    expect(items()).toEqual([
      ['Maren', 'Guerreiro, tanque', 'Retail'],
      ['Tavia Brasaluz', 'Mago, dano', 'WoW Forever · Conta: TaviaB'],
    ]);
  });

  it('acompanha confirmações e cancelamentos', async () => {
    await setup();
    await emit([maren, tavia]);
    await emit([tavia]);
    expect(text('#titulo-confirmados')).toBe('Confirmados: 1');
  });

  it('avisa quando ainda não há confirmados', async () => {
    await setup();
    await emit([]);
    expect(text('#titulo-confirmados')).toBe('Confirmados: 0');
    expect(text('.attendees__empty')).toBe('Ainda não há confirmados.');
  });

  it('conta sem personagem principal aparece pelo nome de usuário', async () => {
    await setup();
    await emit([{ uid: 'x', username: 'Kael', confirmedAt: null, mainCharacter: null }]);
    expect(items()).toEqual([['Kael', 'Sem personagem principal']]);
  });

  describe('Administrador cancela a presença de alguém', () => {
    it('pede confirmação e não cancela se voltar', async () => {
      await setup();
      await emit([maren, tavia]);
      dialog.answer = false;
      removeButton('Tavia Brasaluz')!.click();
      await fixture.whenStable();
      expect(dialog.asked[0].title).toBe('Cancelar presença?');
      expect(dialog.asked[0].message).toContain(
        'Tavia Brasaluz sairá da lista de confirmados de Raid semanal',
      );
      expect(events.removed).toHaveLength(0);
    });

    it('cancela após a confirmação e avisa, com o foco no aviso', async () => {
      await setup();
      await emit([maren, tavia]);
      removeButton('Tavia Brasaluz')!.click();
      await fixture.whenStable();
      expect(events.removed).toEqual([['raid', 'tavia']]);
      expect(text('#confirmados-status')).toBe('Presença de Tavia Brasaluz cancelada.');
      expect(document.activeElement?.id).toBe('confirmados-status');
    });

    it('mostra o motivo quando não é possível', async () => {
      await setup();
      await emit([maren]);
      events.result = { ok: false, error: 'past' };
      removeButton('Maren')!.click();
      await fixture.whenStable();
      expect(text('[role="alert"]')).toContain('já começou');
    });

    it('evento passado ou cancelado não oferece a ação', async () => {
      await setup(false);
      await emit([maren]);
      expect(removeButton('Maren')).toBeUndefined();
    });

    it('o botão diz de quem é a presença (leitores de tela)', async () => {
      await setup();
      await emit([maren]);
      expect(removeButton('Maren')!.textContent?.replace(/\s+/g, ' ').trim()).toBe(
        'Cancelar presença de Maren',
      );
    });
  });
});
