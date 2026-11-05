import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PATHS } from '../../../core/routing/paths';
import { RulesList } from '../../../shared/ui/rules-list/rules-list';

/** História "Ler as regras". */
@Component({
  selector: 'app-rules-page',
  imports: [RouterLink, RulesList],
  templateUrl: './rules-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RulesPage {
  protected readonly joinPath = PATHS.join;
}
