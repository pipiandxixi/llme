# [TODO] llme 个人数字克隆系统——画像、记忆与对话架构说明

更新日期：2026-06-30

本说明文档通过信息流与架构图，直观展现升级后 llme 系统在画像分层构造、记忆自动化加工以及对话装配三个场景下的完整运作机制。

---

## 1. 场景一：画像的分层构造与动态更新（数字人生命周期）

此场景展示如何从用户手动描述、原始对话、访谈等文本中，利用大语言模型（LLM）将散乱信息沉淀并分类整理为数字克隆人的**四层静态画像**。

```mermaid
graph TD
    %% 原始输入数据
    subgraph raw_inputs["原始输入数据 (Raw Inputs)"]
        In1[手动录入的个人背景描述]
        In2[采访或访谈的速记文本]
        In3[聊天记录/社交媒体历史言论]
    end

    %% 提炼与分析器
    subgraph analyzer["提炼与分析器 (LLM Profile Analyzer)"]
        PA1[价值观与信念识别器]
        PA2[思维模型与决策模式提炼器]
        PA3[专业/行业领域见解分类器]
        PA4[实时情境与焦点变动追踪器]
    end

    %% 分层画像库
    subgraph storage["分层画像库 (Layered Profile Storage)"]
        direction TB
        subgraph core["核心层 Core - 更新频率：年"]
            P_Val[values.md 核心价值观]
            P_Bel[beliefs.md 基本信念]
            P_Per[personality.md 性格特质]
        end
        subgraph cognition["认知层 Cognition - 更新频率：季"]
            P_Mod[mental_models.md 思维框架]
            P_Dec[decision_patterns.md 决策模式]
            P_Bia[known_biases.md 认知偏差与盲区]
        end
        subgraph domains["领域层 Domains - 更新频率：月"]
            P_Dom1[tech.md 技术领域认知判断]
            P_Dom2[business.md 商业领域判断]
        end
        subgraph context["情境层 Context - 更新频率：周"]
            P_Foc[current_focus.md 当前工作重心]
            P_Rel[relationships.md 关键关系网络]
            P_Env[environment.md 外部环境认知]
        end
    end

    %% 流程连接
    In1 --> PA1
    In2 --> PA2
    In3 --> PA3
    In1 & In2 & In3 --> PA4

    PA1 --> P_Val & P_Bel & P_Per
    PA2 --> P_Mod & P_Dec & P_Bia
    PA3 --> P_Dom1 & P_Dom2
    PA4 --> P_Foc & P_Rel & P_Env
```

### 关键步骤说明
1.  **输入接收**：归档原始非结构化文本（包括直接描述、访谈速记及日常聊天对话记录）。
2.  **分流提炼**：大模型识别文本中所体现的人格特征、分析视角或当下动态。
3.  **分层沉淀**：
    *   **核心层**：写入人格基本盘，稳定性极高（如“本分”、“诚信”）。
    *   **认知层**：提炼反复使用的逻辑框架（如“第一性原理”）。
    *   **领域层**：分门别类地记录特定行业的认知（如对大模型的态度）。
    *   **情境层**：维护短期活跃变量（如当前焦点、关系变化、外部约束）。**该层除了系统初始化手工输入外，会由“场景二：日常记忆加工流水线”根据日常对话内容进行全自动覆写与更新，不设人工 Review 阻断，依靠 Git 进行事后审计追踪。**

---

## 2. 场景二：记忆的自动化提炼与关联加工（LLM-Wiki 流水线）

此场景展示如何将口语化的、低密度的日常原始记忆自动化转化为高密度的主题 Wiki 网，并自动产生溯源图谱与 Git 提交版本日志。

```mermaid
graph TD
    %% 原始素材归档
    subgraph raw_memories["原始素材归档 (Raw Memories)"]
        R1[raw_memories/interviews/ 访谈]
        R2[raw_memories/dialogues/ 对话记录]
        R3[raw_memories/speeches/ 演讲/发表物]
    end

    %% 自动化记忆加工管道
    subgraph pipeline["自动化记忆加工管道 (Auto Processing Pipeline)"]
        Pipe1[扫描未处理文件 processed: false]
        Pipe2[LLM 提取知识要点 concepts]
        Pipe3[加载并比对已存在的 Wiki 节点]
        Pipe4[合并知识内容 & 追加 sources 原始 ID]
    end

    %% 加工后 Wiki 记忆库
    subgraph wiki_root["高密 Wiki 记忆库 (knowledge/wiki/)"]
        idx[index.yaml 关联图谱与计数]
        
        subgraph business["商业类 wiki/business/"]
            W_Saas[enterprise_software.md 企业软件逻辑]
            W_Team[team_management.md 团队管理]
        end

        subgraph tech["技术类 wiki/tech/"]
            W_LLM[large_language_models.md 大语言模型]
            W_Hw[hardware_acceleration.md 硬件加速]
        end
    end
    
    %% 自动版本日志
    subgraph audit["自动版本日志 (Audit trail)"]
        Git[Git 历史记录 git commit & log -p]
    end

    %% 连接关系
    R1 & R2 & R3 --> Pipe1
    Pipe1 --> Pipe2
    Pipe2 --> Pipe3
    Pipe3 --> Pipe4
    
    Pipe4 -->|写入| idx
    Pipe4 -->|合并/新建| W_Saas
    Pipe4 -->|合并/新建| W_LLM
    Pipe4 -->|自动运行 Git Commit| Git

    %% 双链关联
    W_Saas ---|"Obsidian 双链 [[team_management]]"| W_Team
    W_Saas ---|"Obsidian 双链 [[large_language_models]]"| W_LLM
    W_LLM ---|"Obsidian 双链 [[hardware_acceleration]]"| W_Hw
```

### 关键步骤说明
1.  **文件检索**：通过字段扫描筛选未加工的原始文件（processed: false）。
2.  **观点与画像分流提炼**：大模型读取原始数据进行**双向提取**：
    *   **记忆提取**：提炼高密度观点/事实，进入 Wiki 知识库更新流程。
    *   **情境提取**：检测对话中是否包含“焦点变化、关系状态转移、外部环境变动”等高频情境信息，提炼为情境层增量，写入 `profile/context/`。
3.  **Wiki合并与双链**：若提炼的概念已存在，LLM 合并正文并追加 sources 原文件 ID，自动生成 `[[Concept]]` 双链并更新 `index.yaml`。
4.  **自动写入与 Git 审计**：直接覆写对应的 Wiki 页面与 `profile/context/` 下的情境文件，随后触发 Git Commit 提交所有变更。

---

## 3. 场景三：画像与记忆在对话中的装配应用（RAG 运行期）

此场景展示在用户输入问题时，后端引擎如何读取分层画像、计算匹配高密 Wiki 节点，并在大语言模型上下文预算内最终组装成数字人答复的完整过程。

```mermaid
graph TD
    %% 输入与分流
    User[用户提问 User Query] --> Det[Domain 识别: domain_detector.ts]

    %% 领域分流
    Det -->|匹配到领域| DomMatched[提取指定领域, 如 business/tech]
    Det -->|未匹配到领域| DomAll[加载全部 Domains 页面]

    %% 画像加载
    subgraph profile_load["画像加载 (Profile Loading)"]
        Core[1. 读取固定画像: core/* & cognition/* & context/*]
        Doms[2. 读取过滤后的 domains/ 页面]
    end
    
    %% 记忆检索与加载
    subgraph memory_retrieve["记忆检索 (Wiki Memory Retrieval)"]
        Scan[3. 遍历并解析 knowledge/wiki/ 节点]
        Score[4. 根据关键词/标签匹配度打分]
        LinkWalk[5. 关联页面回溯加载]
        Filter[6. 截取 Top N 记忆页面]
    end

    %% 上下文拼装
    subgraph prompt_assembly["提示词拼装 (Prompt Assembly)"]
        Base[加载系统 base_prompt.md 模板]
        XML[拼装为带有 XML 标签的上下文]
        History[附加当前对话历史记录]
    end

    %% 模型执行
    LLM[LLM 推理服务 Claude/Gemini]
    Resp[克隆人数字答复 JSON/Markdown]

    %% 流程走向
    DomMatched --> Doms
    DomAll --> Doms
    
    User --> Scan
    Scan --> Score
    Score --> LinkWalk
    LinkWalk --> Filter

    Core & Doms --> XML
    Filter --> XML
    Base --> XML
    XML --> LLM
    History --> LLM
    LLM --> Resp
```

### 关键步骤说明
1.  **关键词识别**：[domain-detector.ts](file:///Users/zhoufan/Public/workspace/llme/app/server/src/lib/domain-detector.ts) 精确识别查询的关注点。
2.  **并行组装**：
    *   **核心画像**（恒定加载）：确保数字人行为和底色保持一致。
    *   **Wiki 记忆**：[knowledge-retriever.ts](file:///Users/zhoufan/Public/workspace/llme/app/server/src/lib/knowledge-retriever.ts) 根据打分结果和双链指向，智能捞取最相关的概念面。
3.  **XML 包装**：使用标准的 `<core>`、`<cognition>`、`<domain>` 以及 `<knowledge>` 标签对各模块进行围闭隔离，方便 LLM 准确解构上下文。
4.  **模型流式输出**：LLM 扮演数字克隆人本人身份，根据上下文直接给出符合其认知的解答。
