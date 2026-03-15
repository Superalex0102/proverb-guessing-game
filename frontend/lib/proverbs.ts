import { promises as fs } from 'node:fs';
import path from 'node:path';

export async function getProverbs(): Promise<string[]> {
  const proverbsFile = path.join(process.cwd(), 'public', 'proverbs.txt');
  const proverbs = await fs.readFile(proverbsFile, 'utf8');

  return proverbs
    .split(/\r?\n/)
    .map((proverb) => proverb.trim())
    .filter((proverb) => proverb.length > 0);
}

export function pickRandomProverb(proverbs: string[], excludedProverb?: string | null): string | null {
  if (proverbs.length === 0) return null;

  const candidates = proverbs.filter((proverb) => proverb !== excludedProverb);
  const source = candidates.length > 0 ? candidates : proverbs;
  const index = Math.floor(Math.random() * source.length);

  return source[index] ?? null;
}