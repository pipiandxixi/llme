import { getOpenAIEnvStatus, sendJson } from '../_helpers'

export default async function handler(_req: any, res: any) {
  return sendJson(res, getOpenAIEnvStatus())
}
