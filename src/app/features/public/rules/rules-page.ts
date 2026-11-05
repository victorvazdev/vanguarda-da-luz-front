import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { RULES } from '../../../core/content/guild-content';
import { PATHS } from '../../../core/routing/paths';

/** História "Ler as regras". */
@Component({
  selector: 'app-rules-page',
  imports: [RouterLink],
  templateUrl: './rules-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RulesPage {
  protected readonly rules = RULES;
  protected readonly joinPath = PATHS.join;
}
