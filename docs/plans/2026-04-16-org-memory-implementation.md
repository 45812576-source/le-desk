# Le Desk 组织 Memory — 可执行实施文档

日期：2026-04-16

## 1. 背景与目标

当前 `Le Desk` 的组织管理入口承载了过多“管理台”能力：组织架构、花名册、OKR、部门职责、业务流程、岗位能力、协作矩阵等都以“系统内维护”为默认前提，但实际问题有三个：

1. 信息维护成本高，容易失真
2. 组织信息和知识库/Skill/审批的连接不清晰
3. LLM 缺少统一、稳定、可追溯的组织语义输入

本期目标不是继续做一个组织管理系统，而是把组织信息收敛成一个**文档驱动的组织-部门级 Memory 层**，作为后续三类消费端的统一上游：

1. 知识库文档自动分类规则和敏感/共享标签
2. Skill 自动权限判断与挂载建议
3. 权限审批

## 2. 已确认前提

本方案按以下前提执行：

- 组织 Memory 的主对象采用 `组织 / 部门 / 岗位 / 人员 / OKR / 流程` 六类
- 日常维护不在系统里做，系统只读外部源文档
- 源文档采用“关键章节模板 + 其余自由写”的混合模式
- 系统只生成草案，不直接改正式知识库结构
- 三类消费端共用同一份“组织 Memory 推断草案”
- 敏感控制不只看内容类型，还要看：
  - 理论可共享范围
  - 使用意图
  - 匿名化/摘要化要求

## 3. 一期设计原则

### 3.1 产品原则

- 不做组织主数据系统
- 不做系统内人工编辑
- 不做全量自动生效
- 不让分类、Skill 挂载、审批各自产生一套规则

### 3.2 技术原则

- 外部文档是唯一事实源
- 系统内只保留“快照、证据、草案、审批、生效结果”
- 所有推断必须可追溯到源文档证据
- 高风险动作必须通过审批后生效

## 4. 一期范围

### 4.1 做什么

一期只做四步：

1. 导入/同步组织源文档
2. 解析为结构化组织 Memory 快照
3. 基于快照生成统一草案
4. 审批通过后把草案写入正式配置

### 4.2 不做什么

- 不做组织树、花名册、岗位、OKR 的系统内编辑
- 不做复杂人事主数据校验
- 不做历史知识库大迁移
- 不做完全自动 Skill 挂载
- 不做细粒度动态 ABAC 引擎
- 不做全部 Skill 的全量权限重算

## 5. 信息架构

### 5.1 新的信息流

```text
外部源文档
  ↓
OrgMemorySource
  ↓ 解析
OrgMemorySnapshot
  ↓ 推断
OrgMemoryProposal
  ↓ 审批
OrgMemoryDecision
  ↓ 写入
正式配置（知识库结构 / 分类规则 / 共享标签 / Skill挂载）
```

### 5.2 与现有页面的关系

当前 `src/app/(app)/admin/org-management/page.tsx` 是“组织管理”多 Tab 工作台，一期应把它收缩为“组织 Memory 治理台”。

建议保留 4 个主视图：

1. `概览`：最近源文档、最近快照、最近草案、待审批数
2. `源文档`：导入、同步、查看解析状态
3. `快照`：只读查看结构化结果与证据
4. `草案`：查看 diff、提交审批、看审批状态

原有 Tab 的处理建议：

- `组织架构 / 花名册 / OKR / 部门职责 / 业务流程`：不再作为编辑台，改为快照视图子页
- `岗位能力 / 资源库定义 / KR 映射 / 协同协议 / 术语 / 协作矩阵 / 访问矩阵`：本期从主导航移除，后续按需要从草案或配置页进入

## 6. 源文档约束

### 6.1 必填章节

源文档必须至少有以下章节：

1. 组织架构
2. 花名册
3. 部门职责
4. 岗位职责
5. OKR
6. 业务流程

### 6.2 最小字段要求

- 组织/部门：`名称 / 上级 / 负责人 / 职责`
- 人员：`姓名 / 部门 / 岗位 / 状态`
- 岗位：`岗位名称 / 归属部门 / 职责`
- OKR：`周期 / 目标 / KR / 归属部门`
- 流程：`流程名称 / 所属部门 / 参与岗位 / 输入输出`

### 6.3 解析要求

- 允许自然语言描述
- 关键字段必须能抽取
- 每个结构化字段都必须带证据位置
- 抽取低置信度时必须标记待人工审阅

## 7. 核心数据模型

### 7.1 Source 层

#### `OrgMemorySource`

记录一次源文档输入。

建议字段：

- `id`
- `source_type`：`feishu_doc | notion | markdown | upload`
- `source_uri`
- `title`
- `external_version`
- `fetched_at`
- `ingest_status`
- `raw_content_ref`
- `created_by`

### 7.2 Snapshot 层

#### `OrgMemorySnapshot`

记录一次解析后的组织 Memory 快照，是后续推断唯一输入。

建议字段：

- `id`
- `source_id`
- `snapshot_version`
- `parse_status`
- `parse_summary`
- `confidence_score`
- `created_at`

#### `OrgUnit`

- `id`
- `snapshot_id`
- `unit_type`：`org | dept`
- `name`
- `parent_unit_id`
- `leader_name`
- `responsibilities`
- `business_domains`
- `sensitive_domains`
- `evidence_refs`

#### `RoleProfile`

- `id`
- `snapshot_id`
- `dept_id`
- `name`
- `responsibilities`
- `default_allowed_domains`
- `default_blocked_domains`
- `evidence_refs`

#### `PersonProfile`

- `id`
- `snapshot_id`
- `name`
- `dept_id`
- `role_id`
- `manager_name`
- `employment_status`
- `evidence_refs`

#### `OkrItem`

- `id`
- `snapshot_id`
- `owner_unit_id`
- `period`
- `objective`
- `key_results`
- `linked_process_ids`
- `evidence_refs`

#### `BusinessProcess`

- `id`
- `snapshot_id`
- `owner_unit_id`
- `name`
- `participants`
- `inputs`
- `outputs`
- `linked_knowledge_domains`
- `risk_points`
- `evidence_refs`

### 7.3 Proposal 层

#### `OrgMemoryProposal`

统一草案，不拆成三套规则源。

建议字段：

- `id`
- `snapshot_id`
- `proposal_status`：`draft | pending_approval | approved | rejected | partially_approved`
- `risk_level`
- `summary`
- `created_at`
- `submitted_at`

#### `ProposalKnowledgeStructureItem`

- `proposal_id`
- `change_type`：`create | rename | move | archive`
- `target_path`
- `dept_scope`
- `rationale`
- `confidence_score`
- `evidence_refs`

#### `ProposalClassificationRuleItem`

- `proposal_id`
- `target_scope`
- `match_signals`
- `default_folder_path`
- `origin_scope`
- `allowed_scope`
- `usage_purpose`
- `redaction_mode`
- `rationale`
- `evidence_refs`

#### `ProposalSkillMountItem`

- `proposal_id`
- `skill_id`
- `skill_name`
- `target_scope`
- `required_domains`
- `max_allowed_scope`
- `required_redaction_mode`
- `decision`：`allow | require_approval | deny`
- `rationale`
- `evidence_refs`

#### `ProposalApprovalImpactItem`

- `proposal_id`
- `impact_type`
- `target_asset_type`
- `target_asset_id`
- `risk_reason`
- `requires_manual_approval`
- `evidence_refs`

### 7.4 Decision 层

#### `OrgMemoryDecision`

- `id`
- `proposal_id`
- `decision`：`approved | rejected | needs_info | partially_approved`
- `reviewer_id`
- `decision_note`
- `created_at`

## 8. 共享范围与匿名化标签模型

这是本方案和普通“敏感级标签”最大的区别。

### 8.1 为什么不能只打敏感级

同样是“客户案例”，其可共享范围可能完全不同：

- 某一线商务的真实客户案例：理论上只允许本人 + leader 访问
- 部门培训案例：允许部门内传播，但必须去标识化
- 公司级方法论案例：只允许共享抽象模式，不共享原文

因此本期不只做“高/中/低敏”标签，而是组合策略。

### 8.2 一期落地字段

每条分类/共享建议至少要有：

- `origin_scope`：理论原始共享范围
  - `self`
  - `manager_chain`
  - `department`
  - `cross_department`
  - `company`
- `allowed_scope`：审批后允许共享范围
- `usage_purpose`：使用意图
  - `execution`
  - `management_review`
  - `training`
  - `knowledge_reuse`
  - `llm_qa`
- `redaction_mode`：共享形态
  - `raw`
  - `masked`
  - `summary`
  - `pattern_only`
- `evidence_level`
  - `explicit`
  - `inferred`
  - `reviewer_confirmed`

### 8.3 一期判定规则

- 如果 `allowed_scope > origin_scope`，则必须审批
- 如果 `redaction_mode` 从 `summary/pattern_only` 下降为 `masked/raw`，则必须审批
- 如果 `usage_purpose = llm_qa` 且源内容属于 `self/manager_chain`，默认只能输出 `summary` 或 `pattern_only`
- 如果文档归属为部门知识但含客户/个人强标识，默认建议 `masked`

## 9. 三类消费端落地方式

### 9.1 消费端一：知识库自动分类与共享标签

一期只做：

- 目录建议
- 分类规则建议
- 共享范围/匿名化标签建议

一期不做：

- 历史文档批量搬迁
- 所有历史知识自动重打标签

正式配置落点：

- 知识目录路径建议
- 新文档默认分类规则
- 文档默认共享/匿名化策略

### 9.2 消费端二：Skill 自动权限判断和挂载

每个 Skill 需要补一份最小声明：

- 服务对象
- 适用部门
- 需要的知识域
- 可接受的共享范围上限
- 可接受的匿名化级别

系统把 Skill 声明与 `OrgMemoryProposal` 匹配，生成三类建议：

- `allow`
- `require_approval`
- `deny`

一期只做到“建议 + 审批 + 生效”，不做完全自动挂载。

### 9.3 消费端三：权限审批

审批对象是整份 `OrgMemoryProposal`，但审批视图按四组展示：

1. 知识库结构变化
2. 分类规则变化
3. 共享范围/匿名化变化
4. Skill 挂载变化

每条变更必须展示：

- 来源文档片段
- 影响范围
- 风险等级
- 推断理由
- 是否需要人工审批

## 10. 审批规则

### 10.1 新审批类型

建议在 `src/lib/knowledge-permission-constants.ts` 追加以下动作/审批类型承接：

- `org_memory.proposal.approve`
- `org_memory.proposal.reject`
- `knowledge.scope.expand`
- `knowledge.redaction.lower`
- `skill.mount.approve_by_org_memory`

### 10.2 触发规则

以下情况必须进入审批：

1. 新建/调整组织知识主目录
2. 扩大 `allowed_scope`
3. 降低 `redaction_mode`
4. Skill 首次挂载到新的部门知识域
5. Skill 请求读取 `department` 以上共享范围内容
6. Skill 请求读取 `masked` 以下共享形态内容

### 10.3 审批视图要求

应复用 `src/app/(app)/approvals/page.tsx` 的承载能力，新增类型映射和详情渲染，不另造审批系统。

## 11. API 设计

### 11.1 导入与查询

- `POST /api/org-memory/sources/ingest`
  - 输入：文档链接或文档正文
  - 输出：`source_id`

- `GET /api/org-memory/sources`
  - 输出：源文档列表、状态、最近快照

- `GET /api/org-memory/sources/:id`
  - 输出：源文档详情、同步记录、解析摘要

### 11.2 快照

- `POST /api/org-memory/sources/:id/snapshots`
  - 创建一次解析任务

- `GET /api/org-memory/snapshots/:id`
  - 输出：结构化快照、证据、低置信度项

- `GET /api/org-memory/snapshots/:id/diff?base_snapshot_id=xxx`
  - 输出：与上一版本差异

### 11.3 草案

- `POST /api/org-memory/snapshots/:id/proposals`
  - 基于快照生成草案

- `GET /api/org-memory/proposals/:id`
  - 输出：完整草案和四类影响项

- `POST /api/org-memory/proposals/:id/submit`
  - 提交审批

### 11.4 审批与生效

- `POST /api/org-memory/proposals/:id/approve`
  - 审批通过并写入正式配置

- `POST /api/org-memory/proposals/:id/reject`
  - 审批拒绝

- `POST /api/org-memory/proposals/:id/request-more-info`
  - 要求补充说明

## 12. 前端实施方案

### 12.1 页面调整

#### `src/app/(app)/admin/org-management/page.tsx`

从“多 Tab 管理台”收缩为“组织 Memory 治理台”。

执行建议：

1. 保留外层路由不变，避免导航震荡
2. 将原 Tab 收缩为：
   - `overview`
   - `sources`
   - `snapshots`
   - `proposals`
3. 把原来的 `OrgStructureTab`、`RosterTab`、`OkrTab`、`DeptMissionTab`、`BizProcessTab` 逐步转为只读子视图

#### `src/components/org-management/OrgStructureTab.tsx`

本组件不再承担“新建部门/编辑部门”职责，改为：

- 展示当前快照的部门树
- 展示证据和置信度
- 支持与上一版对比

#### 新组件建议

- `src/components/org-memory/SourceList.tsx`
- `src/components/org-memory/SnapshotViewer.tsx`
- `src/components/org-memory/ProposalDiff.tsx`
- `src/components/org-memory/EvidenceDrawer.tsx`

### 12.2 审批页调整

#### `src/app/(app)/approvals/page.tsx`

新增：

- 新审批类型映射
- `OrgMemoryProposal` 详情区块
- 共享范围与匿名化变化可视化
- Skill 挂载变化摘要

### 12.3 Skill 页调整

#### `src/app/(app)/skills/page.tsx`

新增两类展示，不改主工作台逻辑：

1. Skill 可挂载建议来源于哪份组织草案
2. 当前挂载是否受组织 Memory 审批约束

#### `src/lib/workspace-skill-config.ts`

后续接入“审批通过后才 mountable”的资格过滤。

## 13. 后端/契约要求

后端应满足以下能力，否则前端只能停留在原型层：

1. 能拉取外部文档并生成稳定文本快照
2. 能保存结构化对象与证据引用
3. 能按规则生成统一草案
4. 能把审批通过后的草案写入正式知识配置
5. 能记录生效版本与回滚来源

## 14. 实施顺序

### Phase 1：信息架构收缩

目标：先把产品形态从“组织管理系统”改成“组织 Memory 治理台”。

任务：

1. 收缩 `org-management` 顶层 Tab
2. 下线新增/编辑组织对象入口
3. 加入源文档、快照、草案三类占位页

验收：

- 用户进入组织管理后，看到的是导入/快照/草案视角
- 不再默认鼓励系统内维护组织数据

### Phase 2：快照展示

目标：打通“源文档 → 结构化快照”只读链路。

任务：

1. 接入 Source 列表
2. 接入 Snapshot 详情
3. 展示部门、岗位、人员、OKR、流程
4. 展示证据片段与置信度

验收：

- 可以查看一次解析结果
- 可以识别低置信度字段

### Phase 3：草案展示

目标：打通“快照 → 统一草案”。

任务：

1. 接入 Proposal 详情
2. 按四类影响项展示 diff
3. 突出共享范围变化、匿名化变化、Skill 挂载变化

验收：

- 同一份草案能同时展示三类消费端建议
- 每条建议都能回溯证据

### Phase 4：审批接入

目标：草案可提交审批并在审批页处理。

任务：

1. 扩展审批类型
2. 新增草案详情渲染
3. 增加 approve / reject / needs_info 动作

验收：

- 草案能进入审批流
- 审批人能看到影响和证据

### Phase 5：落地生效

目标：审批通过后写入正式配置。

任务：

1. 写入知识库结构建议
2. 写入分类规则建议
3. 写入共享范围/匿名化策略建议
4. 写入 Skill 挂载建议

验收：

- 生效结果可追溯到某次 proposal
- 可查看 proposal 与正式配置的映射关系

## 15. 风险与控制

### 15.1 风险

- 外部文档格式不稳定，导致抽取波动
- LLM 推断草案存在误判
- 共享范围与匿名化策略过于抽象，审批人看不懂
- 三类消费端落地节奏不同，导致 proposal 结构失衡

### 15.2 控制手段

- 所有结构化字段强制保留证据引用
- 所有草案项强制有置信度和推断理由
- 高风险项不自动生效
- 审批页突出“范围扩大”和“匿名化降低”两个风险动作

## 16. 最小验收标准

以下 6 条满足即算一期成立：

1. 能导入至少一种外部组织文档源
2. 能生成包含六类对象的结构化快照
3. 能生成一份统一草案而不是三套分散规则
4. 能展示共享范围与匿名化建议
5. 能把草案送入审批页并完成审批
6. 能把审批通过结果写入正式配置并可追溯

## 17. 建议的首批代码变更清单

优先顺序如下：

1. `src/app/(app)/admin/org-management/page.tsx`
2. `src/components/org-management/OrgStructureTab.tsx`
3. `src/app/(app)/approvals/page.tsx`
4. `src/lib/knowledge-permission-constants.ts`
5. `src/lib/workspace-skill-config.ts`
6. 新增 `src/components/org-memory/*`

## 18. 结论

如果 `Le Desk` 本期要大幅做减法，同时又要让组织信息真正驱动知识库结构、Skill 挂载和权限审批，则应把“组织管理”改造成**文档驱动的组织 Memory 治理层**，并以 `Source → Snapshot → Proposal → Approval → Apply` 作为唯一主链路，而不是继续扩张系统内编辑能力。
