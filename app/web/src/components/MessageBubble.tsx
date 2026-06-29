import type { Message } from '../types'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import ProfileAvatar from './ProfileAvatar'

interface Props {
  message: Message
  isStreaming?: boolean
  profileName: string
  profileInitial: string
  profileAvatarUrl?: string
}

interface StructuredSection {
  title: string
  bullets: string[]
  paragraphs: string[]
}

interface StructuredResponse {
  intro: string
  sections: StructuredSection[]
  conclusion: string
  followUp: string
}

function normalizeAssistantMarkdown(content: string): string {
  return content
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/([：:。！？])\s+(#{2,6}\s)/g, '$1\n\n$2')
    .replace(/([：:。！？])\s+([-*+]\s)/g, '$1\n\n$2')
    .replace(/([：:。！？])\s+(\d+\.\s)/g, '$1\n\n$2')
    .replace(/([^\n])\s+(#{2,6}\s)/g, '$1\n\n$2')
    .replace(/([^\n])\s+([-*+]\s+\*\*[^*]+\*\*:)/g, '$1\n\n$2')
    .replace(/([^\n])\s+([-*+]\s)/g, '$1\n\n$2')
    .replace(/([^\n])\s+(\d+\.\s)/g, '$1\n\n$2')
    .replace(/([^\n])\s+([一二三四五六七八九十]+\.\s)/g, '$1\n\n$2')
    .replace(/(#{2,6}\s[^\n]+)\s+([-*+]\s)/g, '$1\n\n$2')
    .replace(/(#{2,6}\s[^\n]+)\s+(\d+\.\s)/g, '$1\n\n$2')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function parseStructuredResponse(content: string): StructuredResponse | null {
  try {
    const parsed = JSON.parse(content) as Partial<StructuredResponse>
    if (!parsed || typeof parsed !== 'object') return null

    return {
      intro: typeof parsed.intro === 'string' ? parsed.intro : '',
      sections: Array.isArray(parsed.sections)
        ? parsed.sections.map((section) => ({
          title: typeof section?.title === 'string' ? section.title : '',
          bullets: Array.isArray(section?.bullets) ? section.bullets.filter((item): item is string => typeof item === 'string' && item.trim().length > 0) : [],
          paragraphs: Array.isArray(section?.paragraphs) ? section.paragraphs.filter((item): item is string => typeof item === 'string' && item.trim().length > 0) : [],
        })).filter((section) => section.title || section.bullets.length > 0 || section.paragraphs.length > 0)
        : [],
      conclusion: typeof parsed.conclusion === 'string' ? parsed.conclusion : '',
      followUp: typeof parsed.followUp === 'string' ? parsed.followUp : '',
    }
  } catch {
    return null
  }
}

export default function MessageBubble({ message, isStreaming, profileName, profileInitial, profileAvatarUrl }: Props) {
  const isUser = message.role === 'user'
  const structured = !isStreaming ? parseStructuredResponse(message.content) : null

  if (isUser) {
    return (
      <div className="flex justify-end pl-12">
        <div className="max-w-[85%] rounded-[20px] bg-[#f4f4f4] px-4 py-2.5 text-[15px] leading-6 whitespace-pre-wrap break-words">
          {message.content}
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-start gap-3">
      <ProfileAvatar name={profileName} src={profileAvatarUrl} sizeClassName="avatar-message shrink-0" initialClassName="" />
      <div className="min-w-0 pt-0.5">
        <div className="text-xs font-semibold mb-1.5">{profileName}</div>
        <div className="markdown-body text-[15px] leading-7 break-words text-[#1f1f1f]">
          {structured ? (
            <div className="space-y-5">
              {structured.intro && <p>{structured.intro}</p>}
              {structured.sections.map((section, index) => (
                <section key={`${section.title}-${index}`} className="space-y-2.5">
                  {section.title && <h3>{section.title}</h3>}
                  {section.bullets.length > 0 && (
                    <ul>
                      {section.bullets.map((bullet, bulletIndex) => <li key={`${section.title}-bullet-${bulletIndex}`}>{bullet}</li>)}
                    </ul>
                  )}
                  {section.paragraphs.map((paragraph, paragraphIndex) => (
                    <p key={`${section.title}-paragraph-${paragraphIndex}`}>{paragraph}</p>
                  ))}
                </section>
              ))}
              {structured.conclusion && (
                <section className="space-y-2">
                  <h3>结论</h3>
                  <p>{structured.conclusion}</p>
                </section>
              )}
              {structured.followUp && <p>{structured.followUp}</p>}
            </div>
          ) : (
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                a: ({ children, ...props }) => (
                  <a {...props} target="_blank" rel="noreferrer">{children}</a>
                ),
              }}
            >
              {normalizeAssistantMarkdown(message.content)}
            </ReactMarkdown>
          )}
          {isStreaming && <span className="inline-block w-0.5 h-4 bg-[#777] ml-0.5 animate-pulse align-middle" />}
        </div>
      </div>
    </div>
  )
}
