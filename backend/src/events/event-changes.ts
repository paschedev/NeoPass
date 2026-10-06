import { Prisma } from '@prisma/client';
import { formatPesos } from '../common/amounts';
import { joinPhrases } from '../common/join-phrases';
import { BatchDto } from './dto/batch.dto';
import { UpdateEventDto } from './dto/update-event.dto';

// What an edit changes, as the owner reads it in the event history. The edit
// form sends every field back: only what differs from the stored event counts,
// and each part needs its own permission.

type InfoField = Exclude<keyof UpdateEventDto, 'status' | 'batches'>;

type StoredEvent = { status: string } & {
  [field in InfoField]: string | number | Date | null;
};

type StoredBatch = {
  id: string;
  name: string;
  isVisible: boolean;
  publishAt: Date | null;
  closeAt: Date | null;
  publishWhenPreviousSoldOut: boolean;
  ticketTypes: {
    id: string;
    name: string;
    price: Prisma.Decimal;
    stock: number;
  }[];
};

const INFO_FIELDS: { label: string; fields: InfoField[] }[] = [
  { label: 'el título', fields: ['title'] },
  { label: 'la descripción', fields: ['description'] },
  { label: 'el flyer', fields: ['imageUrl'] },
  { label: 'el video', fields: ['youtubeLink'] },
  { label: 'la fecha de inicio', fields: ['startDate'] },
  { label: 'la fecha de fin', fields: ['endDate'] },
  { label: 'el lugar', fields: ['venueName'] },
  { label: 'la dirección', fields: ['venueAddress'] },
  {
    label: 'la ubicación en el mapa',
    fields: ['venueCity', 'latitude', 'longitude', 'venuePlaceId'],
  },
];

const timeOf = (value: string | Date | null | undefined) =>
  value ? new Date(value).getTime() : null;

// Sent and different from what is stored; empty text is the same as nothing.
function differs(sent: unknown, stored: string | number | Date | null) {
  if (sent === undefined) return false;
  if (stored instanceof Date) return timeOf(sent as string) !== timeOf(stored);
  return (sent === '' ? null : sent) !== (stored === '' ? null : stored);
}

export function changedEventInfo(
  event: StoredEvent,
  changes: UpdateEventDto,
): string[] {
  return INFO_FIELDS.filter(({ fields }) =>
    fields.some((field) => differs(changes[field], event[field])),
  ).map(({ label }) => label);
}

const DATE_FIELDS: InfoField[] = ['startDate', 'endDate'];
const PLACE_FIELDS: InfoField[] = [
  'venueName',
  'venueAddress',
  'venueCity',
  'latitude',
  'longitude',
  'venuePlaceId',
];

// What changes for whoever already has tickets: when or where the event is.
// Null when the edit changes neither.
export function ticketHolderChanges(
  event: StoredEvent,
  changes: UpdateEventDto,
): { date: boolean; place: boolean } | null {
  const changed = (fields: InfoField[]) =>
    fields.some((field) => differs(changes[field], event[field]));
  const date = changed(DATE_FIELDS);
  const place = changed(PLACE_FIELDS);
  return date || place ? { date, place } : null;
}

export function statusChange(event: StoredEvent, changes: UpdateEventDto) {
  return changes.status !== undefined && changes.status !== event.status
    ? changes.status
    : null;
}

const STATUS_SENTENCE = {
  PUBLISHED: 'Publicó el evento.',
  DRAFT: 'Pasó el evento a borrador.',
};

// "Editó el título y la fecha de fin. Publicó el evento.", or null when
// nothing changed.
export function eventUpdateSummary(
  info: string[],
  status: keyof typeof STATUS_SENTENCE | null,
): string | null {
  const sentences = [
    ...(info.length > 0 ? [`Editó ${joinPhrases(info)}.`] : []),
    ...(status ? [STATUS_SENTENCE[status]] : []),
  ];
  return sentences.length > 0 ? sentences.join(' ') : null;
}

export function batchChangesSummary(phrases: string[]): string {
  const text = joinPhrases(phrases);
  return `${text.charAt(0).toUpperCase()}${text.slice(1)}.`;
}

const pesos = (price: Prisma.Decimal.Value) =>
  formatPesos(new Prisma.Decimal(price).toNumber());

const units = (stock: number) => stock.toLocaleString('es-AR');

// Batch and ticket type IDs not stored count as new: the service still
// rejects the ones that belong to another event.
export function describeBatchChanges(
  stored: StoredBatch[],
  incoming: BatchDto[],
): string[] {
  const storedById = new Map(stored.map((batch) => [batch.id, batch]));
  const keptIds = new Set(incoming.map((batch) => batch.id));
  const phrases = stored
    .filter((batch) => !keptIds.has(batch.id))
    .map((batch) => `borró la tanda "${batch.name}"`);

  for (const batch of incoming) {
    const before = batch.id ? storedById.get(batch.id) : undefined;
    if (before) {
      phrases.push(...describeBatchEdit(before, batch));
      continue;
    }
    const types = batch.ticketTypes.map(
      (type) => `"${type.name}" a ${pesos(type.price)}`,
    );
    phrases.push(
      types.length > 0
        ? `creó la tanda "${batch.name}" con ${joinPhrases(types)}`
        : `creó la tanda "${batch.name}"`,
    );
  }
  return phrases;
}

function describeBatchEdit(before: StoredBatch, batch: BatchDto): string[] {
  const name = `"${batch.name}"`;
  const phrases: string[] = [];
  if (batch.name !== before.name) {
    phrases.push(`renombró la tanda "${before.name}" a ${name}`);
  }
  if (batch.isVisible !== before.isVisible) {
    phrases.push(`${batch.isVisible ? 'mostró' : 'ocultó'} la tanda ${name}`);
  }
  if (
    timeOf(batch.publishAt) !== timeOf(before.publishAt) ||
    timeOf(batch.closeAt) !== timeOf(before.closeAt)
  ) {
    phrases.push(`cambió las fechas de venta de ${name}`);
  }
  if (
    (batch.publishWhenPreviousSoldOut ?? false) !==
    before.publishWhenPreviousSoldOut
  ) {
    phrases.push(`cambió la publicación automática de ${name}`);
  }

  const storedTypes = new Map(
    before.ticketTypes.map((type) => [type.id, type]),
  );
  const keptTypeIds = new Set(batch.ticketTypes.map((type) => type.id));
  for (const type of before.ticketTypes) {
    if (!keptTypeIds.has(type.id)) {
      phrases.push(`borró "${type.name}" de ${name}`);
    }
  }
  for (const type of batch.ticketTypes) {
    const old = type.id ? storedTypes.get(type.id) : undefined;
    if (!old) {
      phrases.push(`agregó "${type.name}" a ${pesos(type.price)} en ${name}`);
      continue;
    }
    if (type.name !== old.name) {
      phrases.push(`renombró "${old.name}" a "${type.name}" en ${name}`);
    }
    if (!old.price.equals(type.price)) {
      phrases.push(
        `cambió el precio de "${type.name}" en ${name} de ${pesos(old.price)} a ${pesos(type.price)}`,
      );
    }
    if (type.stock !== old.stock) {
      phrases.push(
        `cambió el stock de "${type.name}" en ${name} de ${units(old.stock)} a ${units(type.stock)}`,
      );
    }
  }
  return phrases;
}
