import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { beforeEach, describe, it } from 'vitest';
import { account, asUser, asVisitor, seed, useRulesEnv } from './env';

const env = useRulesEnv();

const DAY = 86_400_000;
const future = () => new Date(Date.now() + 3 * DAY);
const past = () => new Date(Date.now() - DAY);

const content = (over: Record<string, unknown> = {}) => ({
  title: 'Raid semanal',
  startsAt: future(),
  description: '[DESCRIÇÃO DO EVENTO]',
  organizer: 'Maren',
  ...over,
});

const newEvent = (uid: string, over: Record<string, unknown> = {}) => ({
  ...content(),
  status: 'ativo',
  createdBy: uid,
  createdAt: serverTimestamp(),
  updatedAt: serverTimestamp(),
  ...over,
});

const stored = (over: Record<string, unknown> = {}) => ({
  ...content(),
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
    'users/kaelen': account('kaelen'),
    'users/brenna': account('brenna', { status: 'desativado' }),
    'events/raid': stored(),
    'events/antigo': stored({ startsAt: past() }),
    'events/cancelado': stored({ status: 'cancelado' }),
  }),
);

const events = (uid: string) => collection(asUser(env(), uid), 'events');
const event = (uid: string, id: string) => doc(asUser(env(), uid), 'events', id);

describe('Ler eventos', () => {
  it('membros ativos e administradores leem e listam', async () => {
    await assertSucceeds(getDocs(events('tavia')));
    await assertSucceeds(getDoc(event('ana', 'raid')));
  });

  it('visitante, conta pendente e conta desativada não leem', async () => {
    await assertFails(getDocs(collection(asVisitor(env()), 'events')));
    await assertFails(getDoc(event('kaelen', 'raid')));
    await assertFails(getDocs(events('brenna')));
  });
});

describe('Criar evento', () => {
  it('administrador cria evento futuro', async () => {
    await assertSucceeds(addDoc(events('ana'), newEvent('ana')));
  });

  it('membro não cria', async () => {
    await assertFails(addDoc(events('tavia'), newEvent('tavia')));
  });

  it('não aceita data e horário no passado', async () => {
    await assertFails(addDoc(events('ana'), newEvent('ana', { startsAt: past() })));
  });

  it('exige título, descrição e organizador preenchidos', async () => {
    for (const field of ['title', 'description', 'organizer']) {
      await assertFails(addDoc(events('ana'), newEvent('ana', { [field]: '   ' })));
      const missing = newEvent('ana');
      delete (missing as Record<string, unknown>)[field];
      await assertFails(addDoc(events('ana'), missing));
    }
  });

  it('limita o tamanho dos textos', async () => {
    await assertFails(addDoc(events('ana'), newEvent('ana', { title: 'x'.repeat(81) })));
    await assertFails(addDoc(events('ana'), newEvent('ana', { organizer: 'x'.repeat(41) })));
    await assertFails(addDoc(events('ana'), newEvent('ana', { description: 'x'.repeat(2001) })));
  });

  it('nasce ativo, com autor e datas do servidor, sem campos extras', async () => {
    await assertFails(addDoc(events('ana'), newEvent('ana', { status: 'cancelado' })));
    await assertFails(addDoc(events('ana'), newEvent('ana', { createdBy: 'tavia' })));
    await assertFails(addDoc(events('ana'), newEvent('ana', { createdAt: new Date() })));
    await assertFails(addDoc(events('ana'), newEvent('ana', { attendees: [] })));
  });
});

describe('Editar evento', () => {
  const edit = (uid: string, id: string, over: Record<string, unknown> = {}) =>
    updateDoc(event(uid, id), {
      title: 'Raid semanal (heroico)',
      updatedAt: serverTimestamp(),
      updatedBy: uid,
      ...over,
    });

  it('administrador edita título, data, horário, descrição e organizador', async () => {
    await assertSucceeds(
      edit('ana', 'raid', {
        startsAt: new Date(Date.now() + 5 * DAY),
        description: 'Nova descrição',
        organizer: 'Dorvan',
      }),
    );
  });

  it('membro não edita', async () => {
    await assertFails(edit('tavia', 'raid'));
  });

  it('não move o evento para o passado', async () => {
    await assertFails(edit('ana', 'raid', { startsAt: past() }));
  });

  it('não edita evento passado ou cancelado', async () => {
    await assertFails(edit('ana', 'antigo'));
    await assertFails(edit('ana', 'cancelado'));
  });

  it('não altera a situação nem o autor pela edição', async () => {
    await assertFails(edit('ana', 'raid', { status: 'cancelado' }));
    await assertFails(edit('ana', 'raid', { createdBy: 'tavia' }));
  });

  it('não esvazia campos obrigatórios', async () => {
    await assertFails(edit('ana', 'raid', { title: '' }));
  });
});

describe('Cancelar evento', () => {
  const cancel = (uid: string, id: string, over: Record<string, unknown> = {}) =>
    updateDoc(event(uid, id), {
      status: 'cancelado',
      cancelledAt: serverTimestamp(),
      cancelledBy: uid,
      ...over,
    });

  it('administrador cancela um evento futuro, que continua existindo', async () => {
    await assertSucceeds(cancel('ana', 'raid'));
    await assertSucceeds(getDoc(event('tavia', 'raid')));
  });

  it('membro não cancela', async () => {
    await assertFails(cancel('tavia', 'raid'));
  });

  it('não cancela evento passado nem reativa um cancelado', async () => {
    await assertFails(cancel('ana', 'antigo'));
    await assertFails(updateDoc(event('ana', 'cancelado'), { status: 'ativo' }));
  });

  it('registra quem cancelou e quando', async () => {
    await assertFails(cancel('ana', 'raid', { cancelledBy: 'tavia' }));
    await assertFails(cancel('ana', 'raid', { cancelledAt: new Date() }));
  });

  it('não muda outros campos junto com o cancelamento', async () => {
    await assertFails(cancel('ana', 'raid', { title: 'Outro' }));
  });

  it('ninguém apaga eventos', async () => {
    await assertFails(deleteDoc(event('ana', 'raid')));
  });

  it('ninguém grava evento com ID escolhido fora das regras de criação', async () => {
    await assertFails(setDoc(event('tavia', 'novo'), newEvent('tavia')));
  });
});
