import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { App } from './app';
import { provideSessionStub } from './core/auth/session.stub';
import { provideSiteContentStub } from './core/content/site-content.stub';

describe('App', () => {
  it('renderiza cabeçalho, conteúdo principal, rodapé e link para pular ao conteúdo', async () => {
    TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideRouter([]),
        provideSessionStub('visitor').provider,
        provideSiteContentStub().provider,
      ],
    });
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('header')).toBeTruthy();
    expect(el.querySelector('main#conteudo')).toBeTruthy();
    expect(el.querySelector('footer')).toBeTruthy();
    expect(el.querySelector('a.skip-link')?.getAttribute('href')).toBe('#conteudo');
  });
});
