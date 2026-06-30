# 增加外部信息获取能力设计说明

## 1. 目标

当前 `llme` 的核心链路是：

`profile + local knowledge -> assemble prompt -> model reply`

这套结构适合回答基于本地画像和本地材料的问题，但不适合处理以下场景：

- 用户明确要求“查一下”“搜一下”“最新情况”
- 问题依赖近期新闻、价格、公告、政策、产品更新
- 本地记忆不足以支持高可信回答

本次改造的目标，是让系统在保留数字人人格一致性的前提下，具备可控、可解释的外部信息获取能力。

## 2. 核心结论

不要把“联网搜索”当成现有 prompt 的一个补丁能力，而要把后端升级成一个编排层。

推荐的知识分层如下：

- `profiles/`
  - 负责人格、价值观、思维方式、长期稳定偏好
- `local memory`
  - 负责本地沉淀的事实、历史材料、知识条目、过往整理结果
- `web search`
  - 负责最新事实、外部变化、时间敏感信息
- `chat orchestrator`
  - 负责判断本轮该调用哪几层，以及如何合并结果后生成回答

可以理解为：

- `profile` = 这个人怎么想
- `local memory` = 这个人过去知道什么、积累了什么
- `web search` = 外部世界最近发生了什么
- `orchestrator` = 这次回答该参考哪些信息源

## 3. 为什么要这样拆

如果把外部搜索结果直接混进现有 `assembleSystemPrompt()`，会出现几个问题：

- 职责混乱：人格信息和实时事实没有边界
- 调试困难：很难判断回答错误是画像问题、记忆问题还是搜索问题
- 扩展困难：后续更换搜索源、增加缓存、增加引用都不方便
- 可信度不足：用户看不到答案到底来自本地材料还是来自外部网页

因此，外部信息获取必须成为独立层，而不是隐藏在 prompt 拼装内部。

## 4. 建议的新架构

建议把当前单次问答链路升级为：

1. 接收用户请求
2. 判断是否需要外部信息
3. 加载 `profile`
4. 检索 `local memory`
5. 如有必要，执行 `web search`
6. 合并上下文
7. 调用模型生成答案
8. 返回答案和来源

可抽象为：

`messages -> orchestrator -> profile + local memory + web search -> grounded context -> model -> answer + citations`

## 5. 各层职责

### 5.1 profiles

`profiles/` 继续保持当前定位，不承担最新事实检索职责。

它只负责：

- 角色设定
- 价值观
- 思维框架
- 决策偏好
- 稳定领域认知

不应负责：

- 今日新闻
- 最新股价
- 最新产品发布
- 最近政策变化

### 5.2 local memory

`local memory` 是介于 `profile` 和 `web search` 之间的一层。

它负责：

- 本地知识条目
- 本地整理过的公开材料
- 历史决策记录
- 长期有效但可能逐步更新的背景事实

它比 `profile` 更动态，但比 `web search` 更稳定。

### 5.3 web search

`web search` 只负责外部实时信息。

它适合处理：

- 最新
- 最近
- 今日
- 当前
- 近期变化
- 外部站点验证

不应该让它覆盖数字人的人格层，也不应该让它直接替代本地记忆。

### 5.4 chat orchestrator

`chat orchestrator` 是新增的核心。

它至少负责 4 件事：

- 判断要不要搜
- 决定搜什么
- 决定哪些结果可信
- 决定如何把结果和本地人格、本地记忆一起交给模型

## 6. 推荐的数据流

建议每次回答遵循以下顺序：

1. 先加载 `profile`
2. 再检索 `local memory`
3. 如果问题涉及时间敏感信息，再触发 `web search`
4. 最后统一生成答案

也就是说，默认不是“每轮都搜”，而是“按需搜”。

## 7. 后端代码改造建议

### 7.1 先收敛聊天主逻辑

当前聊天逻辑分散在两处：

- `app/server/src/routes/chat.ts`
- `api/_helpers.ts`

在增加外部搜索前，应该先抽成统一模块，例如：

- `app/server/src/lib/chat-orchestrator.ts`
- `app/server/src/lib/chat-types.ts`
- `app/server/src/lib/grounding/*`
- `app/server/src/lib/search/*`

这样本地开发入口和部署入口都复用同一套逻辑。

### 7.2 扩展请求参数

当前 `ChatRequest` 只有：

- `profileId`
- `messages`

建议扩展为支持搜索控制，例如：

- `webSearchMode: 'off' | 'auto'`
- `freshnessDays?: number`
- `allowedDomains?: string[]`
- `citationMode?: 'none' | 'inline' | 'footnotes'`

### 7.3 搜索层不要直接喂网页原文

推荐流程：

1. 搜索得到候选链接
2. 抓取页面
3. 提取正文
4. 清洗噪音
5. 按相关性和可信度排序
6. 只取少量高质量结果进入模型上下文

不要把完整网页原文直接塞进 prompt。

## 8. 前端改造建议

前端不应只显示最终文本，还应展示本轮是否使用了外部信息。

建议补充：

- 本次回答是否使用联网搜索
- 引用了哪些来源
- 来源域名与时间
- 用户可控的搜索模式开关

推荐的模式：

- `关闭联网`
- `自动联网`

## 9. 回答结果的结构建议

当回答使用了外部信息后，返回值不应只剩一个 `content`。

建议返回结构至少包含：

- `content`
- `usedWebSearch`
- `citations`
- `searchQuery`
- `generatedAt`

这样前端才能明确区分：

- 哪些内容来自数字人人格
- 哪些内容来自本地记忆
- 哪些内容来自外部搜索

## 10. 搜索触发策略

建议先使用规则判断，不要一开始就完全交给模型自由决定。

优先触发搜索的场景：

- 用户明确要求查询
- 问题包含“最新”“最近”“今天”“目前”等时间敏感词
- 本地记忆明显不足

默认不触发搜索的场景：

- 纯风格模拟
- 价值观分析
- 基于既有画像的判断方式推演

## 11. 实施顺序

建议按以下顺序落地：

1. 抽出统一的 `chat orchestrator`
2. 扩展聊天请求结构，支持搜索模式
3. 新增独立的 `web search` 模块
4. 为回答增加来源返回结构
5. 前端展示“是否联网”和“引用来源”
6. 最后再考虑更复杂的多轮 agent 搜索

## 12. 一句话结论

本项目增加外部信息获取能力后，推荐采用三层知识源 + 一层编排器的结构：

- `profile`
- `local memory`
- `web search`
- `chat orchestrator`

其中：

- `profile` 管人格
- `local memory` 管本地事实沉淀
- `web search` 管实时外部事实
- `orchestrator` 管调用策略与最终合并
