import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export function getSocket(): Socket | null {
  if (typeof window === 'undefined') return null;

  if (!socket) {
    socket = io({ path: '/socket.io' });
  }

  return socket;
}
