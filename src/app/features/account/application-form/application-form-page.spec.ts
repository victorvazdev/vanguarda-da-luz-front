import { Component } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import type { Application, ApplicationInput, SubmitResult } from '../../../core/data/applications';
import { ApplicationsService } from '../../../core/data/applications.service';
import { stubDialog } from '../../../shared/ui/modal/dialog.stub';
import { ApplicationFormPage } from './application-form-page';

stubDialog();

@Component({ template: '' })
class Blank {}

class ApplicationsStub {
  current: Application | null = null;
  result: SubmitResult = { ok: true };
  submitted: ApplicationInput[] = [];
  mine() {
    return Promise.resolve(this.current);
  }
  submit(input: ApplicationInput) {
    this.submitted.push(input);
    return Promise.resolve(this.result);
  }
}

const rejected: Application = {
  uid: 'u1',
  game: 'forever',
  characterName: 'Elaris',
  characterSurname: 'Aurora',
  server: null,
  ruleset: 'jxj',
  characterClass: 'paladino',
  characterRole: 'cura',
  professions: ['alquimia'],
  battleTag: 'Elaris#1234',
  motivation: 'Quero raidar.',
  status: 'recusada',
  submittedAt: new Date('2026-11-02T12:00:00Z'),
  decidedBy: 'admin',
  decidedAt: new Date('2026-11-03T12:00:00Z'),
  history: [],
};

let fixture: ComponentFixture<ApplicationFormPage>;
let el: HTMLElement;
let stub: ApplicationsStub;

async function setup(configure?: (s: ApplicationsStub) => void) {
  stub = new ApplicationsStub();
  configure?.(stub);
  TestBed.configureTestingModule({
    imports: [ApplicationFormPage],
    providers: [
      provideRouter([{ path: '**', component: Blank }]),
      { provide: ApplicationsService, useValue: stub },
    ],
  });
  fixture = TestBed.createComponent(ApplicationFormPage);
  el = fixture.nativeElement;
  await fixture.whenStable();
}

const q = <T extends HTMLElement>(sel: string) => el.querySelector<T>(sel);
const errorOf = (field: string) =>
  el.querySelector(`#candidatura-${field}-erro`)?.textContent?.trim() ?? null;
const optionsOf = (field: string) =>
  [...el.querySelectorAll(`#candidatura-${field} option`)].map((o) => o.textContent?.trim());

async function set(field: string, value: string) {
  const input = q<HTMLInputElement>(`#candidatura-${field}`)!;
  input.value = value;
  input.dispatchEvent(new Event(input.tagName === 'SELECT' ? 'change' : 'input'));
  await fixture.whenStable();
}

async function choose(groupLegend: string, label: string) {
  const fieldset = [...el.querySelectorAll('fieldset')].find(
    (f) => f.querySelector('legend')?.textContent?.trim() === groupLegend,
  )!;
  const option = [...fieldset.querySelectorAll('label')].find(
    (l) => l.textContent?.trim() === label,
  )!;
  option.querySelector('input')!.click();
  await fixture.whenStable();
}

async function fillCommon() {
  await set('characterName', 'Elaris');
  await set('characterClass', 'paladino');
  await set('characterRole', 'cura');
  await choose('Profissões', 'Alquimia');
  await set('battleTag', 'Elaris#1234');
  await set('motivation', 'Quero participar das raids.');
  q<HTMLInputElement>('#candidatura-rulesAccepted')!.click();
  await fixture.whenStable();
}

async function submit() {
  q<HTMLFormElement>('form')!.dispatchEvent(new Event('submit'));
  await fixture.whenStable();
}

describe('ApplicationFormPage (Enviar candidatura)', () => {
  it('começa pedindo o jogo: World of Warcraft Retail ou Forever', async () => {
    await setup();
    const options = [...el.querySelectorAll('fieldset label')].map((l) => l.textContent?.trim());
    expect(options).toEqual(['World of Warcraft Retail', 'World of Warcraft Forever']);
    expect(optionsOf('characterClass')).toEqual(['Escolha o jogo primeiro']);
  });

  it('campos vazios exibem mensagens junto ao campo', async () => {
    await setup();
    await submit();
    expect(errorOf('game')).toBe('Selecione o jogo.');
    expect(errorOf('characterName')).toBe('Informe o nome do personagem.');
    expect(errorOf('motivation')).toBe('Conte por que você quer entrar na guilda.');
    expect(errorOf('rulesAccepted')).toBe('Confirme que leu e aceita as regras da guilda.');
    expect(errorOf('battleTag')).toBe('Informe seu BattleTag.');
    expect(errorOf('professions')).toBe(
      'Selecione as profissões ou marque que o personagem não tem profissão.',
    );
    expect(stub.submitted).toHaveLength(0);
  });

  describe('Retail', () => {
    it('pede servidor e oferece as 13 classes', async () => {
      await setup();
      await choose('Jogo', 'World of Warcraft Retail');
      expect(q('#candidatura-server')).toBeTruthy();
      expect(q('#candidatura-characterSurname')).toBeNull();
      expect(optionsOf('characterClass')).toHaveLength(14);
    });

    it('envia nome e servidor', async () => {
      await setup();
      await choose('Jogo', 'World of Warcraft Retail');
      await set('server', 'Azralon');
      await fillCommon();
      await submit();
      expect(stub.submitted).toEqual([
        {
          game: 'retail',
          characterName: 'Elaris',
          server: 'Azralon',
          characterClass: 'paladino',
          characterRole: 'cura',
          professions: ['alquimia'],
          battleTag: 'Elaris#1234',
          motivation: 'Quero participar das raids.',
        },
      ]);
      expect(TestBed.inject(Router).url).toBe('/minha-conta');
    });

    it('exige o servidor', async () => {
      await setup();
      await choose('Jogo', 'World of Warcraft Retail');
      await submit();
      expect(errorOf('server')).toBe('Informe o servidor.');
    });
  });

  describe('WoW Forever', () => {
    it('pede sobrenome e ruleset (Normal ou JxJ) no lugar do servidor', async () => {
      await setup();
      await choose('Jogo', 'World of Warcraft Forever');
      expect(q('#candidatura-characterSurname')).toBeTruthy();
      expect(q('#candidatura-server')).toBeNull();
      const rulesets = [...el.querySelectorAll('fieldset')][1];
      expect(rulesets.querySelector('legend')?.textContent?.trim()).toBe('Ruleset');
      expect([...rulesets.querySelectorAll('label')].map((l) => l.textContent?.trim())).toEqual([
        'Normal',
        'JxJ',
      ]);
    });

    it('oferece somente as 9 classes do Classic', async () => {
      await setup();
      await choose('Jogo', 'World of Warcraft Forever');
      const classes = optionsOf('characterClass');
      expect(classes).toHaveLength(10);
      expect(classes).not.toContain('Monge');
    });

    it('exige sobrenome e ruleset', async () => {
      await setup();
      await choose('Jogo', 'World of Warcraft Forever');
      await submit();
      expect(errorOf('characterSurname')).toBe('Informe o sobrenome do personagem.');
      expect(errorOf('ruleset')).toBe('Selecione o ruleset.');
    });

    it('envia nome, sobrenome e ruleset', async () => {
      await setup();
      await choose('Jogo', 'World of Warcraft Forever');
      await choose('Ruleset', 'JxJ');
      await set('characterSurname', 'Aurora');
      await fillCommon();
      await submit();
      expect(stub.submitted).toEqual([
        {
          game: 'forever',
          characterName: 'Elaris',
          characterSurname: 'Aurora',
          ruleset: 'jxj',
          characterClass: 'paladino',
          characterRole: 'cura',
          professions: ['alquimia'],
          battleTag: 'Elaris#1234',
          motivation: 'Quero participar das raids.',
        },
      ]);
    });

    it('ao trocar para o Forever, descarta classe que não existe nele', async () => {
      await setup();
      await choose('Jogo', 'World of Warcraft Retail');
      await set('characterClass', 'monge');
      await choose('Jogo', 'World of Warcraft Forever');
      expect(q<HTMLSelectElement>('#candidatura-characterClass')!.value).toBe('');
    });
  });

  it('mostra só as funções possíveis para a classe e descarta combinação inválida', async () => {
    await setup();
    await choose('Jogo', 'World of Warcraft Retail');
    await set('characterClass', 'paladino');
    await set('characterRole', 'tanque');
    await set('characterClass', 'mago');
    expect(optionsOf('characterRole')).toEqual(['Selecione', 'Dano']);
    expect(q<HTMLSelectElement>('#candidatura-characterRole')!.value).toBe('');
  });

  it('valida o nome do personagem', async () => {
    await setup();
    await set('characterName', 'Nome Com Espaço');
    await submit();
    expect(errorOf('characterName')).toContain('2 a 12 letras');
  });

  describe('BattleTag', () => {
    it.each(['Elaris', 'El#1234', 'Elaris#12', '1Elaris#1234', 'Ela ris#1234', 'Elaris#1234567'])(
      'bloqueia o envio com formato inválido: %s',
      async (value) => {
        await setup();
        await choose('Jogo', 'World of Warcraft Retail');
        await set('server', 'Azralon');
        await fillCommon();
        await set('battleTag', value);
        await submit();
        expect(errorOf('battleTag')).toContain('Nome#1234');
        expect(q('#candidatura-battleTag')!.getAttribute('aria-invalid')).toBe('true');
        expect(stub.submitted).toHaveLength(0);
      },
    );

    it('aceita letras acentuadas e números (espaços nas pontas são descartados)', async () => {
      await setup();
      await choose('Jogo', 'World of Warcraft Retail');
      await set('server', 'Azralon');
      await fillCommon();
      await set('battleTag', '  Élaris2#98765 ');
      await submit();
      expect(errorOf('battleTag')).toBeNull();
      expect(stub.submitted).toHaveLength(1);
    });
  });

  describe('Profissões', () => {
    const professionInputs = () => {
      const fieldset = [...el.querySelectorAll('fieldset')].find(
        (f) => f.querySelector('legend')?.textContent?.trim() === 'Profissões',
      )!;
      return [...fieldset.querySelectorAll<HTMLInputElement>('.choice input')];
    };

    it('lista as profissões primárias do jogo escolhido', async () => {
      await setup();
      await choose('Jogo', 'World of Warcraft Retail');
      expect(professionInputs()).toHaveLength(11);
      await choose('Jogo', 'World of Warcraft Forever');
      const labels = [...el.querySelectorAll('.choice')].map((l) => l.textContent?.trim());
      expect(professionInputs()).toHaveLength(9);
      expect(labels).not.toContain('Joalheria');
      expect(labels).not.toContain('Escrivania');
    });

    it('permite no máximo 2: as demais ficam indisponíveis', async () => {
      await setup();
      await choose('Jogo', 'World of Warcraft Retail');
      await choose('Profissões', 'Alquimia');
      await choose('Profissões', 'Herborismo');
      const disabled = professionInputs().filter((i) => i.disabled);
      expect(disabled).toHaveLength(9);
      expect(professionInputs().filter((i) => i.checked)).toHaveLength(2);
    });

    it('permite informar que o personagem não tem profissão', async () => {
      await setup();
      await choose('Jogo', 'World of Warcraft Retail');
      await set('server', 'Azralon');
      await fillCommon();
      q<HTMLInputElement>('#candidatura-professions-nenhuma')!.click();
      await fixture.whenStable();
      expect(professionInputs().some((i) => i.checked)).toBe(false);
      await submit();
      expect(stub.submitted[0].professions).toEqual([]);
    });

    it('ao trocar para o Forever, descarta profissão que não existe nele', async () => {
      await setup();
      await choose('Jogo', 'World of Warcraft Retail');
      await choose('Profissões', 'Joalheria');
      await choose('Jogo', 'World of Warcraft Forever');
      expect(professionInputs().some((i) => i.checked)).toBe(false);
      await submit();
      expect(errorOf('professions')).toContain('Selecione as profissões');
    });
  });

  describe('Regras em modal', () => {
    const rulesButton = () => q<HTMLButtonElement>('label[for="candidatura-rulesAccepted"] button')!;
    const dialog = () => q<HTMLDialogElement>('app-rules-modal dialog')!;

    async function openRules() {
      rulesButton().focus();
      rulesButton().click();
      await fixture.whenStable();
    }

    it('abre as regras completas sem sair da página e preserva o formulário', async () => {
      await setup();
      await set('characterName', 'Elaris');
      await openRules();
      expect(TestBed.inject(Router).url).toBe('/');
      expect(dialog().open).toBe(true);
      expect(dialog().querySelectorAll('ol li')).toHaveLength(10);
      expect(dialog().textContent).toContain('Fiel devoção à Aliança');
      expect(document.activeElement?.id).toBe(dialog().getAttribute('aria-labelledby'));
      expect(q<HTMLInputElement>('#candidatura-characterName')!.value).toBe('Elaris');
    });

    it('fecha pelo botão e devolve o foco ao link', async () => {
      await setup();
      await openRules();
      const close = [...dialog().querySelectorAll('button')].find(
        (b) => b.textContent?.trim() === 'Fechar',
      )!;
      close.click();
      await fixture.whenStable();
      expect(dialog().open).toBe(false);
      expect(document.activeElement).toBe(rulesButton());
    });

    it('fecha pela tecla Esc e pelo fundo', async () => {
      await setup();
      await openRules();
      dialog().dispatchEvent(new Event('cancel', { cancelable: true }));
      await fixture.whenStable();
      expect(dialog().open).toBe(false);
      expect(document.activeElement).toBe(rulesButton());

      await openRules();
      expect(dialog().open).toBe(true);
      dialog().dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await fixture.whenStable();
      expect(dialog().open).toBe(false);
    });

    it('clique dentro do conteúdo não fecha', async () => {
      await setup();
      await openRules();
      dialog().querySelector<HTMLElement>('ol')!.click();
      await fixture.whenStable();
      expect(dialog().open).toBe(true);
    });
  });

  it('com candidatura pendente, redireciona ao acompanhamento', async () => {
    await setup((s) => (s.current = { ...rejected, status: 'pendente' }));
    expect(TestBed.inject(Router).url).toBe('/minha-conta');
  });

  it('após recusa, permite reenviar partindo dos dados anteriores (inclusive do jogo)', async () => {
    await setup((s) => (s.current = rejected));
    expect(el.querySelector('h1')?.textContent).toContain('nova candidatura');
    expect(q<HTMLInputElement>('#candidatura-characterSurname')!.value).toBe('Aurora');
    expect(q<HTMLSelectElement>('#candidatura-characterRole')!.value).toBe('cura');
    expect(q<HTMLInputElement>('#candidatura-battleTag')!.value).toBe('Elaris#1234');
    expect(q<HTMLInputElement>('#candidatura-rulesAccepted')!.checked).toBe(false);
  });

  it('informa quando a conta não pode enviar', async () => {
    await setup((s) => (s.result = { ok: false, error: 'not-allowed' }));
    await choose('Jogo', 'World of Warcraft Retail');
    await set('server', 'Azralon');
    await fillCommon();
    await submit();
    expect(el.querySelector('[role="alert"]')?.textContent).toContain('Somente contas');
  });
});
