import { organizerDisplayName } from './organizer-name';

describe('organizerDisplayName', () => {
  it('con productora, muestra la productora', () => {
    expect(
      organizerDisplayName({
        name: 'Agustín Zannantonio',
        organizerProfile: { companyName: 'Productora Sur' },
      }),
    ).toBe('Productora Sur');
  });

  it('sin productora, vacía o sin perfil de organizador, muestra el nombre de la cuenta', () => {
    for (const organizerProfile of [
      { companyName: null },
      { companyName: '   ' },
      null,
      undefined,
    ]) {
      expect(
        organizerDisplayName({ name: 'Agustín Zannantonio', organizerProfile }),
      ).toBe('Agustín Zannantonio');
    }
  });
});
