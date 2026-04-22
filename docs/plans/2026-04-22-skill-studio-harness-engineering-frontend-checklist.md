# Skill Studio Harness Engineering — 前端优化清单

> 日期：2026-04-22
> 范围：`src/components/skill-studio/`、`src/lib/studio-*`、`src/lib/server/skill-studio-orchestration.ts`
> 目标：收紧前端 harness 层的工程质量——类型安全、状态一致性、渲染性能、测试覆盖

---

## 一、类型安全与契约层

### 1.1 card-contracts.ts — 契约注册表
- [ ] **消除 fallback 链中的隐式行为**：`resolveStudioCardContract()` 内 else-if 瀑布（L456-494）与 `CONTRACTS` 字典重复定义同一映射；提取为 `CARD_ID_TO_CONTRACT_ID` 查找表，与 `skill-studio-orchestration.ts` 中的 `ARCHITECT_CARD_ID_TO_CONTRACT_ID` 合并为单一源
- [ ] **FILE_ROLE_CTAS 空 CTA 补全逻辑收敛**：当前在 `resolveStudioCardContract` 末尾两处（L462-465、L490-492）做相同 fallback；抽为 `withFileRoleFallback(contract, card)` 私有函数
- [ ] **StudioCardActionId 穷举检查**：CardRail `CardActions.runAction` 内的 switch（L113-201）缺少 `exhaustive check`；加 `default: never` 或 `assertNever` 防止新增 actionId 时遗漏
- [ ] **contractId 与 card.id 的双轨映射补全**：`ARCHITECT_CARD_ID_TO_CONTRACT_ID`（orchestration.ts L55-69）只覆盖了 architect 子卡；优化模式（optimize.*）和审计模式（audit.*）的 contractId 没有出现在映射表中，导致 orchestration 层无法为这些卡注入 card_prompt

### 1.2 workbench-types.ts — 焦点排序
- [ ] **getWorkbenchCardFocusRank 常量化**：当前用魔法数字（1010/990/1000/970...）；改为枚举或 `const FOCUS_RANK = { ... } as const` 并加注释描述优先级语义
- [ ] **create:summary-ready 和 governance kind 的 rank 冲突**：L223-224 两者都返回 880，在同时存在时排序不稳定；给 create:summary-ready 加偏移（如 882）或加 tiebreaker
- [ ] **resolveFocusedWorkbenchCardId 二次排序缺失 tiebreaker**：当 focusRank 和 priority 都相同时，排序依赖数组原始顺序，而 `[...cards].sort()` 不保证稳定性（引擎相关）；加 card.id 作为最终 tiebreaker

### 1.3 types.ts — 接口膨胀
- [ ] **StagedEdit.source 与 GovernanceCardData.source 语义不一致**：StagedEdit.source 为 `string | undefined`，GovernanceCardData.source 为 `string | undefined`，但实际值空间不同（runtime / bind_back / stream 等）；定义 `type ArtifactSource = "runtime" | "stream" | "bind_back" | ...` 联合类型
- [ ] **PreflightGate.items 内联结构过深**：`{ check, ok, issue, detail, action, knowledge_id }` 应提为 `PreflightCheckItem` 命名接口
- [ ] **PreflightTestResult.detail.deductions 与 PreflightResult.quality_detail.top_deductions 是同一结构**：提取为 `DeductionItem` 共享

---

## 二、状态管理（studio-store.ts + studio-reconcile.ts）

### 2.1 store 粒度
- [ ] **单一巨型 store 拆分**：当前 `useStudioStore` 包含 60+ 个字段和 30+ 个 action，所有组件订阅同一 store 导致过度 re-render。拆分为：
  - `useCardQueueStore`（cards、cardOrder、activeCardId、queueWindow）
  - `useArtifactStore`（governanceCards、stagedEdits、architectArtifacts）
  - `useWorkflowStore`（sessionMode、workflowState、activeAssistSkills、runTracking）
  - `useEditorStore`（editorVisibility、pendingDraft/Summary/Split/Tool）
- [ ] **selector 粒度优化**：StudioCardRail 内 6 个 `useStudioStore((s) => s.xxx)` 调用（L503-507），每次 store 变更都触发 6 次 selector 比较；合并为一个 selector 返回对象 + `shallow` 比较

### 2.2 一致性保证
- [ ] **replaceWorkbenchCards 与 upsertWorkbenchCard 的 cardOrder 计算路径不同**：replace 用 `preserveProvidedOrder: true`，upsert 不传此参数；当 SSE 先推 replace 再推 upsert 时可能丢失顺序语义；统一或文档化两条路径的预期
- [ ] **adoptStagedEdit 后 activeCardId 不随焦点策略走**：L467 直接用 `linkedWorkbenchCardId ?? s.activeCardId`，跳过了 `deriveActiveCardId` 决策；这与 rejectStagedEdit（L497-499）的行为不对称，应统一
- [ ] **governanceCardLedger 和 stagedEditLedger 只增不减**：长会话中 ledger 条目持续增长但从不清理；在 `resetWorkflowArtifacts` 和 `archiveRun` 中加清理逻辑

### 2.3 竞态与幂等
- [ ] **rememberPatchSeq 线性搜索 O(n)**：`s.appliedPatchSeqs.includes(patchSeq)` 在 200 条上限内尚可，但应换为 Set 数据结构
- [ ] **addDeepPatch 去重逻辑用 map + replace 而非 filter + push**：当前实现正确但可读性差（L260-267）；用 Map<`${run_id}:${patch_seq}`, patch> 重写

---

## 三、渲染性能

### 3.1 index.tsx（主组件 ~1500 行）
- [ ] **拆分子面板**：index.tsx 单文件 1500+ 行（见 persisted output），包含 skill list、editor、chat、card rail、governance panel、sandbox modal、preflight、import modal 等所有面板逻辑；至少提取：
  - `StudioActionBar`（底部操作栏 + sandbox/preflight 触发）
  - `StudioPanelRouter`（根据 workspace.mode 切换面板）
  - `StudioSSEHandler`（stream 事件分发 + workflow state 同步）
- [ ] **StudioChat 消息列表虚拟化**：长会话（100+ 条消息）时全量渲染导致卡顿；引入 `react-window` 或 `@tanstack/react-virtual`
- [ ] **PromptEditor 大文本节流**：当前每次 onChange 直接 setState → re-render；加 300ms debounce 或用 uncontrolled mode + ref
- [ ] **StudioCardRail 内 useMemo 依赖过宽**：L566-603 的 `descriptor` 和 `actionSections` memo 依赖了 `pendingCards`，而 pendingCards 本身在每次 cards/activeCardId 变更时都会重建数组引用；应 memoize pendingCards 本身或用 `useMemo` 包裹

### 3.2 StudioWorkspace.tsx — Workspace 切换
- [ ] **四种 Workspace 组件（Analysis/Governance/Report/File）每次切换都重新挂载**：丢失滚动位置和内部状态；考虑改为 `display:none` 隐藏 + 条件 visible，或用 `<KeepAlive>` 缓存
- [ ] **buildWorkspaceActionSections 在渲染路径上每帧调用**：应 memoize（当前在 AnalysisWorkspace 内直接调用，无 useMemo 保护）

---

## 四、测试覆盖缺口

### 4.1 已有测试缺口
- [ ] **workbench-types.ts 无专属测试**：`getWorkbenchCardFocusRank` 和 `resolveFocusedWorkbenchCardId` 是焦点决策核心，但只被 studio-card-rail.test.tsx 间接覆盖；补充：
  - rank 值排序正确性（所有 kind × status 组合）
  - tiebreaker 稳定性
  - preferredActiveId 保留逻辑
- [ ] **workbench.ts 无专属测试**：buildWorkbenchCardFromSSE 等函数只被 workflow-adapter.test.ts 间接覆盖；补充单元测试
- [ ] **studio-store 集成测试缺失**：当前 studio-store.test.ts 只测了独立 action；补充多 action 连续调用序列测试：
  - `replaceWorkbenchCards → upsertWorkbenchCard → adoptStagedEdit` 后 activeCardId 一致性
  - `archiveRun → resetRunTracking` 后 archivedRuns 清理
- [ ] **card-contracts.ts 测试缺失**：`resolveStudioCardContract` 的 fallback 瀑布未被测试；补充每种 card.id pattern → 期望 contractId 的映射测试

### 4.2 新增测试需求
- [ ] **StudioWorkspace descriptor builder 快照测试**：`buildAnalysisDescriptor`、`buildGovernanceDescriptor`、`buildReportDescriptor` 输出结构化对象，适合用 snapshot 保证不意外变更
- [ ] **orchestration.ts roundtrip 测试**：`resolveSkillStudioStreamOrchestration` 输入 payload → 输出 orchestration + preludeEvents 的端到端验证
- [ ] **StudioCardRail 交互测试**：active card 切换、backlog 展开/收起、blocking_signal 横幅渲染、studioError 显示/关闭

---

## 五、SSE / Stream 层

### 5.1 workflow-adapter.ts + workflow-protocol.ts
- [ ] **SSE 事件类型枚举化**：当前 event type（card_patch、artifact_patch、workflow_state、queue_window 等）散落在 adapter 和 protocol 两个文件中，用字符串字面量匹配；定义 `type StudioSseEventType = "card_patch" | "artifact_patch" | ...` 联合类型并在两端复用
- [ ] **deep_patch 合并窗口**：当 SSE 连续推送多个 deep_patch 时，每个 patch 触发一次 store update → 一次 re-render；加 microtask batch（`queueMicrotask` 或 `requestAnimationFrame` 合并）
- [ ] **断线重连后 queue_window 与 cardsById 不一致**：如果重连时后端推送了新 queue_window 但没有重推完整 cards 列表，前端 visible_card_ids 中可能引用不存在的 card；加 defensive check 并请求补全

### 5.2 skill-studio-orchestration.ts（前端 BFF 层）
- [ ] **CARD_PROMPTS 与 GENERIC_CARD_PROMPTS 合并**：两个字典功能相同，lookup 时需双查；合并为一个 `ALL_CARD_PROMPTS`
- [ ] **STUDIO_CHAT_SYSTEM_PROMPT 硬编码**：不同 sessionMode（create/optimize/audit）应使用不同 system prompt，但当前统一用创建模式 prompt；加 mode 分支
- [ ] **buildCardPatch 返回的 kind 字段不完整**：L341 只在 architect 开头时赋值 `"create"`，其他 contractId（refine/fixing/governance 等）返回 undefined；应从 contractId prefix 映射完整 kind

---

## 六、可维护性与代码结构

### 6.1 文件职责
- [ ] **workbench.ts 是 re-export + 新增逻辑的混合体**：既 re-export workbench-types 的所有类型，又定义了 GovernanceWorkbenchIntent、buildWorkbenchCardFromSSE 等核心函数（56.5KB）；分为：
  - `workbench-types.ts`（纯类型 + 排序逻辑，已存在）
  - `workbench-builders.ts`（buildWorkbenchCardFromSSE 等构建函数）
  - `workbench.ts`（仅 re-export）
- [ ] **StudioWorkspace.tsx 混合了 UI 组件和数据构建函数**：`buildAnalysisDescriptor`、`buildGovernanceDescriptor`、`buildReportDescriptor` 是纯函数，应提到 `workspace-descriptors.ts`；`buildWorkspaceActionSections` 同理提到 `workspace-actions.ts`
- [ ] **StudioCardRail.tsx 中的 CardActions、PhaseGuidance、ContractDetail 等子组件应提到 cards/ 子目录**：当前 cards/ 目录已有 Architect 系列卡，但 CardActions 仍内联在 StudioCardRail 中

### 6.2 命名一致性
- [ ] **activeCardId vs activeWorkbenchCardId**：studio-store 中两者同步设置（L275-292），语义完全相同；删除其中一个，统一为 `activeCardId`
- [ ] **GovernanceCardData vs GovernanceWorkbenchIntent vs WorkspaceGovernanceIntent**：三个类型名描述相近概念，实际用途不同；在类型定义处加 JSDoc 注释说明各自边界
- [ ] **种 "source" 字段命名冲突**：`WorkbenchCard.source`（"runtime" / "stream" / "pending_draft"）、`StagedEdit.source`（"runtime" / "stream"）、`GovernanceCardData.source`（同上）——含义不同但字段名相同；考虑重命名为 `origin` 或加类型前缀

### 6.3 技术债
- [ ] **workbench.ts 56.5KB**：单文件已超出合理阅读范围；按上述 6.1 拆分后目标 ≤ 15KB / 文件
- [ ] **index.tsx 65.7KB**：同上；拆分后目标 ≤ 25KB / 文件
- [ ] **魔法字符串清理**：card.id 中大量硬编码字符串（"fixing:overview"、"create:onboarding"、"refine:draft-ready" 等）散落在 store、workbench、card-contracts、StudioCardRail 4+ 个文件中；提取为 `CARD_IDS` 常量对象

---

## 七、优先级排序

| 优先级 | 区域 | 条目 | 影响 |
|--------|------|------|------|
| P0 | 一致性 | 2.2 adoptStagedEdit 焦点不对称 | 用户操作后 active card 跳转异常 |
| P0 | 类型安全 | 1.1 actionId exhaustive check | 新增 actionId 静默忽略 |
| P0 | 类型安全 | 1.1 optimize/audit contractId 映射缺失 | 优化/审计模式下 orchestration 注入失败 |
| P0 | 测试 | 4.1 workbench-types 焦点排序测试 | 焦点逻辑是 harness 核心 |
| P1 | 性能 | 3.1 index.tsx 拆分 | 主组件过大影响加载和维护 |
| P1 | 性能 | 2.1 store 拆分 | 过度 re-render |
| P1 | 性能 | 3.1 消息列表虚拟化 | 长会话卡顿 |
| P1 | SSE | 5.1 deep_patch batch | 连续推送性能 |
| P1 | 结构 | 6.1 workbench.ts / index.tsx 拆分 | 可维护性 |
| P2 | 测试 | 4.2 descriptor snapshot + orchestration roundtrip | 防回归 |
| P2 | 命名 | 6.2 activeCardId 去重 + source 字段重命名 | 可读性 |
| P2 | 清理 | 6.3 魔法字符串 → 常量 | 可维护性 |
| P2 | 一致性 | 2.3 rememberPatchSeq → Set | 微优化 |
