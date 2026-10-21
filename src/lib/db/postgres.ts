import { Pool, types } from 'pg';

// Return NUMERIC/BIGINT as JS numbers and timestamps as ISO strings,
// matching the shapes declared in src/types/index.ts.
types.setTypeParser(types.builtins.NUMERIC, (v) => parseFloat(v));
types.setTypeParser(types.builtins.INT8, (v) => parseInt(v, 10));
types.setTypeParser(types.builtins.TIMESTAMPTZ, (v) => new Date(v).toISOString());
types.setTypeParser(types.builtins.TIMESTAMP, (v) => new Date(v).toISOString());

const databaseUrl = process.env.DATABASE_URL || '';

export const isPostgresConfigured = Boolean(databaseUrl && databaseUrl.startsWith('postgres'));

// Reuse one pool across hot reloads in dev
const globalAny: any = global;

export function getPool(): Pool | null {
  if (!isPostgresConfigured) {
    return null;
  }
  if (!globalAny.__tensorPgPool) {
    globalAny.__tensorPgPool = new Pool({
      connectionString: databaseUrl,
      max: Number(process.env.PG_POOL_MAX || 10),
    });
  }
  return globalAny.__tensorPgPool as Pool;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Guards UUID columns against ids left in localStorage from in-memory mode */
export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_RE.test(value);
}
