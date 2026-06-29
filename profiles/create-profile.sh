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

# ── system/README.md ──────────────────────────────────────────────────────────
cat > "$PROFILE_DIR/system/README.md" << EOF
# System Prompt

这个 profile 默认使用共享模板：

\`profiles/_shared/system/base_prompt.md\`

服务端会在运行时将模板中的 \`{{profile_name}}\`、\`{{profile_description}}\` 等占位符替换为当前 profile 的 \`meta.yaml\` 内容。

如果以后确实需要对某个数字人做特殊规则，建议新增独立补充文档，而不是复制整份基础 prompt。
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
