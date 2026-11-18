import { eventChangeNotice } from './event-change-notices';

const event = {
  title: 'Fiesta X',
  // Sábado 17 de octubre de 2026, 23:00 a domingo 18, 6:00 (hora argentina).
  startDate: new Date('2026-10-18T02:00:00.000Z'),
  endDate: new Date('2026-10-18T09:00:00.000Z'),
  venueName: 'Club Y',
  venueAddress: 'Av. Siempreviva 742',
};

describe('aviso de cambios del evento', () => {
  it('un cambio de fecha dice cuándo es ahora, en hora argentina', () => {
    expect(
      eventChangeNotice(event, { date: true, place: false, map: false }),
    ).toEqual({
      title: 'Cambios en Fiesta X',
      message:
        'Cambió la fecha de Fiesta X. Ahora es del sábado 17 de octubre, 23:00 al domingo 18 de octubre, 06:00.',
    });
  });

  it('un cambio de lugar dice dónde es ahora', () => {
    expect(
      eventChangeNotice(event, { date: false, place: true, map: false })
        .message,
    ).toBe(
      'Cambió el lugar de Fiesta X. Ahora es en Club Y (Av. Siempreviva 742).',
    );
  });

  it('si cambiaron los dos, los nombra juntos', () => {
    expect(
      eventChangeNotice(event, { date: true, place: true, map: false }).message,
    ).toBe(
      'Cambiaron la fecha y el lugar de Fiesta X. Ahora es del sábado 17 de octubre, 23:00 al domingo 18 de octubre, 06:00, en Club Y (Av. Siempreviva 742).',
    );
  });

  it('sin dirección, nombra solo el lugar', () => {
    expect(
      eventChangeNotice(
        { ...event, venueAddress: null },
        { date: false, place: true, map: false },
      ).message,
    ).toBe('Cambió el lugar de Fiesta X. Ahora es en Club Y.');
  });

  it('sin lugar cargado, lo dice', () => {
    expect(
      eventChangeNotice(
        { ...event, venueName: null, venueAddress: null },
        { date: false, place: true, map: false },
      ).message,
    ).toBe('Cambió el lugar de Fiesta X. Ahora el lugar está a confirmar.');
  });

  describe('cuando el lugar queda en el mapa', () => {
    it('solo el mapa: un aviso suave con el lugar y la dirección', () => {
      expect(
        eventChangeNotice(event, { date: false, place: false, map: true }),
      ).toEqual({
        title: 'Novedades de Fiesta X',
        message: 'Ya está el mapa de Fiesta X: Club Y (Av. Siempreviva 742).',
      });
    });

    it('con la fecha, nombra la fecha y suma el mapa', () => {
      expect(
        eventChangeNotice(event, { date: true, place: false, map: true }),
      ).toEqual({
        title: 'Cambios en Fiesta X',
        message:
          'Cambió la fecha de Fiesta X. Ahora es del sábado 17 de octubre, 23:00 al domingo 18 de octubre, 06:00. Ya está el mapa del lugar: Club Y (Av. Siempreviva 742).',
      });
    });

    it('con un cambio de lugar, el mapa no se nombra', () => {
      expect(
        eventChangeNotice(event, { date: false, place: true, map: true })
          .message,
      ).toBe(
        'Cambió el lugar de Fiesta X. Ahora es en Club Y (Av. Siempreviva 742).',
      );
    });
  });
});
