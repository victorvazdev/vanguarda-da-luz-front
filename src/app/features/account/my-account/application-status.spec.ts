import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import type { Application } from '../../../core/data/applications';
import { ApplicationsService } from '../../../core/data/applications.service';
import { ApplicationStatusPanel } from './application-status';

class ApplicationsStub {
  next: ((a: Application | null) => void) | null = null;
  fail: ((e: unknown) => void) | null = null;
  stopped = false;
  watchMine(next: (a: Application | null) => void, error: (e: unknown) => void) {
    this.next = next;
    this.fail = error;
    return () => (this.stopped = true);
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
  motivation: 'x',
  status: 'pendente',
  submittedAt: new Date('2026-11-04T15:00:00Z'),
  decidedBy: null,
  decidedAt: null,
  history: [],
  ...over,
});

let fixture: ComponentFixture<ApplicationStatusPanel>;
let el: HTMLElement;
let stub: ApplicationsStub;

beforeEach(async () => {
  stub = new ApplicationsStub();
  TestBed.configureTestingModule({
    imports: [ApplicationStatusPanel],
    providers: [provideRouter([]), { provide: ApplicationsService, useValue: stub }],
  });
  fixture = TestBed.createComponent(ApplicationStatusPanel);
  el = fixture.nativeElement;
  await fixture.whenStable();
});

async function emit(a: Application | null) {
  stub.next!(a);
  await fixture.whenStable();
}

/** Valor exibido para um rótulo da lista de detalhes. */
const detail = (label: string) =>
  [...el.querySelectorAll('.details div')]
    .find((d) => d.querySelector('dt')?.textContent?.trim() === label)
    ?.querySelector('dd')
    ?.textContent?.trim() ?? null;

const text = () => el.textContent?.replace(/\s+/g, ' ') ?? '';

describe('ApplicationStatusPanel (acompanhar candidatura)', () => {
  it('mostra candidatura pendente com os dados do protótipo', async () => {
    await emit(app());
    expect(el.querySelector('.badge')?.textContent?.trim()).toBe('Pendente');
    expect(text()).toContain('Recebemos sua candidatura');
    expect(text()).toContain('Elaris');
    expect(text()).toContain('Paladino');
    expect(text()).toContain('Cura');
    expect(text()).toContain('4 nov. 2026');
    expect(detail('Jogo')).toBe('Retail');
    expect(detail('Servidor')).toBe('Azralon');
  });

  it('no WoW Forever mostra nome completo e ruleset', async () => {
    await emit(app({ game: 'forever', characterSurname: 'Aurora', server: null, ruleset: 'jxj' }));
    expect(detail('Personagem')).toBe('Elaris Aurora');
    expect(detail('Jogo')).toBe('WoW Forever');
    expect(detail('Ruleset')).toBe('JxJ');
    expect(detail('Servidor')).toBeNull();
  });

  it('mostra aprovação com acesso ao calendário', async () => {
    await emit(app({ status: 'aprovada', decidedAt: new Date('2026-11-05T15:00:00Z') }));
    expect(el.querySelector('.badge')?.textContent?.trim()).toBe('Aprovada');
    expect(el.querySelector('a[href="/calendario"]')).toBeTruthy();
    expect(text()).toContain('Avaliada em');
  });

  it('mostra recusa com a opção de tentar novamente', async () => {
    await emit(app({ status: 'recusada', decidedAt: new Date('2026-11-05T15:00:00Z') }));
    expect(el.querySelector('.badge')?.textContent?.trim()).toBe('Recusada');
    expect(el.querySelector('a[href="/candidatura"]')?.textContent).toContain(
      'Enviar nova candidatura',
    );
  });

  it('atualiza em tempo real quando o administrador decide', async () => {
    await emit(app());
    await emit(app({ status: 'aprovada' }));
    expect(el.querySelector('.badge')?.textContent?.trim()).toBe('Aprovada');
  });

  it('sem candidatura, convida a enviar', async () => {
    await emit(null);
    expect(text()).toContain('Você ainda não enviou sua candidatura');
    expect(el.querySelector('a[href="/candidatura"]')).toBeTruthy();
  });

  it('para de acompanhar ao sair da página', () => {
    fixture.destroy();
    expect(stub.stopped).toBe(true);
  });
});
