import { NextResponse } from 'next/server';

import { createSession } from '@/lib/session-db';

export async function POST() {
  const session = await createSession();
  return NextResponse.json({ session }, { status: 201 });
}
