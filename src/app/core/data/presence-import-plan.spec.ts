import type { PresenceExport, PresenceRecord } from './addon-presence-format';
import {
  countActions,
  hasChanges,
  normalizeCharacter,
  planPresenceImport,
  splitCharacter,
  type MemberCharacter,
  type SiteEventState,
  type SiteState,
} from './presence-import-plan';

const NOW = new Date('2026-11-12T12:00:00Z');
const s = (iso: string) => Date.parse(iso) / 1000;
const GAME = s('2026-11-11T20:00:00Z');

const member = (
  uid: string,
  characterName: string,
  characterSurname: string,
  over: Partial<MemberCharacter> = {},
): MemberCharacter => ({
  uid,
  username: uid,
  active: true,
  characterId: `${uid}-${characterName}`,
  isMain: true,
  characterName,
  characterSurname,
  ...over,
});

const eventState = (over: Partial<SiteEventState['event']> = {}): SiteEventState => ({
  event: {
    id: 'raid',
    title: 'Raid',
    startsAt: new Date('2026-11-20T23:00:00Z'),
    status: 'ativo',
    game: 'forever',
    guestsAllowed: true,
    maxAttendees: 40,
    attendeeCount: 0,
    ...over,
  },
  attendees: [],
  guests: [],
  cancellations: new Map(),
});

const exportOf = (records: PresenceRecord[], id = 'raid', generatedAt = GAME + 3600) =>
  ({
    version: 1,
    game: 'forever',
    generatedAt,
    exportNumber: 0,
    events: [{ id, records }],
  }) satisfies PresenceExport;

const rec = (character: string, status: 0 | 1 = 1, updatedAt = GAME): PresenceRecord => ({
  character,
  status,
  updatedAt,
});

function plan(
  records: PresenceRecord[],
  state: SiteEventState = eventState(),
  characters: MemberCharacter[] = [],
  lastGeneratedAt: number | null = null,
) {
  const site: SiteState = { lastGeneratedAt, characters, events: new Map([['raid', state]]) };
  return planPresenceImport(exportOf(records), site, NOW);
}

describe('Nome do personagem', () => {
  it('normaliza espaços e maiúsculas, mantendo os acentos', () => {
    expect(normalizeCharacter('  ÁRYA   ñúñez ')).toBe('árya ñúñez');
    expect(normalizeCharacter('Arya Nunez')).not.toBe(normalizeCharacter('Árya Ñúñez'));
  });

  it('separa nome e sobrenome como o jogo grava', () => {
    expect(splitCharacter('árya ÑÚÑEZ')).toEqual({
      characterName: 'Árya',
      characterSurname: 'Ñúñez',
    });
    expect(splitCharacter('Só')).toBeNull();
    expect(splitCharacter('Três Nomes Aqui')).toBeNull();
    expect(splitCharacter('X Y')).toBeNull();
  });
});

describe('Prévia da importação de presenças', () => {
  it('associa o personagem ao membro dono (sem diferenciar maiúsculas e espaços)', () => {
    const p = plan([rec('victor  VAZ')], eventState(), [member('victor', 'Victor', 'Vaz')]);
    expect(p.events[0].items[0]).toMatchObject({
      action: 'confirm-member',
      uid: 'victor',
      characterId: 'victor-Victor',
    });
  });

  it('sem membro correspondente, confirma como visitante', () => {
    const p = plan([rec('Árya Ñúñez')]);
    expect(p.events[0].items[0]).toMatchObject({
      action: 'confirm-guest',
      guestId: 'forever:Árya:Ñúñez',
      guest: { characterName: 'Árya', characterSurname: 'Ñúñez' },
    });
  });

  it('recusa nome inválido para visitante', () => {
    expect(plan([rec('Nome Com Tres')]).events[0].items[0]).toMatchObject({
      action: 'refused',
      reason: 'invalid-name',
    });
  });

  it('recusa personagem de mesmo nome em membros diferentes (ambíguo)', () => {
    const p = plan([rec('Maren Luz')], eventState(), [
      member('maren', 'Maren', 'Luz'),
      member('outra', 'Maren', 'Luz', { isMain: false }),
    ]);
    expect(p.events[0].items[0]).toMatchObject({
      action: 'refused',
      reason: 'ambiguous',
      detail: 'maren, outra',
    });
  });

  it('mesmo membro com dois personagens de mesmo nome: usa o principal', () => {
    const p = plan([rec('Maren Luz')], eventState(), [
      member('maren', 'Maren', 'Luz', { characterId: 'jxj', isMain: false }),
      member('maren', 'Maren', 'Luz', { characterId: 'normal', isMain: true }),
    ]);
    expect(p.events[0].items[0]).toMatchObject({ action: 'confirm-member', characterId: 'normal' });
  });

  it('recusa personagem de membro desativado', () => {
    const p = plan([rec('Brenna Ferro')], eventState(), [
      member('brenna', 'Brenna', 'Ferro', { active: false }),
    ]);
    expect(p.events[0].items[0]).toMatchObject({ action: 'refused', reason: 'member-inactive' });
  });

  it('membro já confirmado: mesmo personagem não muda; outro personagem é recusado', () => {
    const state = eventState({ attendeeCount: 1 });
    state.attendees = [
      {
        uid: 'victor',
        character: { characterName: 'Victor', characterSurname: 'Vaz' },
        changedAt: new Date('2026-11-01T00:00:00Z'),
      },
    ];
    const characters = [member('victor', 'Victor', 'Vaz'), member('victor', 'Outro', 'Alt')];
    const p = plan([rec('Victor Vaz'), rec('Outro Alt')], state, characters);
    expect(p.events[0].items.map((i) => i.action)).toEqual(['unchanged', 'refused']);
    expect(p.events[0].items[1]).toMatchObject({
      reason: 'member-other-character',
      detail: 'Victor Vaz',
    });
  });

  it('cancela a presença do membro com aquele personagem, se o jogo for mais recente', () => {
    const state = eventState({ attendeeCount: 1 });
    state.attendees = [
      {
        uid: 'victor',
        character: { characterName: 'Victor', characterSurname: 'Vaz' },
        changedAt: new Date((GAME - 60) * 1000),
      },
    ];
    const characters = [member('victor', 'Victor', 'Vaz'), member('victor', 'Outro', 'Alt')];
    expect(plan([rec('Victor Vaz', 0)], state, characters).events[0].items[0]).toMatchObject({
      action: 'cancel-member',
      uid: 'victor',
    });
    // Cancelamento de outro personagem do mesmo membro: não é a presença dele.
    expect(plan([rec('Outro Alt', 0)], state, characters).events[0].items[0].action).toBe(
      'unchanged',
    );
    // Confirmação feita no site depois da resposta do jogo: o site vence.
    state.attendees[0].changedAt = new Date((GAME + 60) * 1000);
    expect(plan([rec('Victor Vaz', 0)], state, characters).events[0].items[0]).toMatchObject({
      action: 'refused',
      reason: 'stale',
    });
  });

  it('não refaz um cancelamento feito no site depois da resposta do jogo', () => {
    const state = eventState();
    state.cancellations.set('attendees:victor', new Date((GAME + 60) * 1000));
    state.cancellations.set('guests:forever:Árya:Ñúñez', new Date((GAME + 60) * 1000));
    const p = plan([rec('Victor Vaz'), rec('Árya Ñúñez')], state, [
      member('victor', 'Victor', 'Vaz'),
    ]);
    expect(p.events[0].items.map((i) => i.action === 'refused' && i.reason)).toEqual([
      'stale',
      'stale',
    ]);
    // Resposta do jogo depois do cancelamento no site: aplica.
    state.cancellations.set('attendees:victor', new Date((GAME - 60) * 1000));
    expect(
      plan([rec('Victor Vaz')], state, [member('victor', 'Victor', 'Vaz')]).events[0].items[0]
        .action,
    ).toBe('confirm-member');
  });

  it('cancela visitante e ignora cancelamento de presença que não existe', () => {
    const state = eventState({ attendeeCount: 1 });
    state.guests = [
      {
        id: 'forever:Árya:Ñúñez',
        characterName: 'Árya',
        characterSurname: 'Ñúñez',
        changedAt: null,
      },
    ];
    const p = plan([rec('Árya Ñúñez', 0), rec('Dorvan Pedra', 0)], state);
    expect(p.events[0].items.map((i) => i.action)).toEqual(['cancel-guest', 'unchanged']);
  });

  it('respeita o limite de vagas, somando membros e visitantes; cancelamentos liberam vaga', () => {
    const state = eventState({ maxAttendees: 2, attendeeCount: 2 });
    state.guests = [
      {
        id: 'forever:Velho:Visitante',
        characterName: 'Velho',
        characterSurname: 'Visitante',
        changedAt: null,
      },
    ];
    const p = plan(
      [
        rec('Victor Vaz', 1, GAME),
        rec('Nova Pessoa', 1, GAME + 10),
        rec('Velho Visitante', 0, GAME + 20),
      ],
      state,
      [member('victor', 'Victor', 'Vaz')],
    );
    expect(
      p.events[0].items.map((i) => [i.character, i.action === 'refused' ? i.reason : i.action]),
    ).toEqual([
      ['Velho Visitante', 'cancel-guest'],
      ['Victor Vaz', 'confirm-member'],
      ['Nova Pessoa', 'full'],
    ]);
  });

  it('o mesmo personagem não confirma como membro e como visitante', () => {
    const state = eventState({ attendeeCount: 2 });
    state.guests = [
      {
        id: 'forever:Victor:Vaz',
        characterName: 'Victor',
        characterSurname: 'Vaz',
        changedAt: null,
      },
    ];
    state.attendees = [
      {
        uid: 'ex',
        character: { characterName: 'Árya', characterSurname: 'Ñúñez' },
        changedAt: null,
      },
    ];
    const p = plan([rec('Victor Vaz'), rec('Árya Ñúñez')], state, [
      member('victor', 'Victor', 'Vaz'),
    ]);
    expect(p.events[0].items.map((i) => i.action === 'refused' && i.reason)).toEqual([
      'duplicate-guest',
      'duplicate-member',
    ]);
  });

  it('recusa visitantes quando o evento não aceita visitantes', () => {
    expect(
      plan([rec('Árya Ñúñez')], eventState({ guestsAllowed: false })).events[0].items[0],
    ).toMatchObject({ action: 'refused', reason: 'guests-closed' });
  });

  it('ignora eventos desconhecidos, passados, cancelados e que não são do WoW Forever', () => {
    const site: SiteState = {
      lastGeneratedAt: null,
      characters: [],
      events: new Map([
        ['passado', eventState({ startsAt: new Date('2026-11-01T00:00:00Z') })],
        ['cancelado', eventState({ status: 'cancelado' })],
        ['retail', eventState({ game: 'retail' })],
        ['antigo', eventState({ game: null })],
      ]),
    };
    const data: PresenceExport = {
      version: 1,
      game: 'forever',
      generatedAt: GAME,
      exportNumber: 0,
      events: ['passado', 'cancelado', 'retail', 'antigo', 'sumiu'].map((id) => ({
        id,
        records: [rec('Árya Ñúñez')],
      })),
    };
    const p = planPresenceImport(data, site, NOW);
    expect(p.events.map((e) => e.ignored)).toEqual([
      'past',
      'cancelled',
      'not-forever',
      'not-forever',
      'unknown',
    ]);
    expect(p.events.every((e) => e.items.length === 0)).toBe(true);
    expect(hasChanges(p)).toBe(false);
  });

  it('marca como desatualizada a string que não é mais nova que a última importada', () => {
    const p = plan([rec('Árya Ñúñez')], eventState(), [], GAME + 3600);
    expect(p.outdated).toBe(true);
    expect(hasChanges(p)).toBe(false);
    expect(plan([rec('Árya Ñúñez')], eventState(), [], GAME + 3599).outdated).toBe(false);
  });

  it('conta os itens por tipo', () => {
    const p = plan([rec('Árya Ñúñez'), rec('X Y')]);
    expect(countActions(p.events[0].items)).toMatchObject({ 'confirm-guest': 1, refused: 1 });
    expect(hasChanges(p)).toBe(true);
  });
});
