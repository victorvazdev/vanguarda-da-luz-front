import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { provideSessionStub } from '../../../core/auth/session.stub';
import { AdminShell } from './admin-shell';

@Component({ template: '' })
class Blank {}

describe('AdminShell', () => {
  it('mostra as abas da administração', async () => {
    TestBed.configureTestingModule({
      imports: [AdminShell],
      providers: [provideRouter([]), provideSessionStub('admin').provider],
    });
    const fixture = TestBed.createComponent(AdminShell);
    await fixture.whenStable();
    const tabs = [...(fixture.nativeElement as HTMLElement).querySelectorAll('.tabs a')];
    expect(tabs.map((t) => t.textContent?.trim())).toEqual(['Candidaturas', 'Membros', 'Eventos']);
  });

  it('sai da área se a pessoa deixar de ser administradora durante o uso', async () => {
    const { stub, provider } = provideSessionStub('admin');
    TestBed.configureTestingModule({
      imports: [AdminShell],
      providers: [provideRouter([{ path: '**', component: Blank }]), provider],
    });
    const fixture = TestBed.createComponent(AdminShell);
    await fixture.whenStable();
    stub.access.set('member');
    await fixture.whenStable();
    expect(TestBed.inject(Router).url).toBe('/calendario');
  });
});
