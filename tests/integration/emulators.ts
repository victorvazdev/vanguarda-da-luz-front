import { deleteApp, initializeApp, type FirebaseApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, type Auth } from 'firebase/auth';
import { connectFirestoreEmulator, getFirestore, type Firestore } from 'firebase/firestore';
import { afterEach, beforeEach } from 'vitest';

export const PROJECT_ID = 'demo-vanguarda-da-luz';
// `firebase emulators:exec` informa os endereços (ver firebase.test.json).
const AUTH_HOST = process.env['FIREBASE_AUTH_EMULATOR_HOST'] ?? '127.0.0.1:9199';
const FIRESTORE_HOST = process.env['FIRESTORE_EMULATOR_HOST'] ?? '127.0.0.1:8180';
const AUTH = `http://${AUTH_HOST}`;
const FIRESTORE = `http://${FIRESTORE_HOST}`;

export interface Client {
  auth: Auth;
  db: Firestore;
}

/** Zera Auth e Firestore dos emuladores antes de cada teste e fornece clientes isolados. */
export function useEmulators(): () => Client {
  const apps: FirebaseApp[] = [];
  let count = 0;

  beforeEach(async () => {
    await fetch(`${AUTH}/emulator/v1/projects/${PROJECT_ID}/accounts`, { method: 'DELETE' });
    await fetch(`${FIRESTORE}/emulator/v1/projects/${PROJECT_ID}/databases/(default)/documents`, {
      method: 'DELETE',
    });
  });

  afterEach(async () => {
    await Promise.all(apps.splice(0).map((app) => deleteApp(app)));
  });

  // Cada chamada cria um "navegador" separado (sessão própria).
  return () => {
    const app = initializeApp({ projectId: PROJECT_ID, apiKey: 'demo-api-key' }, `t${++count}`);
    apps.push(app);
    const auth = getAuth(app);
    connectAuthEmulator(auth, AUTH, { disableWarnings: true });
    const db = getFirestore(app);
    const [host, port] = FIRESTORE_HOST.split(':');
    connectFirestoreEmulator(db, host, Number(port));
    return { auth, db };
  };
}

/** Lê um documento ignorando as rules (API administrativa do emulador). */
export async function adminGet(path: string): Promise<Record<string, unknown> | null> {
  const res = await fetch(
    `${FIRESTORE}/v1/projects/${PROJECT_ID}/databases/(default)/documents/${path}`,
    { headers: { Authorization: 'Bearer owner' } },
  );
  if (res.status === 404) return null;
  const body = (await res.json()) as { fields: Record<string, Record<string, unknown>> };
  return Object.fromEntries(Object.entries(body.fields).map(([k, v]) => [k, Object.values(v)[0]]));
}

/** Lista contas do emulador do Auth. */
export async function authAccounts(): Promise<{ email: string; passwordHash?: string }[]> {
  const res = await fetch(
    `${AUTH}/identitytoolkit.googleapis.com/v1/projects/${PROJECT_ID}/accounts:query`,
    {
      method: 'POST',
      headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' },
      body: '{}',
    },
  );
  const body = (await res.json()) as { userInfo?: { email: string; passwordHash?: string }[] };
  return body.userInfo ?? [];
}

/** Altera campos de um documento ignorando as rules (simula ação de admin/console). */
export async function adminPatch(
  path: string,
  fields: Record<string, string | Date | string[]>,
): Promise<void> {
  const mask = Object.keys(fields)
    .map((f) => `updateMask.fieldPaths=${encodeURIComponent(f)}`)
    .join('&');
  const res = await fetch(
    `${FIRESTORE}/v1/projects/${PROJECT_ID}/databases/(default)/documents/${path}?${mask}`,
    {
      method: 'PATCH',
      headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fields: Object.fromEntries(
          Object.entries(fields).map(([k, v]) => [
            k,
            v instanceof Date
              ? { timestampValue: v.toISOString() }
              : Array.isArray(v)
                ? { arrayValue: { values: v.map((x) => ({ stringValue: x })) } }
                : { stringValue: v },
          ]),
        ),
      }),
    },
  );
  if (!res.ok) throw new Error(`adminPatch ${path}: ${res.status} ${await res.text()}`);
}

/** Último link de "e-mail" gerado pelo emulador do Auth para o endereço. */
export async function lastResetCode(email: string): Promise<string> {
  const res = await fetch(`${AUTH}/emulator/v1/projects/${PROJECT_ID}/oobCodes`);
  const { oobCodes } = (await res.json()) as {
    oobCodes: { email: string; oobCode: string; requestType: string }[];
  };
  const codes = oobCodes.filter((c) => c.email === email && c.requestType === 'PASSWORD_RESET');
  if (!codes.length) throw new Error(`nenhum código de redefinição para ${email}`);
  return codes[codes.length - 1].oobCode;
}

/** Quantos e-mails de redefinição o emulador "enviou". */
export async function resetEmailCount(): Promise<number> {
  const res = await fetch(`${AUTH}/emulator/v1/projects/${PROJECT_ID}/oobCodes`);
  const { oobCodes } = (await res.json()) as { oobCodes: { requestType: string }[] };
  return oobCodes.filter((c) => c.requestType === 'PASSWORD_RESET').length;
}
