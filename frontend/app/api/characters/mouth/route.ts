import { promises as fs } from 'node:fs';
import path from 'node:path';

import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

const ALLOWED_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg']);

type MouthItem = {
  id: string;
  name: string;
  src: string;
  previewSrc?: string;
};

export async function GET() {
  const mouthDir = path.join(process.cwd(), 'public', 'images', 'characters', 'szajak');
  const previewDir = path.join(mouthDir, 'preview');

  try {
    // Read actual mouth files
    const entries = await fs.readdir(mouthDir, { withFileTypes: true });
    const actualMouthFiles = entries
      .filter((entry) => entry.isFile())
      .map((entry) => entry.name)
      .filter((fileName) => ALLOWED_EXTENSIONS.has(path.extname(fileName).toLowerCase()))
      .sort((a, b) => a.localeCompare(b, 'hu'));

    // Read preview files
    let previewFiles: string[] = [];
    try {
      const previewEntries = await fs.readdir(previewDir, { withFileTypes: true });
      previewFiles = previewEntries
        .filter((entry) => entry.isFile())
        .map((entry) => entry.name)
        .filter((fileName) => ALLOWED_EXTENSIONS.has(path.extname(fileName).toLowerCase()))
        .sort((a, b) => a.localeCompare(b, 'hu'));
    } catch {
      // Preview directory might not exist, that's okay
    }

    // Build a map of preview files for quick lookup (normalized names)
    const previewMap = new Map<string, string>();
    previewFiles.forEach((file) => {
      const baseName = file.replace(/\.[^.]+$/, '').toLowerCase();
      previewMap.set(baseName, file);
    });

    // Create mouth items with optional preview src
    const mouths: MouthItem[] = actualMouthFiles.map((fileName) => {
      const baseName = fileName.replace(/\.[^.]+$/, '').toLowerCase();
      const previewFileName = previewMap.get(baseName);

      return {
        id: fileName,
        name: fileName.replace(/\.[^.]+$/, ''),
        src: `/images/characters/szajak/${encodeURIComponent(fileName)}`,
        ...(previewFileName && {
          previewSrc: `/images/characters/szajak/preview/${encodeURIComponent(previewFileName)}`,
        }),
      };
    });

    return NextResponse.json({ mouths });
  } catch {
    return NextResponse.json({ error: 'Unable to read mouth images.' }, { status: 500 });
  }
}
