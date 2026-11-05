import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';

/** Trecho de texto com a formatação aplicada a ele. */
export interface Segment {
  text: string;
  bold: boolean;
  italic: boolean;
}

/** Uma linha (sequência de trechos). */
export type Line = Segment[];

export type Block = { type: 'paragraph'; lines: Line[] } | { type: 'list'; items: Line[] };

const LIST_ITEM = /^\s*[-*]\s+/;

/** `**negrito**` e `*itálico*`; marcadores sem par ficam como texto. */
export function parseInline(text: string): Line {
  const segments: Line = [];
  const pattern = /\*\*(.+?)\*\*|\*(?!\s)(.+?)(?<!\s)\*/g;
  let last = 0;
  for (const match of text.matchAll(pattern)) {
    if (match.index > last)
      segments.push({ text: text.slice(last, match.index), bold: false, italic: false });
    if (match[1] !== undefined) segments.push({ text: match[1], bold: true, italic: false });
    else segments.push({ text: match[2], bold: false, italic: true });
    last = match.index + match[0].length;
  }
  if (last < text.length) segments.push({ text: text.slice(last), bold: false, italic: false });
  return segments;
}

/**
 * Formatação básica escrita no painel: linha em branco separa parágrafos, linhas que
 * começam com "- " formam uma lista, `**negrito**` e `*itálico*`. Nunca gera HTML.
 */
export function parseRichText(text: string): Block[] {
  const blocks: Block[] = [];
  for (const chunk of text.replace(/\r\n?/g, '\n').split(/\n\s*\n/)) {
    const lines = chunk.split('\n').filter((l) => l.trim());
    let paragraph: Line[] = [];
    let list: Line[] = [];
    const flush = () => {
      if (paragraph.length) blocks.push({ type: 'paragraph', lines: paragraph });
      if (list.length) blocks.push({ type: 'list', items: list });
      paragraph = [];
      list = [];
    };
    for (const line of lines) {
      if (LIST_ITEM.test(line)) {
        if (paragraph.length) flush();
        list.push(parseInline(line.replace(LIST_ITEM, '').trim()));
      } else {
        if (list.length) flush();
        paragraph.push(parseInline(line.trim()));
      }
    }
    flush();
  }
  return blocks;
}

@Component({
  selector: 'app-rich-text',
  template: `
    <!-- Cada trecho fica em um elemento, para não haver espaços extras entre eles. -->
    <ng-template #inline let-line>
      @for (s of line; track $index) {
        @if (s.bold) {
          <strong>{{ s.text }}</strong>
        } @else if (s.italic) {
          <em>{{ s.text }}</em>
        } @else {
          <span>{{ s.text }}</span>
        }
      }
    </ng-template>

    @for (block of blocks(); track $index) {
      @if (block.type === 'paragraph') {
        <p>
          @for (line of block.lines; track $index) {
            @if (!$first) {
              <br />
            }
            <ng-container *ngTemplateOutlet="inline; context: { $implicit: line }" />
          }
        </p>
      } @else {
        <ul>
          @for (item of block.items; track $index) {
            <li><ng-container *ngTemplateOutlet="inline; context: { $implicit: item }" /></li>
          }
        </ul>
      }
    }
  `,
  imports: [NgTemplateOutlet],
  styles: `
    :host {
      display: block;
    }
    p,
    ul {
      margin: 0 0 var(--space-3);
    }
    :host > :last-child {
      margin-bottom: 0;
    }
    ul {
      padding-left: 1.25em;
    }
    strong {
      color: var(--color-heading);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RichText {
  readonly text = input.required<string>();
  protected readonly blocks = computed(() => parseRichText(this.text()));
}
