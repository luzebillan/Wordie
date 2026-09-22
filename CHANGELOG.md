# Changelog

All notable changes to this project will be documented in this file.

---

## [v2.1.0] - 2026-09-22

Wordie v2.1.0 重点完成了 **AI 结构化生成上游架构的系统性重构**、落地了 **AI Rewrite 表达式精准标记与候选集作用域隔离（方案 A）**，并完善了 **Practice 练习一键清空与 Revision 随机打乱快捷键体系**。

### 🚀 核心架构重构与特性治理

#### 1. AI 结构化生成与上游 API 架构重构 (Fix #9, #14)
- **确定性细粒度温控 (Per-Call Temperature)**：彻底废除了全局写死的 `temperature: 0.7`，引入按调用维度的参数重载支持。针对 Glossary 术语生成、卡片提取与 JSON 解析等任务强制使用近确定性温度（`temperature: 0.1`），消除自由发散；创造性改写保留发散空间（`0.7`）。
- **System / User 角色契约分离**：告别单一字符串盲拼，拆分为标准的 `role: 'system'`（指令规约）与 `role: 'user'`（目标内容），从根源杜绝模型指令被正文歧义混淆。
- **自适应 JSON 模式与平滑容错 (Native JSON Object with Fallback)**：全面启用官方原生 `response_format: { type: 'json_object' }`；针对部分第三方反代或网关报 HTTP 400/422 的场景，实现自动降级无损重试。
- **状态机级 JSON 控制字符修复与字段别名规范化**：加入专门的字符状态机，自动修复大模型返回中未转义的换行、控制字符与内部引号；兼容 `def_ en` / `def_en` / `explanation` 等字段别名漂移，彻底根除字段错位与换行异常。

#### 2. AI Rewrite 表达式精准标记与候选集隔离 (Fix #13 - 方案 A)
- **Ground-Truth 内联标记契约**：升级提示词协议，要求大模型在改写文本中直接使用 `<mark id="卡片ID">实际融合屈折词</mark>` 进行真值标记，彻底切断下游模糊搜索带来的漏标歧义。
- **候选集作用域隔离 (Candidate Scoping)**：彻底终结了扫描全词库数千张卡片的盲扫正则比对，表达式解析与补偿严格限定在当次练习的候选集（`candidateCards`）内，彻底杜绝词库通用词误伤。
- **正则结合律优先级漏洞修复**：修复了 `COMMON_VERB_INFLECTIONS` 中包含 `|` 析取运算符的词条未加非捕获组包装的缺陷，根除因单词 `double` 误命中短语 `double down on` 的高频 Bug。
- **不规则屈折与词法结构扩展**：补齐 `seek/sought`, `lead/led`, `deal/dealt` 等高频不规则动词变化表，全面支持动词原形前缀（`to do`, `(to) take`）与占位符（`sb's`, `sth.`）的句法解析与屈折还原。
- **边界标点解构与 ID 碰撞防护**：智能剥离 `<mark>` 标签内的粘连标点；优先进行卡片 Front 字符串完整比对，防止数字词条（如 `Catch-22`, `24/7`）被数字正则误匹配为卡片 ID；前端直接消费后端预分段结果，实现前后端零重复计算。

#### 3. Practice 练习清空功能与快捷键 (New #11)
- **全模式清空按钮**：在 Practice 全部三大子 Tab（`Pure Listener`、`Rewrite Practice`、`AI Version`）中统一增设 Clear（橡皮擦）按钮。
- **全局快捷键与原子化重置**：配置默认 `Ctrl+Q` / `Cmd+Q` 清空快捷键，一键同步原子化清空文本框输入、识别状态与卡片选中池，并提供清晰的快捷键悬浮提示。

#### 4. Revision 复习卡片随机洗牌快捷键 (New #10)
- **新增 `Ctrl+Tab` 洗牌快捷键**：统一扩展快捷键注册表 `revision.shuffle`，在卡片复习与列表模式下均可快速打乱队列。
- **体验加固**：阻止浏览器默认 Tab 焦点跳转，并在洗牌同时重置背面显示状态，杜绝切牌时的瞬时翻面闪烁。

#### 5. 工程规范与质量保证 (Test & CI)
- **测试覆盖**：新增 `test/aiInvocationRedesign.test.ts` 与 `test/shortcuts.test.ts`；全量 13 个测试套件、192 项自动化测试 100% 通过。
- **类型检查与静态扫描**：TypeScript 全量校验 0 错误，Linter 静态扫描 0 错误。
- **多平台 CI 构建**：跨 Windows (nsis)、macOS (dmg/zip)、Linux (AppImage) 自动化编译产物完整打包发布。

---

## [v2.0.0] - 2026-09-18

Wordie v2.0.0 是一次里程碑式的架构重构版本，重点重构了**本地向量检索基础设施**、升级了 **Practice AI Rewrite 单阶段流水线**、根治了**复习计数同步问题**，并全面支持了 **CJK 倒排索引与多语言词向量**。

### 🚀 核心架构重构与新特性

#### 1. 多语言本地嵌入模型升级 (Multilingual Vector Retrieval)
- 全面淘汰纯英文 WordPiece 词表的旧模型，升级为支持 50+ 种语言的 `Xenova/paraphrase-multilingual-MiniLM-L12-v2`（ONNX q8，384 维，XLM-RoBERTa 25 万词表）。
- 消除了中文字符在旧模型下被降维映射为 `[UNK]` 的缺陷，跨语言语义匹配判别裕度从 0.06 暴增至 0.74。
- 由错误的 `cls` 恢复为官方原生的 `mean` pooling，彻底消除了各向异性（Anisotropy）带来的 0.80 假阳性底噪。
- 新增 `getEmbeddingsBatch` 并行推理接口，千张卡片全量重构迁移仅需约 1.5 秒。

#### 2. Practice AI Rewrite 架构重构 (Single-Pass RAG)
- 废弃了“提取-匹配-改写”三步串联，重构为基于精选候选词库的 Single-Pass RAG，改写耗时由 10~15 秒骤降至 2~3 秒，Token 成本降低 65%。
- 结果面板全面支持中日英韩字符、通配符表达（如 `take * off`）及多行术语的高亮渲染与即时卡片预览交互。

#### 3. SQLite FTS5 CJK 倒排索引重构
- 注册 `cjk_unigram` 投影函数与虚拟表触发器，中文单字、双字、词根中缀检索全部毫秒级走倒排索引，彻底移除 5 列全表 `LIKE '%...%'` 暴力扫描。

#### 4. 复习会话（SRS）计数与状态机加固
- 修复 `getDueCards` 未排除当天已复习卡片的 SQL 漏洞，复习进度条与计数严格由内存状态机推导。
- 级联删除历史复习日志，平滑自适应修正复习队列游标。

#### 5. Gemini 3.7 Flash & 思考模型兼容
- 升级 `callAiApi` 与 Daily Word 生成的 `max_tokens` 至 2000，消除 Gemini 3.7 Thinking 截断问题。

#### 6. Sketch Engine CQL 规则优化
- 引入正则负向后行断言保护 `anyone's`，后缀匹配白名单扩充 `aught`。

#### 7. 构建与打包体积优化
- 修复 Vite 多环境构建时模型冗余拷贝缺陷，阻断 258MB 冗余模型文件打包进 asar。
