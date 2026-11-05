import { TestBed, type ComponentFixture } from '@angular/core/testing';
import type { Application } from '../../../core/data/applications';
import type { DecisionResult, PendingAccount } from '../../../core/data/review';
import { ReviewService } from '../../../core/data/review.service';
import { ConfirmService } from '../../../shared/ui/confirm-dialog/confirm.service';
import { ApplicationsAdminPage } from './applications-admin-page';

class ReviewStub {
  next: ((q: PendingAccount[]) => void) | null = null;
  result: DecisionResult = { ok: true };
  approved: string[] = [];
  rejected: string[] = [];
  watchQueue(next: (q: PendingAccount[]) => void) {
    this.next = next;
    return () => undefined;
  }
  approve(uid: string) {
    this.approved.push(uid);
    return Promise.resolve(this.result);
  }
  reject(uid: string) {
    this.rejected.push(uid);
    return Promise.resolve(this.result);
  }
}

class ConfirmStub {
  answer = true;
  asked: string[] = [];
  ask(o: { title: string }) {
    this.asked.push(o.title);
    return Promise.resolve(this.answer);
  }
}

const app = (over: Partial<Application> = {}): Application => ({
  uid: 'u1',
  game: 'retail',
  characterName: 'Elaris',
  characterSurname: null,
  server: 'Azralon',
  ruleset: null,
  characterClass: 'paladino',
  characterRole: 'cura',
  professions: ['alquimia', 'herborismo'],
  battleTag: 'Elaris#1234',
  motivation: 'Quero participar das raids semanais com um grupo fixo.',
  status: 'pendente',
  submittedAt: new Date('2026-11-04T15:00:00Z'),
  decidedBy: null,
  decidedAt: null,
  history: [],
  ...over,
});

const pending = (uid: string, application: Application | null): PendingAccount => ({
  uid,
  username: uid,
  email: `${uid}@example.com`,
  battleTag: application ? 'Conta#4321' : null,
  createdAt: new Date('2026-11-01T15:00:00Z'),
  application,
  rejectedAt: null,
});

let fixture: ComponentFixture<ApplicationsAdminPage>;
let el: HTMLElement;
let review: ReviewStub;
let confirm: ConfirmStub;

beforeEach(async () => {
  review = new ReviewStub();
  confirm = new ConfirmStub();
  TestBed.configureTestingModule({
    imports: [ApplicationsAdminPage],
    providers: [
      { provide: ReviewService, useValue: review },
      { provide: ConfirmService, useValue: confirm },
    ],
  });
  fixture = TestBed.createComponent(ApplicationsAdminPage);
  el = fixture.nativeElement;
  await fixture.whenStable();
});

async function emit(queue: PendingAccount[]) {
  review.next!(queue);
  await fixture.whenStable();
}

const button = (label: string) =>
  [...el.querySelectorAll('button')].find((b) => b.textContent?.trim().startsWith(label))!;
const text = () => el.textContent?.replace(/\s+/g, ' ') ?? '';

describe('ApplicationsAdminPage (Aprovar ou recusar cadastros)', () => {
  it('lista as candidaturas pendentes com os dados para decidir', async () => {
    await emit([
      pending('elaris', app()),
      pending(
        'lioren',
        app({
          uid: 'lioren',
          game: 'forever',
          characterName: 'Lioren',
          characterSurname: 'Vale',
          server: null,
          ruleset: 'normal',
          characterClass: 'mago',
          characterRole: 'dano',
        }),
      ),
    ]);
    expect(el.querySelector('h1')?.textContent).toContain('Candidaturas pendentes: 2');
    expect(text()).toContain('Elaris');
    expect(text()).toContain('Paladino, cura');
    expect(text()).toContain('Retail · Azralon');
    expect(text()).toContain('Quero participar das raids semanais');
    expect(text()).toContain('Conta: elaris · elaris@example.com');
    expect(text()).toContain('Enviada em 4 nov. 2026');
    expect(text()).toContain('Lioren Vale');
    expect(text()).toContain('WoW Forever · ruleset Normal');
    expect(text()).toContain('BattleTag: Conta#4321');
  });

  it('candidatura antiga mostra o BattleTag guardado nela quando a conta não tem', async () => {
    await emit([{ ...pending('elaris', app({ battleTag: 'Antigo#1234' })), battleTag: null }]);
    expect(text()).toContain('BattleTag: Antigo#1234');
  });

  it('mostra cadastros sem candidatura pendente, sem ações, e diferencia quem foi recusado', async () => {
    await emit([
      pending('tavia', null),
      { ...pending('brenna', null), rejectedAt: new Date('2026-11-04T15:00:00Z') },
    ]);
    expect(text()).toContain('Nenhuma candidatura pendente.');
    expect(text()).toContain('Cadastros sem candidatura pendente: 2');
    expect(text()).toContain(
      'tavia · tavia@example.com · cadastro em 1 nov. 2026, ainda sem candidatura',
    );
    expect(text()).toContain('brenna · brenna@example.com · candidatura recusada em 4 nov. 2026');
    expect(el.querySelectorAll('button')).toHaveLength(0);
  });

  it('botões têm nome acessível com o personagem', async () => {
    await emit([pending('elaris', app())]);
    expect(button('Aprovar').textContent?.replace(/\s+/g, ' ').trim()).toBe('Aprovar Elaris');
  });

  it('aprova e informa o resultado', async () => {
    await emit([pending('elaris', app())]);
    button('Aprovar').click();
    await fixture.whenStable();
    expect(review.approved).toEqual(['elaris']);
    expect(text()).toContain('Candidatura de Elaris aprovada');
  });

  it('recusa somente após confirmação', async () => {
    await emit([pending('elaris', app())]);
    confirm.answer = false;
    button('Recusar').click();
    await fixture.whenStable();
    expect(confirm.asked).toEqual(['Recusar candidatura?']);
    expect(review.rejected).toEqual([]);

    confirm.answer = true;
    button('Recusar').click();
    await fixture.whenStable();
    expect(review.rejected).toEqual(['elaris']);
    expect(text()).toContain('Candidatura de Elaris recusada.');
  });

  it('avisa quando outro administrador já decidiu', async () => {
    await emit([pending('elaris', app())]);
    review.result = { ok: false, error: 'already-decided' };
    button('Aprovar').click();
    await fixture.whenStable();
    expect(el.querySelector('[role="alert"]')?.textContent).toContain('já foi avaliada');
  });

  it('indica candidatura reenviada após recusa', async () => {
    await emit([
      pending(
        'elaris',
        app({
          history: [
            { status: 'recusada', submittedAt: new Date(), decidedBy: 'a', decidedAt: new Date() },
          ],
        }),
      ),
    ]);
    expect(text()).toContain('recusada anteriormente 1 vez');
  });
});
