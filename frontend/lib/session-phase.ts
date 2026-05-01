export const SESSION_PHASES = ['lobby', 'picking', 'constructing', 'guessing', 'finished'] as const;

export type SessionPhase = (typeof SESSION_PHASES)[number];

export const GUESSING_RESULTS = ['success', 'timeout'] as const;

export type GuessingResult = (typeof GUESSING_RESULTS)[number];

export function isSessionPhase(value: unknown): value is SessionPhase {
  return typeof value === 'string' && SESSION_PHASES.includes(value as SessionPhase);
}

export function isGuessingResult(value: unknown): value is GuessingResult {
  return typeof value === 'string' && GUESSING_RESULTS.includes(value as GuessingResult);
}
