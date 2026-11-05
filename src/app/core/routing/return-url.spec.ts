import { safeReturnUrl } from './return-url';

describe('safeReturnUrl', () => {
  it('aceita caminhos internos', () => {
    expect(safeReturnUrl('/calendario')).toBe('/calendario');
    expect(safeReturnUrl('/eventos/abc?x=1')).toBe('/eventos/abc?x=1');
  });

  it.each([
    undefined,
    null,
    '',
    'https://malicioso.com',
    '//malicioso.com',
    '/\\malicioso.com',
    'calendario',
  ])('recusa %s', (url) => {
    expect(safeReturnUrl(url)).toBeNull();
  });

  it('ignora as próprias telas de conta', () => {
    expect(safeReturnUrl('/entrar')).toBeNull();
    expect(safeReturnUrl('/cadastro?x=1')).toBeNull();
  });
});
