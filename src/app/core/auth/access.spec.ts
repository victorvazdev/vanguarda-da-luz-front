import { resolveAccess, type UserAccount } from './access';

const account = (over: Partial<UserAccount> = {}): UserAccount => ({
  username: 'elaris',
  email: 'elaris@example.com',
  status: 'pendente',
  role: 'membro',
  ...over,
});

describe('resolveAccess', () => {
  it('fica carregando enquanto o Auth não respondeu', () => {
    expect(resolveAccess(undefined, undefined)).toBe('loading');
  });

  it('é visitante sem usuário autenticado', () => {
    expect(resolveAccess(null, null)).toBe('visitor');
    expect(resolveAccess(null, account({ status: 'ativo' }))).toBe('visitor');
  });

  it('fica carregando enquanto o documento da conta não chegou', () => {
    expect(resolveAccess({}, undefined)).toBe('loading');
  });

  it('trata conta sem documento como pendente (sem acesso de membro)', () => {
    expect(resolveAccess({}, null)).toBe('pending');
  });

  it('conta pendente não tem acesso de membro', () => {
    expect(resolveAccess({}, account())).toBe('pending');
  });

  it('conta ativa com permissão membro é membro', () => {
    expect(resolveAccess({}, account({ status: 'ativo' }))).toBe('member');
  });

  it('conta ativa com permissão admin é administrador', () => {
    expect(resolveAccess({}, account({ status: 'ativo', role: 'admin' }))).toBe('admin');
  });

  it('exclusão em andamento ou concluída só permite concluir a exclusão', () => {
    expect(resolveAccess({}, account({ status: 'excluindo', role: 'admin' }))).toBe('deleting');
    expect(resolveAccess({}, account({ status: 'excluido' }))).toBe('deleting');
  });

  it('conta desativada é bloqueada, mesmo se for admin', () => {
    expect(resolveAccess({}, account({ status: 'desativado', role: 'admin' }))).toBe('blocked');
  });
});
