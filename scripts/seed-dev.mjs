// Desenvolvimento: cria dados de exemplo nos emuladores (nunca na nuvem).
// Uso: npm run dev:seed            → emuladores de desenvolvimento (9099/8080)
//      npm run dev:seed -- --test  → emuladores de teste isolados (9199/8180)
// Todas as contas usam a senha "segredo123". Pode ser executado mais de uma vez.
const test = process.argv.includes('--test');
const AUTH = `http://127.0.0.1:${test ? 9199 : 9099}`;
const FIRESTORE = `http://127.0.0.1:${test ? 8180 : 8080}`;
const PROJECT = 'demo-vanguarda-da-luz';
const PASSWORD = 'segredo123';
const owner = { Authorization: 'Bearer owner', 'Content-Type': 'application/json' };

const now = Date.now();
const daysAgo = (d) => new Date(now - d * 86_400_000);

/** Contas de exemplo (personagens do protótipo). */
const PEOPLE = [
  {
    username: 'Maren',
    role: 'admin',
    status: 'ativo',
    member: {
      game: 'retail',
      characterName: 'Maren',
      server: 'Servidor de teste',
      characterClass: 'guerreiro',
      characterRole: 'tanque',
    },
  },
  {
    username: 'Elaris',
    status: 'pendente',
    application: {
      game: 'retail',
      characterName: 'Elaris',
      server: 'Servidor de teste',
      characterClass: 'paladino',
      characterRole: 'cura',
      motivation: 'Quero participar das raids semanais com um grupo fixo.',
      submittedAt: daysAgo(0),
    },
  },
  {
    username: 'Lioren',
    status: 'pendente',
    application: {
      game: 'forever',
      characterName: 'Lioren',
      characterSurname: 'Vale',
      ruleset: 'normal',
      characterClass: 'mago',
      characterRole: 'dano',
      motivation: 'Voltei ao jogo e procuro uma guilda para as atividades em grupo.',
      submittedAt: daysAgo(1),
    },
  },
  {
    username: 'Brenna',
    status: 'pendente',
    application: {
      game: 'forever',
      characterName: 'Brenna',
      characterSurname: 'Forjaferro',
      ruleset: 'jxj',
      characterClass: 'guerreiro',
      characterRole: 'tanque',
      motivation: 'Fui convidada por um integrante da guilda.',
      submittedAt: daysAgo(2),
    },
  },
  {
    username: 'Dorvan',
    status: 'ativo',
    member: {
      game: 'retail',
      characterName: 'Dorvan',
      server: 'Servidor de teste',
      characterClass: 'sacerdote',
      characterRole: 'cura',
    },
  },
  {
    username: 'Tavia',
    status: 'ativo',
    member: {
      game: 'forever',
      characterName: 'Tavia',
      characterSurname: 'Brasaluz',
      ruleset: 'normal',
      characterClass: 'mago',
      characterRole: 'dano',
    },
  },
  { username: 'Kaelen', status: 'pendente' },
];

function encode(value) {
  if (value instanceof Date) return { timestampValue: value.toISOString() };
  if (Array.isArray(value)) return { arrayValue: { values: value.map(encode) } };
  if (typeof value === 'boolean') return { booleanValue: value };
  if (typeof value === 'object') return { mapValue: { fields: fields(value) } };
  return { stringValue: String(value) };
}
const fields = (obj) => Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, encode(v)]));

async function put(path, data) {
  const res = await fetch(
    `${FIRESTORE}/v1/projects/${PROJECT}/databases/(default)/documents/${path}`,
    {
      method: 'PATCH',
      headers: owner,
      body: JSON.stringify({ fields: fields(data) }),
    },
  );
  if (!res.ok) throw new Error(`${path}: ${res.status} ${await res.text()}`);
}

async function account(email) {
  const url = (action) => `${AUTH}/identitytoolkit.googleapis.com/v1/accounts:${action}?key=demo`;
  const body = JSON.stringify({ email, password: PASSWORD, returnSecureToken: true });
  let res = await fetch(url('signUp'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  });
  if (!res.ok)
    res = await fetch(url('signInWithPassword'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    });
  if (!res.ok) throw new Error(`${email}: ${await res.text()}`);
  return (await res.json()).localId;
}

try {
  await fetch(`${AUTH}/`);
} catch {
  console.error(`Emuladores ${test ? 'de teste' : 'de desenvolvimento'} não estão rodando.`);
  process.exit(1);
}

const adminUids = [];
const uids = {};
for (const p of PEOPLE) {
  const key = p.username.toLowerCase();
  const email = `${key}@vanguarda.test`;
  const uid = await account(email);
  uids[p.username] = uid;
  await put(`usernames/${key}`, { uid });
  await put(`users/${uid}`, {
    username: p.username,
    usernameKey: key,
    email,
    status: p.status,
    role: p.role ?? 'membro',
    createdAt: daysAgo(3),
  });
  if (p.application)
    await put(`applications/${uid}`, { ...p.application, rulesAccepted: true, status: 'pendente' });
  if (p.role === 'admin') adminUids.push(uid);
  if (p.member)
    await put(`members/${uid}`, {
      username: p.username,
      mainCharacter: p.member,
      active: true,
      joinedAt: daysAgo(30),
      approvedBy: adminUids[0] ?? uid,
    });
  console.log(`${p.role === 'admin' ? 'admin   ' : p.status.padEnd(8)} ${email}`);
}
// Lista de administradores ativos (usada para impedir remover o último admin).
await put('config/admins', { activeAdminUids: adminUids });

// Eventos do protótipo, a partir de hoje (horários de Brasília, UTC−3).
const atBrasilia = (days, hour, minute = 0) => {
  const d = new Date(now + days * 86_400_000 - 3 * 3_600_000);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), hour + 3, minute));
};
const EVENTS = [
  ['raid-1', 'Raid semanal', atBrasilia(3, 21)],
  ['masmorras', 'Masmorras em grupo', atBrasilia(7, 20)],
  ['raid-2', 'Raid semanal', atBrasilia(10, 21)],
  ['encontro', 'Encontro da guilda', atBrasilia(18, 20), true],
  ['raid-3', 'Raid semanal', atBrasilia(24, 21)],
  ['raid-anterior', 'Raid semanal', atBrasilia(-4, 21)],
];
for (const [id, title, startsAt, cancelled] of EVENTS) {
  await put(`events/seed-${id}`, {
    title,
    startsAt,
    description: '[DESCRIÇÃO DO EVENTO]',
    organizer: 'Maren',
    status: cancelled ? 'cancelado' : 'ativo',
    createdBy: adminUids[0],
    createdAt: daysAgo(5),
    updatedAt: daysAgo(5),
    ...(cancelled ? { cancelledAt: daysAgo(1), cancelledBy: adminUids[0] } : {}),
  });
}
// Presenças confirmadas na primeira raid (protótipo: Maren, Dorvan e Tavia).
for (const [i, name] of ['Maren', 'Dorvan', 'Tavia'].entries()) {
  await put(`events/seed-raid-1/attendees/${uids[name]}`, { confirmedAt: daysAgo(3 - i) });
}
console.log(`${EVENTS.length} eventos (1 cancelado, 1 passado) e 3 presenças na próxima raid`);
console.log(`\nSenha de todas as contas: ${PASSWORD}`);
