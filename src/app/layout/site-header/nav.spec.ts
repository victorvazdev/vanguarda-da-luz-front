import type { AccessLevel } from '../../core/auth/access';
import { navItemsFor, showsSignOut } from './nav';

const labels = (access: Parameters<typeof navItemsFor>[0]) =>
  navItemsFor(access).map((i) => i.label);

describe('navItemsFor', () => {
  it('visitante vê as páginas públicas, o calendário, Entrar, o addon e Fazer parte', () => {
    expect(labels('visitor')).toEqual([
      'A guilda',
      'Como ingressar',
      'Regras',
      'Calendário',
      'Entrar',
      'Baixar addon',
      'Fazer parte',
    ]);
  });

  it('pendente vê Calendário, Minha conta e o addon', () => {
    expect(labels('pending')).toEqual(['Calendário', 'Minha conta', 'Baixar addon']);
  });

  it('membro vê Calendário, Minha conta e o addon, e não vê Administração', () => {
    expect(labels('member')).toEqual(['Calendário', 'Minha conta', 'Baixar addon']);
  });

  it('somente admin vê Administração', () => {
    expect(labels('admin')).toEqual([
      'Calendário',
      'Minha conta',
      'Administração',
      'Baixar addon',
    ]);
    for (const access of ['visitor', 'pending', 'member', 'blocked', 'loading'] as const) {
      expect(labels(access)).not.toContain('Administração');
    }
  });

  it('enquanto a sessão carrega, mostra só o addon', () => {
    expect(labels('loading')).toEqual(['Baixar addon']);
  });

  it('o addon aparece em destaque para todos os perfis', () => {
    const all: AccessLevel[] = [
      'loading',
      'visitor',
      'blocked',
      'pending',
      'member',
      'admin',
      'deleting',
    ];
    for (const access of all) {
      const addon = navItemsFor(access).filter((i) => i.path === '/addon');
      expect(addon).toEqual([{ label: 'Baixar addon', path: '/addon', kind: 'highlight' }]);
    }
  });
});

describe('showsSignOut', () => {
  it('só aparece para contas logadas com acesso', () => {
    expect(showsSignOut('visitor')).toBe(false);
    expect(showsSignOut('loading')).toBe(false);
    expect(showsSignOut('pending')).toBe(true);
    expect(showsSignOut('member')).toBe(true);
    expect(showsSignOut('admin')).toBe(true);
    expect(showsSignOut('deleting')).toBe(true);
  });
});

describe('navItemsFor (exclusão em andamento)', () => {
  it('mostra somente Minha conta e o addon', () => {
    expect(navItemsFor('deleting').map((i) => i.label)).toEqual(['Minha conta', 'Baixar addon']);
  });
});
