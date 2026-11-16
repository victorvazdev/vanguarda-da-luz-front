import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { BackupReport } from '../../../core/data/addon-backup';
import type { BackupPlan } from '../../../core/data/addon-backup-plan';
import { AddonBackupService } from '../../../core/data/addon-backup.service';
import { dateTime, unixDate } from '../events/presence-import/presence-view';
import { AddonBackupSummary } from './addon-backup-summary';
import {
  BACKUP_APPLY_ERRORS,
  BACKUP_PREVIEW_ERRORS,
  planView,
  reportView,
} from './addon-backup-view';

/**
 * Aplicação de um backup do addon (somente administradores): o administrador cola a string
 * `VDLB1` gerada no jogo, confere a prévia (eventos, presenças e dados guardados) e confirma.
 * Formato: docs/formato-string-backup.md.
 */
@Component({
  selector: 'app-addon-backup-page',
  imports: [RouterLink, AddonBackupSummary],
  templateUrl: './addon-backup-page.html',
  styleUrl: './addon-backup-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AddonBackupPage {
  private readonly backups = inject(AddonBackupService);

  protected readonly text = signal('');
  protected readonly state = signal<'input' | 'checking' | 'preview' | 'applying' | 'done'>(
    'input',
  );
  protected readonly error = signal<string | null>(null);
  protected readonly plan = signal<BackupPlan | null>(null);
  /** A string validada (sem espaços nas pontas), guardada no histórico. */
  private readonly checkedText = signal('');
  protected readonly report = signal<BackupReport | null>(null);
  protected readonly recorded = signal<'new' | 'existing' | 'failed'>('new');

  protected readonly summary = computed(() => {
    const p = this.plan();
    if (!p) return null;
    const b = p.backup;
    return {
      generatedAt: dateTime(unixDate(b.generatedAt)),
      generatedBy: b.generatedBy || 'Não informado',
      older: p.older ? dateTime(unixDate(p.older.generatedAt)) : null,
      alreadyApplied: p.alreadyApplied
        ? p.alreadyApplied.appliedAt
          ? dateTime(p.alreadyApplied.appliedAt)
          : 'antes'
        : null,
    };
  });

  protected readonly previewView = computed(() => {
    const p = this.plan();
    return p ? planView(p) : null;
  });

  protected readonly reportView = computed(() => {
    const r = this.report();
    return r ? reportView(r) : null;
  });

  protected setText(value: string): void {
    this.text.set(value);
    this.error.set(null);
  }

  protected async check(): Promise<void> {
    const text = this.text().trim();
    if (!text) {
      this.error.set('Cole a string de backup gerada no jogo.');
      return;
    }
    this.state.set('checking');
    this.error.set(null);
    const result = await this.backups.preview(text);
    if (!result.ok) {
      this.error.set(BACKUP_PREVIEW_ERRORS[result.error]);
      this.state.set('input');
      return;
    }
    this.plan.set(result.plan);
    this.checkedText.set(result.text);
    this.state.set('preview');
  }

  protected async confirm(): Promise<void> {
    const plan = this.plan();
    if (!plan) return;
    this.state.set('applying');
    this.error.set(null);
    const result = await this.backups.apply(plan, this.checkedText());
    if (!result.ok) {
      this.error.set(BACKUP_APPLY_ERRORS[result.error]);
      this.state.set('preview');
      return;
    }
    this.report.set(result.report);
    this.recorded.set(result.recorded);
    this.state.set('done');
  }

  /** Volta para colar outra string. */
  protected restart(): void {
    this.text.set('');
    this.plan.set(null);
    this.report.set(null);
    this.error.set(null);
    this.state.set('input');
  }
}
