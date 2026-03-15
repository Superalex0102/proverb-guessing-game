export const SESSION_PHASES = ['lobby', 'picking', 'constructing', 'finished'] as const;

export type SessionPhase = (typeof SESSION_PHASES)[number];

export function isSessionPhase(value: unknown): value is SessionPhase {
  return typeof value === 'string' && SESSION_PHASES.includes(value as SessionPhase);
}
