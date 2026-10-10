// Proveedores de correo más usados en Argentina (lo que va entre la arroba y
// el primer punto). Gmail e iCloud solo existen con ".com".
const PROVIDERS = [
  { name: 'gmail', onlyDotCom: true },
  { name: 'icloud', onlyDotCom: true },
  { name: 'hotmail', onlyDotCom: false },
  { name: 'outlook', onlyDotCom: false },
  { name: 'yahoo', onlyDotCom: false },
  { name: 'live', onlyDotCom: false },
];

// Proveedores reales a una letra de uno común: nunca se "corrigen".
const REAL_LOOKALIKES = new Set(['ymail', 'mail', 'email']);

// Cuántos errores de tipeo separan dos textos: agregar, quitar o cambiar una
// letra, o invertir dos vecinas ("gmial"), cuenta como uno.
function typos(a: string, b: string): number {
  const d = Array.from({ length: a.length + 1 }, (_, i) =>
    Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : i)),
  );
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const change = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(
        d[i - 1][j] + 1,
        d[i][j - 1] + 1,
        d[i - 1][j - 1] + change,
      );
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
    }
  }
  return d[a.length][b.length];
}

// El proveedor común más parecido, con un error de tipeo en los nombres
// cortos y hasta dos en los largos; null si no se parece a ninguno.
function closestProvider(typed: string) {
  if (REAL_LOOKALIKES.has(typed)) return null;
  let closest: (typeof PROVIDERS)[number] | null = null;
  let fewest = Infinity;
  for (const provider of PROVIDERS) {
    const count = typos(typed, provider.name);
    const allowed = provider.name.length <= 5 ? 1 : 2;
    if (count <= allowed && count < fewest) {
      closest = provider;
      fewest = count;
    }
  }
  return closest;
}

// "con", "cm", "co" o "comm" en lugar de "com"; el resto ("ar", "es"…) queda.
const fixEnding = (part: string) =>
  part !== 'com' && typos(part, 'com') === 1 ? 'com' : part;

// "¿Quisiste decir …?": el correo con el dominio común corregido, o null si
// el dominio está bien escrito, es propio o no se parece a uno común. Lo que
// va antes de la arroba queda tal como se escribió.
export function suggestEmailFix(email: string): string | null {
  const trimmed = email.trim();
  const at = trimmed.lastIndexOf('@');
  if (at <= 0 || at === trimmed.length - 1) return null;

  const domain = trimmed.slice(at + 1).toLowerCase();
  const [typedProvider, ...ending] = domain.split('.');
  const provider = closestProvider(typedProvider);
  if (!provider) return null;

  const fixed = [
    provider.name,
    ...(provider.onlyDotCom ? ['com'] : ending.map(fixEnding)),
  ].join('.');
  return fixed === domain ? null : `${trimmed.slice(0, at)}@${fixed}`;
}

// Mismo correo aunque cambien las mayúsculas o haya espacios de más.
export const sameEmail = (a: string, b: string) =>
  a.trim().toLowerCase() === b.trim().toLowerCase();
