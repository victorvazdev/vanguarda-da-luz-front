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
  linkedSignal,
  signal,
} from '@angular/core';
import { Title } from '@angular/platform-browser';
import { Router, RouterLink } from '@angular/router';
import { GUILD } from '../../../core/content/guild-content';
import { ACCOUNT_MESSAGES } from '../../../core/auth/messages';
import { SessionService } from '../../../core/auth/session.service';
import type { AttendanceError, MyAttendance } from '../../../core/data/attendance';
import type { Character } from '../../../core/data/characters';
import type { MainCharacter } from '../../../core/data/members-admin';
import { CharactersService } from '../../../core/data/characters.service';
import { isFull, isUpcoming, spotsLeft, type GuildEvent } from '../../../core/data/events';
import { EventsService } from '../../../core/data/events.service';
import {
  GAMES,
  characterDisplayName,
  classLabel,
  gameLabel,
  type Game,
} from '../../../core/models/wow';
import { PATHS, joinPathFor } from '../../../core/routing/paths';
import {
  GUILD_TIME_ZONE_LABEL,
  formatBrasiliaDate,
  formatBrasiliaTime,
  formatBrasiliaWeekday,
  formatEventDateTime,
} from '../../../core/time/brasilia';
import { ConfirmService } from '../../../shared/ui/confirm-dialog/confirm.service';
import { FlashService } from '../../../shared/ui/flash/flash.service';
import { dayKey } from '../calendar/month';
import { AddonExportDialog } from '../../admin/events/addon-export/addon-export-dialog';
import { AttendeesPanel } from './attendees-panel';
import { GuestPresence } from './guest-presence';

const ATTENDANCE_ERRORS: Record<
  Exclude<AttendanceError, 'already-confirmed' | 'not-confirmed'>,
  string
> = {
  past: 'Este evento já começou. Não é mais possível alterar a presença.',
  'wrong-game': 'Este personagem não é da versão do jogo do evento. Escolha outro.',
  'character-not-found': 'Este personagem não existe mais. Escolha outro.',
  full: 'Este evento atingiu o limite de confirmados.',
  cancelled: 'Este evento foi cancelado. Não é possível alterar a presença.',
  'not-found': 'Este evento não existe mais.',
  'not-allowed': 'Sua conta não pode confirmar presença neste evento.',
  network: ACCOUNT_MESSAGES.network,
  unknown: 'Não foi possível salvar sua presença. Tente novamente.',
};

/** Valor da opção do personagem principal que ainda não tem documento próprio. */
const MAIN_FROM_APPLICATION = 'principal';
const characterKey = (c: Character) => c.id ?? MAIN_FROM_APPLICATION;

/** Nome da versão do jogo por extenso ("World of Warcraft Retail"). */
const gameName = (game: Game) => GAMES.find((g) => g.id === game)?.label ?? game;

/** "Tavia — Sacerdote, nível 80 (principal)"; com o jogo quando o evento aceita os dois. */
function characterOption(c: Character, withGame: boolean): string {
  const level = c.level ? `, nível ${c.level}` : '';
  const game = withGame ? ` · ${gameLabel(c.game)}` : '';
  const main = c.isMain ? ' (principal)' : '';
  return `${characterDisplayName(c)} — ${classLabel(c.characterClass)}${level}${main}${game}`;
}

/** "3 de 40 vagas disponíveis" (ou "1 de 40 vaga disponível"). */
export function spotsText(e: GuildEvent): string {
  const left = spotsLeft(e);
  return left === 1
    ? `1 de ${e.maxAttendees} vaga disponível`
    : `${left} de ${e.maxAttendees} vagas disponíveis`;
}

/** Detalhe de um evento do calendário: título, data, horário, organizador e descrição. */
@Component({
  selector: 'app-event-detail-page',
  imports: [RouterLink, AttendeesPanel, GuestPresence, AddonExportDialog],
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
  private readonly characters = inject(CharactersService);
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
  /** Personagens do membro: `undefined` enquanto carrega, `null` se não foi possível carregar. */
  private readonly myCharacters = signal<Character[] | null | undefined>(undefined);
  /** Personagens que podem confirmar presença: os da versão do jogo do evento. */
  protected readonly eligible = computed(() => {
    const list = this.myCharacters() ?? [];
    const game = this.event()?.game ?? null;
    return (game ? list.filter((c) => c.game === game) : list).map((c) => ({
      key: characterKey(c),
      label: characterOption(c, !game),
      character: c,
      summary: {
        game: c.game,
        characterName: c.characterName,
        ...(c.characterSurname ? { characterSurname: c.characterSurname } : {}),
        characterClass: c.characterClass,
        characterRole: c.characterRole,
      } satisfies MainCharacter,
    }));
  });
  protected readonly charactersState = computed(() => {
    const list = this.myCharacters();
    return list === undefined ? 'loading' : list === null ? 'error' : 'ready';
  });
  /**
   * Personagem escolhido. Por padrão, o principal, se for da versão do jogo do evento; a escolha
   * da pessoa é mantida enquanto o personagem continuar disponível.
   */
  protected readonly selectedCharacter = linkedSignal({
    source: this.eligible,
    computation: (options, previous?: { value: string }) => {
      if (previous && options.some((o) => o.key === previous.value)) return previous.value;
      return options.find((o) => o.character.isMain)?.key ?? '';
    },
  });
  /** Nome do personagem com que a pessoa confirmou presença. */
  protected readonly confirmedWith = computed(() => {
    const c = this.attendance()?.character;
    return c ? characterDisplayName(c) : null;
  });
  /** Presença vinda do addon do jogo (importada por um administrador). */
  protected readonly fromAddon = computed(() => {
    const at = this.attendance()?.fromAddon;
    return at
      ? `Esta presença veio do addon da guilda no jogo (resposta de ${formatEventDateTime(at)}, ` +
          `${GUILD_TIME_ZONE_LABEL}). Ao cancelar aqui, cancele também no jogo.`
      : null;
  });
  protected readonly characterError = signal<string | null>(null);
  /** Exclusão do evento cancelado em andamento (somente administradores). */
  protected readonly removing = signal(false);
  protected readonly removeError = signal<string | null>(null);

  protected readonly view = computed(() => {
    const e = this.event();
    if (!e) return null;
    return {
      title: e.title,
      game: e.game ? gameName(e.game) : null,
      date: `${formatBrasiliaWeekday(e.startsAt)}, ${formatBrasiliaDate(e.startsAt)}`,
      time: `${formatBrasiliaTime(e.startsAt)}, ${GUILD_TIME_ZONE_LABEL}`,
      organizer: e.organizer,
      description: e.description,
      cancelled: e.status === 'cancelado',
      upcoming: isUpcoming(e.startsAt),
      guestsAllowed: e.guestsAllowed,
      full: isFull(e),
      maxAttendees: e.maxAttendees,
      spots: spotsText(e),
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

    // Personagens do membro, para escolher com qual confirmar presença.
    effect((onCleanup) => {
      this.myCharacters.set(undefined);
      if (this.presenceMode() !== 'member') return;
      const stop = this.characters.watchMine(
        (list) => this.myCharacters.set(list),
        () => this.myCharacters.set(null),
      );
      onCleanup(stop);
    });

    // Título da aba com o nome do evento.
    effect(() => {
      const title = this.view()?.title;
      if (title) this.pageTitle.setTitle(`${title} | ${GUILD.name}`);
    });
  }

  protected chooseCharacter(key: string): void {
    this.selectedCharacter.set(key);
    this.characterError.set(null);
  }

  protected async confirmPresence(): Promise<void> {
    if (this.confirming()) return;
    this.attendanceError.set(null);
    this.presenceNotice.set(null);
    const chosen = this.eligible().find((o) => o.key === this.selectedCharacter());
    if (!chosen) {
      this.characterError.set('Escolha o personagem.');
      afterNextRender(
        () => this.host.nativeElement.querySelector<HTMLElement>('#presenca-personagem')?.focus(),
        { injector: this.injector },
      );
      return;
    }
    this.characterError.set(null);
    this.confirming.set(true);
    const result = await this.events.confirmAttendance(this.id(), chosen.character.id);
    this.confirming.set(false);
    // "Já confirmada" também é sucesso para a pessoa. O listener traz o horário oficial.
    if (result.ok || result.error === 'already-confirmed') {
      if (!this.attendance()) {
        this.attendance.set({
          confirmedAt: null,
          character: result.ok ? chosen.summary : null,
          fromAddon: null,
        });
      }
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
