// Lógica do login sem dependência do Angular, testada contra os emuladores
// (tests/integration/sign-in.spec.ts).
import { FirebaseError } from 'firebase/app';
import { signInWithEmailAndPassword, signOut, type Auth } from 'firebase/auth';
import { doc, getDoc, type Firestore } from 'firebase/firestore';
import { resolveAccess, type ResolvedAccess, type UserAccount } from './access';

export type SignInError =
  'invalid-credentials' | 'disabled' | 'too-many-requests' | 'network' | 'unknown';

export type SignInResult =
  | { ok: true; access: Exclude<ResolvedAccess, 'visitor' | 'blocked'> }
  | { ok: false; error: SignInError };

/**
 * Traduz erros do Firebase Auth. Todos os casos de credencial viram o mesmo erro,
 * para não revelar se o e-mail existe ou se foi a senha que errou.
 */
export function signInErrorFrom(error: unknown): SignInError {
  const code = error instanceof FirebaseError ? error.code : '';
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/invalid-login-credentials':
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-email':
      return 'invalid-credentials';
    case 'auth/user-disabled':
      return 'disabled';
    case 'auth/too-many-requests':
      return 'too-many-requests';
    case 'auth/network-request-failed':
    case 'unavailable':
      return 'network';
    default:
      return 'unknown';
  }
}

/**
 * Autentica e lê a conta. Conta desativada tem a sessão encerrada na hora
 * (as Security Rules também bloqueiam seus dados).
 */
export async function signIn(
  auth: Auth,
  db: Firestore,
  email: string,
  password: string,
): Promise<SignInResult> {
  let uid: string;
  try {
    ({
      user: { uid },
    } = await signInWithEmailAndPassword(auth, email.trim(), password));
  } catch (error) {
    return { ok: false, error: signInErrorFrom(error) };
  }

  try {
    const snap = await getDoc(doc(db, 'users', uid));
    const access = resolveAccess({ uid }, snap.exists() ? (snap.data() as UserAccount) : null);
    if (access === 'blocked' || access === 'loading' || access === 'visitor') {
      await signOut(auth);
      return { ok: false, error: 'disabled' };
    }
    return { ok: true, access };
  } catch (error) {
    // A própria conta sempre pode ser lida por quem está logado. Se a leitura foi negada,
    // a sessão já foi encerrada no meio do caminho porque a conta está desativada
    // (o SessionService faz isso ao detectar o bloqueio).
    const endedByBlock =
      !auth.currentUser || (error instanceof FirebaseError && error.code === 'permission-denied');
    await signOut(auth).catch(() => undefined);
    return { ok: false, error: endedByBlock ? 'disabled' : signInErrorFrom(error) };
  }
}
