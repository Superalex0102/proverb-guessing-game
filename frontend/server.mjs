import { createServer } from 'node:http';
import next from 'next';
import { Server } from 'socket.io';

const dev = process.argv.includes('--dev');
const hostname = '0.0.0.0';
const port = Number.parseInt(process.env.PORT ?? '3000', 10);
const sessionState = new Map();

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
      }
    });

    socket.on('session:phase-changed', (payload) => {
      if (!payload || typeof payload !== 'object') return;
      const { sessionId, phase, phaseEndAt, currentProverb, proverbRerollsLeft } = payload;
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
      };

      sessionState.set(sessionId, nextState);
      socket.to(sessionId).emit('session:phase-changed', {
        phase,
        phaseEndAt: phaseEndAt ?? null,
        currentProverb: currentProverb ?? null,
        proverbRerollsLeft: typeof proverbRerollsLeft === 'number' ? proverbRerollsLeft : current.proverbRerollsLeft,
      });
    });

    socket.on('session:objects-changed', (payload) => {
      if (!payload || typeof payload !== 'object') return;

      const { sessionId, objects } = payload;
      if (typeof sessionId !== 'string' || !Array.isArray(objects)) return;

      const current = sessionState.get(sessionId) ?? {};
      sessionState.set(sessionId, { ...current, objects });
      socket.to(sessionId).emit('session:objects-updated', { objects });
    });
  });

  httpServer.listen(port, hostname, () => {
    console.log(`Server ready at http://${hostname}:${port}`);
  });
});
