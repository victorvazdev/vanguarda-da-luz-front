import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import type { RestoreResult, StoredBackup } from '../../../core/data/addon-backup';
import type { CharacterState } from '../../../core/data/addon-backup-state';
import { AddonBackupService } from '../../../core/data/addon-backup.service';
import { AddonDataPage, formatDuration } from './addon-data-page';

const T = 1_794_400_000;

const state: CharacterState = {
  professions: {
    'Victor Vaz': {
      updatedAt: T,
      professions: [
        { id: 164, level: 225, max: 300, name: 'Ferraria' },
        { id: 186, level: 230, max: 300, name: 'Mineração' },
      ],
    },
  },
  itemLevels: {
    'Victor Vaz': { updatedAt: T, itemLevel: 31, main: 'Victor Vaz' },
    'Victor Alt': { updatedAt: T, itemLevel: 12, main: 'Victor Vaz' },
    'Maren Luz': { updatedAt: T, itemLevel: 28, main: '' },
  },
  together: { 'Victor Vaz': 36000, 'Victor Alt': 1800, 'Árya Ñúñez': 5400 },
};

const stored: StoredBackup = {
  id: '1794420000-1',
  text: 'VDLB1:1:original',
  generatedAt: 1_794_420_000,
  exportNumber: 0,
  generatedBy: 'Victor Vaz',
  appliedAt: new Date('2026-11-12T12:00:00Z'),
  appliedBy: 'uid',
  appliedByName: 'maren',
  report: {
    events: [
      {
        id: 'G7cQx2LmP9aRt4VbN1sK',
        origin: 'jogo',
        title: 'Treino de PvP',
        startsAt: 1_794_870_000,
        changedBy: 'Victor Vaz',
        updatedAt: 1_794_415_000,
        action: 'create',
        reason: null,
        changed: [],
      },
    ],
    presences: [],
    professions: { total: 1, newer: 1 },
    itemLevels: { total: 3, newer: 3 },
    together: { total: 3, newer: 3 },
  },
};

class BackupStub {
  includeOld: boolean[] = [];
  characters = () => Promise.resolve(state);
  history = () => Promise.resolve([stored]);
  restoreString(includeOld: boolean): Promise<RestoreResult> {
    this.includeOld.push(includeOld);
    return Promise.resolve({
      text: 'VDLB1:9:restaurar',
      characters: 4,
      presenceEvents: 2,
      tooLong: false,
    });
  }
}

let fixture: ComponentFixture<AddonDataPage>;
let el: HTMLElement;
let service: BackupStub;
let copied: string[];

beforeEach(async () => {
  service = new BackupStub();
  copied = [];
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText: (text: string) => (copied.push(text), Promise.resolve()) },
  });
  TestBed.configureTestingModule({
    imports: [AddonDataPage],
    providers: [provideRouter([]), { provide: AddonBackupService, useValue: service }],
  });
  fixture = TestBed.createComponent(AddonDataPage);
  el = fixture.nativeElement;
  await fixture.whenStable();
});

const normalized = (v: string | null | undefined) => v?.replace(/\s+/g, ' ').trim() ?? '';
const rows = (caption: string) =>
  [...el.querySelectorAll('table')]
    .find((t) => normalized(t.querySelector('caption')?.textContent).startsWith(caption))!
    .querySelectorAll('tbody tr');
const cells = (row: Element) =>
  [...row.querySelectorAll('th, td')].map((c) => normalized(c.textContent));
const button = (label: string) =>
  [...el.querySelectorAll<HTMLButtonElement>('button')].find(
    (b) => normalized(b.textContent) === label,
  )!;

describe('AddonDataPage', () => {
  it('mostra personagens com main/alt, item level e profissões', () => {
    const list = [...rows('Profissões')].map(cells);
    // Ordem alfabética do português: "Árya" antes de "Maren".
    expect(list.map((r) => r.slice(0, 4))).toEqual([
      ['Árya Ñúñez', 'Não definido', '—', '—'],
      ['Maren Luz', 'Não definido', '28', '—'],
      ['Victor Alt', 'Alt de Victor Vaz', '12', '—'],
      ['Victor Vaz', 'Main', '31', 'Ferraria 225/300, Mineração 230/300'],
    ]);
  });

  it('soma o tempo dos alts no main', () => {
    expect([...rows('Tempo')].map(cells)).toEqual([
      ['Victor Vaz', 'Victor Alt', '10 h 30 min'],
      ['Árya Ñúñez', '—', '1 h 30 min'],
    ]);
  });

  it('filtra por nome, sem acentos e incluindo os alts do main', async () => {
    const input = el.querySelector<HTMLInputElement>('#dados-filtro')!;
    input.value = 'arya';
    input.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    expect([...rows('Profissões')].map((r) => cells(r)[0])).toEqual(['Árya Ñúñez']);
    input.value = 'victor vaz';
    input.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    expect([...rows('Profissões')].map((r) => cells(r)[0])).toEqual(['Victor Alt', 'Victor Vaz']);
  });

  it('gera e copia a string de restauração', async () => {
    button('Copiar string para restaurar').click();
    await fixture.whenStable();
    expect(service.includeOld).toEqual([false]);
    expect(copied).toEqual(['VDLB1:9:restaurar']);
    expect(normalized(el.textContent)).toContain('String copiada.');
    expect(el.querySelector<HTMLTextAreaElement>('#restaurar-string')!.value).toBe(
      'VDLB1:9:restaurar',
    );

    const check = el.querySelector<HTMLInputElement>('#restaurar-antigas')!;
    check.checked = true;
    check.dispatchEvent(new Event('change'));
    await fixture.whenStable();
    button('Copiar string para restaurar').click();
    await fixture.whenStable();
    expect(service.includeOld).toEqual([false, true]);
  });

  it('lista o histórico com o relatório e copia a string original', async () => {
    const text = normalized(el.textContent);
    expect(text).toContain('Backups aplicados (1)');
    expect(text).toContain('por maren');
    expect(text).toContain('Treino de PvP Criado');
    button('Copiar string original').click();
    await fixture.whenStable();
    expect(copied).toEqual(['VDLB1:1:original']);
    expect(normalized(el.textContent)).toContain('String original copiada.');
  });
});

describe('formatDuration', () => {
  it('formata horas e minutos', () => {
    expect(formatDuration(59)).toBe('0 min');
    expect(formatDuration(3600 * 1234 + 60 * 5)).toBe('1.234 h 05 min');
  });
});
