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
import { account, asUser, asVisitor, seed, useRulesEnv } from './env';

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
    // Evento antigo, sem o campo `guestsAllowed`: visitantes podem confirmar.
    'events/raid': event(),
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
const confirm = (db: Firestore, eventId: string, data: Record<string, unknown>, id = LUNARA) =>
  setDoc(guest(db, eventId, id), data);

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
      confirm(
        visitor(),
        'raid',
        retail({ realm: "Água Quel'Thalas" }),
        "retail:Thalor:Água Quel'Thalas",
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
  it('administrador cancela em evento futuro e ativo', async () => {
    await assertSucceeds(deleteDoc(guest(asUser(env(), 'ana'), 'raid', THALOR)));
  });

  it('visitante, conta pendente e membro não cancelam', async () => {
    await assertFails(deleteDoc(guest(visitor(), 'raid', THALOR)));
    await assertFails(deleteDoc(guest(asUser(env(), 'kaelen'), 'raid', THALOR)));
    await assertFails(deleteDoc(guest(asUser(env(), 'tavia'), 'raid', THALOR)));
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
