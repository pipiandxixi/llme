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

export function getOpenAIConfig() {
  return {
    apiKey: requireEnv('OPENAI_API_KEY'),
    baseURL: requireEnv('OPENAI_BASE_URL'),
    modelName: requireEnv('OPENAI_MODEL_NAME'),
  }
}

export function getOpenAIEnvStatus() {
  const apiKey = process.env.OPENAI_API_KEY?.trim() ?? ''
  const baseURL = process.env.OPENAI_BASE_URL?.trim() ?? ''
  const modelName = process.env.OPENAI_MODEL_NAME?.trim() ?? ''

  return {
    hasOpenAIKey: apiKey.length > 0,
    openAIKeyMasked: maskSecret(apiKey),
    openAIBaseURL: baseURL || null,
    openAIModelName: modelName || null,
  }
}

function maskSecret(value: string): string | null {
  if (!value) return null
  if (value.length <= 10) return `${value.slice(0, 2)}***${value.slice(-2)}`
  return `${value.slice(0, 6)}***${value.slice(-4)}`
}
