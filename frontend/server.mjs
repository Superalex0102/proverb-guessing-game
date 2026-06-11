import { createServer } from 'node:http';
import next from 'next';
import { Server } from 'socket.io';

const dev = process.argv.includes('--dev');
const hostname = '0.0.0.0';
const port = Number.parseInt(process.env.PORT ?? '3000', 10);
const sessionState = new Map();

const PHASE_ORDER = ['lobby', 'picking', 'constructing', 'guessing', 'finished'];

function getNextPhase(currentPhase) {
  const idx = PHASE_ORDER.indexOf(currentPhase);
  if (idx === -1 || idx >= PHASE_ORDER.length - 1) return null;
  return PHASE_ORDER[idx + 1];
}

const phaseTimers = new Map();

function schedulePhaseTimeout(sessionId, currentPhase, phaseEndAt) {
  const existing = phaseTimers.get(sessionId);
  if (existing) {
    clearTimeout(existing);
  }

  const nextPhase = getNextPhase(currentPhase);
  if (!nextPhase || !phaseEndAt) return;

  const delay = new Date(phaseEndAt).getTime() - Date.now();
  if (delay <= 0) return;

  const timer = setTimeout(async () => {
    phaseTimers.delete(sessionId);

    const body = nextPhase === 'finished'
      ? { phase: nextPhase, guessingResult: 'timeout' }
      : { phase: nextPhase };

    try {
      const response = await fetch(`http://localhost:${port}/api/sessions/${sessionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (response.ok) {
        const data = await response.json();
        const s = data.session;
        const payload = {
          phase: s.phase,
          phaseEndAt: s.phaseEndAt,
          currentProverb: s.currentProverb,
          proverbRerollsLeft: s.proverbRerollsLeft,
          guessingResult: s.guessingResult ?? null,
        };

        const current = sessionState.get(sessionId) ?? {};
        sessionState.set(sessionId, { ...current, ...payload });

        io.to(sessionId).emit('session:phase-changed', payload);

        schedulePhaseTimeout(sessionId, s.phase, s.phaseEndAt);
      }
    } catch (err) {
      console.error(`[Auto-advance] Failed for session ${sessionId}:`, err);
    }
  }, delay);

  phaseTimers.set(sessionId, timer);
}

const app = next({ dev, hostname, port });
const handler = app.getRequestHandler();

app.prepare().then(() => {
  const httpServer = createServer((req, res) => {
    handler(req, res);
  });

  const io = new Server(httpServer, {
    path: '/socket.io',
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
  });

  io.on('connection', (socket) => {
    socket.on('session:join', (sessionId) => {
      if (typeof sessionId !== 'string' || sessionId.length === 0) return;
      socket.join(sessionId);

      const existing = sessionState.get(sessionId);
      if (existing) {
        socket.emit('session:state', existing);
        schedulePhaseTimeout(sessionId, existing.phase, existing.phaseEndAt);
      }
    });

    socket.on('session:phase-changed', (payload) => {
      if (!payload || typeof payload !== 'object') return;
      const { sessionId, phase, phaseEndAt, currentProverb, proverbRerollsLeft, guessingResult } = payload;
      if (typeof sessionId !== 'string' || typeof phase !== 'string') return;
      if (!(phaseEndAt === null || typeof phaseEndAt === 'string' || typeof phaseEndAt === 'undefined')) return;
      if (!(currentProverb === null || typeof currentProverb === 'string' || typeof currentProverb === 'undefined')) return;
      if (!(typeof proverbRerollsLeft === 'number' || typeof proverbRerollsLeft === 'undefined')) return;

      const current = sessionState.get(sessionId) ?? { objects: [] };
      const nextState = {
        ...current,
        phase,
        phaseEndAt: phaseEndAt ?? null,
        currentProverb: currentProverb ?? null,
        proverbRerollsLeft: typeof proverbRerollsLeft === 'number' ? proverbRerollsLeft : current.proverbRerollsLeft,
        guessingResult: guessingResult ?? null,
      };

      sessionState.set(sessionId, nextState);

      const broadcastPayload = {
        phase,
        phaseEndAt: phaseEndAt ?? null,
        currentProverb: currentProverb ?? null,
        proverbRerollsLeft: typeof proverbRerollsLeft === 'number' ? proverbRerollsLeft : current.proverbRerollsLeft,
        guessingResult: guessingResult ?? null,
      };

      socket.to(sessionId).emit('session:phase-changed', broadcastPayload);

      schedulePhaseTimeout(sessionId, phase, phaseEndAt);
    });

    socket.on('session:objects-changed', (payload) => {
      if (!payload || typeof payload !== 'object') return;

      const { sessionId, objects, zoomLevel, boardWidth, boardHeight } = payload;
      if (typeof sessionId !== 'string' || !Array.isArray(objects)) return;

      const current = sessionState.get(sessionId) ?? {};
      const nextState = { ...current, objects };
      if (typeof zoomLevel === 'number') {
        nextState.zoomLevel = zoomLevel;
      }
      if (typeof boardWidth === 'number') {
        nextState.boardWidth = boardWidth;
      }
      if (typeof boardHeight === 'number') {
        nextState.boardHeight = boardHeight;
      }
      sessionState.set(sessionId, nextState);
      
      socket.to(sessionId).emit('session:objects-updated', { 
        objects, 
        ...(typeof zoomLevel === 'number' ? { zoomLevel } : {}),
        ...(typeof boardWidth === 'number' ? { boardWidth } : {}),
        ...(typeof boardHeight === 'number' ? { boardHeight } : {})
      });
    });
  });

  httpServer.listen(port, hostname, () => {
    console.log(`Server ready at http://${hostname}:${port}`);
  });
});
