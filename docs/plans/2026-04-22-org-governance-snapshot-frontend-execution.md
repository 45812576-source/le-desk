# 组织治理快照前端执行文件

## 1. 目标

本文件用于指导 `le-desk` 前端把“组织治理快照”能力正式接入到现有工作台页面，使其可以通过按钮事件调用后端快照引擎，完成以下闭环：

- 从工作台按钮触发 `生成快照 / 更新快照 / 仅更新当前 Tab`
- 选择范围、追加资料、提交补缺项
- 用横排 Tab 呈现六类长篇 Markdown 快照
- 保存 Markdown 后自动触发结构化同步
- 展示 `authority_map`、`resource_access_matrix`、`approval_route_candidates`、`policy_hints` 等治理中间产物

本期前端主战场为：

- `Step 02 快照结果`
- `Step 01 资料接入` 的资料追加入口
- 与后端统一事件协议的交互层

## 2. 非目标

本期前端不负责：

- 直接在浏览器端运行 Skill 文本
- 自动修改全局权限配置
- 多人协同实时编辑
- 富文本编辑器重构
- 流式生成首版
- universal-kb 后台完整 UI 重做

## 3. 现状判断

当前 `le-desk` 已具备：

- 统一四步页面壳子：`资料接入 → 快照结果 → 治理版本 → 生效与影响`
- `OrgMemorySourcesTab` 资料导入与生成快照入口
- `OrgMemorySnapshotsTab` 快照展示页
- `src/lib/org-memory.ts` 作为组织 Memory 前端 API 访问层
- `src/lib/api.ts` 通过 `/api/proxy` 转发到 `universal-kb` 后端

当前问题：

- `Step 02` 仍以摘要卡和六类小卡展示，不适合长文档快照
- 交互仍偏“快照列表 + 详情”，不符合“按钮流 + 长文档 + Markdown 真源”
- 没有“缺失项补齐表单”
- 没有“单 Tab 保存并同步结构化”的编辑工作台
- 没有承接治理中间产物的前端工作区

## 4. 前端交付物

本期前端必须交付以下能力。

### 4.1 页面级交付物

- 将 `Step 02 快照结果` 改造成 `组织治理快照工作台`
- 顶部增加：
  - `生成 / 更新快照`
  - `追加资料`
  - `快照范围` 下拉
  - `版本选择`
  - `同步状态`
  - `缺失项数量`
  - `冲突项数量`
- 主体区域改为横排 Tab：
  - 组织
  - 部门
  - 岗位
  - 人员
  - OKR
  - 业务流程

### 4.2 交互级交付物

- 右侧抽屉承接按钮事件
- 资料范围确认与追加
- 缺失项表单补齐
- 单 Tab Markdown 编辑与保存
- 保存后同步 JSON/YAML
- 展示治理中间产物和冲突风险

### 4.3 工程级交付物

- 新的类型定义
- 新的 API 客户端
- 新的工作台组件树
- 旧快照展示组件兼容或降级保留
- 单元测试与关键交互测试

## 5. 文件改造范围

### 5.1 必改文件

- `src/components/org-memory/OrgMemoryWorkflow.tsx`
- `src/lib/org-memory.ts`
- `src/lib/types.ts`

### 5.2 新增文件建议

- `src/components/org-memory/OrgGovernanceSnapshotWorkbench.tsx`
- `src/components/org-memory/SnapshotEventDrawer.tsx`
- `src/components/org-memory/SnapshotScopeSelect.tsx`
- `src/components/org-memory/SnapshotVersionPicker.tsx`
- `src/components/org-memory/SnapshotTabBar.tsx`
- `src/components/org-memory/SnapshotMarkdownEditor.tsx`
- `src/components/org-memory/SnapshotPreviewPane.tsx`
- `src/components/org-memory/SnapshotMissingItemsForm.tsx`
- `src/components/org-memory/SnapshotConflictPanel.tsx`
- `src/components/org-memory/SnapshotEvidencePanel.tsx`
- `src/components/org-memory/SnapshotGovernancePanel.tsx`
- `src/components/org-memory/SnapshotSyncStatus.tsx`
- `src/components/org-memory/SnapshotChangeSummary.tsx`
- `src/components/org-memory/SnapshotToolbar.tsx`

### 5.3 测试文件建议

- `src/components/org-memory/__tests__/org-governance-snapshot-workbench.test.tsx`
- `src/components/org-memory/__tests__/snapshot-event-drawer.test.tsx`
- `src/components/org-memory/__tests__/snapshot-missing-items-form.test.tsx`
- `src/components/org-memory/__tests__/snapshot-sync-status.test.tsx`
- `src/lib/__tests__/org-governance-snapshot-api.test.ts`

## 6. 页面结构设计

`Step 02 快照结果` 最终结构如下：

### 6.1 顶部工具栏

- 左侧：
  - 快照标题
  - 当前版本
  - 最近保存时间
- 中间：
  - 范围下拉
  - 版本选择器
- 右侧：
  - `追加资料`
  - `生成 / 更新快照`
  - `提交确认`

### 6.2 主体布局

- 第一层：横排 Tab
- 第二层：当前 Tab 的 Markdown 编辑区
- 第三层：右侧信息面板

右侧面板分块：

- 证据引用
- 缺失项
- 冲突项
- 低置信度
- SoD 风险
- 同步状态
- 变更摘要

### 6.3 抽屉与弹层

- `SnapshotEventDrawer`
  - 范围选择
  - 资料选择
  - 资料追加
  - 高价值缺失项补齐
- `MissingItemsForm`
  - 当后端返回 `needs_input` 时显示

## 7. 前端状态模型

建议新增本地状态模型。

```ts
type SnapshotTabKey =
  | "organization"
  | "department"
  | "role"
  | "person"
  | "okr"
  | "process";

interface WorkspaceSnapshotRunState {
  runId: string | null;
  status: "idle" | "queued" | "running" | "needs_input" | "ready_for_review" | "synced" | "partial_sync" | "failed";
  error: string | null;
}

interface WorkspaceSnapshotDetailState {
  snapshotId: number | null;
  version: string | null;
  activeTab: SnapshotTabKey;
  markdownByTab: Record<SnapshotTabKey, string>;
  structuredByTab: Record<SnapshotTabKey, Record<string, unknown> | null>;
  governanceOutputs: Record<string, unknown>;
  missingItems: unknown[];
  conflicts: unknown[];
  lowConfidenceItems: unknown[];
  separationOfDutyRisks: unknown[];
  changeSummary: Record<string, unknown> | null;
  syncStatus: Record<string, unknown> | null;
}
```

优先建议：

- 先放在组件内或局部 hook
- 如果状态跨多个组件层级较深，再抽到 `zustand`

## 8. API 客户端改造

在 `src/lib/org-memory.ts` 新增以下方法。

### 8.1 事件入口

```ts
createWorkspaceSnapshotEvent(payload)
```

调用：

```http
POST /org-memory/workspace-snapshot-events
```

### 8.2 版本列表

```ts
loadWorkspaceSnapshots(params)
```

调用：

```http
GET /org-memory/workspace-snapshots?workspace_id=...&app=le-desk
```

### 8.3 快照详情

```ts
loadWorkspaceSnapshotDetail(snapshotId)
```

### 8.4 单 Tab 保存

```ts
saveWorkspaceSnapshotTabMarkdown(snapshotId, tabKey, markdown)
```

### 8.5 全量同步

```ts
syncWorkspaceSnapshot(snapshotId)
```

### 8.6 查询运行状态

```ts
loadWorkspaceSnapshotRun(runId)
```

## 9. 组件职责拆分

### 9.1 `OrgGovernanceSnapshotWorkbench`

职责：

- 拉取版本列表
- 拉取当前快照详情
- 管理当前 Tab
- 组织工具栏、Tab、编辑器、右侧面板

### 9.2 `SnapshotEventDrawer`

职责：

- 收集本次事件输入
- 提交按钮事件 payload
- 显示资料确认
- 显示缺失项补齐

### 9.3 `SnapshotMarkdownEditor`

职责：

- 编辑 Markdown
- 保存按钮
- 自动保存节流
- 显示保存中、保存成功、部分同步失败

### 9.4 `SnapshotGovernancePanel`

职责：

- 展示 `authority_map`
- 展示 `resource_access_matrix`
- 展示 `approval_route_candidates`
- 展示 `policy_hints`

首版不需要复杂表格编辑器，只要能查看和筛选。

### 9.5 `SnapshotMissingItemsForm`

职责：

- 渲染后端返回的问题项
- 支持输入类型：
  - text
  - select
  - multi_select
  - boolean
  - user_select
  - department_select
  - role_select
- 支持 `暂缺，继续生成`

## 10. 与后端事件协议的交互规则

### 10.1 点击 `生成 / 更新快照`

前端发送：

- `event_type=snapshot.generate` 或 `snapshot.update`
- `workspace`
- `snapshot.scope`
- 当前选中的 `source_ids`

后端可能返回：

- `needs_input`
- `ready_for_review`
- `failed`

前端动作：

- `needs_input`：打开补缺表单
- `ready_for_review`：刷新工作台详情
- `failed`：显示错误通知

### 10.2 点击 `追加资料`

前端动作：

- 打开抽屉的资料区
- 允许从现有 source、知识库、上传文件中选择
- 允许走现有 `Step 01` 上传接口追加 source

### 10.3 保存 Markdown

前端发送：

- `PUT /workspace-snapshots/{snapshot_id}/tabs/{tab_key}/markdown`

后端返回：

- `synced`
- `partial_sync`
- `failed`

前端规则：

- `synced`：更新结构化状态
- `partial_sync`：保留编辑内容，提示同步失败 section
- `failed`：保留编辑内容，显示错误

## 11. Step 01 与 Step 02 的职责重新划分

### Step 01 `资料接入`

保留：

- 飞书文档导入
- 文件上传
- 批量生成基础 source/snapshot

新增：

- 向 Step 02 传递可选 source 清单
- 允许跳转到 Step 02 时预勾选新增 source

### Step 02 `快照结果`

承接：

- 新一代治理快照工作台
- 六个 Tab 的 Markdown 真源
- 缺失项、冲突、治理中间产物

## 12. 与旧快照页兼容策略

不建议直接删除旧的 `OrgMemorySnapshotsTab`。

建议策略：

- 第一阶段将其标记为 legacy
- 工作流默认渲染新 `OrgGovernanceSnapshotWorkbench`
- 如后端新接口不可用，可临时 fallback 到 legacy 只读页

兼容开关建议：

```ts
ORG_GOVERNANCE_SNAPSHOT_WORKBENCH=on
```

## 13. UI 开发顺序

### Phase FE-1：类型与 API 封装

- 新增 TypeScript 类型
- 新增 `src/lib/org-memory.ts` 方法
- mock 最小响应结构

完成标准：

- 本地可调用新接口
- 组件可拿到结构化返回

### Phase FE-2：Step 02 页面骨架

- 新增 workbench 外壳
- 新增 toolbar
- 新增 Tab bar
- 新增右侧 panel 容器

完成标准：

- 可切换 Tab
- 可加载快照详情

### Phase FE-3：事件抽屉与补缺表单

- 实现 `SnapshotEventDrawer`
- 实现 `SnapshotMissingItemsForm`

完成标准：

- 能提交 generate/update 事件
- 能处理 `needs_input`

### Phase FE-4：Markdown 编辑与同步

- 接入 Markdown 编辑器
- 实现 save / autosave
- 接入 sync 状态提示

完成标准：

- 保存后正确展示 `synced / partial_sync / failed`

### Phase FE-5：治理中间产物展示

- 展示 `authority_map`
- 展示 `resource_access_matrix`
- 展示 `approval_route_candidates`
- 展示 `policy_hints`

完成标准：

- 用户可浏览并理解权限建议来源

### Phase FE-6：测试与回归

- 组件测试
- 关键交互测试
- 与 Step 01 联动回归

## 14. 测试清单

### 14.1 单元测试

- scope dropdown 映射正确
- `needs_input` 响应会打开补缺表单
- `partial_sync` 不会丢失编辑内容
- 保存成功后会更新同步状态
- 切换 Tab 不会污染其它 Tab Markdown

### 14.2 集成测试

- 生成快照 → 返回 `ready_for_review`
- 生成快照 → 返回 `needs_input` → 补缺 → 成功
- 编辑 Markdown → 保存 → 同步成功
- 编辑 Markdown 破坏标题 → 返回 `partial_sync`

### 14.3 页面回归

- Step 01 上传 source 不受影响
- Step 03 / Step 04 现有治理版本页面仍可访问
- 旧快照数据可只读加载

## 15. 验收标准

- 用户能在 `Step 02` 通过按钮触发生成快照
- 用户能选择 `全量快照 / 单个 Tab / 仅更新当前 Tab`
- 页面采用横排 Tab，而不是六宫格
- 每个 Tab 支持长文 Markdown 编辑
- 保存 Markdown 后 JSON/YAML 可同步刷新
- `partial_sync` 时 Markdown 不丢失，旧结构化结果不被错误覆盖
- 页面可展示权限控制相关的治理中间产物

## 16. 风险与缓解

### 风险 1：后端协议频繁改动

缓解：

- 前端先封装单独 API 层
- 响应数据做 normalize

### 风险 2：Markdown 编辑器状态复杂

缓解：

- 首版只做单 Tab 编辑
- 保存策略先手动按钮，后续再加 autosave

### 风险 3：治理中间产物字段过多

缓解：

- 首版先展示 JSON 视图或简单表格
- 二期再做高级筛选与比对

### 风险 4：老页面与新页面并存造成混乱

缓解：

- 用 feature flag 包裹
- 明确 legacy 页面为只读兜底

## 17. 前端实施建议

如果前后端并行开发，则前端优先顺序为：

1. 类型与 API 封装
2. 页面骨架
3. 抽屉与补缺表单
4. Markdown 保存与 sync 状态
5. 治理中间产物展示

如果后端协议未完全就绪，则先用本地 mock 数据把工作台壳子做完，避免阻塞布局和交互开发。
