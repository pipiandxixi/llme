const DOMAIN_KEYWORDS: Record<string, string[]> = {
  tech: [
    'AI', 'ai', '技术', '工程', '代码', '软件', '硬件', '系统', '架构', '算法',
    '模型', '数据', '机器人', 'robot', 'software', 'hardware', 'code', 'data',
    'model', '火箭', '卫星', '芯片', '编程', 'programming', 'space', '太空',
  ],
  business: [
    '公司', '商业', '市场', '竞争', '融资', '投资', '营收', '利润', '增长',
    '战略', '客户', 'business', 'company', 'market', 'revenue', 'strategy',
    '创业', 'startup', '商业模式', '团队', 'team', '管理', 'management',
  ],
}

export function detectDomains(query: string): string[] {
  const matched = new Set<string>()
  for (const [domain, keywords] of Object.entries(DOMAIN_KEYWORDS)) {
    for (const kw of keywords) {
      if (query.includes(kw)) {
        matched.add(domain)
        break
      }
    }
  }
  return Array.from(matched)
}
