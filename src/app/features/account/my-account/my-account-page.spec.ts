import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { AccessLevel } from '../../../core/auth/access';
import { provideSessionStub } from '../../../core/auth/session.stub';
import { AccountSettingsPanel } from './account-settings-panel';
import { ApplicationStatusPanel } from './application-status';
import { CharactersPanel } from './characters-panel';
import { DeleteAccountPanel } from './delete-account-panel';
import { MyAccountPage } from './my-account-page';

@Component({ selector: 'app-characters-panel', template: 'personagens' })
class CharactersFake {}
@Component({ selector: 'app-application-status', template: 'candidatura' })
class ApplicationFake {}
@Component({ selector: 'app-account-settings-panel', template: 'dados' })
class SettingsFake {}
@Component({ selector: 'app-delete-account-panel', template: 'excluir' })
class DeleteFake {}

async function render(access: AccessLevel) {
  TestBed.configureTestingModule({
    imports: [MyAccountPage],
    providers: [provideSessionStub(access).provider],
  });
  TestBed.overrideComponent(MyAccountPage, {
    remove: {
      imports: [CharactersPanel, ApplicationStatusPanel, AccountSettingsPanel, DeleteAccountPanel],
    },
    add: { imports: [CharactersFake, ApplicationFake, SettingsFake, DeleteFake] },
  });
  const fixture = TestBed.createComponent(MyAccountPage);
  await fixture.whenStable();
  return (fixture.nativeElement as HTMLElement).textContent ?? '';
}

describe('MyAccountPage', () => {
  it('conta pendente vê a candidatura e os dados da conta', async () => {
    const text = await render('pending');
    expect(text).toContain('candidatura');
    expect(text).toContain('dados');
    expect(text).not.toContain('personagens');
    expect(text).toContain('excluir');
  });

  it('membro e administrador veem os personagens e os dados da conta', async () => {
    for (const access of ['member', 'admin'] as const) {
      TestBed.resetTestingModule();
      const text = await render(access);
      expect(text).toContain('personagens');
      expect(text).toContain('dados');
      expect(text).not.toContain('candidatura');
    }
  });

  it('exclusão em andamento: mostra somente a conclusão da exclusão', async () => {
    const text = await render('deleting');
    expect(text).toContain('excluir');
    expect(text).not.toContain('personagens');
    expect(text).not.toContain('candidatura');
    expect(text).not.toContain('dados');
  });
});
