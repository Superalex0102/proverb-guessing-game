import { promises as fs } from 'node:fs';
import path from 'node:path';

import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

const ALLOWED_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif']);

export async function GET() {
  const objectsDir = path.join(process.cwd(), 'public', 'images', 'objects');

  try {
    const entries = await fs.readdir(objectsDir, { withFileTypes: true });

    const objects = entries
      .filter((entry) => entry.isFile())
      .map((entry) => entry.name)
      .filter((fileName) => ALLOWED_EXTENSIONS.has(path.extname(fileName).toLowerCase()))
      .sort((a, b) => a.localeCompare(b))
      .map((fileName) => ({
        id: fileName,
        name: fileName.replace(/\.[^.]+$/, ''),
        src: `/images/objects/${encodeURIComponent(fileName)}`,
      }));

    return NextResponse.json({ objects });
  } catch {
    return NextResponse.json({ error: 'Unable to read object images.' }, { status: 500 });
  }
}