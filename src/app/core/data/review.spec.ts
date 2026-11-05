import type { Application } from './applications';
import { buildQueue } from './review';

const app = (uid: string, submittedAt: string): Application => ({
  uid,
  game: 'retail',
  characterName: uid,
  characterSurname: null,
  server: 'Azralon',
  ruleset: null,
  characterClass: 'mago',
  characterRole: 'dano',
  professions: null,
  battleTag: null,
  motivation: 'x',
  status: 'pendente',
  submittedAt: new Date(submittedAt),
  decidedBy: null,
  decidedAt: null,
  history: [],
});

const acc = (uid: string, createdAt: string) => ({
  uid,
  username: uid,
  email: `${uid}@x.com`,
  battleTag: null,
  createdAt: new Date(createdAt),
});

describe('buildQueue', () => {
  it('liga cada conta à sua candidatura, pendentes primeiro e mais recentes antes', () => {
    const queue = buildQueue(
      [acc('sem', '2026-11-01'), acc('nova', '2026-11-01'), acc('antiga', '2026-11-01')],
      [app('nova', '2026-11-04'), app('antiga', '2026-11-02')],
    );
    expect(queue.map((q) => [q.uid, !!q.application])).toEqual([
      ['nova', true],
      ['antiga', true],
      ['sem', false],
    ]);
  });

  it('candidatura recusada não entra na fila de avaliação, mas a recusa fica indicada', () => {
    const decidedAt = new Date('2026-11-05');
    const [item] = buildQueue(
      [acc('recusado', '2026-11-01')],
      [{ ...app('recusado', '2026-11-02'), status: 'recusada', decidedAt }],
    );
    expect(item.application).toBeNull();
    expect(item.rejectedAt).toEqual(decidedAt);
  });

  it('ignora candidatura de conta que não está pendente', () => {
    expect(buildQueue([], [app('x', '2026-11-04')])).toEqual([]);
  });
});
