import { Pool, types } from 'pg'

// Return DATE columns (OID 1082) as raw 'YYYY-MM-DD' strings instead of pg's
// default JS Date objects, which get constructed in local time and then
// shift to the previous day once JSON.stringify's toISOString() converts to UTC.
types.setTypeParser(1082, (value) => value)

let pool: Pool | null = null

function normalizeConnectionString(raw: string) {
  const url = new URL(raw)
  url.searchParams.delete('sslmode')
  url.searchParams.delete('sslcert')
  url.searchParams.delete('sslkey')
  url.searchParams.delete('sslrootcert')
  return url.toString()
}

export function getPostgresPool(): Pool {
  const rawConnectionString = process.env.POSTGRES_URL?.trim() || process.env.POSTGRES_URL_NON_POOLING?.trim()
  const connectionString = rawConnectionString ? normalizeConnectionString(rawConnectionString) : ''
  if (!connectionString) {
    throw new Error('Missing POSTGRES_URL or POSTGRES_URL_NON_POOLING in the project root .env')
  }

  if (!pool) {
    pool = new Pool({
      connectionString,
      max: 5,
      ssl: { rejectUnauthorized: false },
      // Without these, a hung connection (the pooler has dropped it, network
      // hiccup, etc.) blocks until Vercel's own function timeout kills the
      // whole request — surfacing as a slow, generic 504 instead of a fast,
      // retryable error.
      connectionTimeoutMillis: 8000,
      statement_timeout: 15000,
      query_timeout: 15000,
      idleTimeoutMillis: 10000,
    })
  }

  return pool
}

// The Supabase pooler occasionally drops a connection outright (seen
// repeatedly during this project's own migration/import scripts too). A
// single retry clears the vast majority of these transient failures.
export async function withRetry<T>(fn: () => Promise<T>, attempts = 2): Promise<T> {
  let lastError: unknown
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn()
    } catch (err) {
      lastError = err
      if (i < attempts - 1) await new Promise((resolve) => setTimeout(resolve, 300))
    }
  }
  throw lastError
}
