import { isOwnAvatarUrl } from './avatar-url';

const CLOUDINARY_URL = 'cloudinary://key:secret@test-cloud';
const USER_ID = '6f1c2a9e-5d4b-4c3a-9b2e-1a2b3c4d5e6f';
const OTHER_ID = '00000000-0000-4000-8000-000000000000';
const BASE = 'https://res.cloudinary.com/test-cloud/image/upload';

describe('isOwnAvatarUrl', () => {
  it.each([
    `${BASE}/v1728000000/avatars/${USER_ID}.jpg`,
    `${BASE}/avatars/${USER_ID}.png`,
    `${BASE}/v12/avatars/${USER_ID}`,
  ])('acepta la foto de la cuenta en la carpeta de NeoPass: %s', (url) => {
    expect(isOwnAvatarUrl(url, CLOUDINARY_URL, USER_ID)).toBe(true);
  });

  it.each([
    `${BASE}/v1/avatars/${OTHER_ID}.jpg`,
    `${BASE}/v1/flyers/${USER_ID}.jpg`,
    `https://res.cloudinary.com/otra-cuenta/image/upload/avatars/${USER_ID}.jpg`,
    `http://res.cloudinary.com/test-cloud/image/upload/avatars/${USER_ID}.jpg`,
    `https://evil.test/test-cloud/image/upload/avatars/${USER_ID}.jpg`,
    `https://user@res.cloudinary.com/test-cloud/image/upload/avatars/${USER_ID}.jpg`,
    `${BASE}/v1/avatars/${USER_ID}.jpg?track=1`,
    `${BASE}/v1/avatars/${USER_ID}/../${OTHER_ID}.jpg`,
    'no es una url',
  ])('rechaza cualquier otra imagen: %s', (url) => {
    expect(isOwnAvatarUrl(url, CLOUDINARY_URL, USER_ID)).toBe(false);
  });
});
