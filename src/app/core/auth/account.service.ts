import { Injectable, inject } from '@angular/core';
import { FIREBASE_AUTH, FirestoreClient } from '../firebase/firebase.providers';
import { LoginThrottle } from './login-throttle';
import { checkResetCode, requestPasswordReset, resetPassword, type Result } from './password-reset';
import { signIn, type SignInResult } from './sign-in';
import { signUp, type SignUpInput, type SignUpResult } from './sign-up';

/** Operações de conta usadas pelas telas. */
@Injectable({ providedIn: 'root' })
export class AccountService {
  private readonly auth = inject(FIREBASE_AUTH);
  private readonly firestore = inject(FirestoreClient);

  /** Compartilhado entre visitas à tela de login durante a sessão do navegador. */
  readonly loginThrottle = new LoginThrottle();

  async signUp(input: SignUpInput): Promise<SignUpResult> {
    return signUp(this.auth, await this.firestore.get(), input);
  }

  async signIn(email: string, password: string): Promise<SignInResult> {
    const result = await signIn(this.auth, await this.firestore.get(), email, password);
    if (result.ok) this.loginThrottle.registerSuccess();
    else if (result.error === 'invalid-credentials') this.loginThrottle.registerFailure(Date.now());
    return result;
  }

  requestPasswordReset(email: string): Promise<Result> {
    return requestPasswordReset(this.auth, email);
  }

  checkResetCode(code: string | null | undefined): Promise<Result<{ email: string }>> {
    return checkResetCode(this.auth, code);
  }

  resetPassword(code: string, newPassword: string): Promise<Result> {
    return resetPassword(this.auth, code, newPassword);
  }
}
