# llme — 技术设计文档

## 技术栈

| 层次 | 选型 | 说明 |
|------|------|------|
| 后端 | TypeScript + Node.js + Hono | 轻量 HTTP 框架，边缘兼容 |
| 前端 | React + Vite | 本地 Web UI |
| LLM | Claude API（claude-sonnet-4-6） | 主要推理模型 |
| 存储 | 本地文件系统（Markdown + YAML） | 无数据库，git 原生版本控制 |
| 检索 | YAML frontmatter 过滤 + 关键词 grep | 初期无向量检索 |
| 包管理 | pnpm | monorepo 友好 |

---

## 目录结构

```
llme/
├── PRODUCT.md
├── TECHNICAL.md
├── profiles/                        # 所有人物画像
│   ├── create-profile.sh            # 画像脚手架脚本
│   └── {name}/                      # 每个克隆对象一个子目录
│       ├── profile/                 # 个人画像（prompt 素材）
│       │   ├── core/
│       │   │   ├── values.md        # 核心价值观
│       │   │   ├── beliefs.md       # 基本信念
│       │   │   └── personality.md   # 性格特质
│       │   ├── cognition/
│       │   │   ├── mental_models.md    # 惯用思维框架
│       │   │   ├── decision_patterns.md # 决策模式
│       │   │   └── known_biases.md     # 已知认知偏差
│       │   ├── domains/
│       │   │   ├── tech.md          # 技术领域判断
│       │   │   ├── business.md      # 商业认知
│       │   │   └── ...              # 按需扩展
│       │   └── context/
│       │       ├── current_focus.md # 当前关注点
│       │       ├── relationships.md # 关键关系网络
│       │       └── environment.md   # 外部环境认知
│       ├── knowledge/               # 知识记忆库
│       │   ├── entries/             # 知识条目（观点/框架/事实）
│       │   ├── decisions/           # 决策日志
│       │   └── index.yaml           # 轻量索引（tag 统计）
│       └── system/                  # 系统配置
│           ├── base_prompt.md       # 基础角色 prompt
│           └── assembly.md          # 上下文组装规则
├── app/                             # 应用代码（v0.2 开始）
│   ├── server/                      # Hono 后端
│   └── web/                         # React 前端
└── scripts/                         # 工具脚本
    └── update-profile.ts            # 画像更新辅助（v0.3）
```

---

## 数据 Schema

### 画像文件 YAML Frontmatter

```yaml
---
layer: core | cognition | domains | context
last_updated: YYYY-MM-DD
stability: high | medium | low   # 更新频率预期
---
```

### 知识条目 Schema（knowledge/entries/YYYY-MM-DD-{slug}.md）

```yaml
---
id: "YYYY-MM-DD-{n}"
date: YYYY-MM-DD
type: opinion | framework | fact | reflection
domain: [tech, business, product, people, life]
tags: []
confidence: high | medium | low
source: "来源描述"
related_profile: []              # 关联的画像章节路径
---
```

### 决策日志 Schema（knowledge/decisions/YYYY-MM-DD-{slug}.md）

```yaml
---
id: "decision-YYYY-MM-DD-{n}"
date: YYYY-MM-DD
type: decision
domain: []
tags: []
outcome: pending | validated | invalidated
---
```

决策日志正文结构：
```markdown
## 场景
## 选项对比
## 决策及推理
## 后续验证（事后填写）
```

### 知识库索引（knowledge/index.yaml）

```yaml
profile: name
created: YYYY-MM-DD
last_updated: YYYY-MM-DD
entry_count: 0
decision_count: 0
tag_index: {}                    # { tag: count }
domain_index: {}                 # { domain: count }
```

---

## Prompt 组装策略

### 固定加载（每次对话必须包含）

```
profile/core/*.md        → 始终全量
profile/cognition/*.md   → 始终全量
profile/context/*.md     → 始终全量
system/base_prompt.md    → 始终加载
```

### 条件加载（按 query 动态选择）

```
profile/domains/{domain}.md     → 匹配 query 关键词 / domain 标签
knowledge/entries/*.md          → domain 过滤 + tag 匹配，取前 10 条
knowledge/decisions/*.md        → domain 过滤，取最近 5 条
```

### Token 预算参考

| 部分 | 目标上限 |
|------|----------|
| 固定加载（画像核心） | 2000 tokens |
| 条件加载（域 + 知识） | 3000 tokens |
| 对话历史 | ≥ 4000 tokens |
| 总上下文 | ≤ 32K tokens |

---

## 知识检索算法（无向量版）

```
function retrieveKnowledge(query, domain, tags):
  entries = loadAll("knowledge/entries/")
  
  # 第一步：domain 过滤
  if domain:
    entries = entries.filter(e => e.domain.includes(domain))
  
  # 第二步：tag 交集打分
  entries = entries.map(e => ({
    ...e,
    score: intersection(e.tags, tags).length
  }))
  
  # 第三步：按 score DESC, date DESC 排序
  entries = entries.sort(byScoreThenDate)
  
  # 第四步：取前 N 条
  return entries.slice(0, 10)
```

后续引入向量检索时，替换第二步的打分逻辑即可，接口保持不变。

---

## 画像更新流程（手动触发，v0.3）

```
scripts/update-profile.ts <profile-name> [--since YYYY-MM-DD]

1. 读取 knowledge/entries/ 中指定日期后的新条目
2. 加载现有 profile/ 全量内容
3. 调用 LLM：分析新条目与现有画像的异同，输出建议
   - 新增条目（画像中未覆盖的认知点）
   - 更新条目（与现有条目有出入，可能是观点演化）
   - 冲突条目（需要人工判断）
4. 以 markdown diff 格式输出到 stdout 或临时文件
5. 用户 review 后手动编辑对应 profile 文件
```

---

## LLM 接入

- 模型：由根目录 `.env` 中的 `OPENAI_MODEL_NAME` 配置
- SDK：`openai`（兼容 OpenAI Chat Completions 的服务均可接入）
- 调用方式：streaming，Web UI 实时展示
- System prompt：`system/base_prompt.md` + 组装后的画像上下文
- Topic 对话历史保存在浏览器 `localStorage`

---

## 本地开发启动（v0.2 目标）

```bash
pnpm install
pnpm dev          # 启动本地 Web UI，默认 http://localhost:3000
```

环境变量（`.env`）：
```
OPENAI_API_KEY=your-api-key
OPENAI_BASE_URL=https://openrouter.ai/api/v1
OPENAI_MODEL_NAME=google/gemini-3.1-flash-lite
```
