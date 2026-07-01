import path from 'path'
import { getContentStore, type KnowledgeMatch } from './storage'

export type { KnowledgeMatch }

export async function scoreKnowledge(
  knowledgeDir: string,
  domains: string[],
  query: string
): Promise<KnowledgeMatch[]> {
  const profileId = path.basename(path.dirname(knowledgeDir))
  return getContentStore().scoreKnowledge(profileId, domains, query)
}

export async function retrieveKnowledge(
  knowledgeDir: string,
  domains: string[],
  query: string
): Promise<string[]> {
  const profileId = path.basename(path.dirname(knowledgeDir))
  return getContentStore().retrieveKnowledge(profileId, domains, query)
}
