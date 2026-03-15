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
      const { sessionId, phase } = payload;
      if (typeof sessionId !== 'string' || typeof phase !== 'string') return;

      const current = sessionState.get(sessionId) ?? { objects: [] };
      sessionState.set(sessionId, { ...current, phase });
      socket.to(sessionId).emit('session:phase-changed', { phase });
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
