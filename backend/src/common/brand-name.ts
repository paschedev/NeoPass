import { ValidateBy } from 'class-validator';

export const BRAND_NAME_MESSAGE = 'El nombre no puede incluir "NeoPass"';

// Names people choose (theirs or their producer's) reach buyers in mails sent
// from NeoPass's own address, so they can't pass as NeoPass. Spaces, signs and
// capital letters don't hide it.
export function mentionsNeoPass(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z]/g, '')
    .includes('neopass');
}

export const NoNeoPassName = () =>
  ValidateBy({
    name: 'noNeoPassName',
    validator: {
      validate: (value: unknown) =>
        typeof value !== 'string' || !mentionsNeoPass(value),
      defaultMessage: () => BRAND_NAME_MESSAGE,
    },
  });
