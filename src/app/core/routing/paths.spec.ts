import { joinPathFor, landingPathFor } from './paths';

describe('landingPathFor', () => {
  it('leva cada perfil à página adequada', () => {
    expect(landingPathFor('visitor')).toBe('/');
    expect(landingPathFor('pending')).toBe('/minha-conta');
    expect(landingPathFor('member')).toBe('/calendario');
    expect(landingPathFor('admin')).toBe('/calendario');
  });
});

describe('joinPathFor', () => {
  it('leva o visitante ao cadastro', () => {
    expect(joinPathFor('visitor')).toBe('/cadastro');
    expect(joinPathFor('loading')).toBe('/cadastro');
  });

  it('leva o usuário cadastrado pendente à candidatura', () => {
    expect(joinPathFor('pending')).toBe('/candidatura');
  });

  it('não oferece ingresso a quem já é membro', () => {
    expect(joinPathFor('member')).toBeNull();
    expect(joinPathFor('admin')).toBeNull();
  });
});
