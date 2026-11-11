import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  updateDoc,
  type Firestore,
} from 'firebase/firestore';
import { beforeEach, describe, it } from 'vitest';
import { account, asUser, asVisitor, presenceWithCount, seed, useRulesEnv } from './env';

const env = useRulesEnv();

const DAY = 86_400_000;
const event = (over: Record<string, unknown> = {}) => ({
  title: 'Raid semanal',
  startsAt: new Date(Date.now() + 3 * DAY),
  description: '[DESCRIÇÃO DO EVENTO]',
  organizer: 'Maren',
  status: 'ativo',
  createdBy: 'ana',
  createdAt: new Date('2026-11-01T12:00:00Z'),
  updatedAt: new Date('2026-11-01T12:00:00Z'),
  ...over,
});

const LUNARA = 'forever:Lunara:Sombraviva';
const THALOR = 'retail:Thalor:Tol Barad';

beforeEach(() =>
  seed(env(), {
    'users/ana': account('ana', { status: 'ativo', role: 'admin' }),
    'users/tavia': account('tavia', { status: 'ativo' }),
    'users/kaelen': account('kaelen'),
    // Evento antigo, sem os campos `guestsAllowed` e `game`: visitantes dos dois jogos
    // podem confirmar.
    'events/raid': event(),
    'events/retail': event({ game: 'retail' }),
    'events/forever': event({ game: 'forever' }),
    'events/ligado': event({ guestsAllowed: true }),
    'events/fechado': event({ guestsAllowed: false }),
    'events/antigo': event({ startsAt: new Date(Date.now() - DAY) }),
    'events/cancelado': event({ status: 'cancelado' }),
    [`events/raid/guests/${THALOR}`]: {
      game: 'retail',
      characterName: 'Thalor',
      realm: 'Tol Barad',
      confirmedAt: new Date(),
    },
  }),
);

const forever = (over: Record<string, unknown> = {}) => ({
  game: 'forever',
  characterName: 'Lunara',
  characterSurname: 'Sombraviva',
  confirmedAt: serverTimestamp(),
  ...over,
});
const retail = (over: Record<string, unknown> = {}) => ({
  game: 'retail',
  characterName: 'Thalor',
  realm: 'Azralon',
  confirmedAt: serverTimestamp(),
  ...over,
});

const guest = (db: Firestore, eventId: string, id: string) =>
  doc(db, 'events', eventId, 'guests', id);
const visitor = () => asVisitor(env());
/** Confirma junto com o contador do evento (eventos semeados sem contador: passa a 1). */
const confirm = (db: Firestore, eventId: string, data: Record<string, unknown>, id = LUNARA) =>
  presenceWithCount(db, eventId, 'guests', id, data, 1);

describe('Visitante confirma presença', () => {
  it('sem login, com nome e sobrenome (WoW Forever)', async () => {
    await assertSucceeds(confirm(visitor(), 'raid', forever()));
    await assertSucceeds(confirm(visitor(), 'ligado', forever()));
  });

  it('sem login, com nome e reino (Retail)', async () => {
    await assertSucceeds(confirm(visitor(), 'raid', retail(), 'retail:Thalor:Azralon'));
  });

  it('conta pendente também confirma como visitante', async () => {
    await assertSucceeds(confirm(asUser(env(), 'kaelen'), 'raid', forever()));
  });

  it('membro ativo confirma pela própria conta, não como visitante', async () => {
    await assertFails(confirm(asUser(env(), 'tavia'), 'raid', forever()));
  });

  it('não confirma sem atualizar o contador, nem além do limite', async () => {
    await assertFails(setDoc(guest(visitor(), 'raid', LUNARA), forever()));
    await seed(env(), { 'events/lotado': event({ maxAttendees: 1, attendeeCount: 1 }) });
    await assertFails(presenceWithCount(visitor(), 'lotado', 'guests', LUNARA, forever(), 2));
  });

  it('não confirma com a confirmação de visitantes desativada', async () => {
    await assertFails(confirm(visitor(), 'fechado', forever()));
  });

  it('não confirma em evento passado, cancelado ou inexistente', async () => {
    await assertFails(confirm(visitor(), 'antigo', forever()));
    await assertFails(confirm(visitor(), 'cancelado', forever()));
    await assertFails(confirm(visitor(), 'nao-existe', forever()));
  });

  it('o mesmo personagem não confirma duas vezes', async () => {
    await assertFails(confirm(visitor(), 'raid', retail({ realm: 'Tol Barad' }), THALOR));
  });

  it('o ID corresponde ao personagem', async () => {
    await assertFails(confirm(visitor(), 'raid', forever(), 'qualquer-coisa'));
    await assertFails(confirm(visitor(), 'raid', forever(), 'forever:lunara:sombraviva'));
    await assertFails(confirm(visitor(), 'raid', forever({ characterName: 'Outra' })));
  });

  it('aceita letras acentuadas, inclusive maiúsculas', async () => {
    await assertSucceeds(
      confirm(
        visitor(),
        'raid',
        forever({ characterName: 'Élune', characterSurname: 'Ñandu' }),
        'forever:Élune:Ñandu',
      ),
    );
    await assertSucceeds(
      // Segunda confirmação no evento: o contador vai a 2.
      presenceWithCount(
        visitor(),
        'raid',
        'guests',
        "retail:Thalor:Água Quel'Thalas",
        retail({ realm: "Água Quel'Thalas" }),
        2,
      ),
    );
  });

  it('valida nomes, sobrenome e reino', async () => {
    const id = (d: Record<string, unknown>) =>
      `forever:${String(d['characterName'])}:${String(d['characterSurname'] ?? '')}`;
    const bad = [
      forever({ characterName: 'L' }),
      forever({ characterName: 'Lunara2' }),
      forever({ characterName: 'Lu nara' }),
      forever({ characterName: 'Lunaraaaaaaaa' }),
      // Como no jogo: só a primeira letra maiúscula.
      forever({ characterName: 'lunara' }),
      forever({ characterName: 'LUNARA' }),
      forever({ characterSurname: '' }),
    ];
    for (const data of bad) await assertFails(confirm(visitor(), 'raid', data, id(data)));
    const { characterSurname: _, ...noSurname } = forever();
    await assertFails(confirm(visitor(), 'raid', noSurname, 'forever:Lunara:'));

    for (const realm of ['', ' Azralon', 'Tol  Barad', 'x'.repeat(41)]) {
      await assertFails(confirm(visitor(), 'raid', retail({ realm }), `retail:Thalor:${realm}`));
    }
  });

  it('cada jogo tem só os seus campos, e o horário é o do servidor', async () => {
    await assertFails(confirm(visitor(), 'raid', forever({ realm: 'Azralon' })));
    await assertFails(
      confirm(
        visitor(),
        'raid',
        retail({ characterSurname: 'Sombraviva' }),
        'retail:Thalor:Azralon',
      ),
    );
    await assertFails(confirm(visitor(), 'raid', forever({ confirmedAt: new Date() })));
    await assertFails(confirm(visitor(), 'raid', forever({ email: 'x@example.com' })));
    await assertFails(
      confirm(visitor(), 'raid', { ...forever(), game: 'classic' }, 'classic:Lunara:Sombraviva'),
    );
  });
});

describe('Versão do jogo do evento', () => {
  it('visitante confirma com personagem da versão do jogo do evento', async () => {
    await assertSucceeds(confirm(visitor(), 'forever', forever()));
    await assertSucceeds(confirm(visitor(), 'retail', retail(), 'retail:Thalor:Azralon'));
  });

  it('não confirma com personagem de outra versão do jogo', async () => {
    await assertFails(confirm(visitor(), 'retail', forever()));
    await assertFails(confirm(visitor(), 'forever', retail(), 'retail:Thalor:Azralon'));
  });
});

describe('Ler presenças de visitantes', () => {
  it('a consulta pontual é pública (o visitante acompanha a própria confirmação)', async () => {
    await assertSucceeds(getDoc(guest(visitor(), 'raid', THALOR)));
  });

  it('somente administradores listam', async () => {
    await assertSucceeds(getDocs(collection(asUser(env(), 'ana'), 'events', 'raid', 'guests')));
    await assertFails(getDocs(collection(asUser(env(), 'tavia'), 'events', 'raid', 'guests')));
    await assertFails(getDocs(collection(visitor(), 'events', 'raid', 'guests')));
  });
});

describe('Cancelar presença de visitante', () => {
  it('administrador cancela em evento futuro e ativo, junto com o contador', async () => {
    await assertFails(deleteDoc(guest(asUser(env(), 'ana'), 'raid', THALOR)));
    await assertSucceeds(
      presenceWithCount(asUser(env(), 'ana'), 'raid', 'guests', THALOR, null, 0),
    );
  });

  it('visitante, conta pendente e membro não cancelam', async () => {
    for (const db of [visitor(), asUser(env(), 'kaelen'), asUser(env(), 'tavia')]) {
      await assertFails(presenceWithCount(db, 'raid', 'guests', THALOR, null, 0));
    }
  });

  it('ninguém altera uma presença de visitante', async () => {
    await assertFails(updateDoc(guest(visitor(), 'raid', THALOR), { realm: 'Azralon' }));
    await assertFails(updateDoc(guest(asUser(env(), 'ana'), 'raid', THALOR), { realm: 'Azralon' }));
  });

  it('o histórico de eventos que já aconteceram não é apagado', async () => {
    await seed(env(), {
      [`events/antigo/guests/${THALOR}`]: {
        game: 'retail',
        characterName: 'Thalor',
        realm: 'Tol Barad',
        confirmedAt: new Date(),
      },
    });
    await assertFails(deleteDoc(guest(asUser(env(), 'ana'), 'antigo', THALOR)));
  });
});
