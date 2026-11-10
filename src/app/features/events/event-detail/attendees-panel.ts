import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { ACCOUNT_MESSAGES } from '../../../core/auth/messages';
import type { Attendee, AttendanceError } from '../../../core/data/attendance';
import { EventsService } from '../../../core/data/events.service';
import {
  guestDisplayName,
  type Guest,
  type GuestAttendanceError,
} from '../../../core/data/guest-attendance';
import { characterDisplayName, classLabel, gameLabel, roleLabel } from '../../../core/models/wow';
import { ConfirmService } from '../../../shared/ui/confirm-dialog/confirm.service';

const ERRORS: Partial<Record<AttendanceError | GuestAttendanceError, string>> = {
  past: 'O evento já começou. Não é mais possível alterar as presenças.',
  cancelled: 'O evento foi cancelado. Não é possível alterar as presenças.',
  'not-allowed': 'Você não tem permissão para esta ação.',
  network: ACCOUNT_MESSAGES.network,
  unknown: 'Não foi possível cancelar a presença. Tente novamente.',
};

interface AttendeeView {
  /** uid do membro ou ID da presença do visitante. */
  uid: string;
  guest?: boolean;
  name: string;
  details: string;
  meta: string;
}

const DELETED = 'Conta excluída';

function toView(a: Attendee): AttendeeView {
  const c = a.mainCharacter;
  if (a.deleted) {
    return c
      ? {
          uid: a.uid,
          name: characterDisplayName(c),
          details: `${classLabel(c.characterClass)}, ${roleLabel(c.characterRole).toLowerCase()}`,
          meta: `${gameLabel(c.game)} · ${DELETED}`,
        }
      : { uid: a.uid, name: DELETED, details: 'Sem personagem principal', meta: '' };
  }
  if (!c) {
    return { uid: a.uid, name: a.username, details: 'Sem personagem principal', meta: '' };
  }
  const name = characterDisplayName(c);
  const account = name.toLowerCase() === a.username.toLowerCase() ? '' : ` · Conta: ${a.username}`;
  return {
    uid: a.uid,
    name,
    details: `${classLabel(c.characterClass)}, ${roleLabel(c.characterRole).toLowerCase()}`,
    meta: `${gameLabel(c.game)}${account}`,
  };
}

function guestView(g: Guest): AttendeeView {
  return {
    uid: g.id,
    guest: true,
    name: guestDisplayName(g),
    details: g.game === 'forever' ? 'Personagem do WoW Forever' : 'Personagem do Retail',
    meta: 'Visitante',
  };
}

/** História "Ver presenças confirmadas" (lateral do detalhe; somente administradores). */
@Component({
  selector: 'app-attendees-panel',
  imports: [NgTemplateOutlet],
  templateUrl: './attendees-panel.html',
  styleUrl: './attendees-panel.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AttendeesPanel {
  private readonly events = inject(EventsService);
  private readonly confirm = inject(ConfirmService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);

  readonly eventId = input.required<string>();
  readonly eventTitle = input.required<string>();
  /** Evento ativo e futuro: presenças ainda podem ser canceladas. */
  readonly open = input.required<boolean>();

  protected readonly state = signal<'loading' | 'ready' | 'error'>('loading');
  private readonly attendees = signal<Attendee[]>([]);
  protected readonly view = computed(() => this.attendees().map(toView));
  private readonly guests = signal<Guest[]>([]);
  protected readonly guestsView = computed(() => this.guests().map(guestView));
  protected readonly total = computed(() => this.view().length + this.guestsView().length);
  protected readonly busy = signal<string | null>(null);
  protected readonly status = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);

  constructor() {
    effect((onCleanup) => {
      const id = this.eventId();
      this.state.set('loading');
      // As duas listas chegam separadas; o painel fica pronto quando ambas chegarem.
      // (Variáveis locais, não sinais: os callbacks podem rodar dentro do próprio efeito.)
      let membersReady = false;
      let guestsReady = false;
      let failed = false;
      const fail = () => {
        failed = true;
        this.state.set('error');
      };
      const ready = () => {
        if (membersReady && guestsReady && !failed) this.state.set('ready');
      };
      const stopMembers = this.events.watchAttendees(
        id,
        (list) => {
          this.attendees.set(list);
          membersReady = true;
          ready();
        },
        fail,
      );
      const stopGuests = this.events.watchGuests(
        id,
        (list) => {
          this.guests.set(list);
          guestsReady = true;
          ready();
        },
        fail,
      );
      onCleanup(() => {
        stopMembers();
        stopGuests();
      });
    });
  }

  protected async remove(person: AttendeeView): Promise<void> {
    const confirmed = await this.confirm.ask({
      title: 'Cancelar presença?',
      message: `${person.name}${person.guest ? ' (visitante)' : ''} sairá da lista de confirmados de ${this.eventTitle()}. A pessoa poderá confirmar novamente enquanto o evento não começar.`,
      confirmLabel: 'Cancelar presença',
      tone: 'danger',
    });
    if (!confirmed || this.busy()) return;

    this.busy.set(person.uid);
    this.status.set(null);
    this.error.set(null);
    const result = person.guest
      ? await this.events.removeGuest(this.eventId(), person.uid)
      : await this.events.removeAttendee(this.eventId(), person.uid);
    this.busy.set(null);
    if (result.ok || result.error === 'not-confirmed') {
      this.status.set(`Presença de ${person.name} cancelada.`);
      // O botão usado some com a linha; o foco vai para o aviso.
      afterNextRender(
        () => this.host.nativeElement.querySelector<HTMLElement>('#confirmados-status')?.focus(),
        { injector: this.injector },
      );
      return;
    }
    this.error.set(ERRORS[result.error] ?? ERRORS.unknown!);
  }
}
