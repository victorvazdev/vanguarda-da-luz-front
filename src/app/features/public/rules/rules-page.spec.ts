import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RulesPage } from './rules-page';

describe('RulesPage (Ler as regras)', () => {
  it('exibe regras numeradas, identificáveis e a data de atualização', async () => {
    TestBed.configureTestingModule({ imports: [RulesPage], providers: [provideRouter([])] });
    const fixture = TestBed.createComponent(RulesPage);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;

    const items = el.querySelectorAll('ol li');
    expect(items).toHaveLength(10);
    expect(items[0].id).toBe('regra-1');
    expect(items[9].id).toBe('regra-10');
    expect(el.textContent).toContain('Última atualização: [DATA]');
    expect(el.querySelector('a[href="/como-ingressar"]')).toBeTruthy();
  });
});
