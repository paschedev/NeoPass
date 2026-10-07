import PDFDocument from 'pdfkit';
import * as qrcode from 'qrcode';
import { formatEntryDeadline } from './templates/free-tickets-email';
import { eventDetailLines, TicketForMail } from './templates/tickets-email';

// One page per ticket, sized for a phone screen (105 × 190 mm) and printable.
const PAGE_WIDTH = 298;
const PAGE_HEIGHT = 540;
const MARGIN = 22;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const HEADER_HEIGHT = 48;
const QR_SIZE = 200;
// Blank modules around the code that readers need (the standard asks for 4).
const QR_QUIET_ZONE = 4;
const FOOTER_HEIGHT = 30;
const QR_TOP = PAGE_HEIGHT - MARGIN - FOOTER_HEIGHT - 22 - QR_SIZE;

const COLORS = {
  header: '#0a0a0a',
  white: '#ffffff',
  headerMuted: '#a1a1aa',
  text: '#18181b',
  muted: '#52525b',
  faint: '#71717a',
  qr: '#000000',
};

const FOOTER =
  'Mostrá este QR en la puerta: sirve para una sola persona. No lo compartas: quien tenga el QR entra con esta entrada.';

export interface TicketPdfPage {
  position: string;
  eventName: string;
  // Date and place of the event, one line for each one that is known.
  details: string[];
  deadline: string | null;
  ticketTypeName: string;
  // Short reference for support; the QR is the secret, not the ticket id.
  code: string;
  qrCode: string;
}

// The PDF's built-in fonts only draw Windows-1252 (Spanish accents, ñ, ¿, “”,
// —, €): anything else, like emojis, would come out as garbage, so it is left
// out. The mail itself still shows the original text.
const NOT_DRAWABLE =
  /[^\x20-\x7e\xa0-\xff\u0152\u0153\u0160\u0161\u0178\u017d\u017e\u0192\u02c6\u02dc\u2013\u2014\u2018-\u201a\u201c-\u201e\u2020-\u2022\u2026\u2030\u2039\u203a\u20ac\u2122]/gu;

export function pdfText(text: string): string {
  return text.replace(NOT_DRAWABLE, '').replace(/\s+/g, ' ').trim();
}

export function ticketPdfPages({
  tickets,
  validUntil,
}: {
  tickets: TicketForMail[];
  // ISO date: until when free tickets let people in.
  validUntil: string | null;
}): TicketPdfPage[] {
  const deadline = validUntil
    ? `Válida para entrar hasta ${formatEntryDeadline(validUntil)}`
    : null;

  return tickets.map((ticket, index) => ({
    position: `Entrada ${index + 1} de ${tickets.length}`,
    eventName: pdfText(ticket.eventName),
    details: eventDetailLines(ticket).map(pdfText),
    deadline,
    ticketTypeName: pdfText(ticket.ticketTypeName),
    code: ticket.id.slice(0, 8).toUpperCase(),
    qrCode: ticket.qrCode,
  }));
}

// "entradas-fiesta-bresh.pdf": ASCII only, so every mail client shows it.
export function ticketsPdfFilename(eventName: string, count: number): string {
  const slug = eventName
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .slice(0, 60)
    .replace(/^-+|-+$/g, '');
  const base = count === 1 ? 'entrada' : 'entradas';
  return slug ? `${base}-${slug}.pdf` : `${base}.pdf`;
}

export interface QrRun {
  row: number;
  col: number;
  length: number;
}

// The dark modules of the QR, as horizontal runs per row. The PDF draws them
// as vectors: sharp at any zoom on a phone and when printed.
export function qrRuns(text: string): { size: number; runs: QrRun[] } {
  const { modules } = qrcode.create(text, { errorCorrectionLevel: 'M' });
  const runs: QrRun[] = [];
  for (let row = 0; row < modules.size; row++) {
    for (let col = 0; col < modules.size; col++) {
      if (!modules.get(row, col)) continue;
      const last = runs.at(-1);
      if (last && last.row === row && last.col + last.length === col) {
        last.length++;
      } else {
        runs.push({ row, col, length: 1 });
      }
    }
  }
  return { size: modules.size, runs };
}

export function renderTicketsPdf(pages: TicketPdfPage[]): Promise<Buffer> {
  // Everything is placed at fixed positions with a height limit, so a long
  // text is cut with "…" instead of spilling onto an extra page.
  const doc = new PDFDocument({
    size: [PAGE_WIDTH, PAGE_HEIGHT],
    margin: 0,
    autoFirstPage: false,
    info: {
      Title: `Entradas para ${pages[0]?.eventName ?? ''}`.trim(),
      Author: 'NeoPass',
    },
  });
  const pdf = new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });

  for (const page of pages) {
    doc.addPage();
    drawPage(doc, page);
  }
  doc.end();

  return pdf;
}

function drawQr(doc: PDFKit.PDFDocument, text: string, x: number, y: number) {
  const { size, runs } = qrRuns(text);
  const unit = QR_SIZE / (size + QR_QUIET_ZONE * 2);
  for (const run of runs) {
    doc.rect(
      x + (run.col + QR_QUIET_ZONE) * unit,
      y + (run.row + QR_QUIET_ZONE) * unit,
      run.length * unit,
      unit,
    );
  }
  // One fill for the whole code, so viewers draw no seams between modules.
  doc.fill(COLORS.qr);
}

function drawPage(doc: PDFKit.PDFDocument, page: TicketPdfPage) {
  doc.rect(0, 0, PAGE_WIDTH, HEADER_HEIGHT).fill(COLORS.header);
  doc
    .font('Helvetica-Bold')
    .fontSize(16)
    .fillColor(COLORS.white)
    .text('NeoPass', MARGIN, 16, { lineBreak: false });
  doc
    .font('Helvetica')
    .fontSize(9)
    .fillColor(COLORS.headerMuted)
    .text(page.position, MARGIN, 20, { width: CONTENT_WIDTH, align: 'right' });

  const block = (
    text: string,
    gap: number,
    font: string,
    size: number,
    color: string,
    lines: number,
  ) => {
    doc
      .font(font)
      .fontSize(size)
      .fillColor(color)
      .text(text, MARGIN, doc.y + gap, {
        width: CONTENT_WIDTH,
        height: size * 1.25 * lines,
        ellipsis: true,
      });
  };

  doc.y = HEADER_HEIGHT + 14;
  block(page.eventName, 0, 'Helvetica-Bold', 15, COLORS.text, 2);
  for (const line of page.details) {
    block(line, 4, 'Helvetica', 10, COLORS.muted, 2);
  }
  if (page.deadline) {
    block(page.deadline, 6, 'Helvetica-Bold', 10, COLORS.text, 2);
  }
  block('ENTRADA', 12, 'Helvetica', 8, COLORS.faint, 1);
  block(page.ticketTypeName, 2, 'Helvetica-Bold', 13, COLORS.text, 2);

  drawQr(doc, page.qrCode, (PAGE_WIDTH - QR_SIZE) / 2, QR_TOP);
  doc
    .font('Helvetica')
    .fontSize(9)
    .fillColor(COLORS.faint)
    .text(`Código ${page.code}`, MARGIN, QR_TOP + QR_SIZE + 6, {
      width: CONTENT_WIDTH,
      align: 'center',
    });
  doc.fontSize(8).text(FOOTER, MARGIN, PAGE_HEIGHT - MARGIN - FOOTER_HEIGHT, {
    width: CONTENT_WIDTH,
    height: FOOTER_HEIGHT,
    align: 'center',
    ellipsis: true,
  });
}
