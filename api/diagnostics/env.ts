import { getOpenAIEnvStatus, json } from '../_helpers'

export default async function handler() {
  return json(getOpenAIEnvStatus())
}
