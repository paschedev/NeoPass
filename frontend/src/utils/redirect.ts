// Placeholder origin: only used to check that the target stays on the same site.
const INTERNAL_ORIGIN = 'https://neopass.invalid';

/**
 * Returns the internal path to redirect to after login, or null if the target
 * could leave the site (`https://...`, `//evil`, `/\evil`, `javascript:`).
 * The target is parsed the way the browser would, so tricks that only become
 * external after normalization are rejected too.
 */
export function getSafeRedirect(target: string | null): string | null {
  if (!target?.startsWith('/')) return null;

  let url: URL;
  try {
    url = new URL(target, INTERNAL_ORIGIN);
  } catch {
    // Not a valid URL, so it is not a safe path either.
    return null;
  }
  if (url.origin !== INTERNAL_ORIGIN) return null;

  return `${url.pathname}${url.search}${url.hash}`;
}
