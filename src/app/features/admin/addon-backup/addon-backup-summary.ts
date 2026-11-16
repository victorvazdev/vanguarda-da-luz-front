import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import type { BackupView } from './addon-backup-view';

/**
 * O que um backup do addon muda (prévia) ou mudou (relatório): eventos, presenças e as
 * quantidades de profissões, item levels e tempos. Usado na aplicação e no histórico.
 */
@Component({
  selector: 'app-addon-backup-summary',
  templateUrl: './addon-backup-summary.html',
  styleUrl: './addon-backup-summary.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AddonBackupSummary {
  readonly view = input.required<BackupView>();
  /** Relatório (resultado da aplicação) em vez de prévia. */
  readonly report = input(false);
  /** Nível dos títulos das seções (2 na página, 3 dentro do histórico). */
  readonly level = input<2 | 3>(2);
}
