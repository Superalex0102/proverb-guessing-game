import { NextResponse } from 'next/server';

import { getProverbs, pickRandomProverb } from '@/lib/proverbs';
import { isSessionPhase, SessionPhase } from '@/lib/session-phase';
import { getSessionById, updateSessionPhase, updateSessionProverbState } from '@/lib/session-db';

type RouteContext = {
  params: Promise<{ id: string }>;
};

const PICKING_TIME_MS = 10_000;
const CONSTRUCTING_TIME_MS = 120_000;
const MAX_PROVERB_REROLLS = 3;

type PhasePatchBody = {
  phase?: unknown;
  action?: unknown;
};

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

  let body: PhasePatchBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (body.action === 'reroll-proverb') {
    const session = await getSessionById(id);
    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    if (session.phase !== 'picking') {
      return NextResponse.json({ error: 'Can only reroll during picking.' }, { status: 409 });
    }

    if (session.proverbRerollsLeft <= 0) {
      return NextResponse.json({ error: 'No proverb rerolls left.' }, { status: 409 });
    }

    const proverbs = await getProverbs();
    const nextProverb = pickRandomProverb(proverbs, session.currentProverb);
    if (!nextProverb) {
      return NextResponse.json({ error: 'No proverbs available.' }, { status: 500 });
    }

    const updatedSession = await updateSessionProverbState(
      id,
      nextProverb,
      session.proverbRerollsLeft - 1,
      getPhaseEndAt('picking'),
    );

    if (!updatedSession) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    return NextResponse.json({ session: updatedSession });
  }

  if (!isSessionPhase(body.phase)) {
    return NextResponse.json({ error: 'Invalid phase value' }, { status: 400 });
  }

  const existingSession = await getSessionById(id);
  if (!existingSession) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  }

  let currentProverb = existingSession.currentProverb;
  let proverbRerollsLeft = existingSession.proverbRerollsLeft;

  if (body.phase === 'picking') {
    const proverbs = await getProverbs();
    currentProverb = pickRandomProverb(proverbs);
    if (!currentProverb) {
      return NextResponse.json({ error: 'No proverbs available.' }, { status: 500 });
    }
    proverbRerollsLeft = MAX_PROVERB_REROLLS;
  } else if (body.phase === 'lobby') {
    currentProverb = null;
    proverbRerollsLeft = MAX_PROVERB_REROLLS;
  }

  const session = await updateSessionPhase(
    id,
    body.phase,
    getPhaseEndAt(body.phase),
    currentProverb,
    proverbRerollsLeft,
  );
  if (!session) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  }

  return NextResponse.json({ session });
}
