// Lógica do cadastro sem dependência do Angular, testada contra os emuladores
// (tests/integration/sign-up.spec.ts).
import { FirebaseError } from 'firebase/app';
import { createUserWithEmailAndPassword, deleteUser, type Auth } from 'firebase/auth';
import { doc, getDoc, runTransaction, serverTimestamp, type Firestore } from 'firebase/firestore';
import { usernameKey } from './username';

export interface SignUpInput {
  username: string;
  email: string;
  password: string;
}

export type SignUpError =
  | 'username-taken'
  | 'email-in-use'
  | 'invalid-email'
  | 'weak-password'
  | 'too-many-requests'
  | 'network'
  | 'unknown';

export type SignUpResult = { ok: true; uid: string } | { ok: false; error: SignUpError };

class UsernameTakenError extends Error {}

/** Traduz códigos do Firebase Auth para os erros que a tela sabe exibir. */
export function signUpErrorFrom(error: unknown): SignUpError {
  if (error instanceof UsernameTakenError) return 'username-taken';
  const code = error instanceof FirebaseError ? error.code : '';
  switch (code) {
    case 'auth/email-already-in-use':
      return 'email-in-use';
    case 'auth/invalid-email':
      return 'invalid-email';
    case 'auth/weak-password':
      return 'weak-password';
    case 'auth/too-many-requests':
      return 'too-many-requests';
    case 'auth/network-request-failed':
    case 'unavailable':
      return 'network';
    default:
      return 'unknown';
  }
}

export async function isUsernameAvailable(db: Firestore, username: string): Promise<boolean> {
  const snap = await getDoc(doc(db, 'usernames', usernameKey(username)));
  return !snap.exists();
}

/**
 * Cadastro:
 * 1. confere se o nome está livre (evita criar a conta à toa);
 * 2. cria o usuário no Firebase Auth (a senha fica só no Auth, em hash);
 * 3. numa transação, reserva `usernames/{chave}` e cria `users/{uid}` pendente.
 * Se a transação falhar, o usuário recém-criado no Auth é excluído.
 */
export async function signUp(auth: Auth, db: Firestore, input: SignUpInput): Promise<SignUpResult> {
  const username = input.username.trim();
  const key = usernameKey(username);

  try {
    if (!(await isUsernameAvailable(db, username))) return { ok: false, error: 'username-taken' };
  } catch (error) {
    return { ok: false, error: signUpErrorFrom(error) };
  }

  let credential;
  try {
    credential = await createUserWithEmailAndPassword(auth, input.email.trim(), input.password);
  } catch (error) {
    return { ok: false, error: signUpErrorFrom(error) };
  }

  const { user } = credential;
  try {
    await runTransaction(db, async (tx) => {
      const usernameRef = doc(db, 'usernames', key);
      if ((await tx.get(usernameRef)).exists()) throw new UsernameTakenError();
      tx.set(usernameRef, { uid: user.uid });
      tx.set(doc(db, 'users', user.uid), {
        username,
        usernameKey: key,
        email: user.email,
        status: 'pendente',
        role: 'membro',
        createdAt: serverTimestamp(),
      });
    });
    return { ok: true, uid: user.uid };
  } catch (error) {
    // Desfaz o usuário do Auth para não deixar conta sem perfil nem e-mail "preso".
    await deleteUser(user).catch(() => undefined);
    // Uma rule negada aqui significa que o nome foi reservado por outra pessoa entre os passos 1 e 3.
    const isPermission = error instanceof FirebaseError && error.code === 'permission-denied';
    return { ok: false, error: isPermission ? 'username-taken' : signUpErrorFrom(error) };
  }
}
