import { randomBytes } from 'node:crypto';
import { Pool } from 'pg';

export type GameSession = {
  id: string;
  createdAt: string;
};

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

let schemaReady: Promise<void> | null = null;

function ensureSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = pool
      .query(
        `CREATE TABLE IF NOT EXISTS sessions (
          id         VARCHAR(12)  PRIMARY KEY,
          created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
        )`,
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

  let row: { id: string; created_at: string } | undefined;
  while (!row) {
    const result = await pool.query<{ id: string; created_at: string }>(
      `INSERT INTO sessions (id, created_at)
       VALUES ($1, NOW())
       ON CONFLICT (id) DO NOTHING
       RETURNING id, created_at`,
      [generateSessionId()],
    );
    row = result.rows[0];
  }

  return { id: row.id, createdAt: row.created_at };
}

export async function getSessionById(id: string): Promise<GameSession | null> {
  await ensureSchema();

  const result = await pool.query<{ id: string; created_at: string }>(
    'SELECT id, created_at FROM sessions WHERE id = $1',
    [id],
  );

  if (result.rows.length === 0) return null;
  return { id: result.rows[0].id, createdAt: result.rows[0].created_at };
}
