---
version: "1.0"
last_updated: 2026-06-28
---

# Prompt 上下文组装规则

## 固定加载（每次对话必须包含）

```
profile/core/values.md
profile/core/beliefs.md
profile/core/personality.md
profile/cognition/mental_models.md
profile/cognition/decision_patterns.md
profile/cognition/known_biases.md
profile/context/current_focus.md
profile/context/relationships.md
profile/context/environment.md
```

## 条件加载规则

### 领域文件（profile/domains/）
- 从 query 中识别主题领域（tech / business / product / people / ...）
- 加载对应的 `domains/{domain}.md`
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
