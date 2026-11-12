// Prévia da importação de presenças do addon (string VDLP1), sem dependências (nem Angular, nem
// Firebase): recebe a string decodificada e o estado atual do site e diz o que vai mudar em cada
// evento. A aplicação no Firestore fica em presence-import.ts, que revalida cada item.
// Testado em presence-import-plan.spec.ts.
//
// Regras decididas com a guilda (docs/formato-string-presencas.md e a história "Importar
// presenças do addon" em docs/criterios-de-aceite.md):
// - o personagem do jogo ("Nome Sobrenome") é comparado com os personagens do WoW Forever dos
//   membros (espaços e maiúsculas normalizados, acentos mantidos); sem membro, vira visitante;
// - limite de vagas e duplicidade continuam valendo;
// - `status = 0` cancela a presença daquele personagem;
// - um registro só é aplicado se for mais recente que a última alteração da presença no site.
import type { PresenceExport, PresenceStatus } from './addon-presence-format';

/** Nome e sobrenome do personagem do WoW Forever. */
export interface ForeverName {
  characterName: string;
  characterSurname: string;
}

/** Personagem do WoW Forever cadastrado por um membro. */
export interface MemberCharacter extends ForeverName {
  uid: string;
  username: string;
  /** Conta ativa (contas desativadas ou excluídas não recebem presenças). */
  active: boolean;
  /** `null` = principal vindo da candidatura, ainda sem documento próprio. */
  characterId: string | null;
  isMain: boolean;
}

export interface SiteEvent {
  id: string;
  title: string;
  startsAt: Date;
  status: 'ativo' | 'cancelado';
  game: 'forever' | 'retail' | null;
  guestsAllowed: boolean;
  maxAttendees: number;
  attendeeCount: number;
}

export interface SiteAttendee {
  uid: string;
  /** Personagem com que confirmou (`null` em presenças antigas, sem personagem). */
  character: ForeverName | null;
  /** Última alteração: horário do jogo (origem addon) ou da confirmação no site. */
  changedAt: Date | null;
}

export interface SiteGuest extends ForeverName {
  id: string;
  changedAt: Date | null;
}

export interface SiteEventState {
  event: SiteEvent;
  attendees: SiteAttendee[];
  guests: SiteGuest[];
  /** Cancelamentos registrados: ID (`attendees:<uid>` ou `guests:<id>`) → quando. */
  cancellations: Map<string, Date>;
}

export interface SiteState {
  /** `generatedAt` da última string importada (`null` se nenhuma). */
  lastGeneratedAt: number | null;
  characters: MemberCharacter[];
  /** Estado de cada evento da string; ausente = evento não existe no site. */
  events: Map<string, SiteEventState>;
}

/** Motivo de um registro não ser aplicado. */
export type RefusalReason =
  | 'stale'
  | 'full'
  | 'member-other-character'
  | 'duplicate-guest'
  | 'duplicate-member'
  | 'member-inactive'
  | 'ambiguous'
  | 'invalid-name'
  /** O personagem foi removido ou renomeado depois da prévia. */
  | 'character-not-found';

export type EventIgnoredReason = 'unknown' | 'past' | 'cancelled' | 'not-forever';

interface ItemBase {
  /** Personagem como veio do jogo. */
  character: string;
  status: PresenceStatus;
  /** Horário da resposta no jogo, em segundos Unix. */
  updatedAt: number;
}

export type PlanItem = ItemBase &
  (
    | { action: 'confirm-member'; uid: string; username: string; characterId: string | null }
    | { action: 'cancel-member'; uid: string; username: string }
    | { action: 'confirm-guest'; guestId: string; guest: ForeverName }
    | { action: 'cancel-guest'; guestId: string }
    | { action: 'refused'; reason: RefusalReason; detail?: string }
    | { action: 'unchanged' }
  );

export type PlanAction = PlanItem['action'];

export interface EventPlan {
  eventId: string;
  /** `null` quando o evento não existe no site. */
  event: SiteEvent | null;
  /** Evento ignorado inteiro (nenhum registro dele é aplicado). */
  ignored: EventIgnoredReason | null;
  items: PlanItem[];
}

export interface ImportPlan {
  generatedAt: number;
  exportNumber: number;
  lastGeneratedAt: number | null;
  /** A string não é mais nova que a última importada: nada é aplicado. */
  outdated: boolean;
  events: EventPlan[];
}

/** Nome do personagem padronizado para comparação: espaços e maiúsculas, acentos mantidos. */
export function normalizeCharacter(value: string): string {
  return value.normalize('NFC').trim().replace(/\s+/gu, ' ').toLocaleLowerCase('pt-BR');
}

export const characterKey = (c: ForeverName) =>
  normalizeCharacter(`${c.characterName} ${c.characterSurname}`);

/** "nome sobrenome" → nome e sobrenome com a primeira letra maiúscula, como o jogo grava. */
export function splitCharacter(value: string): ForeverName | null {
  const parts = value.normalize('NFC').trim().split(/\s+/u);
  if (parts.length !== 2) return null;
  const cap = (s: string) => {
    const lower = s.toLocaleLowerCase('pt-BR');
    return lower.charAt(0).toLocaleUpperCase('pt-BR') + lower.slice(1);
  };
  const name = { characterName: cap(parts[0]), characterSurname: cap(parts[1]) };
  // Igual a GUEST_NAME_PATTERN (guest-attendance.ts) e às Security Rules.
  const valid = /^\p{Lu}\p{Ll}{1,11}$/u;
  return valid.test(name.characterName) && valid.test(name.characterSurname) ? name : null;
}

/** ID da presença de visitante do WoW Forever (igual a `guestKey` em guest-attendance.ts). */
export const foreverGuestId = (c: ForeverName) =>
  `forever:${c.characterName}:${c.characterSurname}`;

export const memberCancellationId = (uid: string) => `attendees:${uid}`;
export const guestCancellationId = (id: string) => `guests:${id}`;

/**
 * Mais recente que a última alteração no site? Igual (o mesmo dado já importado) ou mais antigo
 * não é aplicado.
 */
const newer = (updatedAt: number, ...changes: (Date | null | undefined)[]) =>
  changes.every((c) => !c || updatedAt * 1000 > c.getTime());

export function ignoredReason(event: SiteEvent | null, now: Date): EventIgnoredReason | null {
  if (!event) return 'unknown';
  if (event.game !== 'forever') return 'not-forever';
  if (event.status === 'cancelado') return 'cancelled';
  if (event.startsAt.getTime() <= now.getTime()) return 'past';
  return null;
}

/** Monta a prévia da importação. Não altera nada. */
export function planPresenceImport(
  data: PresenceExport,
  site: SiteState,
  now = new Date(),
): ImportPlan {
  const byCharacter = new Map<string, MemberCharacter[]>();
  for (const c of site.characters) {
    const key = characterKey(c);
    byCharacter.set(key, [...(byCharacter.get(key) ?? []), c]);
  }
  const outdated = site.lastGeneratedAt !== null && data.generatedAt <= site.lastGeneratedAt;

  const events = data.events.map((e): EventPlan => {
    const state = site.events.get(e.id) ?? null;
    const ignored = ignoredReason(state?.event ?? null, now);
    if (!state || ignored) {
      return { eventId: e.id, event: state?.event ?? null, ignored, items: [] };
    }
    return {
      eventId: e.id,
      event: state.event,
      ignored: null,
      items: planEvent(e.records, state, byCharacter),
    };
  });

  return {
    generatedAt: data.generatedAt,
    exportNumber: data.exportNumber,
    lastGeneratedAt: site.lastGeneratedAt,
    outdated,
    events,
  };
}

function planEvent(
  records: PresenceExport['events'][number]['records'],
  state: SiteEventState,
  byCharacter: Map<string, MemberCharacter[]>,
): PlanItem[] {
  // Estado simulado, atualizado a cada item, para a prévia valer em sequência.
  const attendees = new Map(state.attendees.map((a) => [a.uid, a]));
  const guests = new Map(state.guests.map((g) => [g.id, g]));
  let count = state.event.attendeeCount;
  const items: PlanItem[] = [];

  // Cancelamentos primeiro (liberam vagas); depois, confirmações na ordem em que foram feitas.
  const ordered = [...records].sort((a, b) => a.status - b.status || a.updatedAt - b.updatedAt);

  for (const record of ordered) {
    const base: ItemBase = {
      character: record.character,
      status: record.status,
      updatedAt: record.updatedAt,
    };
    const refuse = (reason: RefusalReason, detail?: string): PlanItem => ({
      ...base,
      action: 'refused',
      reason,
      ...(detail ? { detail } : {}),
    });
    const key = normalizeCharacter(record.character);
    const owners = byCharacter.get(key) ?? [];
    const uids = [...new Set(owners.map((o) => o.uid))];

    if (uids.length > 1) {
      items.push(refuse('ambiguous', [...new Set(owners.map((o) => o.username))].join(', ')));
      continue;
    }

    if (uids.length === 1) {
      // Mesmo membro com dois personagens de mesmo nome (rulesets diferentes): o principal.
      const owner = owners.find((o) => o.isMain) ?? owners[0];
      if (!owner.active) {
        items.push(refuse('member-inactive', owner.username));
        continue;
      }
      const current = attendees.get(owner.uid);
      const sameCharacter = !!current?.character && characterKey(current.character) === key;
      const cancelledAt = state.cancellations.get(memberCancellationId(owner.uid));

      if (record.status === 1) {
        if (current) {
          items.push(
            sameCharacter
              ? { ...base, action: 'unchanged' }
              : refuse(
                  'member-other-character',
                  current.character
                    ? `${current.character.characterName} ${current.character.characterSurname}`
                    : undefined,
                ),
          );
        } else if (!newer(record.updatedAt, cancelledAt)) {
          items.push(refuse('stale'));
        } else if (guests.has(foreverGuestId(owner))) {
          items.push(refuse('duplicate-guest'));
        } else if (count >= state.event.maxAttendees) {
          items.push(refuse('full'));
        } else {
          items.push({
            ...base,
            action: 'confirm-member',
            uid: owner.uid,
            username: owner.username,
            characterId: owner.characterId,
          });
          attendees.set(owner.uid, { uid: owner.uid, character: owner, changedAt: null });
          count++;
        }
      } else if (!current || !sameCharacter) {
        items.push({ ...base, action: 'unchanged' });
      } else if (!newer(record.updatedAt, current.changedAt)) {
        items.push(refuse('stale'));
      } else {
        items.push({ ...base, action: 'cancel-member', uid: owner.uid, username: owner.username });
        attendees.delete(owner.uid);
        count = Math.max(0, count - 1);
      }
      continue;
    }

    // Sem membro correspondente: visitante.
    const name = splitCharacter(record.character);
    if (!name) {
      items.push(refuse('invalid-name'));
      continue;
    }
    const guestId = foreverGuestId(name);
    const current = guests.get(guestId);
    if (record.status === 1) {
      const memberWithIt = [...attendees.values()].some(
        (a) => a.character && characterKey(a.character) === key,
      );
      if (current) {
        items.push({ ...base, action: 'unchanged' });
      } else if (!newer(record.updatedAt, state.cancellations.get(guestCancellationId(guestId)))) {
        items.push(refuse('stale'));
      } else if (memberWithIt) {
        items.push(refuse('duplicate-member'));
      } else if (count >= state.event.maxAttendees) {
        items.push(refuse('full'));
      } else {
        items.push({ ...base, action: 'confirm-guest', guestId, guest: name });
        guests.set(guestId, { id: guestId, ...name, changedAt: null });
        count++;
      }
    } else if (!current) {
      items.push({ ...base, action: 'unchanged' });
    } else if (!newer(record.updatedAt, current.changedAt)) {
      items.push(refuse('stale'));
    } else {
      items.push({ ...base, action: 'cancel-guest', guestId });
      guests.delete(guestId);
      count = Math.max(0, count - 1);
    }
  }
  return items;
}

/** Quantidade de itens de cada tipo (resumo da prévia e do relatório). */
export function countActions(items: { action: PlanAction }[]): Record<PlanAction, number> {
  const counts: Record<PlanAction, number> = {
    'confirm-member': 0,
    'cancel-member': 0,
    'confirm-guest': 0,
    'cancel-guest': 0,
    refused: 0,
    unchanged: 0,
  };
  for (const i of items) counts[i.action]++;
  return counts;
}

/** Algo a aplicar? */
export const hasChanges = (plan: ImportPlan) =>
  !plan.outdated &&
  plan.events.some((e) => e.items.some((i) => i.action !== 'refused' && i.action !== 'unchanged'));
