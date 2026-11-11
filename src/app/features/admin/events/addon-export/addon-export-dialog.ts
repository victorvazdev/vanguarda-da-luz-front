import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { ACCOUNT_MESSAGES } from '../../../../core/auth/messages';
import {
  ADDON_DAYS_RANGE,
  ADDON_DEFAULT_DAYS,
  type AddonExportResult,
} from '../../../../core/data/addon-export';
import { ADDON_MAX_LENGTH } from '../../../../core/data/addon-format';
import { EventsService } from '../../../../core/data/events.service';
import {
  GUILD_TIME_ZONE_LABEL,
  formatBrasiliaDate,
  formatEventDateTime,
} from '../../../../core/time/brasilia';
import { Modal } from '../../../../shared/ui/modal/modal';

const number = new Intl.NumberFormat('pt-BR');
const DAY = 86_400_000;

/**
 * Exportação dos eventos do WoW Forever para o addon da guilda (somente administradores): gera a
 * string ao abrir e a cada mudança da janela de dias. Formato: docs/formato-string-addon.md.
 */
@Component({
  selector: 'app-addon-export-dialog',
  imports: [Modal],
  templateUrl: './addon-export-dialog.html',
  styleUrl: './addon-export-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AddonExportDialog {
  private readonly events = inject(EventsService);
  private readonly modal = viewChild.required(Modal);
  private readonly output = viewChild<ElementRef<HTMLTextAreaElement>>('output');

  protected readonly range = ADDON_DAYS_RANGE;
  protected readonly days = signal(ADDON_DEFAULT_DAYS);
  protected readonly daysError = signal<string | null>(null);
  protected readonly state = signal<'idle' | 'loading' | 'done' | 'error'>('idle');
  protected readonly result = signal<AddonExportResult | null>(null);
  protected readonly copyStatus = signal<string | null>(null);
  /** Descarta respostas de gerações anteriores (a janela mudou no meio). */
  private generation = 0;

  protected readonly view = computed(() => {
    const r = this.result();
    if (!r) return null;
    const generatedAt = `${formatEventDateTime(r.generatedAt)}, ${GUILD_TIME_ZONE_LABEL}`;
    if (!r.ok) {
      return {
        ok: false as const,
        generatedAt,
        message:
          `A string ficaria com ${number.format(r.length)} caracteres, acima do limite de ` +
          `${number.format(ADDON_MAX_LENGTH)} que o addon aceita. ` +
          (r.maxDays
            ? `Reduza a janela para ${r.maxDays} ${r.maxDays === 1 ? 'dia' : 'dias'} ou menos.`
            : 'Reduza a quantidade de eventos ou o tamanho das descrições.'),
      };
    }
    const lastDay = new Date(r.window.to.getTime() - DAY);
    return {
      ok: true as const,
      generatedAt,
      text: r.text,
      count: r.count === 1 ? '1 evento incluído' : `${number.format(r.count)} eventos incluídos`,
      period: `${formatBrasiliaDate(r.window.from)} a ${formatBrasiliaDate(lastDay)}`,
      length: number.format(r.text.length),
    };
  });

  open(): void {
    this.modal().open();
    void this.generate();
  }

  protected setDays(raw: string): void {
    const days = Number(raw);
    if (!Number.isInteger(days) || days < this.range.min || days > this.range.max) {
      this.daysError.set(`Use um número inteiro de ${this.range.min} a ${this.range.max}.`);
      return;
    }
    this.daysError.set(null);
    if (days === this.days() && this.state() === 'done') return;
    this.days.set(days);
    void this.generate();
  }

  protected async generate(): Promise<void> {
    const current = ++this.generation;
    this.state.set('loading');
    this.copyStatus.set(null);
    try {
      const result = await this.events.exportForAddon(this.days());
      if (current !== this.generation) return;
      this.result.set(result);
      this.state.set('done');
    } catch {
      if (current !== this.generation) return;
      this.result.set(null);
      this.state.set('error');
    }
  }

  protected async copy(): Promise<void> {
    const r = this.result();
    if (!r?.ok) return;
    const copied = await this.writeClipboard(r.text);
    this.copyStatus.set(
      copied
        ? 'String copiada. Cole no addon, no jogo.'
        : 'Não foi possível copiar automaticamente. A string foi selecionada: use Ctrl+C.',
    );
  }

  private async writeClipboard(text: string): Promise<boolean> {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Sem permissão ou sem a API: seleciona o texto para a cópia manual.
      const el = this.output()?.nativeElement;
      el?.focus();
      el?.select();
      return false;
    }
  }

  protected readonly networkMessage = ACCOUNT_MESSAGES.network;
}
