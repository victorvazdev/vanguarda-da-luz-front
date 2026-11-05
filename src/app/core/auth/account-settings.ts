// Alteração dos dados da conta (nome de usuário, e-mail e senha), sem dependência do Angular.
// Testado contra os emuladores (tests/integration/profile.spec.ts).
import { FirebaseError } from 'firebase/app';
import {
  EmailAuthProvider,
  applyActionCode,
  checkActionCode,
  reauthenticateWithCredential,
  updatePassword,
  verifyBeforeUpdateEmail,
  type Auth,
  type User,
} from 'firebase/auth';
import { doc, runTransaction, updateDoc, type Firestore } from 'firebase/firestore';
import { usernameKey } from './username';

export type SettingsError =
  | 'username-taken'
  | 'wrong-password'
  | 'email-in-use'
  | 'invalid-email'
  | 'same-email'
  | 'weak-password'
  | 'invalid-link'
  | 'too-many-requests'
  | 'not-allowed'
  | 'network'
  | 'unknown';

export type SettingsResult<T = object> = ({ ok: true } & T) | { ok: false; error: SettingsError };

class Blocked extends Error {
  constructor(readonly reason: SettingsError) {
    super(reason);
  }
}

export function settingsErrorFrom(error: unknown): SettingsError {
  if (error instanceof Blocked) return error.reason;
  const code = error instanceof FirebaseError ? error.code : '';
  switch (code) {
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
    case 'auth/invalid-login-credentials':
      return 'wrong-password';
    case 'auth/email-already-in-use':
      return 'email-in-use';
    case 'auth/invalid-email':
    case 'auth/invalid-new-email':
      return 'invalid-email';
    case 'auth/weak-password':
      return 'weak-password';
    case 'auth/expired-action-code':
    case 'auth/invalid-action-code':
    case 'auth/argument-error':
      return 'invalid-link';
    case 'auth/too-many-requests':
      return 'too-many-requests';
    case 'permission-denied':
      return 'not-allowed';
    case 'auth/network-request-failed':
    case 'unavailable':
      return 'network';
    default:
      return 'unknown';
  }
}

/**
 * Troca o nome de usuário numa transação: reserva o novo nome, libera o antigo,
 * atualiza a conta e, se houver, o membro (as listas da guilda mostram o nome novo).
 */
export async function changeUsername(
  db: Firestore,
  uid: string,
  newUsername: string,
): Promise<SettingsResult> {
  const username = newUsername.trim();
  const newKey = usernameKey(username);
  try {
    await runTransaction(db, async (tx) => {
      const userRef = doc(db, 'users', uid);
      const memberRef = doc(db, 'members', uid);
      const user = await tx.get(userRef);
      const status = user.get('status') as string | undefined;
      if (!user.exists() || status === 'desativado') throw new Blocked('not-allowed');
      if (user.get('username') === username) return;

      const oldKey = user.get('usernameKey') as string;
      const member = status === 'ativo' ? await tx.get(memberRef) : null;
      if (newKey !== oldKey) {
        const newRef = doc(db, 'usernames', newKey);
        const oldRef = doc(db, 'usernames', oldKey);
        const [taken, old] = await Promise.all([tx.get(newRef), tx.get(oldRef)]);
        if (taken.exists()) throw new Blocked('username-taken');
        tx.set(newRef, { uid });
        if (old.get('uid') === uid) tx.delete(oldRef);
      }
      tx.update(userRef, { username, usernameKey: newKey });
      if (member?.exists()) tx.update(memberRef, { username });
    });
    return { ok: true };
  } catch (error) {
    return { ok: false, error: settingsErrorFrom(error) };
  }
}

/** Confirma a senha atual (o Firebase exige login recente para mudar e-mail ou senha). */
async function reauthenticate(user: User, currentPassword: string): Promise<void> {
  await reauthenticateWithCredential(
    user,
    EmailAuthProvider.credential(user.email ?? '', currentPassword),
  );
}

function signedInUser(auth: Auth): User {
  const user = auth.currentUser;
  if (!user) throw new Blocked('not-allowed');
  return user;
}

/** Troca a senha, confirmando a atual. */
export async function changePassword(
  auth: Auth,
  currentPassword: string,
  newPassword: string,
): Promise<SettingsResult> {
  try {
    const user = signedInUser(auth);
    await reauthenticate(user, currentPassword);
    await updatePassword(user, newPassword);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: settingsErrorFrom(error) };
  }
}

/**
 * Pede a troca de e-mail. O Firebase envia um link ao novo endereço e só troca o e-mail
 * quando ele é aberto; o endereço antigo recebe um aviso com a opção de desfazer.
 */
export async function requestEmailChange(
  auth: Auth,
  currentPassword: string,
  newEmail: string,
): Promise<SettingsResult> {
  const email = newEmail.trim();
  try {
    const user = signedInUser(auth);
    if (email.toLowerCase() === (user.email ?? '').toLowerCase()) throw new Blocked('same-email');
    await reauthenticate(user, currentPassword);
    await verifyBeforeUpdateEmail(user, email);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: settingsErrorFrom(error) };
  }
}

export type EmailAction = 'changed' | 'restored';

/**
 * Aplica o link de e-mail: confirmação do novo endereço (`verifyAndChangeEmail`)
 * ou desfazer a troca, pelo endereço antigo (`recoverEmail`).
 */
export async function applyEmailAction(
  auth: Auth,
  code: string | null | undefined,
): Promise<SettingsResult<{ action: EmailAction }>> {
  if (!code) return { ok: false, error: 'invalid-link' };
  try {
    const info = await checkActionCode(auth, code);
    if (info.operation !== 'VERIFY_AND_CHANGE_EMAIL' && info.operation !== 'RECOVER_EMAIL') {
      throw new Blocked('invalid-link');
    }
    await applyActionCode(auth, code);
    return { ok: true, action: info.operation === 'RECOVER_EMAIL' ? 'restored' : 'changed' };
  } catch (error) {
    return { ok: false, error: settingsErrorFrom(error) };
  }
}

/** Copia para a conta o e-mail confirmado no Firebase Auth (o do token de login). */
export async function syncAccountEmail(db: Firestore, uid: string, email: string): Promise<void> {
  await updateDoc(doc(db, 'users', uid), { email });
}
