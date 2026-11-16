import { Injectable, inject } from '@angular/core';
import { SessionService } from '../auth/session.service';
import { FirestoreClient } from '../firebase/firebase.providers';
import {
  applyAddonBackup,
  generateRestoreString,
  listBackups,
  previewAddonBackup,
  readCharacterState,
  type ApplyResult,
  type PreviewResult,
  type RestoreResult,
  type StoredBackup,
} from './addon-backup';
import type { BackupPlan } from './addon-backup-plan';
import type { CharacterState } from './addon-backup-state';

/** Backup do addon (string VDLB1), somente administradores. */
@Injectable({ providedIn: 'root' })
export class AddonBackupService {
  private readonly firestore = inject(FirestoreClient);
  private readonly session = inject(SessionService);

  /** Valida a string e monta a prévia, sem alterar nada. */
  async preview(text: string): Promise<PreviewResult> {
    return previewAddonBackup(await this.firestore.get(), text);
  }

  /** Aplica a prévia confirmada, junta os dados ao estado combinado e guarda o backup. */
  async apply(plan: BackupPlan, text: string): Promise<ApplyResult> {
    return applyAddonBackup(
      await this.firestore.get(),
      plan,
      text,
      this.session.user()?.uid ?? '',
      this.session.account()?.username ?? '',
    );
  }

  /** Backups aplicados, do mais novo para o mais antigo. */
  async history(): Promise<StoredBackup[]> {
    return listBackups(await this.firestore.get());
  }

  /** Estado combinado dos personagens. */
  async characters(): Promise<CharacterState> {
    return readCharacterState(await this.firestore.get());
  }

  /** String de restauração (VDLB1, sem eventos) a partir do estado combinado. */
  async restoreString(includeOld: boolean): Promise<RestoreResult> {
    return generateRestoreString(await this.firestore.get(), includeOld);
  }
}
