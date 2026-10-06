import { ARGENTINA_TIME_ZONE } from '../common/argentina-time-zone';

// What ticket holders read when the event changes date or place. The notice
// adds up while unread, so it names everything that changed and always shows
// the event as it is now.

export type EventChanges = { date: boolean; place: boolean };

export type ChangedEvent = {
  title: string;
  startDate: Date;
  endDate: Date;
  venueName: string | null;
  venueAddress: string | null;
};

const dateParts = new Intl.DateTimeFormat('es-AR', {
  timeZone: ARGENTINA_TIME_ZONE,
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

// "sábado 17 de octubre, 23:00", whatever the platform's own punctuation.
function when(date: Date) {
  const part = Object.fromEntries(
    dateParts.formatToParts(date).map(({ type, value }) => [type, value]),
  );
  return `${part.weekday} ${part.day} de ${part.month}, ${part.hour}:${part.minute}`;
}

function where({ venueName, venueAddress }: ChangedEvent) {
  if (!venueName && !venueAddress) return null;
  if (!venueName || !venueAddress) return venueName ?? venueAddress;
  return `${venueName} (${venueAddress})`;
}

export function eventChangeNotice(event: ChangedEvent, changes: EventChanges) {
  const dates = `del ${when(event.startDate)} al ${when(event.endDate)}`;
  const place = where(event);
  const inPlace = place ? `en ${place}` : null;

  let message: string;
  if (changes.date && changes.place) {
    message = `Cambiaron la fecha y el lugar de ${event.title}. Ahora es ${dates}${inPlace ? `, ${inPlace}` : ''}.`;
  } else if (changes.date) {
    message = `Cambió la fecha de ${event.title}. Ahora es ${dates}.`;
  } else {
    message = `Cambió el lugar de ${event.title}. ${inPlace ? `Ahora es ${inPlace}` : 'Ahora el lugar está a confirmar'}.`;
  }
  return { title: `Cambios en ${event.title}`, message };
}
