import { randomBytes } from 'node:crypto';
import { Pool } from 'pg';

import { SessionPhase } from '@/lib/session-phase';

export type GameSession = {
  id: string;
  createdAt: string;
  phase: SessionPhase;
  phaseEndAt: string | null;
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
          phase_end_at TIMESTAMPTZ NULL
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
      .then(() => undefined);
  }
  return schemaReady;
}

function generateSessionId(): string {
  return randomBytes(6).toString('hex');
}

export async function createSession(): Promise<GameSession> {
  await ensureSchema();

  let row: { id: string; created_at: string; phase: SessionPhase; phase_end_at: string | null } | undefined;
  while (!row) {
    const result = await pool.query<{ id: string; created_at: string; phase: SessionPhase; phase_end_at: string | null }>(
      `INSERT INTO sessions (id, created_at, phase, phase_end_at)
       VALUES ($1, NOW(), 'lobby', NULL)
       ON CONFLICT (id) DO NOTHING
       RETURNING id, created_at, phase, phase_end_at`,
      [generateSessionId()],
    );
    row = result.rows[0];
  }

  return { id: row.id, createdAt: row.created_at, phase: row.phase, phaseEndAt: row.phase_end_at };
}

export async function getSessionById(id: string): Promise<GameSession | null> {
  await ensureSchema();

  const result = await pool.query<{ id: string; created_at: string; phase: SessionPhase; phase_end_at: string | null }>(
    'SELECT id, created_at, phase, phase_end_at FROM sessions WHERE id = $1',
    [id],
  );

  if (result.rows.length === 0) return null;
  return {
    id: result.rows[0].id,
    createdAt: result.rows[0].created_at,
    phase: result.rows[0].phase,
    phaseEndAt: result.rows[0].phase_end_at,
  };
}

export async function updateSessionPhase(
  id: string,
  phase: SessionPhase,
  phaseEndAt: string | null,
): Promise<GameSession | null> {
  await ensureSchema();

  const result = await pool.query<{ id: string; created_at: string; phase: SessionPhase; phase_end_at: string | null }>(
    `UPDATE sessions
     SET phase = $2,
         phase_end_at = $3
     WHERE id = $1
     RETURNING id, created_at, phase, phase_end_at`,
    [id, phase, phaseEndAt],
  );

  if (result.rows.length === 0) return null;
  return {
    id: result.rows[0].id,
    createdAt: result.rows[0].created_at,
    phase: result.rows[0].phase,
    phaseEndAt: result.rows[0].phase_end_at,
  };
}
