import Link from 'next/link';
import { LEGAL_DOCUMENTS, type LegalDocumentKey } from '@/utils/legal';
import type {
  LegalBlock,
  LegalInline,
  LegalListItem,
  LegalText,
} from './legal-text';

const LINK =
  'text-indigo-400 hover:text-indigo-300 underline underline-offset-2';

function Inline({ parts }: { parts: LegalInline[] }) {
  return parts.map((part, i) => {
    if (typeof part === 'string') return part;
    const text = part.bold ? (
      <strong className="font-semibold text-white">{part.text}</strong>
    ) : (
      part.text
    );
    if (!part.href) return <span key={i}>{text}</span>;
    return part.href.startsWith('/') ? (
      <Link key={i} href={part.href} className={LINK}>
        {text}
      </Link>
    ) : (
      <a key={i} href={part.href} className={LINK}>
        {text}
      </a>
    );
  });
}

function List({ items, nested }: { items: LegalListItem[]; nested?: true }) {
  return (
    <ul
      className={`pl-5 space-y-2 ${nested ? 'list-[circle] mt-2' : 'list-disc mb-4'}`}
    >
      {items.map((item, i) => (
        <li key={i}>
          <Inline parts={item.content} />
          {item.items && <List items={item.items} nested />}
        </li>
      ))}
    </ul>
  );
}

function Block({ block }: { block: LegalBlock }) {
  if (block.kind === 'paragraph') {
    return (
      <p className="mb-4">
        <Inline parts={block.content} />
      </p>
    );
  }
  if (block.kind === 'list') return <List items={block.items} />;
  return (
    // La tabla se desplaza sola en el celular, sin correr la página.
    <div className="overflow-x-auto mb-4 rounded-xl border border-white/10">
      <table className="w-full text-sm text-left">
        <thead className="bg-white/5 text-white">
          <tr>
            {block.header.map((cell) => (
              <th key={cell} className="px-4 py-2 font-semibold">
                {cell}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {block.rows.map((row) => (
            <tr key={row[0]} className="border-t border-white/10">
              {row.map((cell, i) => (
                <td key={i} className="px-4 py-2">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Un texto legal publicado: título, versión vigente y sus cláusulas.
export default function LegalPage({
  document,
  text,
}: {
  document: LegalDocumentKey;
  text: LegalText;
}) {
  const { title, version, since } = LEGAL_DOCUMENTS[document];

  return (
    <article className="container mx-auto max-w-3xl px-4 pt-6 pb-24 md:pb-12 text-neutral-300 leading-relaxed">
      <h1 className="font-outfit text-4xl md:text-5xl font-bold text-white mb-3">
        {title}
      </h1>
      <p className="text-neutral-400 mb-10">
        Versión {version} · vigente desde el {since}
      </p>
      {text.intro.map((block, i) => (
        <Block key={i} block={block} />
      ))}
      {text.sections.map((section) => (
        <section key={section.title}>
          <h2 className="font-outfit text-xl font-semibold text-white mt-10 mb-4">
            {section.title}
          </h2>
          {section.blocks.map((block, i) => (
            <Block key={i} block={block} />
          ))}
        </section>
      ))}
    </article>
  );
}
