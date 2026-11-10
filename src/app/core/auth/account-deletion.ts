// Exclusão da conta pela própria pessoa, sem dependência do Angular e sem Cloud Functions.
// Testado contra os emuladores (tests/integration/account-deletion.spec.ts).
//
// Não há como apagar tudo numa única operação pelo cliente: o login no Firebase
// Authentication só pode ser excluído por último (depois dele não há mais permissão no
// Firestore) e as Security Rules limitam quantos documentos um lote pode consultar. Por isso
// a exclusão é feita em etapas, cada uma idempotente e retomável pela situação da conta:
//
// 1. `startDeletion`: a conta passa a `excluindo` (sai da lista de admins; o membro sai das
//    listas). A partir daqui o app só oferece concluir a exclusão.
// 2. `cancelFutureAttendances`: apaga as presenças em eventos futuros e ativos (e as tira
//    do contador de confirmados de cada evento).
// 3. `finishDeletion`: num único lote, apaga a candidatura (BattleTag, motivo) e o nome de
//    usuário (que fica livre), tira o nome de usuário do membro e troca a conta por um
//    registro mínimo `excluido`, sem dados pessoais.
// 4. `deleteUser`: exclui o login e o e-mail do Firebase Authentication.
//
// Se algo falhar no meio, a conta fica em `excluindo` ou `excluido` e, no próximo login, a
// pessoa conclui a exclusão (as etapas já feitas são puladas). Personagens e presenças em
// eventos passados ficam, sem nome de usuário, e-mail ou outro dado pessoal.
import { FirebaseError } from 'firebase/app';
import {
  EmailAuthProvider,
  deleteUser,
  reauthenticateWithCredential,
  type Auth,
  type User,
} from 'firebase/auth';
import {
  Timestamp,
  collection,
  deleteField,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  where,
  type Firestore,
} from 'firebase/firestore';
import { cancelAttendance, type AttendanceError } from '../data/attendance';
import { eventFromData, isChangeable } from '../data/events';

export type DeletionError =
  | 'wrong-password'
  | 'last-admin'
  | 'too-many-requests'
  | 'not-allowed'
  | 'network'
  | 'unknown';

export type DeletionResult = { ok: true } | { ok: false; error: DeletionError };

class Blocked extends Error {
  constructor(readonly reason: DeletionError) {
    super(reason);
  }
}

export function deletionErrorFrom(error: unknown): DeletionError {
  if (error instanceof Blocked) return error.reason;
  const code = error instanceof FirebaseError ? error.code : '';
  switch (code) {
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
    case 'auth/invalid-login-credentials':
    case 'auth/missing-password':
      return 'wrong-password';
    case 'auth/too-many-requests':
      return 'too-many-requests';
    case 'auth/requires-recent-login':
    case 'auth/user-mismatch':
    case 'permission-denied':
      return 'not-allowed';
    case 'auth/network-request-failed':
    case 'unavailable':
      return 'network';
    default:
      return 'unknown';
  }
}

const userRef = (db: Firestore, uid: string) => doc(db, 'users', uid);
const memberRef = (db: Firestore, uid: string) => doc(db, 'members', uid);
const adminsRef = (db: Firestore) => doc(db, 'config', 'admins');

/**
 * Etapa 1: marca a conta como `excluindo`. O administrador sai da lista de admins ativos
 * (o último não pode sair) e o membro sai das listas da guilda, no mesmo lote.
 */
export async function startDeletion(
  db: Firestore,
  uid: string,
): Promise<'excluindo' | 'excluido'> {
  return runTransaction(db, async (tx) => {
    const user = await tx.get(userRef(db, uid));
    const status = user.get('status') as string | undefined;
    if (status === 'excluindo' || status === 'excluido') return status; // retomada
    if (status !== 'pendente' && status !== 'ativo') throw new Blocked('not-allowed');

    const isAdmin = status === 'ativo' && user.get('role') === 'admin';
    const [admins, member] = await Promise.all([
      isAdmin ? tx.get(adminsRef(db)) : null,
      status === 'ativo' ? tx.get(memberRef(db, uid)) : null,
    ]);
    const current = (admins?.get('activeAdminUids') as string[] | undefined) ?? [];
    if (current.includes(uid)) {
      const next = current.filter((u) => u !== uid);
      if (next.length === 0) throw new Blocked('last-admin');
      tx.update(adminsRef(db), { activeAdminUids: next });
    }
    tx.update(userRef(db, uid), { status: 'excluindo', deletionStartedAt: serverTimestamp() });
    if (member?.exists() && member.get('active') === true) {
      tx.update(memberRef(db, uid), { active: false });
    }
    return 'excluindo';
  });
}

const SKIPPED: readonly AttendanceError[] = ['not-confirmed', 'past', 'cancelled', 'not-found'];

/**
 * Etapa 2: cancela as presenças em eventos futuros e ativos (as de eventos passados ou
 * cancelados ficam no histórico). Um evento que começa durante a exclusão é pulado.
 */
export async function cancelFutureAttendances(
  db: Firestore,
  uid: string,
  now: () => Date = () => new Date(),
): Promise<void> {
  // Somente membros confirmam presença; conta pendente não tem membro.
  const member = await getDoc(memberRef(db, uid));
  if (!member.exists()) return;

  const snap = await getDocs(
    query(
      collection(db, 'events'),
      where('startsAt', '>', Timestamp.fromDate(now())),
      orderBy('startsAt'),
    ),
  );
  for (const event of snap.docs) {
    if (!isChangeable(eventFromData(event.id, event.data()), now())) continue;
    // Cancela junto com o contador de confirmados do evento. Não ter presença, ou o evento
    // ter começado ou sido cancelado nesse meio-tempo, não é erro.
    const result = await cancelAttendance(db, event.id, uid);
    if (!result.ok && !SKIPPED.includes(result.error)) {
      throw new Blocked(
        result.error === 'not-allowed' || result.error === 'network' ? result.error : 'unknown',
      );
    }
  }
}

/**
 * Etapa 3: num único lote, apaga a candidatura e o nome de usuário, tira o nome de usuário
 * do membro e deixa somente o registro mínimo `excluido` na conta.
 */
export async function finishDeletion(db: Firestore, uid: string): Promise<void> {
  await runTransaction(db, async (tx) => {
    const user = await tx.get(userRef(db, uid));
    const status = user.get('status') as string | undefined;
    if (status === 'excluido') return; // retomada
    if (status !== 'excluindo') throw new Blocked('not-allowed');

    const key = user.get('usernameKey') as string | undefined;
    const usernameRef = key ? doc(db, 'usernames', key) : null;
    const applicationRef = doc(db, 'applications', uid);
    const [member, username, application] = await Promise.all([
      tx.get(memberRef(db, uid)),
      usernameRef ? tx.get(usernameRef) : null,
      tx.get(applicationRef),
    ]);

    if (application.exists()) tx.delete(applicationRef);
    if (usernameRef && username?.get('uid') === uid) tx.delete(usernameRef);
    if (member.exists()) {
      tx.update(memberRef(db, uid), { username: deleteField(), deletedAt: serverTimestamp() });
    }
    tx.set(userRef(db, uid), { status: 'excluido', deletedAt: serverTimestamp() });
  });
}

async function reauthenticate(user: User, password: string): Promise<void> {
  await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email ?? '', password));
  // O token novo (com `auth_time` atual) é o que as rules conferem nas etapas 1 e 3.
  await user.getIdToken(true);
}

/**
 * Exclui a conta de quem está logado, confirmando a senha. Também conclui uma exclusão
 * interrompida (as etapas já feitas são puladas).
 */
export async function deleteAccount(
  auth: Auth,
  db: Firestore,
  password: string,
  now?: () => Date,
): Promise<DeletionResult> {
  const user = auth.currentUser;
  if (!user) return { ok: false, error: 'not-allowed' };
  try {
    await reauthenticate(user, password);
    // Com o registro mínimo já gravado, falta somente o login.
    if ((await startDeletion(db, user.uid)) === 'excluindo') {
      await cancelFutureAttendances(db, user.uid, now);
      await finishDeletion(db, user.uid);
    }
    await deleteUser(user);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: deletionErrorFrom(error) };
  }
}
