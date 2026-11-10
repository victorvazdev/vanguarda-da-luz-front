import { navItemsFor, showsSignOut } from './nav';

const labels = (access: Parameters<typeof navItemsFor>[0]) =>
  navItemsFor(access).map((i) => i.label);

describe('navItemsFor', () => {
  it('visitante vê as páginas públicas, o calendário, Entrar e Fazer parte', () => {
    expect(labels('visitor')).toEqual([
      'A guilda',
      'Como ingressar',
      'Regras',
      'Calendário',
      'Entrar',
      'Fazer parte',
    ]);
  });

  it('pendente vê Calendário e Minha conta', () => {
    expect(labels('pending')).toEqual(['Calendário', 'Minha conta']);
  });

  it('membro vê Calendário e Minha conta, e não vê Administração', () => {
    expect(labels('member')).toEqual(['Calendário', 'Minha conta']);
  });

  it('somente admin vê Administração', () => {
    expect(labels('admin')).toEqual(['Calendário', 'Minha conta', 'Administração']);
    for (const access of ['visitor', 'pending', 'member', 'blocked', 'loading'] as const) {
      expect(labels(access)).not.toContain('Administração');
    }
  });

  it('não mostra itens enquanto a sessão carrega', () => {
    expect(labels('loading')).toEqual([]);
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
  it('mostra somente Minha conta', () => {
    expect(navItemsFor('deleting').map((i) => i.label)).toEqual(['Minha conta']);
  });
});
