# **CardsApp Pre-Spec 需求基线与新对话交接文档**

# **第一部分：Pre-Spec 需求基线草案 (Requirements Baseline)**

## **1\. 系统全局 Shell 与常驻配置 (Global Shell & Shared Config)**

* **三个核心功能 Tab**：`New Cards`（制作新卡）、`Revision`（卡片复习）、`Practice`（写作与表达运用）。  
* **左侧常驻配置面板 (Left Panel)**：  
  * `AI URL` (文本输入框)  
  * `API Key` (文本输入框)  
  * `AI Model` (下拉选择框或自定义文本输入框)  
  * `Sketch Engine Key` (文本输入框)：预料库付费 API Key。每次更新该 Key 时，系统授权到期时间（`Until [Date]`）自动向前推迟 31 天。  
* **左侧/顶部数据面板 (Top Dashboard)**：  
  * `Until [Date]`：当前 Key 到期日期（如 `Until Sept. 1st, 2026`）。  
  * **Today 统计卡片**：  
    * `Cards Reviewed`：今日已复习卡片数量。  
    * `Retention Rate`：记忆率。计算公式为"所有第一遍复习就正确的卡片数 ÷ 总复习卡片数"。  
    * `Cards To Review`：今日待复习卡片数量。  
  * `Search`：全局搜索框，对全库（四类卡片）进行中英文字符串/语义检索。

## **2\. 应用生命周期与加载流程 (Lifecycle & Loading)**

* **Page 1 (启动页)**：打开 .exe 后前 1\~2 秒展示 `Welcome` 标语与当天日期（如 `Jul. 28th, 2026`）。  
* **Page 2 (预加载页)**：加载过渡期，展示今日统计概览（`Cards To Review` 与 `Cards Reviewed`）。  
* **Page 3+ (主界面)**：加载完毕，默认停留在 `New Cards` \- `Useful Expressions` 模块。

## **3\. 核心功能一：制作新卡 (New Cards)**

包含 4 个带分色进度条的子分类 Tab：

### **3.1 Useful Expressions (常用表达)**

* **输入与交互**：  
  * `Context`：多行长文本框，允许复制粘贴完整句子/语境。  
  * `Style`（语体选项）：`Informal`、`Formal`、`General`。单选/互斥规则：Informal 与 Formal 二选一；都不勾选或全勾选自动激活 General；选了 General 无法勾选前两者。  
  * `Front Side`（本词/正面）：输入框，填入语境中的目标词汇。  
  * `Back Side`：点击 AI 生成按钮，AI 分析词汇在 Context 中的语义并输出 `AI-Generated Explanation`。  
* **查重与保存机制**：  
  * 右侧显示数据库中至多 3 个相似卡片。无匹配显示 `No Similar Expressions Found`。  
  * 匹配项操作：点击 `+1` 增加该已有卡片的"复习次数"。  
  * 保存操作 (`Save`)：保存新卡片，存储字段包括：Style 标签、Front Side（本词）、Back Side（AI释义）、初始复习次数（Reviews Count）、使用次数（Use Count）。

### **3.2 Glossary (术语)**

* **输入与交互**：  
  * `Term`：中/英文术语输入框。  
  * `Label`：预设学科分类复选框（Biology, Environment, Chemistry, Culture, Maths, Sociology, Economics/Finance, Engineering, Entertainment, Sports, Geography, History, Medicine, Philosophy, Psychology, Agriculture, Politics, Game Theory）。支持多选及点击 `Create New Labels` 自定义创建。  
  * 点击 `Create Glossary` 触发 AI 生成中英双语术语及释义。  
* **生成结果与保存**：  
  * `Front Side`：中英双语术语翻译（例如 Carbon dioxide \<-\> 二氧化碳），建议字段拆分存储。  
  * `Back Side`：AI 生成的中英文双语解释。  
  * 右侧显示至多 1 个精准匹配项，支持点击 `+1` 增加复习次数。  
  * 点击 `Save` 保存至术语数据库。

### **3.3 Daily Words (日常用语)**

* **输入与交互（二选一互斥）**：  
  * 方式 A：正面输入中文文本。  
  * 方式 B：`Paste the Link of Your Photo` 粘贴图片链接。要求直接在界面渲染图片。  
  * 互斥逻辑：输入文本则禁用图片链接框，反之亦然。  
* **生成与保存**：  
  * 模式 A：点击 `Check`，由 AI 自动查找/询问对应英文。  
  * 模式 B：自填模式，用户直接在 `Back Side` 输入英文答案。  
  * 支持精准字符串匹配查重，已有项点击 `+1`，新项点击 `Save`。

### **3.4 Ready Versions (固定表达)**

* **输入与交互**：  
  * `Type`（4选1固定分类）：`Noun Phrase`、`Verb Phrase`、`Adjective Phrase`、`Sentence`（不可修改/添加）。  
  * `Front Side`：中文固定表达；`Back Side`：英文固定表达。  
* **查重与保存**：  
  * 点击 `Check` 执行中英文字符串匹配，匹配项可点击 `+1`，新项点击 `Save`。

## **4\. 核心功能二：卡片复习 (Revision)**

顶部显示三段式复习进度条（深色为已复习、淡色为未复习、红色为首次做错的 `Second Review`）。

### **4.1 Useful Expressions 复习**

* 从语料库抓取语境，由 AI 修饰改写为完形填空 (`Cloze Test`)。  
* 展示绑定的 Style 标签。点击 `Show Answers` 展开挖空的本词与语义。  
* **可编辑框与实时保存**：提供文本编辑框，修改后点击 `Save` 直接更新数据库中的原卡片内容。  
* **评估按钮与算法**：  
  * `Forget`：记错，卡片标记进入 `Second Review` 队列，按 SRS 算法扣分。  
  * `Got it`：记对，按 SRS 算法加分并推迟下一次复习时间。

### **4.2 Glossary 复习**

* 随机单语展示：随机展示中文或英文术语（术语与解释语言统一），显示学科标签。  
* 点击 `Show Answers` 展开对应另一种语言的翻译与解释。提供可编辑框 \+ `Save`，以及 `Forget` / `Got it`。

### **4.3 Daily Words 复习**

* 文本类：正面仅展示中文，看答案展开英文。  
* 图片类：正面仅展示图片，看答案展开英文释义。  
* 均提供可编辑框 \+ `Save`，以及 `Forget` / `Got it`。

### **4.4 Ready Versions 复习**

* 正面仅展示中文，看答案展开英文，提供可编辑框 \+ `Save`，以及 `Forget` / `Got it`。

## **5\. 核心功能三：写作与表达运用 (Practice)**

顶部展示成就进度条（按照 50, 100, 500, 1000 梯度递增，生成一次 \+1）。用户在 My Version 输入框输入自己的段落（支持文本或语音输入）。

### **5.1 Pure Listener 模式**

* AI 从读者视角输出读后反馈 `Pure Listener Feedback`。

### **5.2 Revision 模式**

* AI 检索用户 `Useful Expressions` 库，筛选至少 6\~8 个可用词汇嵌入并润色用户文本。  
* 替换词汇在文中**高亮显示**。  
* **高亮卡片交互弹窗**：点击高亮词汇（如 `expression1`）弹出 Card 弹窗，展示中文、英文、反面释义。  
* **使用次数计数器**：弹窗展示 `X Used` 及 `+1` 按钮。点击 `+1` **仅增加该卡片在数据库中的"使用次数（Use Count）"**，不影响复习次数。

### **5.3 AI Version 模式**

* AI 完全根据原文重写全新的优质文本。  
* **一键转新卡**：右下角提供"添加新卡"入口，点击后在当前页唤起 `Useful Expressions` 的新建卡片流程，保存时增加的是**复习次数**。

# **第二部分：新对话交接指南 (Handoff Guide for New Agent)**

## **1\. 项目背景与当前进展 (Project Context & Progress)**

* **目标**：开发一款基于 AI 与个人语料库（Sketch Engine）的高效语言学习桌面应用（CardsApp）。  
* **当前进度**：  
  - [x] 完成 27 页 UI 参考图 PDF 的穷尽式解耦提取。  
  - [x] 完成视频转文字 TXT 的逻辑纠错与语义归一。  
  - [x] 完成 UI-逻辑映射对照矩阵（Mapping Matrix）。  
  - [x] 整理出完整的 Pre-Spec 需求基线草案。  
  - [ ] **待执行**：走 Matt Pocock 工作流（grilling \-\> to Spec \-\> to Tickets）。

## **2\. 待解答的部分核心疑点清单 (Open Questions for Grilling)**

请新 Agent 在开启 Matt 工作流时，重点关注并协助用户澄清以下问题：

1. **加载页跳转逻辑**：Page 1 显示 1\~2 秒，Page 2 预加载页显示多久进入主界面？等待初始化响应？  
2. **`Retention Rate` 统计范围**："第一遍复习就正确的卡片比例"是统计历史全量还是仅统计当日？  
3. **Key 到期时间控制**：只有更新 `Sketch Engine Key` 会自动推进 31 天？  
4. **图片链接容错**：`Daily Words` 外链图片渲染失败或过期时，是否需要本地上传（File Picker）兜底？  
5. **复习卡片实时编辑影响**：在复习界面编辑卡片内容并点击 `Save` 后，卡片的 SRS 算法状态（复习历史、间隔）是否重置？  
6. **`Practice - Revision` 短文本替换降级策略**：若用户输入的段落过短，库中无法匹配出 6\~8 个词汇时，AI 应降低替换数还是自动补充通用词？  
7. **`Practice` 模块语料库扩展**：使用次数（Use Count）高亮替换目前仅适用于 `Useful Expressions`，其他三类未来是否扩展？  
8. **算法数学模型**：说明中提及"PyCharm 中使用的算法"，具体的间隔重复算法（SRS）公式和参数配置是什么？  
9. 主界面左下角的各项配置是否要做成独立设置界面？  
10. 暂定使用Electron，有没有更好的框架？本地部署npm install时遇到权限问题？添加allowScripts？  
11. 甲方不懂代码，类似`AI URL``API Key``AI Model``Sketch Engine Key`这些选项是否有效？
12. 其他问题，继续grill.

## **3\. 推荐使用的 Skills (Suggested Skills)**

请新 Agent 在后续对话中按顺序调用以下技能：

* **`user:grill-with-docs`**：针对上述 8 个疑点对用户进行深度拷问，补齐边缘逻辑与设计细节。  
* **`user:to-spec`**：在疑点澄清后，将 Pre-Spec 转化为符合标准的工程 Spec。  
* **`user:to-tickets`**：将 Spec 拆解为具备 Blocking Edges 的开发 Tickets 清单。  
* **`user:implement`**

