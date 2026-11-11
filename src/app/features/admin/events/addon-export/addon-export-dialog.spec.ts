import { TestBed, type ComponentFixture } from '@angular/core/testing';
import type { AddonExportResult } from '../../../../core/data/addon-export';
import { EventsService } from '../../../../core/data/events.service';
import { stubDialog } from '../../../../shared/ui/modal/dialog.stub';
import { AddonExportDialog } from './addon-export-dialog';

const generatedAt = new Date('2026-11-11T15:04:00Z'); // 12:04 em Brasília
const okResult = (
  over: Partial<Extract<AddonExportResult, { ok: true }>> = {},
): AddonExportResult => ({
  ok: true,
  text: 'VDL1:123:abcDEF',
  count: 3,
  generatedAt,
  window: {
    from: new Date('2026-11-11T03:00:00Z'),
    to: new Date('2027-01-11T03:00:00Z'),
  },
  ...over,
});

class EventsStub {
  calls: number[] = [];
  result: AddonExportResult | Error = okResult();
  exportForAddon(days: number) {
    this.calls.push(days);
    return this.result instanceof Error
      ? Promise.reject(this.result)
      : Promise.resolve(this.result);
  }
}

let fixture: ComponentFixture<AddonExportDialog>;
let el: HTMLElement;
let events: EventsStub;

beforeEach(async () => {
  stubDialog();
  events = new EventsStub();
  TestBed.configureTestingModule({
    imports: [AddonExportDialog],
    providers: [{ provide: EventsService, useValue: events }],
  });
  fixture = TestBed.createComponent(AddonExportDialog);
  el = fixture.nativeElement;
  await fixture.whenStable();
});

async function open() {
  fixture.componentInstance.open();
  await fixture.whenStable();
}

const q = <T extends HTMLElement>(sel: string) => el.querySelector<T>(sel);
const text = (sel: string) => q(sel)?.textContent?.replace(/\s+/g, ' ').trim() ?? null;
const button = (label: string) =>
  [...el.querySelectorAll<HTMLButtonElement>('button')].find(
    (b) => b.textContent?.trim() === label,
  );

async function setDays(value: string) {
  const input = q<HTMLInputElement>('#addon-dias')!;
  input.value = value;
  input.dispatchEvent(new Event('change'));
  await fixture.whenStable();
}

describe('AddonExportDialog', () => {
  it('não gera nada antes de abrir', () => {
    expect(events.calls).toEqual([]);
  });

  it('ao abrir, gera a string dos próximos 60 dias e mostra quantidade, data e instruções', async () => {
    await open();
    expect(events.calls).toEqual([60]);
    expect(text('.modal__title')).toBe('Exportar para o addon');
    const output = q<HTMLTextAreaElement>('#addon-string')!;
    expect(output.value).toBe('VDL1:123:abcDEF');
    expect(output.readOnly).toBe(true);
    expect(text('#addon-quantidade')).toBe('3 eventos incluídos');
    expect(text('#addon-gerada-em')).toBe('Qua, 11 nov. 2026, 12:04, Brasília');
    expect(text('.addon-export__facts')).toContain('11 nov. 2026 a 10 jan. 2027');
    expect([...el.querySelectorAll('.addon-export__steps li')].map((li) => li.textContent)).toEqual(
      [
        'Abra o addon da guilda no WoW Forever.',
        'Use o comando de importação do addon.',
        'Cole a string e confirme.',
      ],
    );
    expect(button('Copiar')).toBeTruthy();
  });

  it('uma exportação com 1 evento fica no singular', async () => {
    events.result = okResult({ count: 1 });
    await open();
    expect(text('#addon-quantidade')).toBe('1 evento incluído');
  });

  it('copia a string para a área de transferência', async () => {
    const copied: string[] = [];
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: (t: string) => (copied.push(t), Promise.resolve()) },
    });
    await open();
    button('Copiar')!.click();
    await fixture.whenStable();
    expect(copied).toEqual(['VDL1:123:abcDEF']);
    expect(text('.addon-export__copied')).toBe('String copiada. Cole no addon, no jogo.');
  });

  it('sem acesso à área de transferência, seleciona a string para a cópia manual', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: () => Promise.reject(new Error('negado')) },
    });
    await open();
    button('Copiar')!.click();
    await fixture.whenStable();
    expect(text('.addon-export__copied')).toContain('use Ctrl+C');
    expect(document.activeElement?.id).toBe('addon-string');
  });

  it('a janela de dias é configurável e gera de novo ao mudar', async () => {
    await open();
    await setDays('30');
    expect(events.calls).toEqual([60, 30]);
    await setDays('0');
    expect(text('#addon-dias-erro')).toBe('Use um número inteiro de 1 a 180.');
    await setDays('181');
    await setDays('2.5');
    expect(events.calls).toEqual([60, 30]);
  });

  it('acima do limite, não mostra a string e sugere reduzir a janela', async () => {
    events.result = { ok: false, error: 'too-long', length: 41_200, maxDays: 45, generatedAt };
    await open();
    expect(q('#addon-string')).toBeNull();
    expect(button('Copiar')).toBeUndefined();
    expect(text('[role="alert"]')).toBe(
      'A string ficaria com 41.200 caracteres, acima do limite de 30.000 que o addon aceita. Reduza a janela para 45 dias ou menos.',
    );
  });

  it('informa falha ao gerar e permite tentar de novo', async () => {
    events.result = new Error('offline');
    await open();
    expect(text('[role="alert"]')).toContain('Não foi possível gerar a string.');
    events.result = okResult();
    button('Tentar novamente')!.click();
    await fixture.whenStable();
    expect(q<HTMLTextAreaElement>('#addon-string')!.value).toBe('VDL1:123:abcDEF');
  });
});
