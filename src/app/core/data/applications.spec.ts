import { canSubmit, type Application } from './applications';

const app = (status: Application['status']): Application => ({
  uid: 'u',
  game: 'retail',
  characterName: 'Elaris',
  characterSurname: null,
  server: 'Azralon',
  ruleset: null,
  characterClass: 'paladino',
  characterRole: 'cura',
  motivation: 'x',
  status,
  submittedAt: new Date(),
  decidedBy: null,
  decidedAt: null,
  history: [],
});

describe('canSubmit', () => {
  it('permite a primeira candidatura e o reenvio após recusa', () => {
    expect(canSubmit(null)).toBe(true);
    expect(canSubmit(app('recusada'))).toBe(true);
  });

  it('bloqueia enquanto houver candidatura pendente ou já aprovada', () => {
    expect(canSubmit(app('pendente'))).toBe(false);
    expect(canSubmit(app('aprovada'))).toBe(false);
  });
});
