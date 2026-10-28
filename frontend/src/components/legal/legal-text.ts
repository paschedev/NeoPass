// La forma de un texto legal: secciones con párrafos, listas (que pueden
// tener sublistas) y tablas. Los fragmentos son texto plano, nunca HTML.
export type LegalInline = string | { text: string; bold?: true; href?: string };

export interface LegalListItem {
  content: LegalInline[];
  items?: LegalListItem[];
}

export type LegalBlock =
  | { kind: 'paragraph'; content: LegalInline[] }
  | { kind: 'list'; items: LegalListItem[] }
  | { kind: 'table'; header: string[]; rows: string[][] };

export interface LegalText {
  intro: LegalBlock[];
  sections: { title: string; blocks: LegalBlock[] }[];
}
