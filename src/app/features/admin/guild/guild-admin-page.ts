import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  FACTIONS,
  GUILD_INFO_LIMITS,
  SAVE_CONTENT_ERRORS,
  type Faction,
  type GuildInfo,
} from '../../../core/content/site-content';
import { SiteContentService } from '../../../core/content/site-content.service';
import { RULESETS, type Ruleset } from '../../../core/models/wow';
import { formatBrasiliaDate } from '../../../core/time/brasilia';
import { firstError, type ErrorMessages } from '../../../shared/forms/field-errors';

type Field = 'history' | 'values' | 'retailServer';

const MESSAGES: Record<Field, ErrorMessages> = {
  history: { maxlength: `Use no máximo ${GUILD_INFO_LIMITS.history} caracteres.` },
  values: { maxlength: `Use no máximo ${GUILD_INFO_LIMITS.values} caracteres.` },
  retailServer: { maxlength: `Use no máximo ${GUILD_INFO_LIMITS.retailServer} caracteres.` },
};

/** História "Editar informações da guilda". */
@Component({
  selector: 'app-guild-admin-page',
  imports: [ReactiveFormsModule],
  templateUrl: './guild-admin-page.html',
  styleUrl: '../site-content-admin.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GuildAdminPage {
  private readonly content = inject(SiteContentService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  private readonly fb = inject(NonNullableFormBuilder);

  protected readonly limits = GUILD_INFO_LIMITS;
  protected readonly factions = FACTIONS;
  protected readonly rulesets = RULESETS;
  protected readonly info = this.content.guild();
  protected readonly ready = signal(false);
  protected readonly saving = signal(false);
  protected readonly submitted = signal(false);
  protected readonly status = signal<string | null>(null);
  protected readonly formError = signal<string | null>(null);
  protected readonly updatedAt = signal<string | null>(null);

  protected readonly form = this.fb.group({
    history: ['', [Validators.maxLength(GUILD_INFO_LIMITS.history)]],
    values: ['', [Validators.maxLength(GUILD_INFO_LIMITS.values)]],
    faction: this.fb.control<Faction>('alianca'),
    retailServer: ['', [Validators.maxLength(GUILD_INFO_LIMITS.retailServer)]],
    foreverRulesets: this.fb.group(
      Object.fromEntries(RULESETS.map((r) => [r.id, false])) as Record<Ruleset, boolean>,
    ),
  });

  constructor() {
    // O formulário abre com as informações atuais (somente na primeira leitura, para não
    // apagar o que está sendo digitado se outro administrador salvar ao mesmo tempo).
    effect(() => {
      const info = this.info();
      if (!info) return;
      untracked(() => {
        this.updatedAt.set(info.updatedAt ? formatBrasiliaDate(info.updatedAt) : null);
        if (!this.ready()) {
          this.fill(info);
          this.ready.set(true);
        }
      });
    });
  }

  protected fieldError(field: Field): string | null {
    const control = this.form.controls[field];
    if (!control.touched && !this.submitted()) return null;
    return firstError(control, MESSAGES[field]);
  }

  protected describedBy(field: Field, ...extra: string[]): string | null {
    const ids = [this.fieldError(field) ? `guilda-${field}-erro` : '', ...extra].filter(Boolean);
    return ids.length ? ids.join(' ') : null;
  }

  protected async save(): Promise<void> {
    if (this.saving()) return;
    this.submitted.set(true);
    this.status.set(null);
    this.formError.set(null);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.focus('.content-form [aria-invalid="true"]');
      return;
    }
    const v = this.form.getRawValue();
    this.saving.set(true);
    const result = await this.content.saveGuild({
      history: v.history,
      values: v.values,
      faction: v.faction,
      retailServer: v.retailServer,
      foreverRulesets: RULESETS.map((r) => r.id).filter((id) => v.foreverRulesets[id]),
    });
    this.saving.set(false);
    if (result.ok) {
      this.status.set('Informações salvas. A página da guilda já mostra as alterações.');
      this.form.markAsPristine();
    } else {
      this.formError.set(SAVE_CONTENT_ERRORS[result.error]);
      this.focus('.content-form .form-alert');
    }
  }

  protected discard(): void {
    const info = this.info();
    if (info) this.fill(info);
    this.submitted.set(false);
    this.status.set(null);
    this.formError.set(null);
  }

  private fill(info: GuildInfo): void {
    this.form.reset({
      history: info.history,
      values: info.values,
      faction: info.faction,
      retailServer: info.retailServer,
      foreverRulesets: Object.fromEntries(
        RULESETS.map((r) => [r.id, info.foreverRulesets.includes(r.id)]),
      ) as Record<Ruleset, boolean>,
    });
  }

  private focus(selector: string): void {
    afterNextRender(
      () => {
        const el = this.host.nativeElement.querySelector<HTMLElement>(selector);
        el?.focus();
        el?.scrollIntoView?.({ block: 'center' });
      },
      { injector: this.injector },
    );
  }
}
