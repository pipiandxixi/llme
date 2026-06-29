import path from 'path'
import { loadBasePrompt, loadProfileSections } from './profile-loader'
import { detectDomains } from './domain-detector'
import { retrieveKnowledge } from './knowledge-retriever'

export async function assembleSystemPrompt(profileDir: string, query: string): Promise<string> {
  const domains = detectDomains(query)

  const [basePrompt, sections, knowledgeEntries] = await Promise.all([
    loadBasePrompt(profileDir),
    loadProfileSections(profileDir),
    retrieveKnowledge(path.join(profileDir, 'knowledge'), domains, query),
  ])

  const parts: string[] = [basePrompt]

  parts.push(`\n<core>\n${sections.core.join('\n\n')}\n</core>`)
  parts.push(`\n<cognition>\n${sections.cognition.join('\n\n')}\n</cognition>`)
  parts.push(`\n<context>\n${sections.context.join('\n\n')}\n</context>`)

  const domainsToLoad = domains.length > 0
    ? sections.domains.filter(d => domains.includes(d.name))
    : sections.domains

  for (const domain of domainsToLoad) {
    parts.push(`\n<domain name="${domain.name}">\n${domain.content}\n</domain>`)
  }

  if (knowledgeEntries.length > 0) {
    parts.push(`\n<knowledge>\n${knowledgeEntries.join('\n---\n')}\n</knowledge>`)
  }

  return parts.join('\n')
}
