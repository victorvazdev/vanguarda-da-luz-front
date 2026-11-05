import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RULES } from '../../../core/content/guild-content';

/**
 * Regras da guilda, numeradas. Usada na página de regras e no modal do cadastro e da
 * candidatura, para que o texto exista em um único lugar.
 */
@Component({
  selector: 'app-rules-list',
  template: `
    <ol class="numbered numbered--ruled" aria-label="Regras">
      @for (rule of rules.items; track $index) {
        <li class="numbered__item" [id]="idPrefix() + ($index + 1)">{{ rule }}</li>
      }
    </ol>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RulesList {
  /** Prefixo dos IDs de cada regra (a página usa âncoras `#regra-N`). */
  readonly idPrefix = input('regra-');
  protected readonly rules = RULES;
}
