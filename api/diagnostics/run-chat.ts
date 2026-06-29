import { formatUpstreamError, getOpenAIEnvStatus, runChat, sendJson, serializeError } from '../_helpers'

export default async function handler(req: any, res: any) {
  const profileId = req.query?.profileId || 'elonmusk'
  const query = req.query?.q || '介绍一下你自己'

  try {
    const result = await runChat({
      profileId,
      messages: [{ role: 'user', content: query }],
    })

    return sendJson(res, {
      ok: true,
      contentLength: result.content.length,
      content: result.content,
      modelName: result.modelName,
      baseURL: result.baseURL,
    })
  } catch (err) {
    return sendJson(res, {
      ok: false,
      ...getOpenAIEnvStatus(),
      error: formatUpstreamError(err),
      details: serializeError(err),
    }, 502)
  }
}
