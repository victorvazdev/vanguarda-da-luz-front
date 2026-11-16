import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { ACCOUNT_MESSAGES } from '../../../core/auth/messages';
import {
  RESTORE_RECENT_DAYS,
  type RestoreResult,
  type StoredBackup,
} from '../../../core/data/addon-backup';
import {
  characterRows,
  emptyCharacterState,
  normalizeName,
  togetherRows,
  type CharacterState,
} from '../../../core/data/addon-backup-state';
import { AddonBackupService } from '../../../core/data/addon-backup.service';
import { ADDON_MAX_LENGTH } from '../../../core/data/addon-format';
import { dateTime, unixDate } from '../events/presence-import/presence-view';
import { AddonBackupSummary } from './addon-backup-summary';
import { reportView } from './addon-backup-view';

const number = new Intl.NumberFormat('pt-BR');

/** "12 h 05 min" a partir de segundos. */
export function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const rest = String(minutes % 60).padStart(2, '0');
  return hours ? `${number.format(hours)} h ${rest} min` : `${minutes} min`;
}

/**
 * Dados do addon (somente administradores): estado combinado dos backups (profissões, item
 * level e main/alt, tempo jogado junto), histórico dos backups aplicados e a string de
 * restauração para o jogo.
 */
@Component({
  selector: 'app-addon-data-page',
  imports: [RouterLink, AddonBackupSummary],
  templateUrl: './addon-data-page.html',
  styleUrl: './addon-data-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AddonDataPage {
  private readonly backups = inject(AddonBackupService);
  private readonly output = viewChild<ElementRef<HTMLTextAreaElement>>('output');

  protected readonly recentDays = RESTORE_RECENT_DAYS;
  protected readonly state = signal<'loading' | 'ready' | 'error'>('loading');
  protected readonly characters = signal<CharacterState>(emptyCharacterState());
  protected readonly history = signal<StoredBackup[]>([]);
  protected readonly filter = signal('');

  protected readonly includeOld = signal(false);
  protected readonly restoring = signal(false);
  protected readonly restore = signal<RestoreResult | null>(null);
  protected readonly restoreError = signal<string | null>(null);
  protected readonly copyStatus = signal<string | null>(null);
  /** ID do backup cuja string original foi copiada (mensagem ao lado do botão). */
  protected readonly copiedBackup = signal<{ id: string; message: string } | null>(null);

  private readonly matches = (name: string) => {
    const f = normalizeName(this.filter());
    return !f || normalizeName(name).includes(f);
  };

  protected readonly characterRows = computed(() =>
    characterRows(this.characters())
      .filter((r) => this.matches(r.character) || (r.main !== null && this.matches(r.main)))
      .map((r) => ({
        ...r,
        role: r.main === null ? 'Não definido' : r.isAlt ? `Alt de ${r.main}` : 'Main',
        itemLevelText: r.itemLevel === null ? '—' : String(r.itemLevel),
        professionsText: r.professions.length
          ? r.professions.map((p) => `${p.name} ${p.level}/${p.max}`).join(', ')
          : r.professionsAt === null
            ? '—'
            : 'Nenhuma',
        updated: [r.itemLevelAt, r.professionsAt]
          .filter((t): t is number => t !== null)
          .reduce<number | null>((a, b) => (a === null || b > a ? b : a), null),
      }))
      .map((r) => ({
        ...r,
        updatedText: r.updated === null ? '—' : dateTime(unixDate(r.updated)),
      })),
  );

  protected readonly togetherRows = computed(() =>
    togetherRows(this.characters())
      .filter((r) => this.matches(r.character) || r.alts.some(this.matches))
      .map((r) => ({
        ...r,
        altsText: r.alts.length ? r.alts.join(', ') : '—',
        time: formatDuration(r.seconds),
      })),
  );

  protected readonly historyRows = computed(() =>
    this.history().map((b) => ({
      id: b.id,
      text: b.text,
      generatedAt: dateTime(unixDate(b.generatedAt)),
      generatedBy: b.generatedBy || 'Não informado',
      appliedAt: b.appliedAt ? dateTime(b.appliedAt) : '—',
      appliedBy: b.appliedByName || 'administrador',
      events: b.report.events.length,
      view: reportView(b.report),
    })),
  );

  protected readonly restoreView = computed(() => {
    const r = this.restore();
    if (!r) return null;
    return {
      text: r.text,
      length: number.format(r.text.length),
      characters: r.characters,
      presenceEvents: r.presenceEvents,
      tooLong: r.tooLong,
      limit: number.format(ADDON_MAX_LENGTH),
    };
  });

  constructor() {
    void this.load();
  }

  protected async load(): Promise<void> {
    this.state.set('loading');
    try {
      const [characters, history] = await Promise.all([
        this.backups.characters(),
        this.backups.history(),
      ]);
      this.characters.set(characters);
      this.history.set(history);
      this.state.set('ready');
    } catch {
      this.state.set('error');
    }
  }

  protected setIncludeOld(value: boolean): void {
    this.includeOld.set(value);
    this.restore.set(null);
    this.copyStatus.set(null);
  }

  /** Gera a string de restauração e a copia. */
  protected async copyRestore(): Promise<void> {
    this.restoring.set(true);
    this.restoreError.set(null);
    this.copyStatus.set(null);
    try {
      const result = await this.backups.restoreString(this.includeOld());
      this.restore.set(result);
      const copied = await this.writeClipboard(result.text, () => this.output()?.nativeElement);
      this.copyStatus.set(
        copied
          ? 'String copiada. Cole no jogo em "Administração > Backup do addon > Restaurar".'
          : 'Não foi possível copiar automaticamente. A string foi selecionada: use Ctrl+C.',
      );
    } catch {
      this.restoreError.set(
        `Não foi possível gerar a string de restauração. ${ACCOUNT_MESSAGES.network}`,
      );
    } finally {
      this.restoring.set(false);
    }
  }

  /** Copia a string original de um backup do histórico. */
  protected async copyOriginal(
    id: string,
    text: string,
    field: HTMLTextAreaElement,
  ): Promise<void> {
    const copied = await this.writeClipboard(text, () => field);
    this.copiedBackup.set({
      id,
      message: copied
        ? 'String original copiada.'
        : 'Não foi possível copiar automaticamente. A string foi selecionada: use Ctrl+C.',
    });
  }

  private async writeClipboard(
    text: string,
    field: () => HTMLTextAreaElement | undefined,
  ): Promise<boolean> {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Sem permissão ou sem a API: seleciona o texto para a cópia manual.
      setTimeout(() => {
        const el = field();
        el?.focus();
        el?.select();
      });
      return false;
    }
  }
}
