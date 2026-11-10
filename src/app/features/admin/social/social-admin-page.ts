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
import { NonNullableFormBuilder, ReactiveFormsModule, type ValidatorFn } from '@angular/forms';
import {
  SAVE_CONTENT_ERRORS,
  SOCIAL_NETWORKS,
  SOCIAL_URL_MAX,
  isValidSocialUrl,
  type SocialLinks,
  type SocialNetworkId,
} from '../../../core/content/site-content';
import { SiteContentService } from '../../../core/content/site-content.service';
import { firstError } from '../../../shared/forms/field-errors';

/** Link vazio é permitido (a rede deixa de aparecer); preenchido, precisa ser https://. */
const socialUrl: ValidatorFn = (control) => {
  const value = String(control.value ?? '').trim();
  return !value || isValidSocialUrl(value) ? null : { url: true };
};

const MESSAGES = {
  url: 'Informe um link completo começando com https://, por exemplo https://discord.gg/convite.',
};

/** História "Gerenciar redes sociais". */
@Component({
  selector: 'app-social-admin-page',
  imports: [ReactiveFormsModule],
  templateUrl: './social-admin-page.html',
  styleUrl: '../site-content-admin.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SocialAdminPage {
  private readonly content = inject(SiteContentService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);

  protected readonly networks = SOCIAL_NETWORKS;
  protected readonly maxLength = SOCIAL_URL_MAX;
  protected readonly links = this.content.social();
  protected readonly ready = signal(false);
  protected readonly saving = signal(false);
  protected readonly submitted = signal(false);
  protected readonly status = signal<string | null>(null);
  protected readonly formError = signal<string | null>(null);

  protected readonly form = inject(NonNullableFormBuilder).group(
    Object.fromEntries(SOCIAL_NETWORKS.map((n) => [n.id, ['', [socialUrl]]])) as Record<
      SocialNetworkId,
      [string, ValidatorFn[]]
    >,
  );

  constructor() {
    // Abre com os links atuais (somente na primeira leitura).
    effect(() => {
      const links = this.links();
      if (!links) return;
      untracked(() => {
        if (this.ready()) return;
        this.fill(links);
        this.ready.set(true);
      });
    });
  }

  protected fieldError(id: SocialNetworkId): string | null {
    const control = this.form.controls[id];
    if (!control.touched && !this.submitted()) return null;
    return firstError(control, MESSAGES);
  }

  protected clear(id: SocialNetworkId, name: string): void {
    this.form.controls[id].setValue('');
    this.form.controls[id].markAsDirty();
    this.status.set(`Link do ${name} apagado. Salve para retirá-lo do site.`);
    this.focus(`#rede-${id}`);
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
    const links = Object.fromEntries(
      SOCIAL_NETWORKS.map((n) => [n.id, v[n.id].trim() || null]),
    ) as SocialLinks;
    this.saving.set(true);
    const result = await this.content.saveSocial(links);
    this.saving.set(false);
    if (result.ok) {
      this.fill(links);
      this.status.set('Links salvos. O rodapé e a página inicial já mostram as alterações.');
    } else {
      this.formError.set(SAVE_CONTENT_ERRORS[result.error]);
      this.focus('.content-form .form-alert');
    }
  }

  protected discard(): void {
    const links = this.links();
    if (links) this.fill(links);
    this.submitted.set(false);
    this.status.set(null);
    this.formError.set(null);
  }

  private fill(links: SocialLinks): void {
    this.form.reset(
      Object.fromEntries(SOCIAL_NETWORKS.map((n) => [n.id, links[n.id] ?? ''])) as Record<
        SocialNetworkId,
        string
      >,
    );
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
