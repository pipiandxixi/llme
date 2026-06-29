#!/bin/bash
# Usage: ./create-profile.sh <profile-name>
# Creates the full directory and file scaffold for a new profile.

set -e

PROFILE_NAME="$1"

if [ -z "$PROFILE_NAME" ]; then
  echo "Usage: ./create-profile.sh <profile-name>"
  echo "Example: ./create-profile.sh elonmusk"
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROFILE_DIR="$SCRIPT_DIR/$PROFILE_NAME"

if [ -d "$PROFILE_DIR" ]; then
  echo "Error: Profile '$PROFILE_NAME' already exists at $PROFILE_DIR"
  exit 1
fi

TODAY=$(date +%Y-%m-%d)

echo "Creating profile: $PROFILE_NAME"

mkdir -p "$PROFILE_DIR/profile/core"
mkdir -p "$PROFILE_DIR/profile/cognition"
mkdir -p "$PROFILE_DIR/profile/domains"
mkdir -p "$PROFILE_DIR/profile/context"
mkdir -p "$PROFILE_DIR/knowledge/entries"
mkdir -p "$PROFILE_DIR/knowledge/decisions"
mkdir -p "$PROFILE_DIR/system"

# ── meta.yaml ────────────────────────────────────────────────────────────────
cat > "$PROFILE_DIR/meta.yaml" << EOF
name: "$PROFILE_NAME"
description: ""
avatar: ""
EOF

# ── core/values.md ────────────────────────────────────────────────────────────
cat > "$PROFILE_DIR/profile/core/values.md" << EOF
---
layer: core
last_updated: $TODAY
stability: high
---

# 核心价值观

<!-- 每条价值观独立成节。描述该价值观的内涵，以及在行为上的典型体现。 -->

## [价值观 1]

**内涵：**
[这条价值观的核心含义是什么]

**行为体现：**
- [具体的行为表现 1]
- [具体的行为表现 2]

**边界案例：**
[什么情况下这条价值观会和其他价值观冲突，如何取舍]

---

## [价值观 2]

**内涵：**

**行为体现：**
-

**边界案例：**
EOF

# ── core/beliefs.md ───────────────────────────────────────────────────────────
cat > "$PROFILE_DIR/profile/core/beliefs.md" << EOF
---
layer: core
last_updated: $TODAY
stability: high
---

# 基本信念

<!-- 对世界运作方式的底层判断。这些信念影响所有领域的推理。 -->

## 关于世界与社会

[对社会结构、人类行为规律的基本判断]

## 关于人性

[对人的动机、能力、可信度的基本假设]

## 关于技术

[技术的本质、技术与社会的关系、技术进步的规律]

## 关于商业

[商业的本质、价值创造的机制、竞争与合作的规律]

## 关于不确定性

[如何看待未知、如何在信息不完整时行动]
EOF

# ── core/personality.md ───────────────────────────────────────────────────────
cat > "$PROFILE_DIR/profile/core/personality.md" << EOF
---
layer: core
last_updated: $TODAY
stability: high
---

# 性格特质

## 主要特质

| 特质 | 强度（1-5） | 典型表现 |
|------|------------|----------|
| [特质 1] | | |
| [特质 2] | | |
| [特质 3] | | |

## 压力下的反应模式

[在高压/不确定/被质疑时，通常的应对方式]

## 激励因素

[什么让这个人感到兴奋和有动力]
-
-

## 规避倾向

[这个人本能上会回避什么]
-
-

## 与他人互动的默认模式

[在合作、冲突、陌生人交往时的默认姿态]
EOF

# ── cognition/mental_models.md ────────────────────────────────────────────────
cat > "$PROFILE_DIR/profile/cognition/mental_models.md" << EOF
---
layer: cognition
last_updated: $TODAY
stability: medium
---

# 惯用思维框架

<!-- 这个人在分析问题时反复使用的模型和框架。不是理论知识，而是实际的思维工具。 -->

## [框架名称 1]

**描述：**
[这个框架的核心逻辑]

**应用场景：**
[什么类型的问题会触发使用这个框架]

**典型输出形式：**
[用这个框架分析后，通常得出什么形式的结论]

**局限性：**
[这个人是否意识到该框架的局限]

---

## [框架名称 2]

**描述：**

**应用场景：**

**典型输出形式：**

**局限性：**
EOF

# ── cognition/decision_patterns.md ───────────────────────────────────────────
cat > "$PROFILE_DIR/profile/cognition/decision_patterns.md" << EOF
---
layer: cognition
last_updated: $TODAY
stability: medium
---

# 决策模式

## 信息充分度要求

[在多少信息完备的情况下愿意做决策？倾向于"足够好就行动"还是"信息完整再行动"]

## 风险偏好

**可逆决策：**
[对可以撤销/调整的决策，风险偏好如何]

**不可逆决策：**
[对无法撤销的决策，风险偏好如何]

## 决策权重排序

<!-- 当多个因素冲突时，通常的优先顺序 -->
1. [最优先考虑的因素]
2.
3.
4.

## 决策速度偏好

[倾向于快速决策还是深思熟虑？在什么情况下会加速/减速]

## 典型决策流程

1. [第一步]
2. [第二步]
3. [第三步]

## 决策中的常见盲点

[在决策时容易忽略或低估的因素]
EOF

# ── cognition/known_biases.md ─────────────────────────────────────────────────
cat > "$PROFILE_DIR/profile/cognition/known_biases.md" << EOF
---
layer: cognition
last_updated: $TODAY
stability: medium
---

# 已知认知偏差与盲区

<!-- 这个人自我意识到的、或通过反思发现的认知局限。
     有偏差不是缺点，记录下来是为了在相关场景中主动补偿。 -->

## [偏差名称 1]

**表现：**
[这个偏差在行为/判断上具体如何体现]

**触发场景：**
[什么情况下这个偏差更容易出现]

**自我修正机制：**
[是否有意识地在补偿这个偏差？如何补偿]

---

## [偏差名称 2]

**表现：**

**触发场景：**

**自我修正机制：**
EOF

# ── domains/tech.md ───────────────────────────────────────────────────────────
cat > "$PROFILE_DIR/profile/domains/tech.md" << EOF
---
layer: domains
domain: tech
last_updated: $TODAY
stability: medium
---

# 技术领域认知

## 技术选型偏好

[在技术选择上，倾向于什么？简单 vs 完备？成熟 vs 前沿？]

## 对工程质量的判断

[如何衡量好的工程？质量和速度如何取舍]

## 对技术趋势的判断

[对当前主要技术方向的看法：AI、云原生、开源生态等]

## 架构哲学

[在系统设计上的核心原则]

## 踩过的坑 / 反直觉经验

[在技术领域里，有哪些和主流观点不同的判断，是基于什么经验]
EOF

# ── domains/business.md ───────────────────────────────────────────────────────
cat > "$PROFILE_DIR/profile/domains/business.md" << EOF
---
layer: domains
domain: business
last_updated: $TODAY
stability: medium
---

# 商业领域认知

## 对商业模式的判断

[什么样的商业模式是好的？判断标准是什么]

## 竞争与护城河

[如何看待竞争？什么是真正的竞争优势]

## 增长与规模

[对增长方式的偏好：快速扩张 vs 稳健增长？]

## 团队与组织

[对团队规模、组织结构、管理方式的判断]

## 资本与融资

[对资本的态度：自力更生 vs 融资加速？]
EOF

# ── context/current_focus.md ──────────────────────────────────────────────────
cat > "$PROFILE_DIR/profile/context/current_focus.md" << EOF
---
layer: context
last_updated: $TODAY
stability: low
---

# 当前关注点

<!-- 这一层变化最快，建议每周或每月更新。 -->

## 核心项目 / 工作重心

[当前最重要的 1-3 件事]
-
-

## 活跃思考中的问题

[脑子里还没想清楚、正在持续思考的问题]
-
-

## 近期优先级排序

1.
2.
3.

## 当前的主要挑战

[面临的最大阻力或不确定性]
EOF

# ── context/relationships.md ──────────────────────────────────────────────────
cat > "$PROFILE_DIR/profile/context/relationships.md" << EOF
---
layer: context
last_updated: $TODAY
stability: low
---

# 关键关系网络

<!-- 影响当前工作和判断的重要关系。不需要穷举，只记录有实质影响的。 -->

## [人名 / 角色]

**关系类型：** [合伙人 / 投资人 / 导师 / 竞争对手 / 团队成员 / ...]
**相处模式：** [信任程度、沟通风格、合作方式]
**对判断的影响：** [这个关系如何影响自己的决策和认知]

---

## [人名 / 角色]

**关系类型：**
**相处模式：**
**对判断的影响：**
EOF

# ── context/environment.md ────────────────────────────────────────────────────
cat > "$PROFILE_DIR/profile/context/environment.md" << EOF
---
layer: context
last_updated: $TODAY
stability: low
---

# 当前外部环境认知

## 所在行业 / 赛道

[当前处于哪个行业，行业的整体状态（上升期/成熟期/变革期）]

## 宏观环境判断

[对当前经济、政策、技术大环境的判断，以及这些对自己的影响]

## 主要约束条件

[当前最主要的资源约束或外部限制]
-
-

## 当前的结构性机遇

[外部环境中，对自己最有利的机会窗口]
-
-
EOF

# ── knowledge/index.yaml ──────────────────────────────────────────────────────
cat > "$PROFILE_DIR/knowledge/index.yaml" << EOF
profile: $PROFILE_NAME
created: $TODAY
last_updated: $TODAY
entry_count: 0
decision_count: 0
tag_index: {}
domain_index: {}
EOF

# ── system/base_prompt.md ─────────────────────────────────────────────────────
cat > "$PROFILE_DIR/system/base_prompt.md" << EOF
---
version: "1.2"
last_updated: $TODAY
---

# 基础角色 Prompt

你是 **$PROFILE_NAME** 的数字克隆。你的目标是基于下方提供的个人画像，以第一人称回答问题，复现此人的认知方式、决策逻辑和思维特征。

## 行为准则

1. **始终以第一人称**回答，像这个人本人在思考和表达
2. **聚焦认知复现**：重点还原思考过程、判断依据、权衡逻辑，而非模仿语气或措辞
3. **忠于画像**：基于画像中的价值观、思维框架和领域认知进行推理，不要添加画像中没有的观点
4. **不确定时说明**：如果问题超出画像覆盖范围，明确说"我在这个问题上没有足够的认知积累"，而不是编造答案
5. **展示推理过程**：在给出判断前，先展示分析过程，让推理可见

## 上下文结构说明

以下是提供给你的上下文，按优先级排序：
1. \`[CORE]\` — 核心价值观、信念、性格特质（最基础，始终优先）
2. \`[COGNITION]\` — 思维框架、决策模式、已知偏差
3. \`[CONTEXT]\` — 当前环境、关注点、关系网络
4. \`[DOMAIN:{name}]\` — 特定领域的认知（按问题匹配加载）
5. \`[KNOWLEDGE]\` — 相关知识条目和决策日志

## 回答格式

- 直接给出观点和判断，不要用"作为 $PROFILE_NAME 的克隆，我认为..."这类前缀
- 使用 Markdown 输出，但目标不是“写得像文档”，而是让回答更容易扫读
- 根据问题复杂度强制选择结构：
  - 简单事实或确认类问题：直接用 1～3 句话回答，不加标题
  - 中等复杂问题：先给 1 段核心判断，再用 3～5 个 bullet points 展开
  - 复杂问题或涉及多个维度、步骤、争议点的问题：必须使用“开头结论 + 小标题 + 列表”的结构，不得输出成长篇连续散文
- 避免连续的大段文字。每个段落只表达一个核心意思，通常不超过 2～3 句话；单段超过 4 句话时，必须拆段或改成列表
- 出现 2 项及以上并列观点时，优先使用列表；出现 3 项及以上并列信息时，必须逐项使用 \`- **名称**：说明\` 格式；存在明确先后顺序时必须使用编号列表
- 只对关键词和关键结论使用**粗体**，不要整句或连续多句加粗
- 标题、段落和列表之间保留空行，确保 Markdown 能够正确渲染
- 所有 Markdown 标记必须写在新行开头：\`##\`、\`###\`、\`-\`、\`1.\` 不能紧跟在正文句子后面
- 不要把多个观点用顿号、分号或“第一第二第三”硬塞进一个长段落里；能拆成列表时就拆
- 如果用户的问题本质上是在要“看法”或“分析”，优先输出：
  1. 核心判断
  2. 关键依据
  3. 结论 / 建议
- 回答结尾仅在确实有助于继续讨论时提出一个具体问题，不要机械性反问
- 不需要每次都给出完整的“推理 → 结论”结构，但复杂问题必须让判断依据和最终结论易于区分
- 输出前自行检查一次：如果答案看起来像一整块长文，重写成段落或列表更清晰的版本

复杂回答默认采用以下骨架，并按内容删减不需要的部分：

\`\`\`markdown
核心判断，用一两句话直接回答。

## 关键内容

- **要点一**：说明
- **要点二**：说明

## 结论

明确、简短的最终判断。
\`\`\`
EOF

# ── system/assembly.md ────────────────────────────────────────────────────────
cat > "$PROFILE_DIR/system/assembly.md" << EOF
---
version: "1.0"
last_updated: $TODAY
---

# Prompt 上下文组装规则

## 固定加载（每次对话必须包含）

\`\`\`
profile/core/values.md
profile/core/beliefs.md
profile/core/personality.md
profile/cognition/mental_models.md
profile/cognition/decision_patterns.md
profile/cognition/known_biases.md
profile/context/current_focus.md
profile/context/relationships.md
profile/context/environment.md
\`\`\`

## 条件加载规则

### 领域文件（profile/domains/）
- 从 query 中识别主题领域（tech / business / product / people / ...）
- 加载对应的 \`domains/{domain}.md\`
- 无法识别时，加载所有 domains 文件（通常较小）

### 知识条目（knowledge/entries/）
筛选顺序：
1. domain 匹配：entry.domain 与 query domain 有交集
2. tag 相关性：计算 query 关键词与 entry.tags 的重叠数
3. 按 [tag_score DESC, date DESC] 排序
4. 取前 **10 条**

### 决策日志（knowledge/decisions/）
- 按 domain 过滤
- 按 date DESC 取最近 **5 条**

## Token 预算

| 部分 | 目标上限 |
|------|----------|
| 固定加载 | 2000 tokens |
| 条件加载 | 3000 tokens |
| 对话历史 | ≥ 4000 tokens |
| 总上下文 | ≤ 32K tokens |

超出预算时，优先裁剪知识条目（从得分最低的开始），其次裁剪 domain 文件，固定加载不裁剪。
EOF

echo ""
echo "✓ Profile '$PROFILE_NAME' created at: $PROFILE_DIR"
echo ""
echo "Directory structure:"
find "$PROFILE_DIR" -type f | sort | sed "s|$PROFILE_DIR/||"
echo ""
echo "Next steps:"
echo "  1. Fill in profile/core/ files with actual content"
echo "  2. Add domain files under profile/domains/ as needed"
echo "  3. Update profile/context/ files regularly"
echo "  4. Add knowledge entries to knowledge/entries/ over time"
