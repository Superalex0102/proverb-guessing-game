import { promises as fs } from 'node:fs';
import path from 'node:path';

import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

const ALLOWED_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg']);

export async function GET() {
  const eyesDir = path.join(process.cwd(), 'public', 'images', 'characters', 'szemek');

  try {
    const entries = await fs.readdir(eyesDir, { withFileTypes: true });

    const eyes = entries
      .filter((entry) => entry.isFile())
      .map((entry) => entry.name)
      .filter((fileName) => ALLOWED_EXTENSIONS.has(path.extname(fileName).toLowerCase()))
      .sort((a, b) => a.localeCompare(b, 'hu'))
      .map((fileName) => ({
        id: fileName,
        name: fileName.replace(/\.[^.]+$/, ''),
        src: `/images/characters/szemek/${encodeURIComponent(fileName)}`,
      }));

    return NextResponse.json({ eyes });
  } catch {
    return NextResponse.json({ error: 'Unable to read eye images.' }, { status: 500 });
  }
}
