import { Injectable, inject } from '@angular/core';
import type { Permission } from '../auth/access';
import { FirestoreClient } from '../firebase/firebase.providers';
import {
  changeRole,
  deactivateMember,
  reactivateMember,
  watchMembers,
  type MemberActionResult,
  type MemberRow,
} from './members-admin';

/** Membros e permissões para a área administrativa. */
@Injectable({ providedIn: 'root' })
export class MembersAdminService {
  private readonly firestore = inject(FirestoreClient);

  watch(next: (rows: MemberRow[]) => void, error: (e: unknown) => void): () => void {
    let stop: (() => void) | null = null;
    let stopped = false;
    void this.firestore.get().then((db) => {
      if (!stopped) stop = watchMembers(db, next, error);
    }, error);
    return () => {
      stopped = true;
      stop?.();
    };
  }

  async changeRole(uid: string, role: Permission): Promise<MemberActionResult> {
    return changeRole(await this.firestore.get(), uid, role);
  }

  async deactivate(uid: string): Promise<MemberActionResult> {
    return deactivateMember(await this.firestore.get(), uid);
  }

  async reactivate(uid: string): Promise<MemberActionResult> {
    return reactivateMember(await this.firestore.get(), uid);
  }
}
