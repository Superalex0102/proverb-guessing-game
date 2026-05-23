import { promises as fs } from 'node:fs';
import path from 'node:path';

import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

const ALLOWED_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg']);

type ObjectCatalogItem = {
  id: string;
  name: string;
  src: string;
};

type ObjectCatalogCategory = {
  id: string;
  label: string;
  iconSrc: string;
  items: ObjectCatalogItem[];
};

const CATEGORY_METADATA: Record<string, { label: string; iconSrc: string }> = {
  animals: { label: 'Állatok', iconSrc: '/images/ui/panel_icons/object/animals.svg' },
  clothes: { label: 'Ruhák', iconSrc: '/images/ui/panel_icons/object/clothes.svg' },
  inside_objects: { label: 'Benti tárgyak', iconSrc: '/images/ui/panel_icons/object/inside.svg' },
  outside_objects: { label: 'Kinti tárgyak', iconSrc: '/images/ui/panel_icons/object/outside.svg' },
  misc: { label: 'Vegyes', iconSrc: '/images/ui/panel_icons/object/misc.svg' },
};

function toPublicObjectSrc(relativePath: string): string {
  return `/images/objects/${relativePath.split(path.sep).map(encodeURIComponent).join('/')}`;
}

async function collectObjectFiles(directory: string, categoryId?: string): Promise<Array<{ categoryId: string; filePath: string }>> {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const collected: Array<{ categoryId: string; filePath: string }> = [];

  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      collected.push(...await collectObjectFiles(entryPath, categoryId ?? entry.name));
      continue;
    }

    if (!categoryId || !ALLOWED_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
      continue;
    }

    collected.push({ categoryId, filePath: entryPath });
  }

  return collected;
}

export async function GET() {
  const objectsDir = path.join(process.cwd(), 'public', 'images', 'objects');

  try {
    const fileEntries = await collectObjectFiles(objectsDir);
    const categoryEntries = new Map<string, ObjectCatalogItem[]>();

    for (const entry of fileEntries) {
      const relativePath = path.relative(objectsDir, entry.filePath);
      const normalizedPath = relativePath.split(path.sep).join('/');
      const fileName = path.basename(entry.filePath);
      const objectItem: ObjectCatalogItem = {
        id: normalizedPath,
        name: fileName.replace(/\.[^.]+$/, ''),
        src: toPublicObjectSrc(relativePath),
      };

      const currentCategoryItems = categoryEntries.get(entry.categoryId) ?? [];
      currentCategoryItems.push(objectItem);
      categoryEntries.set(entry.categoryId, currentCategoryItems);
    }

    const categories: ObjectCatalogCategory[] = Object.entries(CATEGORY_METADATA)
      .map(([categoryId, metadata]) => ({
        id: categoryId,
        label: metadata.label,
        iconSrc: metadata.iconSrc,
        items: (categoryEntries.get(categoryId) ?? []).sort((left, right) => left.name.localeCompare(right.name)),
      }))
      .filter((category) => category.items.length > 0);

    return NextResponse.json({ categories });
  } catch {
    return NextResponse.json({ error: 'Unable to read object images.' }, { status: 500 });
  }
}