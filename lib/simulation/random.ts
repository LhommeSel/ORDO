export function seededUnit(seed: number, salt: string) {
  let hash = seed | 0;
  for (let index = 0; index < salt.length; index += 1) {
    hash = Math.imul(hash ^ salt.charCodeAt(index), 0x45d9f3b);
    hash ^= hash >>> 16;
  }
  return ((hash >>> 0) % 1_000_000) / 1_000_000;
}

export function pickSeeded<T>(items: readonly T[], seed: number, salt: string): T {
  if (!items.length) throw new Error('Impossible de choisir dans une liste vide.');
  return items[Math.floor(seededUnit(seed, salt) * items.length) % items.length];
}
