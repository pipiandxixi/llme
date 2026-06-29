import fs from 'fs'
import path from 'path'
import { config as loadEnv } from 'dotenv'

const CWD_ROOT = process.cwd()
const FALLBACK_ROOT = path.resolve(__dirname, '../../..')

export const PROJECT_ROOT = fs.existsSync(path.join(CWD_ROOT, 'profiles'))
  ? CWD_ROOT
  : FALLBACK_ROOT

loadEnv({ path: path.join(PROJECT_ROOT, '.env') })

export const PROFILES_DIR = process.env.PROFILES_DIR?.trim() ||
  path.join(PROJECT_ROOT, 'profiles')
export const PORT = Number(process.env.PORT ?? 3001)

function requireEnv(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) {
    throw new Error(`Missing ${name} in the project root .env`)
  }
  return value
}

export const OPENAI_API_KEY = requireEnv('OPENAI_API_KEY')
export const OPENAI_BASE_URL = requireEnv('OPENAI_BASE_URL')
export const OPENAI_MODEL_NAME = requireEnv('OPENAI_MODEL_NAME')
