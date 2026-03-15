import { NextResponse } from 'next/server';

import { getProverbs } from '@/lib/proverbs';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const proverbList = await getProverbs();

    return NextResponse.json({ proverbs: proverbList });
  } catch {
    return NextResponse.json({ error: 'Unable to read proverbs file.' }, { status: 500 });
  }
}