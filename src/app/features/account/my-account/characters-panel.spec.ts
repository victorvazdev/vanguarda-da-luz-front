import { TestBed, type ComponentFixture } from '@angular/core/testing';
import type { Character, CharacterInput, CharacterResult } from '../../../core/data/characters';
import { CharactersService } from '../../../core/data/characters.service';
import {
  ConfirmService,
  type ConfirmOptions,
} from '../../../shared/ui/confirm-dialog/confirm.service';
import { CharactersPanel } from './characters-panel';

class CharactersStub {
  next: ((list: Character[]) => void) | null = null;
  stopped = false;
  result: CharacterResult = { ok: true, id: 'c9' };
  saved: [string | null, CharacterInput, boolean][] = [];
  mains: string[] = [];
  removed: (string | null)[] = [];
  watchMine(next: (list: Character[]) => void) {
    this.next = next;
    return () => (this.stopped = true);
  }
  save(id: string | null, input: CharacterInput, asMain: boolean) {
    this.saved.push([id, input, asMain]);
    return Promise.resolve(this.result);
  }
  setMain(id: string) {
    this.mains.push(id);
    return Promise.resolve(this.result);
  }
  remove(c: Pick<Character, 'id'>) {
    this.removed.push(c.id);
    return Promise.resolve(this.result);
  }
}

class ConfirmStub {
  answer = true;
  asked: ConfirmOptions[] = [];
  ask(options: ConfirmOptions) {
    this.asked.push(options);
    return Promise.resolve(this.answer);
  }
}

const character = (over: Partial<Character> = {}): Character => ({
  id: 'c1',
  game: 'retail',
  characterName: 'Elaris',
  characterSurname: null,
  server: 'Azralon',
  ruleset: null,
  characterClass: 'paladino',
  characterRole: 'cura',
  level: 80,
  isMain: true,
  ...over,
});

const alt = character({
  id: 'c2',
  game: 'forever',
  characterName: 'Brisa',
  characterSurname: 'Aurora',
  server: null,
  ruleset: 'jxj',
  characterClass: 'druida',
  characterRole: 'tanque',
  level: 42,
  isMain: false,
});

let fixture: ComponentFixture<CharactersPanel>;
let el: HTMLElement;
let stub: CharactersStub;
let confirm: ConfirmStub;

beforeEach(async () => {
  stub = new CharactersStub();
  confirm = new ConfirmStub();
  TestBed.configureTestingModule({
    imports: [CharactersPanel],
    providers: [
      { provide: CharactersService, useValue: stub },
      { provide: ConfirmService, useValue: confirm },
    ],
  });
  fixture = TestBed.createComponent(CharactersPanel);
  el = fixture.nativeElement;
  await fixture.whenStable();
});

async function emit(list: Character[]) {
  stub.next!(list);
  await fixture.whenStable();
}

const text = () => el.textContent?.replace(/\s+/g, ' ') ?? '';
const card = (key: string) => el.querySelector<HTMLElement>(`[data-character="${key}"]`)!;
const button = (root: ParentNode, label: string) =>
  [...root.querySelectorAll<HTMLButtonElement>('button')].find((b) =>
    b.textContent?.trim().startsWith(label),
  )!;

function type(id: string, value: string) {
  const input = el.querySelector<HTMLInputElement | HTMLSelectElement>(`#${id}`)!;
  input.value = value;
  input.dispatchEvent(new Event(input instanceof HTMLSelectElement ? 'change' : 'input'));
}

/** Opção de rádio pelo texto do rótulo. */
async function choose(label: string) {
  [...el.querySelectorAll<HTMLLabelElement>('label.choice')]
    .find((l) => l.textContent?.trim() === label)!
    .querySelector('input')!
    .click();
  await fixture.whenStable();
}

async function click(b: HTMLButtonElement) {
  b.click();
  await fixture.whenStable();
}

async function submit() {
  el.querySelector('.character-form')!.dispatchEvent(new Event('submit'));
  await fixture.whenStable();
}

describe('CharactersPanel (Editar perfil e personagens)', () => {
  it('lista os personagens com jogo, classe, função, nível e o principal', async () => {
    await emit([character(), alt]);
    expect(card('c1').textContent).toContain('Principal');
    expect(card('c1').textContent).toContain('Retail · Azralon · Paladino · Cura');
    expect(card('c1').textContent).toContain('Nível 80');
    expect(card('c2').textContent).toContain('Brisa Aurora');
    expect(card('c2').textContent).toContain('WoW Forever · JxJ · Druida · Tanque');
    expect(card('c2').textContent).not.toContain('Principal');
  });

  it('o principal não pode ser removido nem "tornado principal"', async () => {
    await emit([character(), alt]);
    expect(button(card('c1'), 'Remover')).toBeUndefined();
    expect(button(card('c1'), 'Tornar principal')).toBeUndefined();
    expect(button(card('c2'), 'Remover')).toBeDefined();
  });

  it('adiciona um personagem com nível dentro do limite do jogo', async () => {
    await emit([character()]);
    await click(button(el, 'Adicionar personagem'));
    await choose('World of Warcraft Forever');
    await choose('Normal');
    type('personagem-characterName', 'Brisa');
    type('personagem-characterSurname', 'Aurora');
    type('personagem-characterClass', 'druida');
    await fixture.whenStable();
    type('personagem-characterRole', 'tanque');
    type('personagem-level', '61');
    await submit();
    expect(text()).toContain('Informe um número inteiro dentro do limite.');
    expect(text()).toContain('De 1 a 60.');
    expect(stub.saved).toHaveLength(0);

    type('personagem-level', '60');
    await submit();
    expect(stub.saved).toEqual([
      [
        null,
        {
          game: 'forever',
          characterName: 'Brisa',
          characterSurname: 'Aurora',
          ruleset: 'normal',
          characterClass: 'druida',
          characterRole: 'tanque',
          level: 60,
        },
        false,
      ],
    ]);
    expect(text()).toContain('Personagem adicionado.');
    expect(el.querySelector('.character-form')).toBeNull();
  });

  it('exige os campos obrigatórios', async () => {
    await emit([character()]);
    await click(button(el, 'Adicionar personagem'));
    await submit();
    expect(text()).toContain('Selecione o jogo.');
    expect(text()).toContain('Informe o nome do personagem.');
    expect(text()).toContain('Informe o nível.');
  });

  it('edita o principal e mantém como principal', async () => {
    await emit([character()]);
    await click(button(card('c1'), 'Editar'));
    expect(el.querySelector<HTMLInputElement>('#personagem-characterName')!.value).toBe('Elaris');
    expect(el.querySelector('#personagem-asMain')).toBeNull();
    type('personagem-level', '85');
    await submit();
    expect(stub.saved[0][0]).toBe('c1');
    expect(stub.saved[0][1].level).toBe(85);
    expect(stub.saved[0][2]).toBe(true);
  });

  it('principal vindo da candidatura pede o nível e bloqueia a troca de principal', async () => {
    await emit([character({ id: null, level: null }), alt]);
    expect(text()).toContain('Informe o nível do seu personagem principal');
    expect(card('principal').textContent).toContain('Nível não informado');
    expect(button(card('c2'), 'Tornar principal').disabled).toBe(true);
    await click(button(card('c2'), 'Editar'));
    expect(el.querySelector('#personagem-asMain')).toBeNull();
  });

  it('torna principal outro personagem', async () => {
    await emit([character(), alt]);
    await click(button(card('c2'), 'Tornar principal'));
    expect(stub.mains).toEqual(['c2']);
    expect(text()).toContain('Brisa Aurora agora é o principal.');
  });

  it('remove somente após confirmação', async () => {
    await emit([character(), alt]);
    confirm.answer = false;
    await click(button(card('c2'), 'Remover'));
    expect(confirm.asked[0].title).toBe('Remover personagem?');
    expect(stub.removed).toEqual([]);

    confirm.answer = true;
    await click(button(card('c2'), 'Remover'));
    expect(stub.removed).toEqual(['c2']);
    expect(text()).toContain('Brisa Aurora foi removido.');
  });

  it('mostra o erro quando o salvamento é recusado', async () => {
    await emit([character()]);
    stub.result = { ok: false, error: 'network' };
    await click(button(card('c1'), 'Editar'));
    await submit();
    expect(el.querySelector('.character-form .form-alert')?.textContent).toContain(
      'Não foi possível conectar',
    );
  });

  it('para de acompanhar ao sair', () => {
    fixture.destroy();
    expect(stub.stopped).toBe(true);
  });
});
