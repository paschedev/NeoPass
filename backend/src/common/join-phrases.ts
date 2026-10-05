// "a", "a y b", "a, b y c".
export function joinPhrases(phrases: string[]): string {
  if (phrases.length <= 1) return phrases[0] ?? '';
  return `${phrases.slice(0, -1).join(', ')} y ${phrases[phrases.length - 1]}`;
}
