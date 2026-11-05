import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import type { Application } from '../../../core/data/applications';
import type { DecisionError, PendingAccount } from '../../../core/data/review';
import { ReviewService } from '../../../core/data/review.service';
import {
  characterDisplayName,
  classLabel,
  gameLabel,
  roleLabel,
  rulesetLabel,
} from '../../../core/models/wow';
import { formatBrasiliaDate } from '../../../core/time/brasilia';
import { ConfirmService } from '../../../shared/ui/confirm-dialog/confirm.service';

const DECISION_ERRORS: Record<DecisionError, string> = {
  'already-decided': 'Esta candidatura já foi avaliada por outro administrador.',
  'not-allowed': 'Você não tem permissão para avaliar candidaturas.',
  network: 'Não foi possível conectar. Verifique sua internet e tente novamente.',
  unknown: 'Não foi possível registrar a decisão. Tente novamente.',
};

interface ApplicationCard {
  uid: string;
  name: string;
  classRole: string;
  where: string;
  motivation: string;
  account: string;
  submittedAt: string;
  previousRejections: number;
}

function toCard(account: PendingAccount, app: Application): ApplicationCard {
  const place =
    app.game === 'forever' ? `ruleset ${rulesetLabel(app.ruleset ?? '')}` : (app.server ?? '');
  return {
    uid: account.uid,
    name: characterDisplayName(app),
    classRole: `${classLabel(app.characterClass)}, ${roleLabel(app.characterRole).toLowerCase()}`,
    where: `${gameLabel(app.game)} · ${place}`,
    motivation: app.motivation,
    account: `${account.username} · ${account.email}`,
    submittedAt: formatBrasiliaDate(app.submittedAt),
    previousRejections: app.history.filter((h) => h.status === 'recusada').length,
  };
}

/** História "Aprovar ou recusar cadastros". */
@Component({
  selector: 'app-applications-admin-page',
  templateUrl: './applications-admin-page.html',
  styleUrl: './applications-admin-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ApplicationsAdminPage {
  private readonly review = inject(ReviewService);
  private readonly confirm = inject(ConfirmService);

  protected readonly state = signal<'loading' | 'ready' | 'error'>('loading');
  private readonly queue = signal<PendingAccount[]>([]);
  /** uid em decisão (desabilita os botões do cartão). */
  protected readonly busy = signal<string | null>(null);
  protected readonly status = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);

  protected readonly applications = computed(() =>
    this.queue().flatMap((a) => (a.application ? [toCard(a, a.application)] : [])),
  );
  protected readonly waiting = computed(() =>
    this.queue()
      .filter((a) => !a.application)
      .map((a) => ({
        uid: a.uid,
        username: a.username,
        email: a.email,
        situation: a.rejectedAt
          ? `candidatura recusada em ${formatBrasiliaDate(a.rejectedAt)}`
          : `cadastro em ${a.createdAt ? formatBrasiliaDate(a.createdAt) : '—'}, ainda sem candidatura`,
      })),
  );

  constructor() {
    const stop = this.review.watchQueue(
      (queue) => {
        this.queue.set(queue);
        this.state.set('ready');
      },
      () => this.state.set('error'),
    );
    inject(DestroyRef).onDestroy(stop);
  }

  protected async approve(card: ApplicationCard): Promise<void> {
    await this.decide(card, 'approve');
  }

  protected async reject(card: ApplicationCard): Promise<void> {
    const confirmed = await this.confirm.ask({
      title: 'Recusar candidatura?',
      message: `${card.name} continuará sem acesso às funcionalidades de membros e poderá enviar uma nova candidatura.`,
      confirmLabel: 'Recusar',
      tone: 'danger',
    });
    if (confirmed) await this.decide(card, 'reject');
  }

  private async decide(card: ApplicationCard, action: 'approve' | 'reject'): Promise<void> {
    if (this.busy()) return;
    this.busy.set(card.uid);
    this.status.set(null);
    this.error.set(null);
    const result =
      action === 'approve'
        ? await this.review.approve(card.uid)
        : await this.review.reject(card.uid);
    this.busy.set(null);
    if (result.ok) {
      this.status.set(
        action === 'approve'
          ? `Candidatura de ${card.name} aprovada. ${card.name} agora é membro da guilda.`
          : `Candidatura de ${card.name} recusada.`,
      );
    } else {
      this.error.set(DECISION_ERRORS[result.error]);
    }
  }
}
