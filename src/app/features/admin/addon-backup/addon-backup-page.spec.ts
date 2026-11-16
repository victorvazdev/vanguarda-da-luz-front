import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import type { ApplyResult, BackupReport, PreviewResult } from '../../../core/data/addon-backup';
import type { AddonBackup, BackupEvent } from '../../../core/data/addon-backup-format';
import {
  planBackup,
  type BackupPlan,
  type BackupSiteEvent,
} from '../../../core/data/addon-backup-plan';
import { AddonBackupService } from '../../../core/data/addon-backup.service';
import { AddonBackupPage } from './addon-backup-page';

const NOW = new Date('2026-11-12T12:00:00Z');
const s = (iso: string) => Date.parse(iso) / 1000;
const GAME = s('2026-11-11T20:00:00Z');

const gameEvent = (over: Partial<BackupEvent> = {}): BackupEvent => ({
  id: 'G7cQx2LmP9aRt4VbN1sK',
  origin: 'jogo',
  title: 'Treino de PvP',
  startsAt: s('2026-11-20T23:00:00Z'),
  description: '',
  organizer: 'Victor Vaz',
  status: 'ativo',
  updatedAt: GAME,
  maxAttendees: 25,
  guestsAllowed: true,
  changedBy: 'Victor Vaz',
  ...over,
});

const siteEvent: BackupSiteEvent = {
  id: 'pL5wE1dN7sA3gF6hJ0Ko',
  title: 'Encontro da guilda',
  startsAt: new Date('2026-12-05T23:00:00Z'),
  description: 'Conversa.',
  organizer: 'Tavia',
  status: 'ativo',
  game: 'forever',
  guestsAllowed: true,
  maxAttendees: 40,
  attendeeCount: 0,
  lastChangedAt: new Date((GAME + 60) * 1000),
};

const backup: AddonBackup = {
  version: 1,
  game: 'forever',
  generatedAt: GAME + 3600,
  exportNumber: 0,
  generatedBy: 'Victor Vaz',
  events: [
    gameEvent(),
    gameEvent({
      id: siteEvent.id,
      origin: 'site',
      title: 'Encontro (velho)',
      changedBy: 'Árya Ñúñez',
    }),
    gameEvent({ id: 'Hq2mB8xY4nRcT0vKs9Ue', status: 'cancelado' }),
    // Evento do site excluído depois da alteração no jogo.
    gameEvent({ id: 'Zx9wE1dN7sA3gF6hJ0Ko', origin: 'site', title: 'Excluído no site' }),
  ],
  attendance: [
    {
      id: 'G7cQx2LmP9aRt4VbN1sK',
      records: [{ character: 'Árya Ñúñez', status: 1, updatedAt: GAME }],
    },
    { id: 'antigo', records: [{ character: 'Maren Luz', status: 1, updatedAt: GAME }] },
  ],
  professions: [{ character: 'Victor Vaz', updatedAt: GAME, professions: [] }],
  itemLevels: [],
  together: [{ character: 'Victor Vaz', seconds: 3600 }],
};

const plan = (over: Partial<BackupPlan> = {}): BackupPlan => ({
  ...planBackup(
    backup,
    {
      events: new Map([
        [siteEvent.id, { event: siteEvent, attendees: [], guests: [], cancellations: new Map() }],
      ]),
      characters: [],
      latest: null,
      same: null,
      combined: { professions: new Map(), itemLevels: new Map(), together: new Map() },
    },
    NOW,
  ),
  ...over,
});

const report = (p: BackupPlan): BackupReport => ({
  events: [
    {
      id: 'G7cQx2LmP9aRt4VbN1sK',
      origin: 'jogo',
      title: 'Treino de PvP',
      startsAt: p.backup.events[0].startsAt,
      changedBy: 'Victor Vaz',
      updatedAt: GAME,
      action: 'create',
      reason: null,
      changed: [],
    },
  ],
  presences: [
    {
      eventId: 'G7cQx2LmP9aRt4VbN1sK',
      title: 'Treino de PvP',
      startsAt: p.backup.events[0].startsAt,
      ignored: null,
      items: [
        {
          character: 'Árya Ñúñez',
          status: 1,
          updatedAt: GAME,
          action: 'confirm-guest',
          username: null,
          result: 'refused',
          reason: 'full',
          detail: null,
        },
      ],
    },
  ],
  professions: p.professions,
  itemLevels: p.itemLevels,
  together: p.together,
});

class BackupStub {
  texts: string[] = [];
  applied: [BackupPlan, string][] = [];
  previewResult: PreviewResult = { ok: true, plan: plan(), text: 'VDLB1:1:abc' };
  applyResult: ApplyResult | null = null;
  preview(text: string) {
    this.texts.push(text);
    return Promise.resolve(this.previewResult);
  }
  apply(p: BackupPlan, text: string): Promise<ApplyResult> {
    this.applied.push([p, text]);
    return Promise.resolve(this.applyResult ?? { ok: true, report: report(p), recorded: 'new' });
  }
}

let fixture: ComponentFixture<AddonBackupPage>;
let el: HTMLElement;
let service: BackupStub;

beforeEach(async () => {
  service = new BackupStub();
  TestBed.configureTestingModule({
    imports: [AddonBackupPage],
    providers: [provideRouter([]), { provide: AddonBackupService, useValue: service }],
  });
  fixture = TestBed.createComponent(AddonBackupPage);
  el = fixture.nativeElement;
  await fixture.whenStable();
});

const normalized = (v: string | null | undefined) => v?.replace(/\s+/g, ' ').trim() ?? '';
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
  const area = el.querySelector<HTMLTextAreaElement>('#backup-string')!;
  area.value = value;
  area.dispatchEvent(new Event('input'));
  await fixture.whenStable();
}

async function click(label: string) {
  button(label)!.click();
  await fixture.whenStable();
}

describe('AddonBackupPage', () => {
  it('pede a string antes de validar', async () => {
    await click('Validar e ver prévia');
    expect(service.texts).toEqual([]);
    expect(page()).toContain('Cole a string de backup gerada no jogo.');
  });

  it('mostra o motivo de uma string inválida', async () => {
    service.previewResult = { ok: false, error: 'prefix' };
    await paste('VDLP1:1:abc');
    await click('Validar e ver prévia');
    expect(page()).toContain('Isto não é uma string de backup do addon.');
    expect(el.querySelector('#backup-string')!.getAttribute('aria-invalid')).toBe('true');
  });

  it('mostra a prévia por evento, as presenças e os dados guardados', async () => {
    await paste('  VDLB1:1:abc  ');
    await click('Validar e ver prévia');
    expect(service.texts).toEqual(['VDLB1:1:abc']);
    const text = page();
    expect(text).toContain('Gerado por Victor Vaz');
    expect(text).toContain('Treino de PvP Criar');
    expect(text).toContain('Criado no jogo por Victor Vaz');
    expect(text).toContain('Encontro (velho) Conflito');
    expect(text).toContain('Alterado no jogo por Árya Ñúñez');
    expect(text).toContain('Vale o site.');
    expect(text).toContain('Ignorado');
    expect(text).toContain('criado e cancelado no jogo antes de chegar ao site');
    expect(text).toContain('Excluído no site Ignorado');
    expect(text).toContain('Evento excluído no site; a alteração do jogo foi ignorada.');
    expect(text).toContain('Confirmações de visitantes (1) Árya Ñúñez — Visitante');
    expect(text).toContain('Presenças de 1 evento ignorado');
    expect(text).toContain('Profissões 1 personagem, 1 mais recente que o guardado');
    expect(text).toContain('Item level e main 0 personagens');
  });

  it('avisa sobre backup mais antigo e backup já aplicado', async () => {
    service.previewResult = {
      ok: true,
      text: 'VDLB1:1:abc',
      plan: plan({ older: { id: 'x', generatedAt: GAME + 7200, appliedAt: NOW } }),
    };
    await paste('VDLB1:1:abc');
    await click('Validar e ver prévia');
    expect(page()).toContain('não é mais novo que o último aplicado');
    expect(button('Confirmar e aplicar')).toBeDefined();

    await click('Cancelar');
    service.previewResult = {
      ok: true,
      text: 'VDLB1:1:abc',
      plan: plan({ alreadyApplied: { id: 'x', generatedAt: GAME + 3600, appliedAt: NOW } }),
    };
    await paste('VDLB1:1:abc');
    await click('Validar e ver prévia');
    expect(page()).toContain('Este backup já foi aplicado em');
  });

  it('confirma e mostra o relatório', async () => {
    await paste('VDLB1:1:abc');
    await click('Validar e ver prévia');
    await click('Confirmar e aplicar');
    expect(service.applied).toHaveLength(1);
    expect(service.applied[0][1]).toBe('VDLB1:1:abc');
    const text = page();
    expect(text).toContain('Backup aplicado.');
    expect(text).toContain('Treino de PvP Criado');
    expect(text).toContain('Não aplicados (1) Árya Ñúñez — O evento está lotado.');
    await click('Aplicar outro backup');
    expect(el.querySelector('#backup-string')).not.toBeNull();
  });

  it('mostra o erro da aplicação e mantém a prévia', async () => {
    service.applyResult = { ok: false, error: 'network' };
    await paste('VDLB1:1:abc');
    await click('Validar e ver prévia');
    await click('Confirmar e aplicar');
    expect(page()).toContain('Não foi possível conectar');
    expect(button('Confirmar e aplicar')).toBeDefined();
  });
});
