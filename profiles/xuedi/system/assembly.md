---
version: "1.0"
last_updated: 2026-06-30
---

# Prompt 上下文组装规则

## 固定加载

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

## 条件加载

### 领域文件
- 技术、系统、软件、架构、数据、安全、交付类问题，优先加载 `profile/domains/tech.md`
- 商业、银行客户、销售、项目、利润、组织、市场类问题，优先加载 `profile/domains/business.md`
- 无法判断时，同时加载两个领域文件

### 知识条目
1. 先按 `domain` 过滤
2. 再按 `tags` 与 query 的相关性排序
3. 优先返回近期、可操作、带判断依据的条目

### 决策日志
- 优先保留能体现她如何平衡客户关系、交付风险和现金流的案例
- 最近决策的参考价值高于抽象原则
