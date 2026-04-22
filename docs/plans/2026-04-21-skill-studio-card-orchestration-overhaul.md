# Skill Studio：Card Queue 工作台与 AI 编排总改造方案

日期：2026-04-21  
状态：规划确认稿，后续按 session 分阶段推进  
范围：`Skill Studio` 前端工作台、后端 workflow/card 协议、AI 编排 prompt 与工具策略

## 1. 最终目标

如果用户进入 `Skill Studio`，则系统不应表现为“一个聊天框 + 一个编辑器 + 一堆旁路面板”，而应表现为一个围绕 `Card Queue` 编排的专业 Skill 创作工作台。

最终形态：

1. `Skill list`：左侧 Skill 与文件入口，可收起。
2. `Card Queue`：中间主任务列，是 Skill 创作、完善、治理、测试、整改、确认、发布的唯一任务总线。
3. `Studio Chat`：右侧对话区，是用户意图识别、当前卡片执行、上下文收集和工具调度入口。
4. `File Workspace`：右侧抽屉，仅在存在待确认文件变更或用户主动打开文件确认时推出，不常驻占位。
5. `Governance Panel / Sandbox / Approval`：不再是散落的旁路，而是由 `Card Queue` 中对应卡片驱动打开。

核心判断：

- 如果一个动作会影响 Skill 生命周期，则它必须进入 `Card Queue`。
- 如果一个 AI 输出会修改文件，则它必须生成 staged edit，并由确认卡驱动 `File Workspace`。
- 如果用户还处于 Skill 创作收敛阶段，则不应过早推进权限挂载、测试用例或 Sandbox。
- 如果 Sandbox 失败，则整改任务必须回流为 `fixing` 卡，而不是停留在报告提示之外。
- 如果某张卡没有出现条件、执行目标、工具边界、退场条件，则它不能进入主工作台。

## 2. 当前代码事实

### 2.1 前端布局已经部分重构

当前 `SkillStudio` 已经是 `SkillList | StudioCardRail | StudioChat | File Workspace` 的结构：

- `src/components/skill-studio/index.tsx:848`：Workbench body 注释已经写成 `SkillList | Card Queue | Chat | File Workspace (slide-out) | Governance`
- `src/components/skill-studio/index.tsx:872`：`StudioCardRail` 已经作为独立列渲染
- `src/components/skill-studio/index.tsx:893`：`StudioChat` 已经独立成固定宽度列
- `src/components/skill-studio/index.tsx:932`：`File Workspace` 已经做成宽度切换抽屉

但当前抽屉展开条件仍偏编辑器导向，不是严格的“待确认变更导向”。

### 2.2 Card 模型已经开始扩展

`WorkbenchCardKind` 已经包含新的生命周期卡种：

- `create`
- `refine`
- `governance`
- `validation`
- `fixing`
- `release`

位置：`src/components/skill-studio/workbench-types.ts:7`

这说明前端已经具备将 `Card Queue` 扩展为生命周期总线的基础。

### 2.3 `buildWorkbenchCards` 已经是总入口雏形

`buildWorkbenchCards()` 已经尝试合并：

- 创作卡
- 完善卡
- governance cards
- staged edits
- sandbox report card
- workflow metadata cards
- fixing tasks
- release cards
- selected file card

位置：`src/components/skill-studio/workbench.ts:798`

但当前调用方与函数签名存在接线风险：新签名需要 `prompt / hasPendingDraft / hasPendingSummary / hasPendingToolSuggestion / hasPendingFileSplit`，调用方需要确认完整传入。

### 2.4 `Studio Chat` 已经向后端传 active card 上下文

`StudioChat.send()` 已经把以下字段传给后端：

- `active_card_id`
- `active_card_title`
- `active_card_mode`
- `active_card_target`
- `active_card_source_card_id`
- `active_card_staged_edit_id`
- `active_card_validation_source`

位置：`src/components/skill-studio/StudioChat.tsx:1721`

这说明后端已经可以被设计成“基于 active card 执行”的总调度器。

### 2.5 前端只透传流式接口，主 prompt 在后端

前端代理将请求透传到后端：

- `src/app/api/proxy/[...path]/route.ts:80`
- `src/app/api/proxy/[...path]/route.ts:178`

所以如果要解决“AI 一直讲车轱辘话”的问题，不能只改前端 UI。必须同步改后端 `Studio Chat` system prompt、workflow/card 调度协议和每张卡的 card prompt。

## 3. 产品原则

### 3.1 Card Queue 是唯一任务总线

如果某个任务属于 Skill 生命周期，则它必须进入 `Card Queue`。

包括但不限于：

- Skill 创作引导
- Skill 结构完善
- 知识库 / 工作表 / 工具绑定
- 权限角色与权限包确认
- 测试用例生成、复用、修改
- Sandbox 执行与报告解读
- Sandbox 失败后的整改任务
- AI 文件改动确认
- 重测与发布前复核

### 3.2 Studio Chat 是调度器，不是所有专业逻辑的堆叠处

如果用户输入一句话，则 `Studio Chat` system prompt 负责：

1. 识别用户意图。
2. 判断当前 active card 是否仍适用。
3. 决定继续当前卡、切换卡、生成新卡、阻断跨阶段动作。
4. 加载对应 Card Prompt。
5. 将用户回答写入对应 artifact。
6. 在卡片完成后安排下一跳。

每张卡自己的 Card Prompt 负责：

1. 本卡具体如何问。
2. 本卡允许调用哪些工具。
3. 本卡禁止做什么。
4. 本卡什么时候完成或退场。

### 3.3 File Workspace 是确认抽屉

如果没有待确认改动，则 `File Workspace` 不应自动占位。

自动推出场景：

- 出现 `pendingDraft`
- 出现 `pendingFileSplit`
- 收到 `staged_edit_patch`
- 用户点击 `mode=file` 且状态为 `pending/reviewing` 的确认类卡

不应自动推出场景：

- 用户只是在 Why / What 阶段回答问题
- 用户只是切换 Skill
- 用户只是选中文件查看
- 用户只是打开治理面板或 Sandbox

### 3.4 Skill 创作必须按 Skill Architect 方法，而不是格式检查

如果用户要创建或优化 Skill，则系统应按 `skill-architect-master` 的三阶段引导：

1. `Why`：问题定义，找到真实业务根因与使用场景。
2. `What`：要素拆解，穷举影响结论质量的输入维度。
3. `How`：验证收敛，筛出 P0/P1/P2 关键决策要素并做失败预防。

如果用户已有完整 spec，则不跳过 Skill Architect，而是直接进入 Phase 3 质疑验证。

## 4. 目标信息架构

### 4.1 主布局

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│ Skill Studio Header                                                         │
│ 正在处理：{active_card.title} · {target} / fallback: 正在编辑：Skill / file │
├──────────────┬─────────────────────────────┬───────────────────────────────┤
│ Skill List   │ Card Queue                  │ Studio Chat                   │
│ collapsible  │ active card + queue detail  │ intent + card execution       │
├──────────────┴─────────────────────────────┴───────────────────────────────┤
│ File Workspace drawer: only when pending edit / explicit file confirmation  │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 4.2 Card Queue 分组

建议统一为以下分组：

1. `创作 Create`
   - Skill Architect 三阶段卡
   - 需求摘要卡
   - 草稿生成前自检卡
2. `完善 Refine`
   - 草稿就绪卡
   - 文件拆分卡
   - 知识库 / 工作表 / 工具补齐卡
3. `治理 Governance`
   - 角色推荐卡
   - 权限包确认卡
   - 资产挂载卡
   - 治理门禁阻断卡
4. `测试 Validation`
   - 生成测试用例卡
   - 复用 / 修改 / 重生成测试方案卡
   - 创建 Sandbox Session 卡
   - 执行测试卡
5. `整改 Fixing`
   - 报告解读卡
   - 当前整改任务卡
   - P0/P1/P2 整改任务卡
   - 局部重测卡
6. `确认 Confirm`
   - 待确认 SKILL.md 修改卡
   - 待确认 source file 修改卡
   - 待确认文件拆分卡
7. `发布 Release`
   - 测试通过卡
   - 发布前复核卡
   - 提交审批卡
   - 发布完成卡

## 5. Card Contract 设计

### 5.1 目的

如果卡片没有 contract，则它只是一个 UI 列表项。  
如果卡片有 contract，则它可以成为工作台状态机中的可执行节点。

### 5.2 前端类型建议

新增 `src/components/skill-studio/card-contracts.ts`：

```ts
export type StudioCardPhase =
  | "create"
  | "refine"
  | "governance"
  | "validation"
  | "fixing"
  | "confirm"
  | "release";

export type StudioCardTool =
  | "studio_chat.ask_one_question"
  | "studio_artifact.save"
  | "studio_artifact.update"
  | "skill_draft.generate"
  | "skill_draft.stage_edit"
  | "skill_file.open"
  | "skill_file.stage_edit"
  | "skill_governance.open_panel"
  | "skill_governance.refresh"
  | "skill_governance.generate_declaration"
  | "sandbox_case_plan.generate"
  | "sandbox_case_plan.materialize"
  | "sandbox.run"
  | "sandbox.targeted_rerun"
  | "staged_edit.adopt"
  | "staged_edit.reject";

export interface StudioCardContract {
  contractId: string;
  title: string;
  phase: StudioCardPhase;
  appearsWhen: string[];
  objective: string;
  rolePrompt: string;
  diagnosticQuestions: string[];
  allowedTools: StudioCardTool[];
  forbiddenActions: string[];
  requiredArtifacts: string[];
  exitCriteria: string[];
  nextCards: string[];
  priorityRules: string[];
  drawerPolicy: "never" | "manual" | "on_pending_edit";
}
```

### 5.3 WorkbenchCard 扩展建议

在 `WorkbenchCard` 中增加：

```ts
contractId?: string | null;
artifactRefs?: string[];
blockedBy?: string[];
exitReason?: string | null;
```

如果后端已经能返回 card contract id，则前端不需要靠 `card.id.startsWith(...)` 来推断行为。

### 5.4 Card Contract 注册表

第一批 contract：

#### Skill Architect 创作卡

- `architect.why.5whys`
- `architect.why.first_principles`
- `architect.why.jtbd`
- `architect.why.cynefin`
- `architect.what.mece`
- `architect.what.issue_tree`
- `architect.what.value_chain`
- `architect.what.scenario_planning`
- `architect.how.pyramid`
- `architect.how.pre_mortem`
- `architect.how.red_team`
- `architect.how.sensitivity`
- `architect.how.zero_based`
- `architect.how.ooda`
- `architect.draft.skill_md`

#### 完善卡

- `refine.draft_ready`
- `refine.file_split`
- `refine.knowledge_binding`
- `refine.table_binding`
- `refine.tool_binding`

#### 治理卡

- `governance.role_recommendation`
- `governance.permission_package`
- `governance.asset_mount`
- `governance.declaration`
- `governance.mount_blocked`

#### 测试卡

- `validation.case_plan_generate`
- `validation.case_plan_decision`
- `validation.materialize_sandbox`
- `validation.run_sandbox`

#### 整改卡

- `fixing.report_overview`
- `fixing.prompt_task`
- `fixing.asset_task`
- `fixing.permission_task`
- `fixing.test_case_task`
- `fixing.targeted_retest`

#### 确认卡

- `confirm.skill_md_edit`
- `confirm.source_file_edit`
- `confirm.file_split`

#### 发布卡

- `release.test_passed`
- `release.pre_submit_review`
- `release.submit_approval`
- `release.completed`

## 6. Skill Architect 创作流

### 6.1 Phase 1：Why 问题定义

目标：剥离表面需求，确认根因、真实使用场景和问题复杂度。

卡片顺序：

1. `5 Whys 根因卡`
2. `第一性原理卡`
3. `JTBD 场景卡`
4. `Cynefin 分类卡`

完成产物：

- `surface_request`
- `why_chain`
- `root_cause`
- `true_constraints`
- `assumptions_to_drop`
- `jtbd_scene`
- `user_anxiety`
- `expected_outcome`
- `alternative_solution`
- `problem_complexity`
- `skill_design_mode`

退场条件：

- 如果 root cause 未确认，则不能进入 Phase 2。
- 如果真实使用场景不清楚，则不能生成 `SKILL.md`。
- 如果问题复杂度没有分类，则不能决定 Skill 是刚性流程、专家判断还是探索迭代型。

### 6.2 Phase 2：What 要素拆解

目标：从根因出发，穷举所有影响结论质量的输入维度。

卡片顺序：

1. `MECE 维度卡`
2. `Issue Tree 卡`
3. `Value Chain 卡`
4. `Scenario Planning 卡`

完成产物：

- `dimension_groups`
- `dimension_items`
- `mece_conflicts`
- `issue_tree`
- `value_chain`
- `best_case_scenario`
- `worst_case_scenario`
- `edge_case_scenario`
- `hidden_dimensions`

退场条件：

- 如果维度之间明显重叠，则不能进入 Phase 3。
- 如果场景推演暴露新关键维度，则必须回到 MECE 卡补齐。
- 如果 value chain 找到瓶颈，则后续 `SKILL.md` 必须体现该瓶颈的处理方式。

### 6.3 Phase 3：How 验证收敛

目标：从全面维度中筛选关键决策要素，避免 Skill 变成臃肿表单。

卡片顺序：

1. `金字塔验证卡`
2. `Pre-Mortem 卡`
3. `Red Team 卡`
4. `Sensitivity 卡`
5. `归零思维卡`
6. `OODA 收敛卡`

完成产物：

- `conclusion_evidence_tree`
- `failure_reasons`
- `red_team_counterexamples`
- `dimension_conflicts`
- `p0_dimensions`
- `p1_dimensions`
- `p2_dimensions`
- `removed_dimensions`
- `ooda_rounds`
- `ready_for_draft_summary`

退场条件：

- 如果 Pre-Mortem 少于 3 个失败原因，则不能进入草稿生成。
- 如果所有维度都被标为 P0，则必须生成“收窄范围卡”。
- 如果 OODA 两轮之间变化仍很大，则必须回调到 Phase 1 或 Phase 2。
- 如果 `ready_for_draft_summary` 被用户确认，则生成 `architect.draft.skill_md` 卡。

## 7. 前端改造方案

### 7.1 Phase F0：接线修复

目标：让当前已经存在的半成品能真实跑通。

改动点：

1. `src/components/skill-studio/index.tsx`
   - 将 `pendingDraft / pendingSummary / pendingToolSuggestion / pendingFileSplit` 从 `StudioChat` 透出或改为统一使用 `useStudioStore`
   - 调用 `buildWorkbenchCards()` 时补齐新参数
   - 为 `StudioChat` 增加 `ref`
   - 将 `StudioChatHandle` 的动作传入 `StudioCardRail`
2. `src/components/skill-studio/StudioChat.tsx`
   - 确认 `onPendingDraftChange / onPendingSummaryChange / onPendingToolSuggestionChange / onPendingFileSplitChange` 与 store 同步
   - 确认 `applyDraft / confirmSummary / confirmSplit / startFixTask / targetedRetest` 能被父组件调用
3. `src/components/skill-studio/StudioCardRail.tsx`
   - 先保留现有硬编码动作
   - 确认所有必需 props 都有父组件传入

验收：

- 如果后端返回 `studio_summary`，则 `Card Queue` 出现 `需求摘要确认`。
- 如果后端返回 `studio_draft`，则 `Card Queue` 出现 `草稿就绪`。
- 如果后端返回 staged edit，则 `Card Queue` 出现确认卡，且抽屉推出。
- 如果 Sandbox 失败且 memo 有 tasks，则整改任务出现在 `Card Queue`。

### 7.2 Phase F1：Active Card 选择规则重写

目标：让用户永远看到“下一步最该做的卡”。

改动点：

1. `src/lib/studio-store.ts`
   - 重写 `deriveActiveCardId()`
   - 不再优先 `validation`
   - 改为按生命周期阻塞程度选择 active card

建议排序：

1. `confirm` / staged edit 待确认
2. `fixing` 当前任务
3. `governance` 门禁阻断
4. `validation` 测试推进
5. `create` 当前架构阶段
6. `refine` 建议性完善
7. `release` 发布前动作
8. `selected-file` 兜底

验收：

- 如果有 pending staged edit，则 active card 必须是确认卡。
- 如果有 Sandbox failed current task，则 active card 必须是当前整改任务。
- 如果用户处于 Skill Architect 阶段，则 active card 必须是当前未完成的 architect card。

### 7.3 Phase F2：File Workspace 抽屉规则收窄

目标：抽屉只服务文件确认，不打断创作对话。

改动点：

1. `src/components/skill-studio/index.tsx`
   - 改造 `editorVisible`
   - 增加 `shouldAutoOpenFileWorkspace(activeCard, stagedEdits, pendingDraft, pendingFileSplit)`
   - 移除或弱化 `selectedFile` 自动展开逻辑
2. `src/components/skill-studio/StudioChat.tsx`
   - `staged_edit_patch` 到达时仍可触发抽屉
   - `studio_draft` 到达时触发确认抽屉
3. `src/components/skill-studio/PromptEditor.tsx`
   - 保留待确认 diff 体验
   - 不承担工作台主线提示职责

验收：

- 如果用户点击 Why 阶段卡，则抽屉不展开。
- 如果用户点击 `待确认 SKILL.md 修改卡`，则抽屉展开。
- 如果用户手动收起抽屉，则没有新 pending edit 时不再自动展开。

### 7.4 Phase F3：Card Contract 前端注册表

目标：减少 `StudioCardRail` 中按 `card.id` 硬编码 CTA。

改动点：

1. 新增 `src/components/skill-studio/card-contracts.ts`
2. 新增 `resolveCardContract(card)` 工具函数
3. `StudioCardRail.CardActions` 改为 contract-driven
4. `PhaseGuidance` 改为读取 contract 的 `objective / forbiddenActions / drawerPolicy`

验收：

- 新增卡片时不需要改 `StudioCardRail` 大段 if/else。
- 点击卡片后 CTA 来自 contract。
- contract 能决定是否打开 Chat、治理面板、Sandbox 或 File Workspace。

### 7.5 Phase F4：Card Artifacts 展示

目标：让创作过程不只是聊天，而是持续沉淀结构化结果。

改动点：

1. 新增 `ArchitectArtifactPanel` 或扩展 `GovernanceTimeline`
2. 将以下结构化产物按 card 显示：
   - why chain
   - JTBD table
   - issue tree
   - dimension matrix
   - priority matrix
   - failure prevention list
3. artifacts 与 card id 关联

验收：

- 如果用户完成 `MECE 维度卡`，则能看到维度清单。
- 如果用户完成 `Sensitivity 卡`，则能看到 P0/P1/P2 矩阵。
- 如果用户返回上游卡修改，则下游 artifact 标记为 stale。

## 8. 后端改造方案

### 8.1 Phase B0：流式接口 payload 兼容扩展

当前前端已经传 active card 基础字段。后端需要开始消费这些字段。

请求建议扩展：

```json
{
  "content": "用户输入",
  "selected_skill_id": 123,
  "editor_prompt": "...",
  "editor_is_dirty": false,
  "selected_source_filename": "SKILL.md",
  "active_card_id": "create:architect:5whys",
  "active_card_contract_id": "architect.why.5whys",
  "active_card_phase": "create",
  "active_card_mode": "analysis",
  "active_card_target": null,
  "active_card_artifacts": {},
  "active_card_validation_source": {}
}
```

兼容策略：

- 如果没有 `active_card_contract_id`，则后端按旧逻辑处理。
- 如果有 `active_card_contract_id`，则后端必须优先按 card prompt 执行。

### 8.2 Phase B1：Card Resolver 服务

新增后端模块：`SkillStudioCardResolver`

职责：

1. 根据用户意图、skill 状态、memo、workflow_state、staged_edits 决定需要哪些卡。
2. 对卡片做去重和优先级排序。
3. 返回 active card 建议。
4. 返回每张卡的 contract id。

建议输出：

```json
{
  "cards": [
    {
      "id": "create:architect:5whys",
      "contract_id": "architect.why.5whys",
      "title": "5 Whys 根因卡",
      "summary": "连续追问为什么需要这个 Skill",
      "status": "active",
      "kind": "create",
      "mode": "analysis",
      "phase": "architect_why",
      "priority": 120,
      "target": { "type": "analysis", "key": "5whys" },
      "artifact_refs": ["artifact:root_cause"]
    }
  ],
  "active_card_id": "create:architect:5whys",
  "workflow_state_patch": {
    "workflow_mode": "architect_mode",
    "phase": "phase_1_why",
    "active_card_id": "create:architect:5whys"
  }
}
```

### 8.3 Phase B2：Artifact 持久化

新增或扩展 `studio_state`：

```json
{
  "card_artifacts": {
    "architect.why.5whys": {
      "surface_request": "...",
      "why_chain": [],
      "root_cause": "...",
      "confirmed": true
    }
  },
  "completed_card_ids": [],
  "stale_card_ids": [],
  "card_exit_log": []
}
```

如果已有 `conversation studio-state` 可以承载，则先复用，不急于新建表。

### 8.4 Phase B3：Workflow Patch 协议扩展

当前前端已经支持：

- `workflow_patch`
- `governance_patch`
- `staged_edit_patch`
- `audit_patch`
- `deep_summary_patch`
- `evidence_patch`

建议新增：

- `card_patch`
- `artifact_patch`
- `card_status_patch`

示例：

```json
{
  "patch_type": "card_status_patch",
  "payload": {
    "card_id": "create:architect:5whys",
    "status": "adopted",
    "exit_reason": "root_cause_confirmed",
    "next_card_id": "create:architect:first-principles"
  }
}
```

### 8.5 Phase B4：治理与测试接口统一回流 Card Queue

需要后端确保以下动作都产生 card 结果：

1. 权限挂载门禁失败
2. 角色推荐完成
3. 权限声明生成完成
4. 测试用例生成完成
5. Sandbox Session 创建完成
6. Sandbox 失败报告生成
7. 整改任务生成
8. 局部重测结果生成

如果这些动作只返回面板状态，不返回卡片，则主线仍会断。

## 9. AI 编排方案

### 9.1 Prompt 分层

AI 编排分三层：

1. `Studio Chat System Prompt`
   - 意图识别
   - 卡片调度
   - 当前阶段边界控制
   - 工具路由
   - artifacts 管理
2. `Card Prompt`
   - 单张卡的专业方法
   - 本卡提问方式
   - 本卡工具边界
   - 本卡退场条件
3. `Tool Policy`
   - 工具可用条件
   - 工具调用前校验
   - 工具调用后如何生成 card / artifact / staged edit

### 9.2 Studio Chat System Prompt 职责

如果收到用户输入，则 system prompt 必须按以下顺序判断：

1. 当前是否存在 active card。
2. 用户输入是否是对 active card 的回答。
3. 用户是否试图跨阶段。
4. 跨阶段请求是否允许。
5. 如果允许，则切换或生成目标卡。
6. 如果不允许，则解释缺失前置并继续当前卡。
7. 是否需要调用工具。
8. 是否需要生成 artifact。
9. 是否需要生成 staged edit。
10. 是否需要关闭当前卡并激活下一卡。

禁止行为：

- 不要在 Phase 1 未确认时直接生成完整 `SKILL.md`。
- 不要在依赖资源未明确时生成测试用例。
- 不要在权限治理未满足时直接运行 Sandbox。
- 不要把整改建议只写在聊天里，必须生成整改卡。
- 不要把文件改动直接写入，必须 staged edit。

### 9.3 Card Prompt 例：5 Whys 根因卡

```text
你是 Skill Architect，当前执行 architect.why.5whys。

目标：
找到用户真正需要这个 Skill 的业务根因，而不是满足表面需求。

规则：
1. 一次只问一个问题。
2. 每个问题必须基于用户上一轮回答继续追问。
3. 至少完成 3 层 why，理想完成 5 层。
4. 不要替用户脑补根因。
5. 不要生成 SKILL.md。
6. 不要调用治理、测试或文件写入工具。

退场：
当 why_chain 足够清楚，并且用户确认 root_cause 后，输出 artifact_patch，
将当前卡标记为 adopted，并激活 architect.why.first_principles。
```

### 9.4 Card Prompt 例：Sensitivity 卡

```text
你是 Skill Architect，当前执行 architect.how.sensitivity。

目标：
判断每个输入维度对最终结论的敏感度，并输出 P0/P1/P2。

规则：
1. 如果维度变化会改变结论，则标为 P0。
2. 如果只影响置信度或表达细节，则标为 P1。
3. 如果几乎不影响结论，则标为 P2 或删除。
4. 不允许所有维度都是 P0。
5. 如果 P0 过多，生成收窄范围卡。

允许工具：
- studio_artifact.update
- skill_draft.stage_edit（仅当用户确认 ready_for_draft 后）

退场：
当用户确认 P0/P1/P2 矩阵后，进入 Pre-Mortem 或 OODA 收敛卡。
```

### 9.5 Tool Policy

#### 文件写入

如果 AI 要改 `SKILL.md` 或 source file，则：

1. 只能生成 `staged_edit_patch`。
2. 不能直接 PUT 文件。
3. 前端生成确认卡。
4. 用户采纳后才写入。

#### 治理面板

如果用户要求权限挂载，则：

1. 检查 Skill Architect 是否收敛。
2. 检查输入协议和依赖资产是否明确。
3. 如果不满足，则生成治理前置缺口卡。
4. 如果满足，则打开治理卡。

#### 测试

如果用户要求测试，则：

1. 检查治理前置。
2. 检查测试方案是否已有。
3. 如果已有，则生成测试方案决策卡。
4. 如果没有，则生成测试用例生成卡。
5. 如果 Sandbox 失败，则生成整改卡。

## 10. 数据协议与事件

### 10.1 WorkbenchCard 建议结构

```ts
interface WorkbenchCard {
  id: string;
  contractId?: string | null;
  title: string;
  summary: string;
  status: "pending" | "active" | "blocked" | "reviewing" | "adopted" | "rejected" | "dismissed" | "reopened" | "archived";
  kind: "create" | "refine" | "governance" | "validation" | "fixing" | "confirm" | "release" | "system";
  mode: "analysis" | "file" | "report" | "governance";
  phase: string;
  source: string;
  priority: number;
  target: { type: string | null; key: string | null };
  artifactRefs?: string[];
  sourceCardId?: string | null;
  stagedEditId?: string | null;
  validationSource?: Record<string, unknown> | null;
  blockedBy?: string[];
  exitReason?: string | null;
}
```

### 10.2 Artifact Patch

```json
{
  "patch_type": "artifact_patch",
  "payload": {
    "card_id": "create:architect:5whys",
    "contract_id": "architect.why.5whys",
    "artifact_key": "root_cause",
    "artifact": {
      "surface_request": "做一个财务核算框架架构师 Skill",
      "why_chain": [],
      "root_cause": "财务核算框架设计缺少稳定的结构化评估机制",
      "confirmed": false
    }
  }
}
```

### 10.3 Card Patch

```json
{
  "patch_type": "card_patch",
  "payload": {
    "id": "create:architect:5whys",
    "contract_id": "architect.why.5whys",
    "title": "5 Whys 根因卡",
    "summary": "继续确认真实业务根因",
    "status": "active",
    "kind": "create",
    "mode": "analysis",
    "phase": "architect_why",
    "priority": 120,
    "target": { "type": "analysis", "key": "5whys" }
  }
}
```

### 10.4 Staged Edit Patch

沿用当前前端支持的 `staged_edit_patch`，但必须附带：

- `source_card_id`
- `contract_id`
- `change_note`
- `next_action`

这样用户采纳后，系统才能知道原卡是否退场、是否生成重测卡。

## 11. 分阶段实施路线图

### 阶段 0：代码接线与现状校准

目标：修复当前半成品，让已有卡片真实出现并能操作。

前端：

- 接通 `buildWorkbenchCards()` 新参数。
- 接通 `StudioChatHandle` 到 `StudioCardRail`。
- 修复 `StudioCardRail` 必需 props 缺失。
- 确认 `pendingDraft / pendingSummary / pendingFileSplit` 能驱动卡片。

后端：

- 不要求立即改 prompt。
- 保持现有事件输出。

AI 编排：

- 不改 system prompt，只验证现有 structured event 是否足够驱动前端。

验收：

- 如果用户收到草稿，则有草稿卡。
- 如果用户收到摘要，则有摘要确认卡。
- 如果有整改 memo tasks，则有整改卡。

### 阶段 1：工作台主线体验修复

目标：让用户体感从“乱跳面板”变成“下一步明确”。

前端：

- 重写 active card 选择器。
- 收窄 File Workspace 自动展开条件。
- Header 显示 `正在处理：active card`。
- 删除无意义提示，如“当前与 OpenCode 共用个人工程文件区”。

后端：

- 确保 stream payload 中 active card 字段被记录到 message metadata 或 run context。

AI 编排：

- 在现有 system prompt 中加入“优先服务 active card”的短规则。

验收：

- 如果存在待确认改动，则用户第一眼看到确认卡。
- 如果处于整改模式，则用户第一眼看到当前整改任务。
- 如果处于创作模式，则用户第一眼看到当前架构卡。

### 阶段 2：Card Contract 前端化

目标：让卡片从 UI item 变成可执行节点。

前端：

- 新增 `card-contracts.ts`。
- `StudioCardRail` 改为 contract-driven CTA。
- `Card Queue` 展示每张卡的目标、禁止动作、下一步。
- 前端发送 `active_card_contract_id` 到后端。

后端：

- 先透传和记录 `active_card_contract_id`。

AI 编排：

- system prompt 开始识别 contract id。
- 如果 contract id 未知，则降级到旧逻辑。

验收：

- 新增一张卡不需要改大段 JSX if/else。
- active card 的 CTA 与工具边界来自 contract。

### 阶段 3：Skill Architect 创作流强编排

目标：用户从白纸到可生成草稿，必须经过架构师方法引导。

前端：

- 显示 Skill Architect artifacts。
- 把 `architect_question / architect_structure / architect_priority_matrix / architect_ready_for_draft` 与具体卡绑定。
- Phase 确认后自动推进下一张卡。

后端：

- 实现 `SkillStudioCardResolver`。
- 输出 card patch / artifact patch。
- 保存 `completed_card_ids`。

AI 编排：

- Studio Chat system prompt 改成总调度器。
- 每张 Skill Architect 卡有独立 card prompt。
- 严格执行一次只问一个问题。
- 阻断未收敛时直接生成 `SKILL.md`。

验收：

- 如果用户说“做一个 XX Skill”，则先进入 5 Whys，而不是直接出草稿。
- 如果用户已有完整 spec，则直接进入 Phase 3 质疑验证。
- 如果 Phase 3 未完成，则不能生成最终草稿，只能生成阶段产物。

### 阶段 4：治理 / 测试 / 整改统一回流 Card Queue

目标：治理和测试不再是旁路面板。

前端：

- 治理面板只作为卡片详情或侧栏工具，不作为主线。
- Sandbox 结果必须回流整改卡。
- staged edits 必须生成确认卡。
- 局部重测卡进入队列。

后端：

- 权限门禁、测试用例、Sandbox 报告、整改任务统一返回 card patch。
- memo recovery 中带回卡片和 artifacts。

AI 编排：

- 如果用户要求测试但治理未满足，则生成治理阻断卡。
- 如果 Sandbox failed，则生成整改卡，而不是只解释报告。
- 如果整改产生文件改动，则生成 staged edit。

验收：

- Sandbox failed 后，`Card Queue` 中有报告解读卡、整改任务卡、重测卡。
- 用户不需要去别的区域找“下一步该干嘛”。

### 阶段 5：发布闭环与可观测性

目标：形成从创作到发布的完整闭环，并能调试 AI 调度。

前端：

- Card 状态历史可查看。
- 展示 card exit reason。
- 展示 artifacts stale 状态。

后端：

- 记录 card transition log。
- 记录每次 AI 决策的 active card、contract id、tool call、exit reason。

AI 编排：

- 每轮输出结构化调度摘要。
- 如果用户反馈“你在绕圈”，系统能判断是否卡片未退场或 artifact 未更新。

验收：

- 可以追踪某张卡为什么出现、为什么退场、为什么生成下一张卡。
- 可以定位 AI 重复提问是 prompt 问题、artifact 问题还是状态机问题。

## 12. 测试策略

### 12.1 前端单元测试

重点文件：

- `src/components/skill-studio/workbench.ts`
- `src/lib/studio-store.ts`
- `src/components/skill-studio/card-contracts.ts`
- `src/components/skill-studio/message-parser.ts`
- `src/components/skill-studio/history-recovery.ts`

覆盖场景：

- 从空白 Skill 生成创作卡。
- pending draft 生成 refine card。
- staged edit 生成 confirm card。
- Sandbox failed memo 生成 fixing cards。
- active card 按阻塞优先级选择。
- File Workspace 只在 pending edit 时自动展开。

### 12.2 前端集成测试

覆盖路径：

1. 新建 Skill → 5 Whys → Phase Summary → Phase 2。
2. 完整 spec → Phase 3 → P0/P1/P2 → ready for draft。
3. 草稿生成 → 确认卡 → File Workspace → 采纳。
4. Sandbox failed → fixing cards → staged edit → targeted retest。

### 12.3 后端协议测试

覆盖：

- `active_card_contract_id` 透传。
- `card_patch` 解析。
- `artifact_patch` 持久化。
- `completed_card_ids` 恢复。
- `staged_edit_patch` 与 source card 关联。

### 12.4 AI 编排回归测试

用固定输入验证：

- 模糊需求不直接生成草稿。
- 已有 spec 直接进入 Phase 3。
- 用户跨阶段请求会被阻断并解释原因。
- Sandbox failed 会生成整改卡。
- 文件改动只能 staged edit。

## 13. 关键风险

### 13.1 只改前端，后端 prompt 不改

如果只改前端，则 `Card Queue` 会更好看，但用户仍可能觉得 AI 不聪明。  
原因是意图识别、追问质量、工具调用边界在后端 prompt 和 workflow 服务。

### 13.2 只改 prompt，不改状态机

如果只改 prompt，则 AI 可能回答得更像顾问，但卡片无法稳定出现、退场和恢复。  
用户刷新页面或切换 Skill 后仍会丢主线。

### 13.3 Card Contract 过早后端化

如果一开始就把所有 contract 下沉后端，则开发周期会变长。  
建议先前端注册表落地，再逐步让后端返回 contract id。

### 13.4 继续把整改当报告附属物

如果整改仍停留在 Sandbox 报告或聊天文字里，则用户一定会觉得工作台割裂。  
整改必须成为 `Card Queue` 主线卡。

## 14. 后续 Session 推进建议

### Session 1：接线修复

目标：

- 修 `buildWorkbenchCards()` 调用参数。
- 接通 `StudioChatHandle`。
- 让摘要、草稿、文件拆分、整改任务真实进入 `Card Queue`。

主要文件：

- `src/components/skill-studio/index.tsx`
- `src/components/skill-studio/StudioChat.tsx`
- `src/components/skill-studio/StudioCardRail.tsx`

### Session 2：active card 与抽屉规则

目标：

- 重写 active card 选择器。
- 收窄 File Workspace 自动展开。
- Header 显示 active card。

主要文件：

- `src/lib/studio-store.ts`
- `src/components/skill-studio/index.tsx`
- `src/components/skill-studio/workbench.ts`

### Session 3：Card Contract 前端注册表

目标：

- 新增 contract registry。
- CTA contract-driven。
- 给 active card stream payload 增加 contract id。

主要文件：

- `src/components/skill-studio/card-contracts.ts`
- `src/components/skill-studio/StudioCardRail.tsx`
- `src/components/skill-studio/StudioChat.tsx`

### Session 4：Skill Architect artifacts

目标：

- 将 `skill-architect-master` 的每张卡绑定 artifact。
- 显示 why chain、issue tree、priority matrix。
- 阶段确认后推进下一卡。

主要文件：

- `src/components/skill-studio/GovernanceTimeline.tsx`
- `src/components/skill-studio/message-parser.ts`
- `src/components/skill-studio/history-recovery.ts`
- `src/components/skill-studio/workbench.ts`

### Session 5：后端 card resolver 与 prompt 改造

目标：

- 后端消费 `active_card_contract_id`。
- 后端输出 `card_patch / artifact_patch`。
- Studio Chat system prompt 改成总调度器。
- Card Prompt 独立维护。

主要后端模块：

- conversation stream handler
- studio workflow service
- card resolver
- prompt registry
- studio state persistence

### Session 6：治理、测试、整改闭环

目标：

- 权限门禁、测试用例、Sandbox failed、整改任务全部回流 card queue。
- staged edit 与 source card 绑定。
- 重测卡自动生成。

主要模块：

- skill governance service
- test flow service
- sandbox remediation service
- memo recovery

## 15. 验收总标准

如果用户从一张白纸开始创建 Skill，则系统能用 `Card Queue + Studio Chat` 一步步引导他完成：

1. 明确真实问题。
2. 拆解关键维度。
3. 做失败预演和敏感性分析。
4. 生成可确认的 `SKILL.md` 草稿。
5. 挂载必要权限和资产。
6. 生成并执行测试用例。
7. 承接 Sandbox 失败整改。
8. 采纳或拒绝每个文件改动。
9. 重测通过。
10. 提交审批或发布。

如果这个流程中任一步用户不知道下一步做什么，则 `Card Queue` 失败。  
如果 AI 不能说明当前卡为什么出现、要完成什么、什么时候退场，则 AI 编排失败。  
如果文件改动绕过确认直接写入，则工作台安全边界失败。  
如果整改任务再次游离在队列外，则本次改造目标失败。
