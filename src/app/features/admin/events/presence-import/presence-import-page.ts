import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { RouterLink } from '@angular/router';
import type { ImportReport } from '../../../../core/data/presence-import';
import { hasChanges, type ImportPlan } from '../../../../core/data/presence-import-plan';
import { PresenceImportService } from '../../../../core/data/presence-import.service';
import { APPLY_ERRORS, PREVIEW_ERRORS } from './presence-import-messages';
import { dateTime, eventView, unixDate } from './presence-view';

/**
 * Importação de presenças do addon (somente administradores): o administrador cola a string
 * `VDLP1` gerada no jogo, confere a prévia do que muda em cada evento e confirma. Formato:
 * docs/formato-string-presencas.md.
 */
@Component({
  selector: 'app-presence-import-page',
  imports: [RouterLink, NgTemplateOutlet],
  templateUrl: './presence-import-page.html',
  styleUrl: './presence-import-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PresenceImportPage {
  private readonly importer = inject(PresenceImportService);

  protected readonly text = signal('');
  protected readonly state = signal<'input' | 'checking' | 'preview' | 'applying' | 'done'>(
    'input',
  );
  protected readonly error = signal<string | null>(null);
  protected readonly plan = signal<ImportPlan | null>(null);
  protected readonly report = signal<ImportReport | null>(null);

  protected readonly summary = computed(() => {
    const p = this.plan();
    if (!p) return null;
    return {
      generatedAt: dateTime(unixDate(p.generatedAt)),
      lastGeneratedAt: p.lastGeneratedAt === null ? null : dateTime(unixDate(p.lastGeneratedAt)),
      outdated: p.outdated,
      changes: hasChanges(p),
    };
  });

  protected readonly previewEvents = computed(() =>
    (this.plan()?.events ?? []).map((e) =>
      eventView(e, e.event?.title ?? null, e.event?.startsAt ?? null, e.items),
    ),
  );

  protected readonly reportEvents = computed(() => {
    const plan = this.plan();
    const starts = new Map(plan?.events.map((e) => [e.eventId, e.event?.startsAt ?? null]));
    return (this.report()?.events ?? []).map((e) =>
      eventView(e, e.title, starts.get(e.eventId) ?? null, e.items),
    );
  });

  protected setText(value: string): void {
    this.text.set(value);
    this.error.set(null);
  }

  protected async check(): Promise<void> {
    const text = this.text().trim();
    if (!text) {
      this.error.set('Cole a string de presenças gerada no jogo.');
      return;
    }
    this.state.set('checking');
    this.error.set(null);
    const result = await this.importer.preview(text);
    if (!result.ok) {
      this.error.set(PREVIEW_ERRORS[result.error]);
      this.state.set('input');
      return;
    }
    this.plan.set(result.plan);
    this.state.set('preview');
  }

  protected async confirm(): Promise<void> {
    const plan = this.plan();
    if (!plan) return;
    this.state.set('applying');
    this.error.set(null);
    const result = await this.importer.apply(plan);
    if (!result.ok) {
      this.error.set(APPLY_ERRORS[result.error]);
      this.state.set('preview');
      return;
    }
    this.report.set(result.report);
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
