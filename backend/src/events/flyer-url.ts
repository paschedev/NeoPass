// Flyers are uploaded to NeoPass's own Cloudinary account (MediaService signs
// the upload with CLOUDINARY_URL). Any other image would let an organizer log
// who visits the event, or swap the picture after publishing.
export function isOwnFlyerUrl(url: string, cloudinaryUrl: string): boolean {
  const cloudName = new URL(cloudinaryUrl).hostname;
  let flyer: URL;
  try {
    flyer = new URL(url);
  } catch {
    return false;
  }
  return (
    flyer.protocol === 'https:' &&
    flyer.host === 'res.cloudinary.com' &&
    flyer.username === '' &&
    flyer.pathname.startsWith(`/${cloudName}/`)
  );
}
