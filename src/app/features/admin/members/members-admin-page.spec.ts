import { TestBed, type ComponentFixture } from '@angular/core/testing';
import type { Permission } from '../../../core/auth/access';
import { provideSessionStub } from '../../../core/auth/session.stub';
import type { MemberActionResult, MemberRow } from '../../../core/data/members-admin';
import { MembersAdminService } from '../../../core/data/members-admin.service';
import { ConfirmService } from '../../../shared/ui/confirm-dialog/confirm.service';
import { MembersAdminPage } from './members-admin-page';

class MembersStub {
  next: ((rows: MemberRow[]) => void) | null = null;
  result: MemberActionResult = { ok: true };
  roles: [string, Permission][] = [];
  deactivated: string[] = [];
  reactivated: string[] = [];
  watch(next: (rows: MemberRow[]) => void) {
    this.next = next;
    return () => undefined;
  }
  changeRole(uid: string, role: Permission) {
    this.roles.push([uid, role]);
    return Promise.resolve(this.result);
  }
  deactivate(uid: string) {
    this.deactivated.push(uid);
    return Promise.resolve(this.result);
  }
  reactivate(uid: string) {
    this.reactivated.push(uid);
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

const row = (uid: string, name: string, over: Partial<MemberRow> = {}): MemberRow => ({
  uid,
  username: uid,
  email: `${uid}@x.com`,
  status: 'ativo',
  role: 'membro',
  mainCharacter: {
    game: 'retail',
    characterName: name,
    server: 'Azralon',
    characterClass: 'guerreiro',
    characterRole: 'tanque',
  },
  ...over,
});

let fixture: ComponentFixture<MembersAdminPage>;
let el: HTMLElement;
let members: MembersStub;
let confirm: ConfirmStub;

beforeEach(async () => {
  members = new MembersStub();
  confirm = new ConfirmStub();
  TestBed.configureTestingModule({
    imports: [MembersAdminPage],
    providers: [
      { provide: MembersAdminService, useValue: members },
      { provide: ConfirmService, useValue: confirm },
      provideSessionStub('admin').provider,
    ],
  });
  fixture = TestBed.createComponent(MembersAdminPage);
  el = fixture.nativeElement;
  await fixture.whenStable();
});

async function emit(rows: MemberRow[]) {
  members.next!(rows);
  await fixture.whenStable();
}

const names = () =>
  [...el.querySelectorAll('.members-table__name')].map((n) =>
    n.textContent?.replace(/\s+/g, ' ').trim(),
  );
const rowOf = (name: string) =>
  [...el.querySelectorAll('tbody tr')].find((tr) =>
    tr.querySelector('.members-table__name')?.textContent?.includes(name),
  )!;

async function changeSelect(name: string, value: Permission) {
  const select = rowOf(name).querySelector('select')!;
  select.value = value;
  select.dispatchEvent(new Event('change'));
  await fixture.whenStable();
  return select;
}

const guild = () => [
  row('me', 'Maren', { role: 'admin' }),
  row('dorvan', 'Dorvan', {
    mainCharacter: {
      game: 'retail',
      characterName: 'Dorvan',
      server: 'Azralon',
      characterClass: 'sacerdote',
      characterRole: 'cura',
    },
  }),
  row('tavia', 'Tavia', { status: 'desativado' }),
];

describe('MembersAdminPage (Gerenciar membros e permissões)', () => {
  it('lista membros com personagem, situação e permissão', async () => {
    await emit(guild());
    expect([...el.querySelectorAll('thead th')].map((t) => t.textContent?.trim())).toEqual([
      'Personagem',
      'Situação',
      'Permissão',
      'Ações',
    ]);
    expect(names()).toEqual(['Maren (você)', 'Dorvan', 'Tavia']);
    expect(rowOf('Dorvan').textContent).toContain('Sacerdote, cura · Retail');
    expect(rowOf('Dorvan').querySelector('select')!.value).toBe('membro');
    expect(rowOf('Tavia').textContent).toContain('Desativado');
    expect(rowOf('Tavia').querySelector('select')).toBeNull();
    expect(rowOf('Tavia').textContent).toContain('Sem permissão enquanto desativado');
  });

  it('busca por nome', async () => {
    await emit(guild());
    const input = el.querySelector<HTMLInputElement>('#membros-busca')!;
    expect(el.querySelector('label[for="membros-busca"]')?.textContent?.trim()).toBe(
      'Buscar por nome',
    );
    input.value = 'dor';
    input.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    expect(names()).toEqual(['Dorvan']);

    input.value = 'ninguém';
    input.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    expect(el.textContent).toContain('Nenhum membro encontrado');
  });

  it('torna um membro administrador após confirmação', async () => {
    await emit(guild());
    await changeSelect('Dorvan', 'admin');
    expect(confirm.asked).toEqual(['Tornar administrador?']);
    expect(members.roles).toEqual([['dorvan', 'admin']]);
    expect(el.textContent).toContain('Dorvan agora é administrador.');
  });

  it('cancelar a confirmação desfaz a escolha no seletor', async () => {
    await emit(guild());
    confirm.answer = false;
    const select = await changeSelect('Dorvan', 'admin');
    expect(members.roles).toEqual([]);
    expect(select.value).toBe('membro');
  });

  it('desativa um membro somente após confirmação', async () => {
    await emit(guild());
    const button = rowOf('Dorvan').querySelector('button')!;
    expect(button.textContent?.replace(/\s+/g, ' ').trim()).toBe('Desativar Dorvan');
    confirm.answer = false;
    button.click();
    await fixture.whenStable();
    expect(members.deactivated).toEqual([]);
    confirm.answer = true;
    button.click();
    await fixture.whenStable();
    expect(confirm.asked).toEqual(['Desativar membro?', 'Desativar membro?']);
    expect(members.deactivated).toEqual(['dorvan']);
  });

  it('reativa um membro desativado somente após confirmação', async () => {
    await emit(guild());
    const button = rowOf('Tavia').querySelector('button')!;
    expect(button.textContent?.replace(/\s+/g, ' ').trim()).toBe('Reativar Tavia');
    confirm.answer = false;
    button.click();
    await fixture.whenStable();
    expect(members.reactivated).toEqual([]);
    confirm.answer = true;
    button.click();
    await fixture.whenStable();
    expect(confirm.asked.at(-1)).toBe('Reativar membro?');
    expect(members.reactivated).toEqual(['tavia']);
    expect(el.textContent).toContain('Tavia foi reativado, com permissão de membro.');
  });

  it('o único administrador ativo não pode perder a permissão nem ser desativado', async () => {
    await emit(guild());
    const maren = rowOf('Maren');
    expect(maren.querySelector('select')!.disabled).toBe(true);
    expect(maren.querySelector('button')!.disabled).toBe(true);
    expect(maren.querySelector('button')!.getAttribute('aria-describedby')).toBe('ultimo-admin');
    expect(el.querySelector('#ultimo-admin')?.textContent).toContain('único administrador');
  });

  it('com dois administradores, ambos podem ser alterados', async () => {
    await emit([...guild(), row('bia', 'Bia', { role: 'admin' })]);
    expect(rowOf('Maren').querySelector('select')!.disabled).toBe(false);
    expect(el.querySelector('#ultimo-admin')).toBeNull();
  });

  it('mostra o erro de último administrador vindo do servidor', async () => {
    await emit([...guild(), row('bia', 'Bia', { role: 'admin' })]);
    members.result = { ok: false, error: 'last-admin' };
    const select = await changeSelect('Bia', 'membro');
    expect(el.querySelector('[role="alert"]')?.textContent).toContain(
      'ao menos um administrador ativo',
    );
    expect(select.value).toBe('admin');
  });
});
