import { TestBed } from '@angular/core/testing';
import { RichText, parseInline, parseRichText } from './rich-text';

describe('parseRichText', () => {
  it('separa parágrafos por linha em branco e mantém quebras de linha', () => {
    const blocks = parseRichText('Primeira linha\nsegunda linha\n\nOutro parágrafo');
    expect(blocks).toHaveLength(2);
    expect(blocks[0]).toEqual({
      type: 'paragraph',
      lines: [
        [{ text: 'Primeira linha', bold: false, italic: false }],
        [{ text: 'segunda linha', bold: false, italic: false }],
      ],
    });
  });

  it('agrupa linhas que começam com "- " em uma lista', () => {
    const blocks = parseRichText('Nossos valores:\n- Honra\n- Respeito');
    expect(blocks.map((b) => b.type)).toEqual(['paragraph', 'list']);
    expect(blocks[1].type === 'list' && blocks[1].items.length).toBe(2);
  });

  it('reconhece negrito e itálico e ignora marcadores sem par', () => {
    expect(parseInline('a **forte** e *leve*, 2 * 3')).toEqual([
      { text: 'a ', bold: false, italic: false },
      { text: 'forte', bold: true, italic: false },
      { text: ' e ', bold: false, italic: false },
      { text: 'leve', bold: false, italic: true },
      { text: ', 2 * 3', bold: false, italic: false },
    ]);
  });

  it('não gera parágrafos vazios', () => {
    expect(parseRichText('  \n\n ')).toEqual([]);
  });
});

describe('RichText', () => {
  it('exibe HTML digitado como texto, sem interpretá-lo', async () => {
    const fixture = TestBed.createComponent(RichText);
    fixture.componentRef.setInput('text', '<img src=x onerror=alert(1)> **ok**');
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('img')).toBeNull();
    expect(el.querySelector('strong')?.textContent).toBe('ok');
    expect(el.textContent).toContain('<img');
  });
});
