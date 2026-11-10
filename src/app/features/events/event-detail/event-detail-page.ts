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
import { Title } from '@angular/platform-browser';
import { Router, RouterLink } from '@angular/router';
import { GUILD } from '../../../core/content/guild-content';
import { ACCOUNT_MESSAGES } from '../../../core/auth/messages';
import { SessionService } from '../../../core/auth/session.service';
import type { AttendanceError, MyAttendance } from '../../../core/data/attendance';
import { isUpcoming, type GuildEvent } from '../../../core/data/events';
import { EventsService } from '../../../core/data/events.service';
import { PATHS, joinPathFor } from '../../../core/routing/paths';
import {
  GUILD_TIME_ZONE_LABEL,
  formatBrasiliaDate,
  formatBrasiliaTime,
  formatBrasiliaWeekday,
} from '../../../core/time/brasilia';
import { ConfirmService } from '../../../shared/ui/confirm-dialog/confirm.service';
import { FlashService } from '../../../shared/ui/flash/flash.service';
import { dayKey } from '../calendar/month';
import { AttendeesPanel } from './attendees-panel';
import { GuestPresence } from './guest-presence';

const ATTENDANCE_ERRORS: Record<
  Exclude<AttendanceError, 'already-confirmed' | 'not-confirmed'>,
  string
> = {
  past: 'Este evento já começou. Não é mais possível alterar a presença.',
  cancelled: 'Este evento foi cancelado. Não é possível alterar a presença.',
  'not-found': 'Este evento não existe mais.',
  'not-allowed': 'Sua conta não pode confirmar presença neste evento.',
  network: ACCOUNT_MESSAGES.network,
  unknown: 'Não foi possível salvar sua presença. Tente novamente.',
};

/** Detalhe de um evento do calendário: título, data, horário, organizador e descrição. */
@Component({
  selector: 'app-event-detail-page',
  imports: [RouterLink, AttendeesPanel, GuestPresence],
  templateUrl: './event-detail-page.html',
  styleUrl: './event-detail-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EventDetailPage {
  private readonly events = inject(EventsService);
  private readonly pageTitle = inject(Title);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  private readonly confirm = inject(ConfirmService);
  private readonly session = inject(SessionService);
  private readonly router = inject(Router);
  private readonly flash = inject(FlashService);
  /** A lista de confirmados é visível apenas para administradores. */
  protected readonly isAdmin = computed(() => this.session.access() === 'admin');
  /** Membros confirmam com a conta; os demais (visitantes e contas pendentes), como visitantes. */
  protected readonly presenceMode = computed<'member' | 'guest' | null>(() => {
    const access = this.session.access();
    if (access === 'member' || access === 'admin') return 'member';
    if (access === 'visitor' || access === 'pending' || access === 'blocked') return 'guest';
    return null;
  });
  protected readonly joinPath = computed(() => joinPathFor(this.session.access()));

  /** Parâmetro `:id` da rota. */
  readonly id = input.required<string>();

  protected readonly paths = PATHS;
  protected readonly state = signal<'loading' | 'ready' | 'not-found' | 'error'>('loading');
  protected readonly event = signal<GuildEvent | null>(null);
  /** Presença da pessoa: `undefined` enquanto carrega, `null` se não confirmou. */
  protected readonly attendance = signal<MyAttendance | null | undefined>(undefined);
  protected readonly confirming = signal(false);
  /** Aviso após cancelar a presença. */
  protected readonly presenceNotice = signal<string | null>(null);
  protected readonly attendanceError = signal<string | null>(null);
  /** Exclusão do evento cancelado em andamento (somente administradores). */
  protected readonly removing = signal(false);
  protected readonly removeError = signal<string | null>(null);

  protected readonly view = computed(() => {
    const e = this.event();
    if (!e) return null;
    return {
      title: e.title,
      date: `${formatBrasiliaWeekday(e.startsAt)}, ${formatBrasiliaDate(e.startsAt)}`,
      time: `${formatBrasiliaTime(e.startsAt)}, ${GUILD_TIME_ZONE_LABEL}`,
      organizer: e.organizer,
      description: e.description,
      cancelled: e.status === 'cancelado',
      upcoming: isUpcoming(e.startsAt),
      guestsAllowed: e.guestsAllowed,
    };
  });

  /** Volta ao mês do evento (ou ao mês atual, se ainda não carregou). */
  protected readonly backParams = computed(() => {
    const e = this.event();
    return e ? { mes: dayKey(e.startsAt).slice(0, 7) } : {};
  });

  constructor() {
    effect((onCleanup) => {
      const id = this.id();
      this.state.set('loading');
      const stop = this.events.watchOne(
        id,
        (event) => {
          // Excluído por este administrador: a página sai daqui; não mostra "não encontrado".
          if (!event && this.removing()) return;
          this.event.set(event);
          this.state.set(event ? 'ready' : 'not-found');
        },
        () => this.state.set('error'),
      );
      onCleanup(stop);
    });

    // Presença do membro autenticado neste evento, em tempo real.
    effect((onCleanup) => {
      const id = this.id();
      this.attendance.set(undefined);
      this.attendanceError.set(null);
      if (this.presenceMode() !== 'member') return;
      const stop = this.events.watchMyAttendance(
        id,
        (attendance) => this.attendance.set(attendance),
        () => this.attendance.set(null),
      );
      onCleanup(stop);
    });

    // Título da aba com o nome do evento.
    effect(() => {
      const title = this.view()?.title;
      if (title) this.pageTitle.setTitle(`${title} | ${GUILD.name}`);
    });
  }

  protected async confirmPresence(): Promise<void> {
    if (this.confirming()) return;
    this.confirming.set(true);
    this.attendanceError.set(null);
    this.presenceNotice.set(null);
    const result = await this.events.confirmAttendance(this.id());
    this.confirming.set(false);
    // "Já confirmada" também é sucesso para a pessoa. O listener traz o horário oficial.
    if (result.ok || result.error === 'already-confirmed') {
      if (!this.attendance()) this.attendance.set({ confirmedAt: null });
      this.focusStatus();
      return;
    }
    this.attendanceError.set(ATTENDANCE_ERRORS[result.error as keyof typeof ATTENDANCE_ERRORS]);
  }

  protected async cancelPresence(): Promise<void> {
    const title = this.view()?.title ?? 'este evento';
    const confirmed = await this.confirm.ask({
      title: 'Cancelar presença?',
      message: `Seu nome sairá da lista de confirmados de ${title}. Você poderá confirmar novamente enquanto o evento não começar.`,
      confirmLabel: 'Cancelar presença',
      tone: 'danger',
    });
    if (!confirmed || this.confirming()) return;

    this.confirming.set(true);
    this.attendanceError.set(null);
    const result = await this.events.cancelAttendance(this.id());
    this.confirming.set(false);
    // "Não estava confirmada" (ex.: cancelada em outra aba) também é sucesso para a pessoa.
    if (result.ok || result.error === 'not-confirmed') {
      this.attendance.set(null);
      this.presenceNotice.set('Sua presença foi cancelada.');
      this.focusStatus();
      return;
    }
    this.attendanceError.set(ATTENDANCE_ERRORS[result.error as keyof typeof ATTENDANCE_ERRORS]);
  }

  /** Administrador exclui o evento cancelado (com a lista de confirmados) e volta ao calendário. */
  protected async removeEvent(): Promise<void> {
    const e = this.event();
    const v = this.view();
    if (!e || !v || this.removing()) return;
    const confirmed = await this.confirm.ask({
      title: 'Excluir evento?',
      message: `${v.title} (${v.date}) sairá do calendário, junto com a lista de confirmados. Esta ação não pode ser desfeita.`,
      confirmLabel: 'Excluir evento',
      cancelLabel: 'Manter',
      tone: 'danger',
    });
    if (!confirmed) return;

    this.removing.set(true);
    this.removeError.set(null);
    const result = await this.events.deleteCancelled(e.id);
    if (result.ok || result.error === 'not-found') {
      await this.router.navigate([PATHS.calendar], { queryParams: this.backParams() });
      this.flash.show(`${v.title} foi excluído do calendário.`);
      return;
    }
    this.removing.set(false);
    this.removeError.set(
      result.error === 'not-cancelled'
        ? 'Somente eventos cancelados podem ser excluídos.'
        : result.error === 'not-allowed'
          ? 'Você não tem permissão para excluir este evento.'
          : result.error === 'network'
            ? ACCOUNT_MESSAGES.network
            : 'Não foi possível excluir o evento. Tente novamente.',
    );
  }

  /** O botão usado some; o foco vai para a mensagem de situação da presença. */
  private focusStatus(): void {
    afterNextRender(
      () => this.host.nativeElement.querySelector<HTMLElement>('#presenca-status')?.focus(),
      { injector: this.injector },
    );
  }
}
