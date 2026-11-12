import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import type { ApplyResult, PreviewResult } from '../../../../core/data/presence-import';
import type { ImportPlan, SiteEvent } from '../../../../core/data/presence-import-plan';
import { PresenceImportService } from '../../../../core/data/presence-import.service';
import { PresenceImportPage } from './presence-import-page';

const event: SiteEvent = {
  id: 'raid',
  title: 'Raid: Núcleo Derretido',
  startsAt: new Date('2026-11-20T23:00:00Z'),
  status: 'ativo',
  game: 'forever',
  guestsAllowed: true,
  maxAttendees: 40,
  attendeeCount: 0,
};
const t = 1_794_412_000;

const plan = (over: Partial<ImportPlan> = {}): ImportPlan => ({
  generatedAt: 1_794_412_800,
  exportNumber: 0,
  lastGeneratedAt: null,
  outdated: false,
  events: [
    {
      eventId: 'raid',
      event,
      ignored: null,
      items: [
        {
          action: 'confirm-member',
          character: 'Victor Vaz',
          status: 1,
          updatedAt: t,
          uid: 'v',
          username: 'victor',
          characterId: null,
        },
        {
          action: 'confirm-guest',
          character: 'Árya Ñúñez',
          status: 1,
          updatedAt: t,
          guestId: 'forever:Árya:Ñúñez',
          guest: { characterName: 'Árya', characterSurname: 'Ñúñez' },
        },
        {
          action: 'cancel-member',
          character: 'Dorvan Pedra',
          status: 0,
          updatedAt: t,
          uid: 'd',
          username: 'dorvan',
        },
        {
          action: 'refused',
          character: 'Maren Luz',
          status: 1,
          updatedAt: t,
          reason: 'ambiguous',
          detail: 'maren, outra',
        },
        { action: 'unchanged', character: 'Tavia Sol', status: 1, updatedAt: t },
      ],
    },
    { eventId: 'sumiu', event: null, ignored: 'unknown', items: [] },
  ],
  ...over,
});

class ImporterStub {
  texts: string[] = [];
  applied: ImportPlan[] = [];
  previewResult: PreviewResult = { ok: true, plan: plan() };
  applyResult: ApplyResult | null = null;
  preview(text: string) {
    this.texts.push(text);
    return Promise.resolve(this.previewResult);
  }
  apply(p: ImportPlan): Promise<ApplyResult> {
    this.applied.push(p);
    return Promise.resolve(
      this.applyResult ?? {
        ok: true,
        report: {
          generatedAt: p.generatedAt,
          recorded: true,
          events: [
            {
              eventId: 'raid',
              title: event.title,
              ignored: null,
              items: [
                { ...p.events[0].items[0], outcome: { result: 'applied' } },
                { ...p.events[0].items[1], outcome: { result: 'refused', reason: 'full' } },
              ],
            },
          ],
        },
      },
    );
  }
}

let fixture: ComponentFixture<PresenceImportPage>;
let el: HTMLElement;
let importer: ImporterStub;

beforeEach(async () => {
  importer = new ImporterStub();
  TestBed.configureTestingModule({
    imports: [PresenceImportPage],
    providers: [provideRouter([]), { provide: PresenceImportService, useValue: importer }],
  });
  fixture = TestBed.createComponent(PresenceImportPage);
  el = fixture.nativeElement;
  await fixture.whenStable();
});

const normalized = (s: string | null | undefined) => s?.replace(/\s+/g, ' ').trim() ?? '';
/** Texto da página, com espaço entre os elementos (o jsdom não tem `innerText`). */
function page() {
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  const parts: string[] = [];
  while (walker.nextNode()) parts.push(walker.currentNode.textContent ?? '');
  return normalized(parts.join(' '));
}
const button = (label: string) =>
  [...el.querySelectorAll<HTMLButtonElement>('button')].find(
    (b) => normalized(b.textContent) === label,
  );

async function paste(value: string) {
  const area = el.querySelector<HTMLTextAreaElement>('#presencas-string')!;
  area.value = value;
  area.dispatchEvent(new Event('input'));
  await fixture.whenStable();
}

async function click(label: string) {
  button(label)!.click();
  await fixture.whenStable();
}

describe('PresenceImportPage', () => {
  it('pede a string antes de validar', async () => {
    await click('Validar e ver prévia');
    expect(importer.texts).toEqual([]);
    expect(page()).toContain('Cole a string de presenças gerada no jogo.');
  });

  it('mostra o motivo de uma string inválida', async () => {
    importer.previewResult = { ok: false, error: 'checksum' };
    await paste('VDLP1:1:abc');
    await click('Validar e ver prévia');
    expect(page()).toContain('A string está incompleta ou corrompida.');
    expect(el.querySelector('#presencas-string')!.getAttribute('aria-invalid')).toBe('true');
  });

  it('mostra a prévia por evento, com os recusados e o motivo', async () => {
    await paste('  VDLP1:123:abc  ');
    await click('Validar e ver prévia');
    expect(importer.texts).toEqual(['VDLP1:123:abc']);
    const text = page();
    expect(text).toContain('Raid: Núcleo Derretido');
    expect(text).toContain('Confirmações de membros (1) Victor Vaz — Membro victor');
    expect(text).toContain('Confirmações de visitantes (1) Árya Ñúñez — Visitante');
    expect(text).toContain('Cancelamentos (1) Dorvan Pedra — Membro dorvan');
    expect(text).toContain(
      'Recusados (1) Maren Luz — Mais de um membro tem um personagem com este nome (maren, outra).',
    );
    expect(text).toContain('1 registro sem alteração');
    expect(text).toContain('Evento sumiu');
    expect(text).toContain('Evento não encontrado no site. Ignorado.');
    expect(text).toContain('Última importada Nenhuma');
  });

  it('confirma e mostra o relatório do que foi aplicado', async () => {
    await paste('VDLP1:123:abc');
    await click('Validar e ver prévia');
    await click('Confirmar importação');
    expect(importer.applied).toHaveLength(1);
    const text = page();
    expect(text).toContain('Importação concluída.');
    expect(text).toContain('Membros confirmados (1) Victor Vaz — Membro victor');
    expect(text).toContain('Não aplicados (1) Árya Ñúñez — O evento está lotado.');
    await click('Importar outra string');
    expect(el.querySelector('#presencas-string')).not.toBeNull();
  });

  it('não permite aplicar uma string mais antiga que a última importada', async () => {
    importer.previewResult = {
      ok: true,
      plan: plan({ outdated: true, lastGeneratedAt: 1_794_412_800 }),
    };
    await paste('VDLP1:123:abc');
    await click('Validar e ver prévia');
    expect(page()).toContain('não é mais nova que a última importada');
    expect(button('Confirmar importação')).toBeUndefined();
  });

  it('mostra o erro da aplicação e mantém a prévia', async () => {
    importer.applyResult = { ok: false, error: 'outdated' };
    await paste('VDLP1:123:abc');
    await click('Validar e ver prévia');
    await click('Confirmar importação');
    expect(page()).toContain('Esta string não é mais nova que a última importada.');
    expect(button('Confirmar importação')).toBeDefined();
  });
});
