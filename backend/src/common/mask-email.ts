// "ana.perez@gmail.com" → "a*******z@gmail.com": enough to recognize an
// email without exposing it.
export function maskEmail(email: string) {
  const [local, domain] = email.split('@');
  if (!domain) return email;
  const masked =
    local.length > 2
      ? local[0] + '*'.repeat(local.length - 2) + local[local.length - 1]
      : local[0] + '***';
  return `${masked}@${domain}`;
}
