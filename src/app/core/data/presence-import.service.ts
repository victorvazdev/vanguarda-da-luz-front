import { Injectable, inject } from '@angular/core';
import { SessionService } from '../auth/session.service';
import { FirestoreClient } from '../firebase/firebase.providers';
import {
  applyPresenceImport,
  previewPresenceImport,
  type ApplyResult,
  type PreviewResult,
} from './presence-import';
import type { ImportPlan } from './presence-import-plan';

/** Importação de presenças do addon (string VDLP1), somente administradores. */
@Injectable({ providedIn: 'root' })
export class PresenceImportService {
  private readonly firestore = inject(FirestoreClient);
  private readonly session = inject(SessionService);

  /** Valida a string e monta a prévia, sem alterar nada. */
  async preview(text: string): Promise<PreviewResult> {
    return previewPresenceImport(await this.firestore.get(), text);
  }

  /** Aplica a prévia confirmada e registra a string como a última importada. */
  async apply(plan: ImportPlan): Promise<ApplyResult> {
    return applyPresenceImport(await this.firestore.get(), plan, this.session.user()?.uid ?? '');
  }
}
