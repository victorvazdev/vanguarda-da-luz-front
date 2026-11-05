import { FormControl, Validators } from '@angular/forms';
import { firstError } from './field-errors';

describe('firstError', () => {
  const messages = { required: 'Obrigatório.', minlength: 'Curto.', mismatch: 'Diferente.' };

  it('retorna null para controle válido', () => {
    expect(firstError(new FormControl('ok'), messages)).toBeNull();
  });

  it('respeita a ordem das mensagens', () => {
    const control = new FormControl('', [Validators.required]);
    expect(firstError(control, messages)).toBe('Obrigatório.');
  });

  it('considera erros extras (ex.: do grupo)', () => {
    expect(firstError(new FormControl('x'), messages, { mismatch: true })).toBe('Diferente.');
  });
});
