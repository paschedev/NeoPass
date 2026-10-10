const escapeRegExp = (text: string) =>
  text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// A profile photo is the one NeoPass signed for that account (see
// MediaService.avatarSignature): NeoPass's Cloudinary account, folder
// avatars/, named after the account. Any other image could be someone else's
// photo or a host that logs who opens the app.
export function isOwnAvatarUrl(
  url: string,
  cloudinaryUrl: string,
  userId: string,
): boolean {
  const cloudName = new URL(cloudinaryUrl).hostname;
  let avatar: URL;
  try {
    avatar = new URL(url);
  } catch {
    return false;
  }
  const uploads = `/${cloudName}/image/upload/`;
  if (
    avatar.protocol !== 'https:' ||
    avatar.host !== 'res.cloudinary.com' ||
    avatar.username !== '' ||
    avatar.password !== '' ||
    avatar.search !== '' ||
    avatar.hash !== '' ||
    !avatar.pathname.startsWith(uploads)
  ) {
    return false;
  }
  return new RegExp(
    `^(v\\d+/)?avatars/${escapeRegExp(userId)}(\\.[a-z0-9]+)?$`,
    'i',
  ).test(avatar.pathname.slice(uploads.length));
}
