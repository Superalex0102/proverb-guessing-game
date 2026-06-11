declare module '*.css';

declare global {
  var __io: import('socket.io').Server | undefined;
  var __sessionState: Map<string, Record<string, unknown>> | undefined;
  var __schedulePhaseTimeout: ((sessionId: string, phase: string, phaseEndAt: string | null) => void) | undefined;
}

export {};
