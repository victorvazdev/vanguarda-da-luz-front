import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';
import { beforeEach, describe, it } from 'vitest';
import { account, asUser, seed, useRulesEnv } from './env';

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

beforeEach(() =>
  seed(env(), {
    'users/ana': account('ana', { status: 'ativo', role: 'admin' }),
    'users/tavia': account('tavia', { status: 'ativo' }),
    'users/dorvan': account('dorvan', { status: 'ativo' }),
    'users/kaelen': account('kaelen'),
    'users/brenna': account('brenna', { status: 'desativado' }),
    'events/raid': event(),
    'events/antigo': event({ startsAt: new Date(Date.now() - DAY) }),
    'events/cancelado': event({ status: 'cancelado' }),
    'events/raid/attendees/dorvan': { confirmedAt: new Date() },
    'events/raid/attendees/brenna': { confirmedAt: new Date() },
    'events/antigo/attendees/dorvan': { confirmedAt: new Date() },
    'events/cancelado/attendees/dorvan': { confirmedAt: new Date() },
  }),
);

const attendee = (as: string, eventId: string, uid = as) =>
  doc(asUser(env(), as), 'events', eventId, 'attendees', uid);
const confirm = (as: string, eventId: string, data: Record<string, unknown> = {}, uid = as) =>
  setDoc(attendee(as, eventId, uid), { confirmedAt: serverTimestamp(), ...data });

describe('Confirmar presença', () => {
  it('membro confirma a própria presença em evento futuro e ativo', async () => {
    await assertSucceeds(confirm('tavia', 'raid'));
  });

  it('administrador também confirma a própria presença', async () => {
    await assertSucceeds(confirm('ana', 'raid'));
  });

  it('ninguém confirma em nome de outra pessoa', async () => {
    await assertFails(confirm('tavia', 'raid', {}, 'kaelen'));
    await assertFails(confirm('ana', 'raid', {}, 'tavia'));
  });

  it('não confirma duas vezes no mesmo evento', async () => {
    await assertFails(confirm('dorvan', 'raid'));
  });

  it('não confirma em evento passado, cancelado ou inexistente', async () => {
    await assertFails(confirm('tavia', 'antigo'));
    await assertFails(confirm('tavia', 'cancelado'));
    await assertFails(confirm('tavia', 'nao-existe'));
  });

  it('conta pendente ou desativada não confirma', async () => {
    await assertFails(confirm('kaelen', 'raid'));
    await assertFails(confirm('brenna', 'raid'));
  });

  it('registra só o horário do servidor', async () => {
    await assertFails(confirm('tavia', 'raid', { confirmedAt: new Date() }));
    await assertFails(confirm('tavia', 'raid', { characterName: 'Outro' }));
  });
});

describe('Ler presenças', () => {
  it('membro lê somente a própria presença', async () => {
    await assertSucceeds(getDoc(attendee('dorvan', 'raid')));
    await assertSucceeds(getDoc(attendee('tavia', 'raid')));
    await assertFails(getDoc(attendee('tavia', 'raid', 'dorvan')));
    await assertFails(getDocs(collection(asUser(env(), 'tavia'), 'events', 'raid', 'attendees')));
  });

  it('administrador lista os confirmados', async () => {
    await assertSucceeds(getDocs(collection(asUser(env(), 'ana'), 'events', 'raid', 'attendees')));
  });

  it('conta desativada não lê nem a própria presença', async () => {
    await assertFails(getDoc(attendee('brenna', 'raid')));
  });
});

describe('Cancelar presença', () => {
  it('membro cancela a própria presença em evento futuro e ativo', async () => {
    await assertSucceeds(deleteDoc(attendee('dorvan', 'raid')));
  });

  it('depois de cancelar, pode confirmar de novo', async () => {
    await assertSucceeds(deleteDoc(attendee('dorvan', 'raid')));
    await assertSucceeds(confirm('dorvan', 'raid'));
  });

  it('membro não cancela a presença de outra pessoa', async () => {
    await assertFails(deleteDoc(attendee('tavia', 'raid', 'dorvan')));
  });

  it('administrador cancela a presença de qualquer confirmado', async () => {
    await assertSucceeds(deleteDoc(attendee('ana', 'raid', 'dorvan')));
  });

  it('nem o administrador cancela depois que o evento começou ou foi cancelado', async () => {
    await assertFails(deleteDoc(attendee('ana', 'antigo', 'dorvan')));
    await assertFails(deleteDoc(attendee('ana', 'cancelado', 'dorvan')));
  });

  it('não cancela depois que o evento começou ou foi cancelado', async () => {
    await assertFails(deleteDoc(attendee('dorvan', 'antigo')));
    await assertFails(deleteDoc(attendee('dorvan', 'cancelado')));
  });

  it('conta desativada não altera presenças', async () => {
    await assertFails(deleteDoc(attendee('brenna', 'raid')));
  });
});
