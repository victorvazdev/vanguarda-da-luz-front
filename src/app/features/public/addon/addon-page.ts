import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ADDON } from '../../../core/content/guild-content';

/** História "Baixar o addon da guilda". */
@Component({
  selector: 'app-addon-page',
  templateUrl: './addon-page.html',
  styleUrl: './addon-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AddonPage {
  protected readonly addon = ADDON;
}
