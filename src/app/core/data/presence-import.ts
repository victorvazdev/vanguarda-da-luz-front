// Importação de presenças do addon (string VDLP1), sem dependência do Angular.
// Testado contra os emuladores (tests/integration/presence-import.spec.ts).
//
// Fluxo: `previewPresenceImport` decodifica a string, lê o estado do site e monta a prévia
// (presence-import-plan.ts); `applyPresenceImport` aplica cada item numa transação própria, que
// relê e revalida tudo (o site pode ter mudado desde a prévia), e registra a string importada em
// `config/presenceImport`. O contador de confirmados do evento aceita uma presença por escrita,
// então os itens são aplicados em sequência, com as mesmas regras de vaga das confirmações
// normais (inclusive a repetição em caso de concorrência).
import { FirebaseError } from 'firebase/app';
import {
  Timestamp,
  collection,
  doc,
  getDoc,
  getDocs,
  runTransaction,
  serverTimestamp,
  setDoc,
  type DocumentData,
  type Firestore,
  type Transaction,
} from 'firebase/firestore';
import { AddonDecodeFailure, type AddonDecodeError } from './addon-format';
import { decodePresenceExport } from './addon-presence-format';
import { toDate } from './applications';
import {
  attendanceCountUpdate,
  cancellationRef,
  eventFromData,
  isFull,
  retryCountRace,
  type GuildEvent,
  type PresenceKind,
} from './events';
import {
  characterKey,
  foreverGuestId,
  ignoredReason,
  normalizeCharacter,
  planPresenceImport,
  type EventIgnoredReason,
  type ForeverName,
  type ImportPlan,
  type MemberCharacter,
  type PlanItem,
  type RefusalReason,
  type SiteEventState,
  type SiteState,
} from './presence-import-plan';

export const PRESENCE_IMPORT_PATH = 'config/presenceImport';

export type PreviewError = AddonDecodeError | 'not-allowed' | 'network' | 'unknown';
export type PreviewResult = { ok: true; plan: ImportPlan } | { ok: false; error: PreviewError };

/** Resultado de um item na aplicação. */
export type ItemOutcome =
  | { result: 'applied' }
  | { result: 'unchanged' }
  | { result: 'refused'; reason: RefusalReason | EventIgnoredReason | 'not-allowed' | 'error' };

export type AppliedItem = PlanItem & { outcome: ItemOutcome };

export interface ImportReport {
  generatedAt: number;
  events: {
    eventId: string;
    title: string | null;
    ignored: EventIgnoredReason | null;
    items: AppliedItem[];
  }[];
  /** A string ficou registrada como a última importada. */
  recorded: boolean;
}

export type ApplyResult =
  | { ok: true; report: ImportReport }
  | { ok: false; error: 'outdated' | 'not-allowed' | 'network' | 'unknown' };

// ---------- Leitura do estado do site ----------

function foreverName(value: unknown): ForeverName | null {
  if (!value || typeof value !== 'object') return null;
  const c = value as Record<string, unknown>;
  return c['game'] === 'forever' &&
    typeof c['characterName'] === 'string' &&
    typeof c['characterSurname'] === 'string'
    ? { characterName: c['characterName'], characterSurname: c['characterSurname'] }
    : null;
}

/** Última alteração de uma presença: o horário do jogo (origem addon) ou o do site. */
const changedAt = (data: DocumentData, siteField: string) =>
  toDate(data['addonUpdatedAt']) ?? toDate(data[siteField]);

/** Personagens do WoW Forever de todos os membros (inclusive desativados, para o relatório). */
async function loadMemberCharacters(db: Firestore): Promise<MemberCharacter[]> {
  const members = await getDocs(collection(db, 'members'));
  const lists = await Promise.all(
    members.docs.map(async (m) => {
      const data = m.data();
      const base = {
        uid: m.id,
        username: typeof data['username'] === 'string' ? data['username'] : '',
        active: data['active'] === true && data['deletedAt'] === undefined,
      };
      const mainId = typeof data['mainCharacterId'] === 'string' ? data['mainCharacterId'] : null;
      const list: MemberCharacter[] = [];
      const main = foreverName(data['mainCharacter']);
      // Principal vindo da candidatura, ainda sem documento próprio.
      if (main && !mainId) list.push({ ...base, ...main, characterId: null, isMain: true });
      const characters = await getDocs(collection(db, 'members', m.id, 'characters'));
      for (const c of characters.docs) {
        const name = foreverName(c.data());
        if (name) list.push({ ...base, ...name, characterId: c.id, isMain: c.id === mainId });
      }
      return list;
    }),
  );
  return lists.flat();
}

async function loadEvent(db: Firestore, id: string): Promise<SiteEventState | null> {
  const snap = await getDoc(doc(db, 'events', id));
  if (!snap.exists()) return null;
  const event = eventFromData(id, snap.data());
  const siteEvent = { ...event };
  // Ignorado: não precisa das listas.
  if (ignoredReason(siteEvent, new Date())) {
    return { event: siteEvent, attendees: [], guests: [], cancellations: new Map() };
  }
  const [attendees, guests, cancellations] = await Promise.all([
    getDocs(collection(db, 'events', id, 'attendees')),
    getDocs(collection(db, 'events', id, 'guests')),
    getDocs(collection(db, 'events', id, 'cancellations')),
  ]);
  return {
    event: siteEvent,
    attendees: attendees.docs.map((d) => ({
      uid: d.id,
      character: foreverName(d.get('character')),
      changedAt: changedAt(d.data(), 'confirmedAt'),
    })),
    guests: guests.docs
      .filter((d) => d.get('game') === 'forever')
      .map((d) => ({
        id: d.id,
        characterName: String(d.get('characterName')),
        characterSurname: String(d.get('characterSurname')),
        changedAt: changedAt(d.data(), 'confirmedAt'),
      })),
    cancellations: new Map(
      cancellations.docs.flatMap((d) => {
        const at = changedAt(d.data(), 'cancelledAt');
        return at ? [[d.id, at] as const] : [];
      }),
    ),
  };
}

async function lastGeneratedAt(db: Firestore): Promise<number | null> {
  const snap = await getDoc(doc(db, PRESENCE_IMPORT_PATH));
  const value = snap.exists() ? snap.get('generatedAt') : null;
  return typeof value === 'number' ? value : null;
}

/** Decodifica a string e monta a prévia do que vai mudar (somente administradores). */
export async function previewPresenceImport(
  db: Firestore,
  text: string,
  now = new Date(),
): Promise<PreviewResult> {
  let data;
  try {
    data = await decodePresenceExport(text);
  } catch (error) {
    if (error instanceof AddonDecodeFailure) return { ok: false, error: error.reason };
    return { ok: false, error: 'unknown' };
  }
  try {
    const [last, characters, events] = await Promise.all([
      lastGeneratedAt(db),
      loadMemberCharacters(db),
      Promise.all(data.events.map(async (e) => [e.id, await loadEvent(db, e.id)] as const)),
    ]);
    const site: SiteState = {
      lastGeneratedAt: last,
      characters,
      events: new Map(events.flatMap(([id, s]) => (s ? [[id, s] as const] : []))),
    };
    return { ok: true, plan: planPresenceImport(data, site, now) };
  } catch (error) {
    return { ok: false, error: errorCode(error) };
  }
}

// ---------- Aplicação ----------

class Refused extends Error {
  constructor(readonly outcome: ItemOutcome) {
    super(outcome.result);
  }
}
const refused = (reason: Extract<ItemOutcome, { result: 'refused' }>['reason']) =>
  new Refused({ result: 'refused', reason });
const unchanged = () => new Refused({ result: 'unchanged' });

/** Lê o evento na transação e garante que ainda aceita mudanças de presença. */
async function openEvent(tx: Transaction, db: Firestore, eventId: string): Promise<GuildEvent> {
  const snap = await tx.get(doc(db, 'events', eventId));
  if (!snap.exists()) throw refused('unknown');
  const event = eventFromData(eventId, snap.data());
  const ignored = ignoredReason(event, new Date());
  if (ignored) throw refused(ignored);
  return event;
}

/** Mais recente que a última alteração no site (presença ou cancelamento)? */
function checkNewer(updatedAt: number, data: DocumentData | undefined, siteField: string) {
  const at = data ? changedAt(data, siteField) : null;
  if (at && updatedAt * 1000 <= at.getTime()) throw refused('stale');
}

const addonFields = (item: PlanItem, adminUid: string) => ({
  source: 'addon',
  addonUpdatedAt: Timestamp.fromMillis(item.updatedAt * 1000),
  importedBy: adminUid,
});

const presenceRef = (db: Firestore, eventId: string, kind: PresenceKind, id: string) =>
  doc(db, 'events', eventId, kind, id);

/** Saída da presença com o registro do cancelamento e o contador, no mesmo lote. */
function removePresence(
  tx: Transaction,
  db: Firestore,
  event: GuildEvent,
  kind: PresenceKind,
  id: string,
  item: PlanItem,
  adminUid: string,
) {
  tx.delete(presenceRef(db, event.id, kind, id));
  tx.set(cancellationRef(db, event.id, kind, id), {
    kind,
    id,
    cancelledAt: serverTimestamp(),
    ...addonFields(item, adminUid),
  });
  tx.update(doc(db, 'events', event.id), attendanceCountUpdate(event, kind, id, -1));
}

async function applyItem(
  tx: Transaction,
  db: Firestore,
  eventId: string,
  item: PlanItem,
  adminUid: string,
): Promise<void> {
  const key = normalizeCharacter(item.character);
  switch (item.action) {
    case 'confirm-member': {
      const event = await openEvent(tx, db, eventId);
      const ref = presenceRef(db, eventId, 'attendees', item.uid);
      const current = await tx.get(ref);
      if (current.exists()) {
        const c = foreverName(current.get('character'));
        throw c && characterKey(c) === key ? unchanged() : refused('member-other-character');
      }
      const cancellation = await tx.get(cancellationRef(db, eventId, 'attendees', item.uid));
      checkNewer(item.updatedAt, cancellation.data(), 'cancelledAt');
      const characterSnap = item.characterId
        ? await tx.get(doc(db, 'members', item.uid, 'characters', item.characterId))
        : null;
      const member = await tx.get(doc(db, 'members', item.uid));
      if (member.get('active') !== true) throw refused('member-inactive');
      const character = (characterSnap ? characterSnap.data() : member.get('mainCharacter')) as
        DocumentData | undefined;
      const name = foreverName(character);
      // O personagem foi removido ou renomeado depois da prévia.
      if (!character || !name || characterKey(name) !== key) throw refused('character-not-found');
      const guest = await tx.get(presenceRef(db, eventId, 'guests', foreverGuestId(name)));
      if (guest.exists()) throw refused('duplicate-guest');
      if (isFull(event)) throw refused('full');
      tx.set(ref, {
        confirmedAt: serverTimestamp(),
        character,
        ...(item.characterId ? { characterId: item.characterId } : {}),
        ...addonFields(item, adminUid),
      });
      tx.update(doc(db, 'events', eventId), attendanceCountUpdate(event, 'attendees', item.uid, 1));
      return;
    }
    case 'cancel-member': {
      const event = await openEvent(tx, db, eventId);
      const current = await tx.get(presenceRef(db, eventId, 'attendees', item.uid));
      const c = current.exists() ? foreverName(current.get('character')) : null;
      if (!c || characterKey(c) !== key) throw unchanged();
      checkNewer(item.updatedAt, current.data(), 'confirmedAt');
      removePresence(tx, db, event, 'attendees', item.uid, item, adminUid);
      return;
    }
    case 'confirm-guest': {
      const event = await openEvent(tx, db, eventId);
      if (!event.guestsAllowed) throw refused('guests-closed');
      const ref = presenceRef(db, eventId, 'guests', item.guestId);
      if ((await tx.get(ref)).exists()) throw unchanged();
      const cancellation = await tx.get(cancellationRef(db, eventId, 'guests', item.guestId));
      checkNewer(item.updatedAt, cancellation.data(), 'cancelledAt');
      if (isFull(event)) throw refused('full');
      tx.set(ref, {
        game: 'forever',
        ...item.guest,
        confirmedAt: serverTimestamp(),
        ...addonFields(item, adminUid),
      });
      tx.update(
        doc(db, 'events', eventId),
        attendanceCountUpdate(event, 'guests', item.guestId, 1),
      );
      return;
    }
    case 'cancel-guest': {
      const event = await openEvent(tx, db, eventId);
      const current = await tx.get(presenceRef(db, eventId, 'guests', item.guestId));
      if (!current.exists()) throw unchanged();
      checkNewer(item.updatedAt, current.data(), 'confirmedAt');
      removePresence(tx, db, event, 'guests', item.guestId, item, adminUid);
      return;
    }
    default:
      throw unchanged();
  }
}

async function runItem(
  db: Firestore,
  eventId: string,
  item: PlanItem,
  adminUid: string,
): Promise<ItemOutcome> {
  if (item.action === 'refused') return { result: 'refused', reason: item.reason };
  if (item.action === 'unchanged') return { result: 'unchanged' };
  try {
    await retryCountRace(() =>
      runTransaction(db, (tx) => applyItem(tx, db, eventId, item, adminUid)),
    );
    return { result: 'applied' };
  } catch (error) {
    if (error instanceof Refused) return error.outcome;
    const code = errorCode(error);
    if (code === 'network') throw error;
    return { result: 'refused', reason: code === 'not-allowed' ? 'not-allowed' : 'error' };
  }
}

/**
 * Aplica a prévia (administrador `adminUid`) e registra a string como a última importada.
 * Cada item é revalidado na sua transação; o que não puder ser aplicado aparece no relatório.
 */
export async function applyPresenceImport(
  db: Firestore,
  plan: ImportPlan,
  adminUid: string,
): Promise<ApplyResult> {
  try {
    const last = await lastGeneratedAt(db);
    if (plan.outdated || (last !== null && plan.generatedAt <= last)) {
      return { ok: false, error: 'outdated' };
    }
    const events: ImportReport['events'] = [];
    for (const e of plan.events) {
      const items: AppliedItem[] = [];
      for (const item of e.items) {
        items.push({ ...item, outcome: await runItem(db, e.eventId, item, adminUid) });
      }
      events.push({ eventId: e.eventId, title: e.event?.title ?? null, ignored: e.ignored, items });
    }
    let recorded = true;
    try {
      await setDoc(doc(db, PRESENCE_IMPORT_PATH), {
        generatedAt: plan.generatedAt,
        exportNumber: plan.exportNumber,
        importedAt: serverTimestamp(),
        importedBy: adminUid,
      });
    } catch (error) {
      // Outra importação mais nova entrou ao mesmo tempo: as presenças já estão aplicadas.
      if (errorCode(error) !== 'not-allowed') throw error;
      recorded = false;
    }
    return { ok: true, report: { generatedAt: plan.generatedAt, events, recorded } };
  } catch (error) {
    return { ok: false, error: errorCode(error) };
  }
}

function errorCode(error: unknown): 'not-allowed' | 'network' | 'unknown' {
  const code = error instanceof FirebaseError ? error.code : '';
  if (code === 'permission-denied') return 'not-allowed';
  if (code === 'unavailable') return 'network';
  return 'unknown';
}
