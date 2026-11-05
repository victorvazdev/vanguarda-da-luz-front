import {
  DestroyRef,
  Injectable,
  Injector,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { onAuthStateChanged, signOut, type User } from 'firebase/auth';
import { filter, firstValueFrom, map } from 'rxjs';
import { FIREBASE_AUTH, FirestoreClient } from '../firebase/firebase.providers';
import { PATHS } from '../routing/paths';
import { resolveAccess, type ResolvedAccess, type UserAccount } from './access';
import { ACCOUNT_MESSAGES } from './messages';

/** Estado da sessão: usuário do Firebase Auth + documento `users/{uid}`, em signals. */
@Injectable({ providedIn: 'root' })
export class SessionService {
  private readonly auth = inject(FIREBASE_AUTH);
  private readonly firestore = inject(FirestoreClient);
  private readonly injector = inject(Injector);
  private readonly router = inject(Router);

  private readonly _user = signal<User | null | undefined>(undefined);
  private readonly _account = signal<UserAccount | null | undefined>(undefined);
  private readonly _notice = signal<string | null>(null);

  readonly user = this._user.asReadonly();
  readonly account = this._account.asReadonly();
  readonly access = computed(() => resolveAccess(this._user(), this._account()));
  readonly isAuthenticated = computed(() => !!this._user());
  /** Aviso a exibir na tela de login (ex.: conta desativada durante o uso). */
  readonly notice = this._notice.asReadonly();

  private readonly access$ = toObservable(this.access, { injector: this.injector });

  constructor() {
    let unsubscribeAccount: (() => void) | null = null;
    let generation = 0;

    const unsubscribeAuth = onAuthStateChanged(this.auth, async (user) => {
      const current = ++generation;
      unsubscribeAccount?.();
      unsubscribeAccount = null;
      this._user.set(user);

      if (!user) {
        this._account.set(null);
        return;
      }

      this._account.set(undefined);
      const [db, { doc, onSnapshot }] = await Promise.all([
        this.firestore.get(),
        import('firebase/firestore'),
      ]);
      if (current !== generation) return; // o usuário mudou enquanto carregava

      unsubscribeAccount = onSnapshot(
        doc(db, 'users', user.uid),
        (snap) => this._account.set(snap.exists() ? (snap.data() as UserAccount) : null),
        () => this._account.set(null),
      );
    });

    // Conta desativada (no login ou durante o uso): encerra a sessão e leva ao login.
    effect(() => {
      if (this.access() !== 'blocked') return;
      untracked(() => void this.endBlockedSession());
    });

    inject(DestroyRef).onDestroy(() => {
      unsubscribeAuth();
      unsubscribeAccount?.();
    });
  }

  /**
   * Resolve com o perfil assim que ele estiver definido e sincronizado com o
   * Firebase Auth (logo após um login, o listener do Auth ainda pode estar atrasado).
   */
  resolvedAccess(): Promise<ResolvedAccess> {
    const ready = (): ResolvedAccess | null => {
      const access = this.access();
      const synced = (this._user()?.uid ?? null) === (this.auth.currentUser?.uid ?? null);
      return access !== 'loading' && synced ? access : null;
    };
    const now = ready();
    if (now) return Promise.resolve(now);
    return firstValueFrom(
      this.access$.pipe(
        map(() => ready()),
        filter((a): a is ResolvedAccess => a !== null),
      ),
    );
  }

  clearNotice(): void {
    this._notice.set(null);
  }

  signOut(): Promise<void> {
    return signOut(this.auth);
  }

  private async endBlockedSession(): Promise<void> {
    this._notice.set(ACCOUNT_MESSAGES.disabled);
    await this.signOut();
    await this.router.navigateByUrl(PATHS.signIn);
  }
}
