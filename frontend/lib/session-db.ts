import { randomBytes } from 'node:crypto';
import { Pool } from 'pg';

import { GuessingResult, SessionPhase } from '@/lib/session-phase';

export type GameSession = {
  id: string;
  createdAt: string;
  phase: SessionPhase;
  phaseEndAt: string | null;
  currentProverb: string | null;
  proverbRerollsLeft: number;
  usedProverbs: string[];
  guessingResult: GuessingResult | null;
};

type GameSessionRow = {
  id: string;
  created_at: string;
  phase: SessionPhase;
  phase_end_at: string | null;
  current_proverb: string | null;
  proverb_rerolls_left: number;
  used_proverbs: string[];
  guessing_result: GuessingResult | null;
};

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

let schemaReady: Promise<void> | null = null;

function ensureSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = pool
      .query(
        `CREATE TABLE IF NOT EXISTS sessions (
          id         VARCHAR(12)  PRIMARY KEY,
          created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
          phase      VARCHAR(20)  NOT NULL DEFAULT 'lobby',
          phase_end_at TIMESTAMPTZ NULL,
          current_proverb TEXT NULL,
          proverb_rerolls_left INTEGER NOT NULL DEFAULT 3,
          guessing_result VARCHAR(20) NULL
        )`,
      )
      .then(() =>
        pool.query(
          `ALTER TABLE sessions
           ADD COLUMN IF NOT EXISTS phase VARCHAR(20) NOT NULL DEFAULT 'lobby'`,
        ),
      )
      .then(() =>
        pool.query(
          `ALTER TABLE sessions
           ADD COLUMN IF NOT EXISTS phase_end_at TIMESTAMPTZ NULL`,
        ),
      )
      .then(() =>
        pool.query(
          `ALTER TABLE sessions
           ADD COLUMN IF NOT EXISTS current_proverb TEXT NULL`,
        ),
      )
      .then(() =>
        pool.query(
          `ALTER TABLE sessions
           ADD COLUMN IF NOT EXISTS proverb_rerolls_left INTEGER NOT NULL DEFAULT 3`,
        ),
      )
      .then(() =>
        pool.query(
          `ALTER TABLE sessions
           ADD COLUMN IF NOT EXISTS guessing_result VARCHAR(20) NULL`,
        ),
      )
      .then(() =>
        pool.query(
          `ALTER TABLE sessions
           ADD COLUMN IF NOT EXISTS used_proverbs TEXT[] NOT NULL DEFAULT '{}'`,
        ),
      )
      .then(() => undefined);
  }
  return schemaReady;
}

function mapSessionRow(row: GameSessionRow): GameSession {
  return {
    id: row.id,
    createdAt: row.created_at,
    phase: row.phase,
    phaseEndAt: row.phase_end_at,
    currentProverb: row.current_proverb,
    proverbRerollsLeft: row.proverb_rerolls_left,
    usedProverbs: row.used_proverbs ?? [],
    guessingResult: row.guessing_result,
  };
}

function generateSessionId(): string {
  return randomBytes(6).toString('hex');
}

export async function createSession(): Promise<GameSession> {
  await ensureSchema();

  let row: GameSessionRow | undefined;
  while (!row) {
    const result = await pool.query<GameSessionRow>(
      `INSERT INTO sessions (id, created_at, phase, phase_end_at, current_proverb, proverb_rerolls_left, guessing_result, used_proverbs)
       VALUES ($1, NOW(), 'lobby', NULL, NULL, 3, NULL, '{}')
       ON CONFLICT (id) DO NOTHING
       RETURNING id, created_at, phase, phase_end_at, current_proverb, proverb_rerolls_left, guessing_result, used_proverbs`,
      [generateSessionId()],
    );
    row = result.rows[0];
  }

  return mapSessionRow(row);
}

export async function getSessionById(id: string): Promise<GameSession | null> {
  await ensureSchema();

  const result = await pool.query<GameSessionRow>(
    'SELECT id, created_at, phase, phase_end_at, current_proverb, proverb_rerolls_left, guessing_result, used_proverbs FROM sessions WHERE id = $1',
    [id],
  );

  if (result.rows.length === 0) return null;
  return mapSessionRow(result.rows[0]);
}

export async function updateSessionPhase(
  id: string,
  phase: SessionPhase,
  phaseEndAt: string | null,
  currentProverb: string | null,
  proverbRerollsLeft: number,
  guessingResult: GuessingResult | null,
  usedProverbs: string[],
): Promise<GameSession | null> {
  await ensureSchema();

  const result = await pool.query<GameSessionRow>(
    `UPDATE sessions
     SET phase = $2,
         phase_end_at = $3,
         current_proverb = $4,
         proverb_rerolls_left = $5,
       guessing_result = $6,
       used_proverbs = $7
     WHERE id = $1
     RETURNING id, created_at, phase, phase_end_at, current_proverb, proverb_rerolls_left, guessing_result, used_proverbs`,
    [id, phase, phaseEndAt, currentProverb, proverbRerollsLeft, guessingResult, usedProverbs],
  );

  if (result.rows.length === 0) return null;
  return mapSessionRow(result.rows[0]);
}

export async function updateSessionProverbState(
  id: string,
  currentProverb: string | null,
  proverbRerollsLeft: number,
  phaseEndAt: string | null,
): Promise<GameSession | null> {
  await ensureSchema();

  const result = await pool.query<GameSessionRow>(
    `UPDATE sessions
     SET current_proverb = $2,
         proverb_rerolls_left = $3,
         phase_end_at = $4
     WHERE id = $1
     RETURNING id, created_at, phase, phase_end_at, current_proverb, proverb_rerolls_left, guessing_result, used_proverbs`,
    [id, currentProverb, proverbRerollsLeft, phaseEndAt],
  );

  if (result.rows.length === 0) return null;
  return mapSessionRow(result.rows[0]);
}
