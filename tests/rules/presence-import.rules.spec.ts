// Rules da importação de presenças do addon (string VDLP1): presenças criadas pelo
// administrador em nome de membros e visitantes, registro de cancelamentos e registro da
// última string importada.
import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import {
  Timestamp,
  collection,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
  type Firestore,
} from 'firebase/firestore';
import { beforeEach, describe, it } from 'vitest';
import { account, asUser, asVisitor, seed, useRulesEnv } from './env';

const env = useRulesEnv();

const DAY = 86_400_000;
const event = (over: Record<string, unknown> = {}) => ({
  title: 'Raid semanal',
  game: 'forever',
  startsAt: new Date(Date.now() + 3 * DAY),
  description: '[DESCRIÇÃO DO EVENTO]',
  organizer: 'Maren',
  status: 'ativo',
  createdBy: 'ana',
  createdAt: new Date('2026-11-01T12:00:00Z'),
  updatedAt: new Date('2026-11-01T12:00:00Z'),
  ...over,
});

const forever = (characterName: string, characterSurname: string) => ({
  game: 'forever',
  characterName,
  characterSurname,
  ruleset: 'normal',
  characterClass: 'druida',
  characterRole: 'cura',
  professions: [],
  level: 60,
});
const LUNARA = forever('Lunara', 'Sombraviva');
const GAME_TIME = Timestamp.fromMillis(Date.parse('2026-11-10T20:00:00Z'));

const addon = (uid: string) => ({
  source: 'addon',
  addonUpdatedAt: GAME_TIME,
  importedBy: uid,
});

beforeEach(() =>
  seed(env(), {
    'users/ana': account('ana', { status: 'ativo', role: 'admin' }),
    'users/tavia': account('tavia', { status: 'ativo' }),
    'users/brenna': account('brenna', { status: 'desativado' }),
    'members/tavia': {
      username: 'tavia',
      active: true,
      mainCharacter: LUNARA,
      mainCharacterId: 'principal',
    },
    'members/tavia/characters/principal': LUNARA,
    'members/brenna': {
      username: 'brenna',
      active: false,
      mainCharacter: forever('Brenna', 'Ferro'),
      mainCharacterId: 'principal',
    },
    'members/brenna/characters/principal': forever('Brenna', 'Ferro'),
    'events/raid': event(),
    'events/cheio': event({ maxAttendees: 1, attendeeCount: 1 }),
    'events/cheio/guests/forever:Outro:Visitante': {
      game: 'forever',
      characterName: 'Outro',
      characterSurname: 'Visitante',
      confirmedAt: new Date('2026-11-05T12:00:00Z'),
    },
    'events/fechado': event({ guestsAllowed: false }),
  }),
);

/**
 * Confirma (`data`) ou cancela (`null`) uma presença com o contador do evento, como o app faz;
 * no cancelamento, `cancellation` é o registro gravado no mesmo lote.
 */
async function presence(
  db: Firestore,
  eventId: string,
  kind: 'attendees' | 'guests',
  id: string,
  data: Record<string, unknown> | null,
  attendeeCount: number,
  cancellation?: Record<string, unknown>,
) {
  const batch = writeBatch(db);
  const ref = doc(db, 'events', eventId, kind, id);
  if (data) batch.set(ref, data);
  else batch.delete(ref);
  if (cancellation) {
    batch.set(doc(db, 'events', eventId, 'cancellations', `${kind}:${id}`), cancellation);
  }
  batch.update(doc(db, 'events', eventId), { attendeeCount, lastAttendance: { kind, id } });
  return batch.commit();
}

const memberPresence = (extra: Record<string, unknown> = {}) => ({
  confirmedAt: serverTimestamp(),
  character: LUNARA,
  characterId: 'principal',
  ...extra,
});

const ARYA = { game: 'forever', characterName: 'Árya', characterSurname: 'Ñúñez' };
const ARYA_ID = 'forever:Árya:Ñúñez';

describe('Presença de membro importada do addon', () => {
  it('administrador confirma a presença de um membro ativo com um personagem dele', async () => {
    await assertSucceeds(
      presence(asUser(env(), 'ana'), 'raid', 'attendees', 'tavia', memberPresence(addon('ana')), 1),
    );
  });

  it('exige a origem addon, o horário do jogo e o administrador que importou', async () => {
    const ana = asUser(env(), 'ana');
    await assertFails(presence(ana, 'raid', 'attendees', 'tavia', memberPresence(), 1));
    await assertFails(
      presence(ana, 'raid', 'attendees', 'tavia', memberPresence(addon('tavia')), 1),
    );
    await assertFails(
      presence(
        ana,
        'raid',
        'attendees',
        'tavia',
        memberPresence({ ...addon('ana'), source: 'site' }),
        1,
      ),
    );
    await assertFails(
      presence(
        ana,
        'raid',
        'attendees',
        'tavia',
        memberPresence({ ...addon('ana'), addonUpdatedAt: 123 }),
        1,
      ),
    );
  });

  it('membro comum não confirma em nome de outro, nem com a origem addon', async () => {
    await assertFails(
      presence(
        asUser(env(), 'tavia'),
        'raid',
        'attendees',
        'tavia',
        memberPresence(addon('tavia')),
        1,
      ),
    );
  });

  it('o personagem precisa ser do membro e o membro precisa estar ativo', async () => {
    const ana = asUser(env(), 'ana');
    await assertFails(
      presence(
        ana,
        'raid',
        'attendees',
        'tavia',
        memberPresence({ ...addon('ana'), character: forever('Outro', 'Nome') }),
        1,
      ),
    );
    await assertFails(
      presence(
        ana,
        'raid',
        'attendees',
        'brenna',
        {
          ...addon('ana'),
          confirmedAt: serverTimestamp(),
          character: forever('Brenna', 'Ferro'),
          characterId: 'principal',
        },
        1,
      ),
    );
  });

  it('respeita o limite de vagas', async () => {
    await assertFails(
      presence(
        asUser(env(), 'ana'),
        'cheio',
        'attendees',
        'tavia',
        memberPresence(addon('ana')),
        2,
      ),
    );
  });

  it('não sobrescreve uma presença existente', async () => {
    const ana = asUser(env(), 'ana');
    await assertSucceeds(
      presence(ana, 'raid', 'attendees', 'tavia', memberPresence(addon('ana')), 1),
    );
    await assertFails(presence(ana, 'raid', 'attendees', 'tavia', memberPresence(addon('ana')), 2));
  });
});

describe('Presença de visitante importada do addon', () => {
  it('administrador confirma o personagem do jogo como visitante', async () => {
    await assertSucceeds(
      presence(
        asUser(env(), 'ana'),
        'raid',
        'guests',
        ARYA_ID,
        { ...ARYA, confirmedAt: serverTimestamp(), ...addon('ana') },
        1,
      ),
    );
  });

  it('sem a origem addon, o administrador (conta ativa) não confirma visitantes', async () => {
    await assertFails(
      presence(
        asUser(env(), 'ana'),
        'raid',
        'guests',
        ARYA_ID,
        {
          ...ARYA,
          confirmedAt: serverTimestamp(),
        },
        1,
      ),
    );
  });

  it('membro comum e visitante não usam a origem addon', async () => {
    const data = { ...ARYA, confirmedAt: serverTimestamp(), ...addon('tavia') };
    await assertFails(presence(asUser(env(), 'tavia'), 'raid', 'guests', ARYA_ID, data, 1));
    await assertFails(presence(asVisitor(env()), 'raid', 'guests', ARYA_ID, data, 1));
  });

  it('respeita o limite de vagas, a confirmação de visitantes e o ID do personagem', async () => {
    const ana = asUser(env(), 'ana');
    const data = { ...ARYA, confirmedAt: serverTimestamp(), ...addon('ana') };
    await assertFails(presence(ana, 'cheio', 'guests', ARYA_ID, data, 2));
    await assertFails(presence(ana, 'fechado', 'guests', ARYA_ID, data, 1));
    await assertFails(presence(ana, 'raid', 'guests', 'forever:Arya:Nunez', data, 1));
  });
});

describe('Registro de cancelamentos', () => {
  beforeEach(() =>
    seed(env(), {
      'events/raid': event({ attendeeCount: 2 }),
      'events/raid/attendees/tavia': {
        confirmedAt: new Date('2026-11-05T12:00:00Z'),
        character: LUNARA,
        characterId: 'principal',
      },
      [`events/raid/guests/${ARYA_ID}`]: {
        ...ARYA,
        confirmedAt: new Date('2026-11-05T12:00:00Z'),
      },
    }),
  );

  const cancelled = (kind: string, id: string, extra: Record<string, unknown> = {}) => ({
    kind,
    id,
    cancelledAt: serverTimestamp(),
    ...extra,
  });

  it('membro registra o cancelamento da própria presença no mesmo lote', async () => {
    await assertSucceeds(
      presence(
        asUser(env(), 'tavia'),
        'raid',
        'attendees',
        'tavia',
        null,
        1,
        cancelled('attendees', 'tavia'),
      ),
    );
  });

  it('administrador registra o cancelamento vindo do addon', async () => {
    await assertSucceeds(
      presence(
        asUser(env(), 'ana'),
        'raid',
        'guests',
        ARYA_ID,
        null,
        1,
        cancelled('guests', ARYA_ID, addon('ana')),
      ),
    );
  });

  it('só registra quando a presença é apagada no mesmo lote', async () => {
    const tavia = asUser(env(), 'tavia');
    await assertFails(
      setDoc(
        doc(tavia, 'events/raid/cancellations/attendees:tavia'),
        cancelled('attendees', 'tavia'),
      ),
    );
    await assertFails(
      setDoc(
        doc(tavia, 'events/raid/cancellations/attendees:kaelen'),
        cancelled('attendees', 'kaelen'),
      ),
    );
  });

  it('confere o ID, o horário e a origem do registro', async () => {
    const tavia = asUser(env(), 'tavia');
    const batch = (id: string, data: Record<string, unknown>) => {
      const b = writeBatch(tavia);
      b.delete(doc(tavia, 'events/raid/attendees/tavia'));
      b.set(doc(tavia, 'events/raid/cancellations', id), data);
      b.update(doc(tavia, 'events/raid'), {
        attendeeCount: 1,
        lastAttendance: { kind: 'attendees', id: 'tavia' },
      });
      return b.commit();
    };
    await assertFails(batch('tavia', cancelled('attendees', 'tavia')));
    await assertFails(
      batch('attendees:tavia', { ...cancelled('attendees', 'tavia'), cancelledAt: new Date() }),
    );
    await assertFails(batch('attendees:tavia', cancelled('attendees', 'tavia', addon('tavia'))));
  });

  it('somente administradores leem o registro', async () => {
    await assertSucceeds(getDocs(collection(asUser(env(), 'ana'), 'events/raid/cancellations')));
    await assertFails(getDocs(collection(asUser(env(), 'tavia'), 'events/raid/cancellations')));
  });
});

describe('Última importação de presenças (config/presenceImport)', () => {
  const record = (uid: string, generatedAt: number) => ({
    generatedAt,
    exportNumber: 1_794_409_200,
    importedAt: serverTimestamp(),
    importedBy: uid,
  });

  it('administrador registra a importação e lê o registro', async () => {
    const ana = asUser(env(), 'ana');
    await assertSucceeds(setDoc(doc(ana, 'config/presenceImport'), record('ana', 100)));
    await assertSucceeds(getDoc(doc(ana, 'config/presenceImport')));
  });

  it('só aceita strings mais novas que a última importada', async () => {
    const ana = asUser(env(), 'ana');
    await assertSucceeds(setDoc(doc(ana, 'config/presenceImport'), record('ana', 100)));
    await assertFails(setDoc(doc(ana, 'config/presenceImport'), record('ana', 100)));
    await assertFails(updateDoc(doc(ana, 'config/presenceImport'), record('ana', 99)));
    await assertSucceeds(setDoc(doc(ana, 'config/presenceImport'), record('ana', 101)));
  });

  it('membros não leem nem gravam; quem importou é o próprio administrador', async () => {
    const tavia = asUser(env(), 'tavia');
    await assertFails(setDoc(doc(tavia, 'config/presenceImport'), record('tavia', 100)));
    await assertFails(getDoc(doc(tavia, 'config/presenceImport')));
    await assertFails(
      setDoc(doc(asUser(env(), 'ana'), 'config/presenceImport'), record('tavia', 1)),
    );
  });
});
