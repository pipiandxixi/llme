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
    })
  }

  return pool
}
