import { NextResponse } from 'next/server';

import { isSessionPhase } from '@/lib/session-phase';
import { getSessionById, updateSessionPhase } from '@/lib/session-db';

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_: Request, context: RouteContext) {
  const { id } = await context.params;
  const session = await getSessionById(id);

  if (!session) {
    return NextResponse.json(
      { error: 'Session not found' },
      { status: 404 }
    );
  }

  return NextResponse.json({ session });
}

export async function PATCH(request: Request, context: RouteContext) {
  const { id } = await context.params;

  let body: { phase?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!isSessionPhase(body.phase)) {
    return NextResponse.json({ error: 'Invalid phase value' }, { status: 400 });
  }

  const session = await updateSessionPhase(id, body.phase);
  if (!session) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  }

  return NextResponse.json({ session });
}
