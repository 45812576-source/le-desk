# 数据表可视化 V2+ 支线计划：安全内核 + 审批版本 + 外部源治理

> **并行于主线**。主线负责：Phase 0 契约层 → Phase 1 类型 → Phase 3 权限向导 → Phase 4 视图 → Phase 5 治理 → Phase 8 首页 → Phase 9 三级导航。
>
> 本支线负责：Phase 2（安全内核可视化）+ Phase 6（审批/版本/影响分析）+ Phase 7（外部源治理）+ 对应测试。
>
> **前置依赖**：Phase 0 + Phase 1 必须先完成（类型、normalizer、hooks、feature flag 到位后本支线才可开始）。

---

## 前置检查清单

开始前确认以下文件已就绪（由主线 Phase 0+1 产出）：

- [ ] `src/app/(app)/data/components/shared/types.ts` — 含 V2 类型（`SensitivityLevel`, `RiskAssessment`, `SmallSampleProtection`, `OutputReviewLog`, `LogicalViewRun`, `FieldImpactEdge`, `PolicyVersion`, `DataApprovalRequest` 等）
- [ ] `src/app/(app)/data/components/shared/normalize.ts` — normalizer 函数
- [ ] `src/app/(app)/data/components/shared/empty-states.ts` — 空态常量
- [ ] `src/app/(app)/data/components/shared/api.ts` — API helper
- [ ] `src/app/(app)/data/components/shared/feature-flags.ts` — `useV2DataAssets()` hook
- [ ] `src/app/(app)/data/hooks/` — 统一 hooks 层
- [ ] `src/__tests__/fixtures/data-assets.ts` — V2 fixtures

---

## 全局约束（必须遵守）

1. **不改现有骨架**：所有新组件追加到现有 Tab 内，不重组 Tab 结构
2. **Feature flag 保护**：所有 V2 UI 用 `useV2DataAssets()` 包裹，flag off 时不渲染
3. **单一事实来源**：不引入新的 schema 格式，只消费 canonical `TablePermissionPolicy` 等现有类型
4. **页面职责收敛**：风险页只读不改权限；输出审查只读列表
5. **Hooks 规范**：所有异步数据走 `src/app/(app)/data/hooks/` 下的统一 hook

---

## Part A：安全内核可视化最小版（Phase 2，Step 4-9）

### A1. 敏感字段分级 UI

**修改文件**: `src/app/(app)/data/components/TableDetail/FieldsTab.tsx`

**要做的事**：
1. 将现有 `🔒` 按钮替换为 `sensitivity_level` 下拉选择器（S0-S4）
2. 字段行背景色按敏感级别渐变：S0=无色, S1=蓝底, S2=黄底, S3=橙底, S4=红底
3. 批量操作条中增加"批量设置敏感级别"下拉
4. **向后兼容**：`sensitivity_level >= S2_sensitive` 时同步 `is_sensitive = true`

**涉及 API**：
- `PATCH /data-assets/fields/{id}/tags` — 已有，需支持 `sensitivity_level` 字段
- `PATCH /data-assets/fields/batch-tags` — 已有，需支持 `sensitivity_level` 字段

**注意**：
- 用 normalizer 处理旧接口返回值：缺 `sensitivity_level` 时从 `is_sensitive` 推断
- 下拉选项用 `SENSITIVITY_LABELS` 常量
- 色阶映射：

```typescript
const SENSITIVITY_BG: Record<SensitivityLevel, string> = {
  S0_public: "",
  S1_internal: "bg-blue-50",
  S2_sensitive: "bg-yellow-50",
  S3_highly_sensitive: "bg-orange-50",
  S4_regulated: "bg-red-50",
};
```

**验收标准**：
- [ ] 字段列表每行按敏感级别显示色阶
- [ ] 单个字段可选择 S0-S4
- [ ] 批量选择后可批量设置级别
- [ ] 旧接口（缺 sensitivity_level）不报错，正确降级

---

### A2. 字段生命周期状态

**修改文件**: `src/app/(app)/data/components/TableDetail/FieldsTab.tsx`

**要做的事**：
1. 每个字段名旁显示 `lifecycle_status` 标签
2. 样式：draft=灰色虚线边框, inferred=蓝色虚线, confirmed=绿色实线, deprecated=橙色删除线, archived=灰色删除线
3. `inferred` 状态的字段增加"确认"按钮，点击后变为 `confirmed`
4. `deprecated` 状态的字段整行半透明

**涉及 API**：
- `PATCH /data-assets/fields/{id}/tags` — 需支持 `lifecycle_status` 字段

**样式映射**：

```typescript
const LIFECYCLE_STYLES: Record<FieldLifecycleStatus, { label: string; className: string }> = {
  draft: { label: "草稿", className: "border-dashed border-gray-300 text-gray-400" },
  inferred: { label: "推断", className: "border-dashed border-blue-300 text-blue-500" },
  confirmed: { label: "已确认", className: "border-solid border-green-400 text-green-600" },
  deprecated: { label: "已弃用", className: "border-solid border-orange-300 text-orange-500 line-through" },
  archived: { label: "已归档", className: "border-solid border-gray-300 text-gray-400 line-through" },
};
```

**验收标准**：
- [ ] 每个字段显示生命周期标签
- [ ] inferred 字段有"确认"按钮
- [ ] deprecated/archived 字段视觉弱化
- [ ] 旧接口缺 lifecycle_status 时降级为 "inferred"

---

### A3. 小样本保护配置

**新建文件**: `src/app/(app)/data/components/TableDetail/security/SmallSampleProtection.tsx`

**要做的事**：
1. 在现有 `PermissionsTab.tsx` 底部追加（用 feature flag 保护）
2. UI 包含：
   - 开关 toggle（启用/禁用）
   - 阈值数字输入（默认 5，范围 2-20）
   - 回退策略单选：隐藏桶 / 合并为"其他" / 仅返回高层级分桶
3. 受影响的视图/Skill 列表（只读，从 `detail.views` 和 `detail.skill_grants` 中筛出 L2 的）
4. 保存按钮

**涉及 API**：
- `PATCH /data-assets/tables/{id}` — 需支持 `small_sample_protection` 字段
- **can-mock**：后端未实现时，保存成功但不生效，前端显示 toast "配置已保存（后端处理中）"

**组件接口**：

```typescript
interface Props {
  tableId: number;
  config: SmallSampleProtection;
  views: TableViewDetail[];
  skillGrants: SkillDataGrant[];
  onSave: (config: SmallSampleProtection) => Promise<void>;
}
```

**验收标准**：
- [ ] 开关切换正常
- [ ] 阈值可编辑
- [ ] 回退策略可选
- [ ] 受影响列表正确筛选 L2 视图
- [ ] 保存调用正确 API

---

### A4. 风险评分面板（只读）

**新建文件**: `src/app/(app)/data/components/TableDetail/security/RiskScorePanel.tsx`

**要做的事**：
1. 在现有 `OverviewTab.tsx` 中追加风险评分卡片（位于"字段画像"卡片下方）
2. UI 包含：
   - 总分圆形指示器（0-100）+ 风险等级文字（低/关注/高/阻断）
   - 色阶：low=绿, attention=黄, high=橙, block=红
   - 因素明细列表：每个因素一行（标签 / 得分 / 说明）
   - 整改建议区域（纯文字）
3. **不含任何编辑操作**

**涉及 API**：
- `GET /data-assets/tables/{id}/risk` — **can-mock**
- mock 策略：后端 404 时，前端根据 `detail` 本地计算简化评分

**本地计算逻辑（mock fallback）**：

```typescript
function computeLocalRisk(detail: TableDetail): RiskAssessment {
  let score = 0;
  const factors: RiskFactor[] = [];

  // 敏感字段数
  const sensitiveCount = detail.fields.filter(f => f.is_sensitive).length;
  if (sensitiveCount > 0) {
    const s = Math.min(sensitiveCount * 5, 30);
    score += s;
    factors.push({ code: "SENSITIVE_FIELDS", label: "敏感字段", score: s, detail: `${sensitiveCount} 个敏感字段` });
  }

  // 披露级别
  const maxDisclosure = detail.permission_policies.reduce((max, p) => {
    const order = { L0: 0, L1: 1, L2: 2, L3: 3, L4: 4 };
    return Math.max(max, order[p.disclosure_level] || 0);
  }, 0);
  if (maxDisclosure >= 3) {
    const s = maxDisclosure * 8;
    score += s;
    factors.push({ code: "HIGH_DISCLOSURE", label: "高披露级别", score: s, detail: `最高 L${maxDisclosure}` });
  }

  // 无权限策略
  if (detail.permission_policies.length === 0) {
    score += 15;
    factors.push({ code: "NO_POLICY", label: "无权限策略", score: 15, detail: "未配置任何权限策略" });
  }

  // Skill 整表绑定
  const wholeTableBindings = detail.skill_grants?.filter(g => !g.view_id) || [];
  if (wholeTableBindings.length > 0) {
    const s = wholeTableBindings.length * 10;
    score += s;
    factors.push({ code: "WHOLE_TABLE_BINDING", label: "整表绑定", score: s, detail: `${wholeTableBindings.length} 个 Skill 整表绑定` });
  }

  const level: RiskLevel = score < 20 ? "low" : score < 50 ? "attention" : score < 80 ? "high" : "block";
  return { table_id: detail.id, overall_level: level, overall_score: Math.min(score, 100), factors, assessed_at: new Date().toISOString() };
}
```

**验收标准**：
- [ ] 有后端数据时显示后端评分
- [ ] 后端 404 时显示本地计算评分
- [ ] 色阶正确
- [ ] 因素列表可展开
- [ ] 无任何编辑操作

---

### A5. 输出审查日志面板（只读）

**新建文件**: `src/app/(app)/data/components/TableDetail/security/OutputReviewPanel.tsx`

**要做的事**：
1. 在现有 `SkillBindingsTab.tsx` 底部追加（feature flag 保护）
2. UI 包含：
   - 顶部统计条：本周审查次数 / 拦截次数 / 拦截率
   - 列表：Skill名 | 动作 | 原因 | 时间
   - 动作类型筛选（pass / redact / downgrade / block / require_approval）
   - 点击展开：原始片段 vs 审查后片段
3. **纯只读**

**涉及 API**：
- `GET /data-assets/output-review-logs?table_id={id}` — **can-mock**
- mock：返回空列表 + 统计为 0

**动作色阶**：

```typescript
const REVIEW_ACTION_STYLES: Record<OutputReviewAction, { label: string; color: string }> = {
  pass: { label: "通过", color: "text-green-500" },
  redact_and_continue: { label: "脱敏放行", color: "text-yellow-500" },
  downgrade_to_summary: { label: "降级为汇总", color: "text-orange-500" },
  block_response: { label: "阻断", color: "text-red-500" },
  require_approval: { label: "需审批", color: "text-purple-500" },
};
```

**验收标准**：
- [ ] 列表正确渲染
- [ ] 筛选正常
- [ ] 展开/收起正常
- [ ] 无数据时显示"暂无审查记录"
- [ ] 统计正确

---

### A6. 字段影响图（只读）

**新建文件**: `src/app/(app)/data/components/TableDetail/fields/FieldImpactPanel.tsx`

**要做的事**：
1. 在 `FieldsTab.tsx` 的 `FieldRow` 中增加"影响"按钮
2. 点击后弹出面板（inline 展开，不是 modal）
3. 显示 4 个维度：
   - 被哪些视图使用（view_name 列表）
   - 被哪些权限策略引用（role_group_name 列表）
   - 被哪些 Skill 授权使用（skill_name 列表）
   - 被哪些同步规则依赖（字符串列表）
4. **纯只读**

**涉及 API**：
- `GET /data-assets/fields/{id}/impact` — **can-mock**
- mock fallback：从 `detail` 本地计算

**本地计算逻辑（mock fallback）**：

```typescript
function computeLocalFieldImpact(fieldId: number, detail: TableDetail): FieldImpactEdge {
  const field = detail.fields.find(f => f.id === fieldId);
  return {
    field_id: fieldId,
    field_name: field?.field_name || "",
    used_by_views: detail.views
      .filter(v => v.visible_field_ids?.includes(fieldId))
      .map(v => ({ view_id: v.id, view_name: v.name })),
    used_by_policies: detail.permission_policies
      .filter(p => p.allowed_field_ids.includes(fieldId) || p.blocked_field_ids.includes(fieldId))
      .map(p => {
        const rg = detail.role_groups.find(r => r.id === p.role_group_id);
        return { policy_id: p.id, role_group_name: rg?.name || `角色组#${p.role_group_id}` };
      }),
    used_by_skill_grants: (detail.skill_grants || [])
      .filter(g => Object.keys(g.field_rule_override_json || {}).length > 0)
      .map(g => ({ grant_id: g.id, skill_name: g.skill_name || `Skill#${g.skill_id}` })),
    used_by_sync_rules: [],
  };
}
```

**验收标准**：
- [ ] "影响"按钮在每个字段行显示
- [ ] 点击展开影响面板
- [ ] 4 个维度正确显示
- [ ] 无引用时显示"无引用"
- [ ] 后端 404 时降级为本地计算

---

## Part B：审批/版本/影响分析（Phase 6，Step 21-25）

### 前置调查（Step 0.7，必须先做）

#### B0a. 审批页承载验证

**检查文件**: `src/app/(app)/approvals/page.tsx`

逐项确认：
1. 现有 `ApprovalRequest` 类型（见 `src/lib/types.ts`）能否承载 `DataApprovalType` 的 payload？
   - 检查 `request_type` 字段是否为 string 类型（可扩展）
   - 检查 `payload` 或 `details` 字段能否存 JSON
2. 现有 TYPE_TABS 能否新增数据安全分类？
3. 审批状态流 pending → approved/rejected 够用吗？

**输出**：在代码中写注释记录调查结论，选择路径 A 或 B：
- **路径 A**：可承载 → Step 21 修改 `approvals/page.tsx`
- **路径 B**：不可承载 → Step 21 新建 `InlineApprovalPanel.tsx`

#### B0b. 审计页承载验证

**检查文件**: `src/app/(app)/admin/audit/page.tsx`

逐项确认：
1. 现有 `AuditLog` 能否承载 diff JSON？
2. 能否按 entity_type + entity_id 过滤？
3. 能否增加风险级别筛选？

**输出**：选择路径 A（全局扩展）或路径 B（页内审计面板）。

---

### B1. 审批面板

#### 路径 A：全局审批扩展
**修改文件**: `src/app/(app)/approvals/page.tsx`

1. 在 `TYPE_TABS` 中增加：
```typescript
{ key: "skill_grant_l4,external_skill_raw,whole_table_high_sens,modify_s3_s4_masking,disable_small_sample,export_raw_detail", label: "数据安全" },
```

2. 在 `requestTypeLabel` 中增加映射：
```typescript
skill_grant_l4: "Skill 提升到 L4",
external_skill_raw: "外部 Skill 开原始值",
whole_table_high_sens: "整表绑定高敏表",
modify_s3_s4_masking: "修改 S3/S4 披露",
disable_small_sample: "关闭小样本保护",
export_raw_detail: "导出原始明细",
```

3. 审批详情展示增加数据资产专用渲染（表名、影响范围摘要）

#### 路径 B：页内审批面板
**新建文件**: `src/app/(app)/data/components/TableDetail/security/InlineApprovalPanel.tsx`

独立面板，只显示当前表相关的待审批/已审批请求。

**验收标准**：
- [ ] 数据安全审批类型正确显示
- [ ] 可审批/拒绝
- [ ] 审批详情含表名和影响摘要

---

### B2. 内联审批触发

**新建文件**: `src/app/(app)/data/components/TableDetail/security/ApprovalTrigger.tsx`

**要做的事**：
1. 提供 `useApprovalCheck` hook，集成到 `useDataAssetMutation` 的前置钩子
2. 判断逻辑：

```typescript
function checkApprovalRequired(operation: string, payload: unknown): DataApprovalType | null {
  // Skill grant max_disclosure_level === "L4" → "skill_grant_l4"
  // external skill + grant_mode === "allow" + raw fields → "external_skill_raw"
  // binding whole table + 表含 S3/S4 字段 → "whole_table_high_sens"
  // 修改 S3/S4 字段的 masking_rule_json → "modify_s3_s4_masking"
  // small_sample_protection.enabled = false → "disable_small_sample"
  // export_permission = true + disclosure_level >= L3 → "export_raw_detail"
  return null; // 不需要审批
}
```

3. 需要审批时弹出表单：
   - 审批类型（自动填充）
   - 变更说明（必填文本框）
   - 预期影响（自动生成摘要）
4. 提交后创建审批请求，操作暂不生效，显示"已提交审批，待管理员确认"

**涉及 API**：
- `POST /data-assets/approval-requests` — **can-mock**（开发期直接自动通过）

**验收标准**：
- [ ] 高风险操作自动触发审批弹窗
- [ ] 表单字段完整
- [ ] 提交成功后操作不生效
- [ ] 非高风险操作不弹审批

---

### B3. 策略版本对比与回滚

**新建文件**: `src/app/(app)/data/components/TableDetail/security/PolicyVersionPanel.tsx`

**要做的事**：
1. 在 PermissionsTab 中追加"版本历史"区域（feature flag 保护）
2. UI 包含：
   - 时间线列表：版本号 / 变更人 / 变更时间 / 变更原因
   - 选中某版本后显示 Diff 视图（左=旧, 右=新, 变更字段高亮）
   - 回滚按钮（需二次确认 + 输入回滚原因）
3. Diff 渲染：JSON 对比，用色阶标记 added/removed/changed

**涉及 API**：
- `GET /data-assets/policies/{id}/versions` — **can-mock**
- `POST /data-assets/policies/{id}/rollback` — **later**（开发期 mock）

**Diff 渲染逻辑**：

```typescript
function renderDiff(oldSnapshot: Record<string, unknown>, newSnapshot: Record<string, unknown>): DiffLine[] {
  const allKeys = new Set([...Object.keys(oldSnapshot), ...Object.keys(newSnapshot)]);
  return Array.from(allKeys).map(key => {
    const oldVal = JSON.stringify(oldSnapshot[key]);
    const newVal = JSON.stringify(newSnapshot[key]);
    if (!(key in oldSnapshot)) return { key, type: "added", newVal };
    if (!(key in newSnapshot)) return { key, type: "removed", oldVal };
    if (oldVal !== newVal) return { key, type: "changed", oldVal, newVal };
    return { key, type: "unchanged", oldVal };
  });
}
```

**验收标准**：
- [ ] 版本列表正确渲染
- [ ] 选中版本显示 Diff
- [ ] Diff 色阶正确（added=绿, removed=红, changed=黄）
- [ ] 回滚需二次确认
- [ ] 无版本时显示"暂无变更记录"

---

### B4. 影响分析面板

**新建文件**: `src/app/(app)/data/components/TableDetail/security/ImpactAnalysisPanel.tsx`

**要做的事**：
1. 作为 modal/drawer 组件，由 `useDataAssetMutation` 的前置钩子调用
2. 输入：当前操作类型 + 变更 payload
3. 输出分析结果：
   - 受影响角色组列表
   - 受影响 Skill 列表
   - 数据暴露是否扩大（新增可见字段/行范围扩大）
   - 可能失效的 Skill（视图/字段被删后无法访问）
   - 视图字段缺失警告
4. 用户可选择"继续保存"或"取消"

**影响分析逻辑（前端计算）**：

```typescript
interface ImpactAnalysis {
  affected_role_groups: { id: number; name: string; impact: string }[];
  affected_skills: { id: number; name: string; impact: string }[];
  exposure_expanded: boolean;
  exposure_detail: string;
  skill_failures: { skill_name: string; reason: string }[];
  view_field_warnings: { view_name: string; missing_fields: string[] }[];
}

function analyzeImpact(
  operation: "update_policy" | "delete_view" | "delete_field" | "update_grant",
  payload: Record<string, unknown>,
  detail: TableDetail,
): ImpactAnalysis {
  // ... 基于 detail 的本地分析
}
```

**验收标准**：
- [ ] 保存前自动弹出影响分析
- [ ] 无影响时快速通过（不弹窗）
- [ ] 有影响时清晰展示每项
- [ ] 用户可继续或取消
- [ ] 暴露扩大用红色警告

---

### B5. 页内审计面板（或全局审计扩展）

根据 B0b 调查结果选择路径。

#### 路径 A：全局审计扩展
**修改文件**: `src/app/(app)/admin/audit/page.tsx`

增加筛选：
- 按数据资产表名
- 按操作类型（权限变更/Skill 授权/视图变更/字段变更）
- 按风险级别
- 展开详情增加 Diff 渲染

#### 路径 B：页内审计面板
**新建文件**: `src/app/(app)/data/components/TableDetail/security/InlineAuditPanel.tsx`

只显示当前表相关的审计日志。

---

## Part C：外部源治理（Phase 7，Step 26-28）

### C1. 数据源画像面板

**新建文件**: `src/app/(app)/data/components/TableDetail/source/SourceProfilePanel.tsx`

**要做的事**：
1. 在 `OverviewTab.tsx` 的"同步状态"卡片下方追加（仅 source_type !== "blank" 时显示）
2. UI 包含：
   - 来源类型 + 连接身份
   - 能力矩阵：行级下推 ✓/✗ | 列裁剪 ✓/✗ | 原生脱敏 ✓/✗
   - 实际下推比例进度条
   - 最近错误（若有）
   - 安全级别 badge

**涉及 API**：
- 数据来自 `TableDetail.source_profile`（由 normalizer 填充）
- 无后端数据时显示"外部源信息暂未就绪"

**验收标准**：
- [ ] 只对外部源表显示
- [ ] 能力矩阵正确渲染
- [ ] 下推比例进度条正确
- [ ] 无数据时优雅降级

---

### C2. 降级告警组件

**新建文件**: `src/app/(app)/data/components/TableDetail/source/DegradationAlert.tsx`

**要做的事**：
1. 在 `PreviewTab.tsx` 和 `OverviewTab.tsx` 顶部条件渲染
2. 触发条件：`source_profile.actual_pushdown_ratio < 0.5` 或 `source_profile.last_sync_error` 存在
3. UI：黄色/红色告警条
   - 文案：降级原因 + 当前模式
   - 性能影响提示
   - 安全影响提示
   - risk_level >= high 时阻断查询按钮

**验收标准**：
- [ ] 下推率低时显示黄色告警
- [ ] 有同步错误时显示红色告警
- [ ] 高风险时显示阻断提示
- [ ] 正常源不显示

---

### C3. 外部源安全配置

**修改文件**: `src/app/(app)/data/components/connect/ConnectTab.tsx`

**要做的事**：
1. 在"对接数据源"页面增加"安全配置"折叠区域
2. 已接入源列表每行增加安全级别 badge + 能力摘要
3. 点击进入表详情（跳转到对应表的 OverviewTab）

**验收标准**：
- [ ] 安全配置区域正确显示
- [ ] 跳转正确

---

## Part D：对应测试

### D1. normalizer 相关（Part A 依赖）
**已由主线 Phase 0 覆盖**，本支线确保不破坏。

### D2. 输出审查器测试
**新建文件**: `src/__tests__/data-assets/output-review.test.ts`

```typescript
describe("输出审查日志", () => {
  it("空列表渲染正确", () => { ... });
  it("筛选按动作类型工作", () => { ... });
  it("统计计算正确", () => { ... });
  it("展开显示原始/审查片段", () => { ... });
});
```

### D3. 小样本保护测试
**新建文件**: `src/__tests__/data-assets/small-sample.test.ts`

```typescript
describe("小样本保护", () => {
  it("开关切换更新配置", () => { ... });
  it("阈值范围限制 2-20", () => { ... });
  it("受影响列表只筛 L2 视图", () => { ... });
  it("保存调用正确 API", () => { ... });
});
```

### D4. 策略版本测试
**新建文件**: `src/__tests__/data-assets/policy-version.test.ts`

```typescript
describe("策略版本", () => {
  it("版本列表按时间倒序", () => { ... });
  it("Diff 正确标记 added/removed/changed", () => { ... });
  it("回滚需二次确认", () => { ... });
  it("空版本列表提示", () => { ... });
});
```

### D5. 影响分析测试
**新建文件**: `src/__tests__/data-assets/impact-analysis.test.ts`

```typescript
describe("影响分析", () => {
  it("删字段 → 识别受影响视图和策略", () => { ... });
  it("提升披露级别 → 识别暴露扩大", () => { ... });
  it("删视图 → 识别 Skill 失效", () => { ... });
  it("无影响时不弹窗", () => { ... });
});
```

### D6. 敏感分级 + 生命周期测试
**新建文件**: `src/__tests__/data-assets/field-sensitivity.test.ts`

```typescript
describe("敏感字段分级", () => {
  it("S0-S4 色阶正确", () => { ... });
  it("批量设置级别", () => { ... });
  it("向后兼容：S2+ → is_sensitive=true", () => { ... });
  it("旧接口缺 sensitivity_level 降级", () => { ... });
});

describe("字段生命周期", () => {
  it("lifecycle_status 标签正确", () => { ... });
  it("inferred 有确认按钮", () => { ... });
  it("deprecated 半透明", () => { ... });
  it("旧接口缺 lifecycle_status 降级为 inferred", () => { ... });
});
```

### D7. 风险评分本地计算测试
**新建文件**: `src/__tests__/data-assets/risk-score.test.ts`

```typescript
describe("风险评分", () => {
  it("无敏感字段 + 有策略 → 低风险", () => { ... });
  it("多敏感字段 + 无策略 → 高风险", () => { ... });
  it("整表绑定 + L4 → 高风险", () => { ... });
  it("评分上限 100", () => { ... });
});
```

---

## 新建文件清单

```
# 组件
src/app/(app)/data/components/TableDetail/security/SmallSampleProtection.tsx
src/app/(app)/data/components/TableDetail/security/RiskScorePanel.tsx
src/app/(app)/data/components/TableDetail/security/OutputReviewPanel.tsx
src/app/(app)/data/components/TableDetail/security/ApprovalTrigger.tsx
src/app/(app)/data/components/TableDetail/security/PolicyVersionPanel.tsx
src/app/(app)/data/components/TableDetail/security/ImpactAnalysisPanel.tsx
src/app/(app)/data/components/TableDetail/security/InlineApprovalPanel.tsx  (条件)
src/app/(app)/data/components/TableDetail/security/InlineAuditPanel.tsx    (条件)
src/app/(app)/data/components/TableDetail/fields/FieldImpactPanel.tsx
src/app/(app)/data/components/TableDetail/source/SourceProfilePanel.tsx
src/app/(app)/data/components/TableDetail/source/DegradationAlert.tsx

# 测试
src/__tests__/data-assets/output-review.test.ts
src/__tests__/data-assets/small-sample.test.ts
src/__tests__/data-assets/policy-version.test.ts
src/__tests__/data-assets/impact-analysis.test.ts
src/__tests__/data-assets/field-sensitivity.test.ts
src/__tests__/data-assets/risk-score.test.ts
```

## 修改文件清单

```
src/app/(app)/data/components/TableDetail/FieldsTab.tsx         — 敏感分级 + 生命周期 + 影响按钮
src/app/(app)/data/components/TableDetail/OverviewTab.tsx       — 追加风险卡片 + 源画像
src/app/(app)/data/components/TableDetail/PermissionsTab.tsx    — 追加小样本 + 版本
src/app/(app)/data/components/TableDetail/SkillBindingsTab.tsx  — 追加输出审查
src/app/(app)/data/components/TableDetail/PreviewTab.tsx        — 追加降级告警
src/app/(app)/data/components/connect/ConnectTab.tsx            — 安全配置区
src/app/(app)/approvals/page.tsx                                — 数据安全类型（条件路径 A）
src/app/(app)/admin/audit/page.tsx                              — 数据资产筛选（条件路径 A）
```

---

## 验收总结

| 模块 | 验收标准 |
|------|---------|
| 敏感分级 | S0-S4 色阶、批量操作、向后兼容 |
| 生命周期 | 标签渲染、确认操作、降级处理 |
| 小样本保护 | 开关+阈值+策略、受影响列表 |
| 风险评分 | 只读、色阶、因素明细、本地 fallback |
| 输出审查 | 只读列表、筛选、统计、展开 |
| 字段影响 | 只读面板、4 维度、本地 fallback |
| 审批触发 | 高风险自动触发、表单完整、操作暂停 |
| 策略版本 | 时间线、Diff、回滚二次确认 |
| 影响分析 | 前置钩子、有影响时弹窗、可取消 |
| 数据源画像 | 能力矩阵、下推比例、优雅降级 |
| 降级告警 | 条件渲染、黄/红色阶、阻断 |
| 外部源配置 | 安全 badge、跳转正确 |
