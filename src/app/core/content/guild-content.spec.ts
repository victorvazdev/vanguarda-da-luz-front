import { RULES } from './guild-content';

describe('RULES', () => {
  it('tem as 10 regras do protótipo', () => {
    expect(RULES.items).toHaveLength(10);
  });
});
