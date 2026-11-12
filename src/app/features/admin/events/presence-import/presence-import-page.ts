import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { RouterLink } from '@angular/router';
import type { AppliedItem, ImportReport } from '../../../../core/data/presence-import';
import {
  hasChanges,
  type EventPlan,
  type ImportPlan,
  type PlanItem,
} from '../../../../core/data/presence-import-plan';
import { PresenceImportService } from '../../../../core/data/presence-import.service';
import { GUILD_TIME_ZONE_LABEL, formatEventDateTime } from '../../../../core/time/brasilia';
import {
  APPLY_ERRORS,
  IGNORED_EVENTS,
  PREVIEW_ERRORS,
  refusalMessage,
} from './presence-import-messages';

interface Line {
  character: string;
  detail: string;
}

/** Itens de um evento agrupados para exibição (prévia ou relatório). */
interface EventView {
  key: string;
  title: string;
  when: string | null;
  ignored: string | null;
  members: Line[];
  guests: Line[];
  cancellations: Line[];
  refused: Line[];
  unchanged: number;
}

const unixDate = (seconds: number) => new Date(seconds * 1000);
const dateTime = (date: Date) => `${formatEventDateTime(date)}, ${GUILD_TIME_ZONE_LABEL}`;

/** Resultado de um item: o planejado (prévia) ou o obtido na aplicação (relatório). */
function place(view: EventView, item: PlanItem | AppliedItem) {
  const outcome = 'outcome' in item ? item.outcome : null;
  const line = (detail: string) => ({ character: item.character, detail });
  if (outcome?.result === 'refused') {
    view.refused.push(line(refusalMessage(outcome.reason)));
    return;
  }
  if (outcome?.result === 'unchanged') {
    view.unchanged++;
    return;
  }
  switch (item.action) {
    case 'confirm-member':
      view.members.push(line(`Membro ${item.username}`));
      break;
    case 'confirm-guest':
      view.guests.push(line('Visitante'));
      break;
    case 'cancel-member':
      view.cancellations.push(line(`Membro ${item.username}`));
      break;
    case 'cancel-guest':
      view.cancellations.push(line('Visitante'));
      break;
    case 'refused':
      view.refused.push(line(refusalMessage(item.reason, item.detail)));
      break;
    case 'unchanged':
      view.unchanged++;
      break;
  }
}

function eventView(
  e: { eventId: string; ignored: EventPlan['ignored'] },
  title: string | null,
  startsAt: Date | null,
  items: (PlanItem | AppliedItem)[],
): EventView {
  const view: EventView = {
    key: e.eventId,
    title: title ?? `Evento ${e.eventId}`,
    when: startsAt ? dateTime(startsAt) : null,
    ignored: e.ignored ? IGNORED_EVENTS[e.ignored] : null,
    members: [],
    guests: [],
    cancellations: [],
    refused: [],
    unchanged: 0,
  };
  for (const item of items) place(view, item);
  return view;
}

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
