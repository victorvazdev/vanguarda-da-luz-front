import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import type { Application, ApplicationStatus } from '../../../core/data/applications';
import { ApplicationsService } from '../../../core/data/applications.service';
import {
  characterDisplayName,
  classLabel,
  gameLabel,
  roleLabel,
  rulesetLabel,
} from '../../../core/models/wow';
import { PATHS } from '../../../core/routing/paths';
import { formatBrasiliaDate } from '../../../core/time/brasilia';

interface StatusView {
  badge: string;
  badgeClass: string;
  title: string;
  text: string;
  action?: { label: string; path: string };
}

const STATUS: Record<ApplicationStatus, StatusView> = {
  pendente: {
    badge: 'Pendente',
    badgeClass: 'badge--warning',
    title: 'Recebemos sua candidatura',
    text: 'Um administrador avaliará seu pedido. O resultado aparecerá aqui, e o calendário será liberado se você for aprovado.',
  },
  aprovada: {
    badge: 'Aprovada',
    badgeClass: 'badge--success',
    title: 'Boas-vindas à Vanguarda da Luz',
    text: 'Sua candidatura foi aprovada. O calendário de eventos já está liberado para você.',
    action: { label: 'Ver calendário', path: PATHS.calendar },
  },
  recusada: {
    badge: 'Recusada',
    badgeClass: 'badge--danger',
    title: 'Sua candidatura não foi aprovada',
    text: 'Você pode revisar seus dados e enviar uma nova candidatura.',
    action: { label: 'Enviar nova candidatura', path: PATHS.application },
  },
};

/** "Minha conta": acompanhamento da candidatura (pendente, aprovada ou recusada). */
@Component({
  selector: 'app-application-status',
  imports: [RouterLink],
  templateUrl: './application-status.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ApplicationStatusPanel {
  protected readonly applicationPath = PATHS.application;
  protected readonly state = signal<'loading' | 'ready' | 'error'>('loading');
  protected readonly application = signal<Application | null>(null);

  protected readonly view = computed(() => {
    const app = this.application();
    if (!app) return null;
    return {
      ...STATUS[app.status],
      character: characterDisplayName(app),
      game: gameLabel(app.game),
      place:
        app.game === 'forever'
          ? { label: 'Ruleset', value: rulesetLabel(app.ruleset ?? '') }
          : { label: 'Servidor', value: app.server ?? '' },
      characterClass: classLabel(app.characterClass),
      role: roleLabel(app.characterRole),
      submittedAt: formatBrasiliaDate(app.submittedAt),
      decidedAt:
        app.status !== 'pendente' && app.decidedAt ? formatBrasiliaDate(app.decidedAt) : null,
    };
  });

  constructor() {
    const stop = inject(ApplicationsService).watchMine(
      (app) => {
        this.application.set(app);
        this.state.set('ready');
      },
      () => this.state.set('error'),
    );
    inject(DestroyRef).onDestroy(stop);
  }
}
