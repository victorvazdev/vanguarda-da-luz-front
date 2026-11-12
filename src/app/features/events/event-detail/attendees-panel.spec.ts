import { TestBed, type ComponentFixture } from '@angular/core/testing';
import type { AttendanceResult, Attendee } from '../../../core/data/attendance';
import { EventsService } from '../../../core/data/events.service';
import type { Guest } from '../../../core/data/guest-attendance';
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
  guestsNext: ((list: Guest[]) => void) | null = null;
  watchGuests(_id: string, next: (list: Guest[]) => void) {
    this.guestsNext = next;
    next([]);
    return () => undefined;
  }
  removedGuests: [string, string][] = [];
  removeGuest(eventId: string, id: string) {
    this.removedGuests.push([eventId, id]);
    return Promise.resolve({ ok: true as const, id });
  }
}

const lunara: Guest = {
  id: 'forever:Lunara:Sombraviva',
  game: 'forever',
  characterName: 'Lunara',
  characterSurname: 'Sombraviva',
  confirmedAt: new Date('2026-11-03T12:00:00Z'),
  fromAddon: false,
};
const thalor: Guest = {
  id: 'retail:Thalor:Azralon',
  game: 'retail',
  characterName: 'Thalor',
  realm: 'Azralon',
  confirmedAt: new Date('2026-11-04T12:00:00Z'),
  fromAddon: false,
};

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
  character: {
    game: 'retail',
    characterName: 'Maren',
    server: 'Azralon',
    characterClass: 'guerreiro',
    characterRole: 'tanque',
  },
  deleted: false,
  fromAddon: false,
};
const tavia: Attendee = {
  uid: 'tavia',
  username: 'TaviaB',
  confirmedAt: new Date('2026-11-02T12:00:00Z'),
  character: {
    game: 'forever',
    characterName: 'Tavia',
    characterSurname: 'Brasaluz',
    ruleset: 'normal',
    characterClass: 'mago',
    characterRole: 'dano',
  },
  deleted: false,
  fromAddon: false,
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
  it('mostra o total e cada confirmado com o personagem, a classe e a função', async () => {
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

  it('conta sem personagem aparece pelo nome de usuário', async () => {
    await setup();
    await emit([
      {
        uid: 'x',
        username: 'Kael',
        confirmedAt: null,
        character: null,
        deleted: false,
        fromAddon: false,
      },
    ]);
    expect(items()).toEqual([['Kael', 'Sem personagem']]);
  });

  it('no histórico, conta excluída aparece como tal, com o personagem', async () => {
    await setup(false);
    await emit([maren, { ...tavia, username: '', deleted: true }]);
    expect(text('#titulo-confirmados')).toBe('Confirmados: 2');
    expect(items()).toEqual([
      ['Maren', 'Guerreiro, tanque', 'Retail'],
      ['Tavia Brasaluz', 'Mago, dano', 'WoW Forever · Conta excluída'],
    ]);
    expect(el.textContent).not.toContain('TaviaB');
  });

  it('conta excluída sem personagem aparece só como conta excluída', async () => {
    await setup(false);
    await emit([
      {
        uid: 'x',
        username: '',
        confirmedAt: null,
        character: null,
        deleted: true,
        fromAddon: false,
      },
    ]);
    expect(items()).toEqual([['Conta excluída', 'Sem personagem']]);
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

  describe('Visitantes', () => {
    async function withGuests(guests: Guest[], open = true) {
      await setup(open);
      await emit([maren]);
      events.guestsNext!(guests);
      await fixture.whenStable();
    }

    it('presenças importadas do addon do jogo aparecem marcadas', async () => {
      await setup();
      await emit([{ ...tavia, fromAddon: true }]);
      events.guestsNext!([{ ...lunara, fromAddon: true }]);
      await fixture.whenStable();
      expect(items()).toEqual([
        ['Tavia Brasaluz', 'Mago, dano', 'WoW Forever · Conta: TaviaB · Pelo addon'],
        ['Lunara Sombraviva', 'Personagem do WoW Forever', 'Visitante · Pelo addon'],
      ]);
    });

    it('somam ao total e aparecem em lista própria, com o personagem e o jogo', async () => {
      await withGuests([lunara, thalor]);
      expect(text('#titulo-confirmados')).toBe('Confirmados: 3');
      expect(text('.attendees__group')).toBe('Visitantes: 2');
      expect(items()).toEqual([
        ['Maren', 'Guerreiro, tanque', 'Retail'],
        ['Lunara Sombraviva', 'Personagem do WoW Forever', 'Visitante'],
        ['Thalor-Azralon', 'Personagem do Retail', 'Visitante'],
      ]);
    });

    it('sem membros confirmados, mostra só os visitantes', async () => {
      await setup();
      await emit([]);
      events.guestsNext!([thalor]);
      await fixture.whenStable();
      expect(text('#titulo-confirmados')).toBe('Confirmados: 1');
      expect(el.querySelector('.attendees__empty')).toBeNull();
    });

    it('administrador cancela a presença de um visitante, com confirmação', async () => {
      await withGuests([lunara]);
      removeButton('Lunara Sombraviva')!.click();
      await fixture.whenStable();
      expect(dialog.asked[0].message).toContain('Lunara Sombraviva (visitante) sairá da lista');
      expect(events.removedGuests).toEqual([['raid', 'forever:Lunara:Sombraviva']]);
      expect(events.removed).toHaveLength(0);
      expect(text('#confirmados-status')).toBe('Presença de Lunara Sombraviva cancelada.');
    });

    it('evento passado ou cancelado não oferece a ação', async () => {
      await withGuests([lunara], false);
      expect(removeButton('Lunara Sombraviva')).toBeUndefined();
    });
  });
});
