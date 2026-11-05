import { RULES } from './guild-content';

describe('RULES', () => {
  it('tem as 10 regras do protótipo e a data da última atualização', () => {
    expect(RULES.items).toHaveLength(10);
    expect(RULES.updatedAt).toBeTruthy();
  });
});
