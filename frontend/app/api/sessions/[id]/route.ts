import { NextResponse } from 'next/server';

import { isSessionPhase, SessionPhase } from '@/lib/session-phase';
import { getSessionById, updateSessionPhase } from '@/lib/session-db';

type RouteContext = {
  params: Promise<{ id: string }>;
};

const PICKING_TIME_MS = 10_000;
const CONSTRUCTING_TIME_MS = 120_000;

function getPhaseEndAt(phase: SessionPhase): string | null {
  if (phase === 'picking') {
    return new Date(Date.now() + PICKING_TIME_MS).toISOString();
  }

  if (phase === 'constructing') {
    return new Date(Date.now() + CONSTRUCTING_TIME_MS).toISOString();
  }

  return null;
}

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

  const session = await updateSessionPhase(id, body.phase, getPhaseEndAt(body.phase));
  if (!session) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  }

  return NextResponse.json({ session });
}
