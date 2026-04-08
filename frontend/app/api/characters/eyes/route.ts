import { promises as fs } from 'node:fs';
import path from 'node:path';

import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

const ALLOWED_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg']);

type EyeItem = {
  id: string;
  name: string;
  src: string;
  previewSrc?: string;
};

export async function GET() {
  const eyesDir = path.join(process.cwd(), 'public', 'images', 'characters', 'szemek');
  const previewDir = path.join(eyesDir, 'preview');

  try {
    // Read actual eye files
    const entries = await fs.readdir(eyesDir, { withFileTypes: true });
    const actualEyeFiles = entries
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

    // Create eye items with optional preview src
    const eyes: EyeItem[] = actualEyeFiles.map((fileName) => {
      const baseName = fileName.replace(/\.[^.]+$/, '').toLowerCase();
      const previewFileName = previewMap.get(baseName);

      return {
        id: fileName,
        name: fileName.replace(/\.[^.]+$/, ''),
        src: `/images/characters/szemek/${encodeURIComponent(fileName)}`,
        ...(previewFileName && {
          previewSrc: `/images/characters/szemek/preview/${encodeURIComponent(previewFileName)}`,
        }),
      };
    });

    return NextResponse.json({ eyes });
  } catch {
    return NextResponse.json({ error: 'Unable to read eye images.' }, { status: 500 });
  }
}
