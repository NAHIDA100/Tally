export function newId(prefix: string): string {
  const random = Array.from({ length: 4 }, () =>
    Math.random().toString(36).slice(2, 7).padEnd(5, '0'),
  ).join('');
  return `${prefix}_${Date.now().toString(36)}${random}`;
}
