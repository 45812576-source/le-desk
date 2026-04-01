# Phase 5: 前端证据链 + 阻断反馈 — 实施计划

## Context

当前前端权限预览（PermissionPreview）是纯客户端计算，无法给用户解释"为什么被拒绝"。需要：
- 权限 explain 可视化（调用 Phase 1 的 explain 端点）
- deny reason 展示
- Skill 绑定关系可视化
- PreviewTab 接入新权限（显示用户实际能看到的数据）

## 依赖

Phase 1（策略引擎 + explain 端点）必须先完成。

---

## Step 1: PermissionPreview 对接后端 explain

**文件**: `PermissionPreview.tsx` — 增强

```tsx
// 新增 "查看后端生效结果" 按钮
// 调用 GET /data-assets/tables/{tableId}/permission-explain?user_id=X
// 展示：
//   - matched_role_groups（匹配到了哪些角色组）
//   - source（策略来自 skill_grant / view_policy / table_policy / default_deny）
//   - deny_reasons[]（如果被拒绝，显示具体原因列表）
//   - visible_fields vs client_computed_fields 对比（不一致时高亮警告）
```

增加"为何被拒绝"面板：
- 当 hasPolicy=false 或 policy.row_access_mode="none" 时，显示 deny_reasons
- 建议用户联系管理员 + 显示需要的角色组

---

## Step 2: PreviewTab 接入权限过滤

**文件**: `PreviewTab.tsx` — 修改

当前 PreviewTab 直接调用 `/data/{tableName}/rows` 并根据前端 `hidden_fields` 过滤。Phase 1 后，后端已做权限裁剪，前端只需：
- 移除客户端 hidden_fields 过滤（后端已处理）
- 在数据行上方显示当前用户的生效权限摘要（L级别 + 可见字段数）
- 如果返回 0 行且非空表，显示"您无权查看此表数据"

---

## Step 3: Skill 绑定关系可视化

**文件**: `SkillBindingsTab.tsx` — 增强

当前是纯列表。增加：
- 绑定关系图（简化版）：表 → 视图 → Skill，用 flexbox/grid 画，不需要 D3
- 每个绑定显示：grant_mode, max_disclosure_level, approval_required
- 点击绑定展开 SkillDataGrant 详情
- 显示该 Skill 通过此绑定能看到的字段列表（调用 explain 端点）

---

## Step 4: 资产列表增强

**文件**: `AssetList.tsx` — 修改（Phase 4 风险图标基础上继续）

- 每个表显示权限摘要标签（如"3 角色组 / 2 视图 / 4 Skill"）
- hover 显示最严格和最宽松的角色组
- 快捷入口："配置权限"直接跳转到该表的权限 tab

---

## 修改文件清单

| 文件 | 动作 |
|------|------|
| `PermissionPreview.tsx` | 修改：对接 explain 端点 + deny reason 展示 |
| `PreviewTab.tsx` | 修改：移除客户端过滤 + 权限摘要 |
| `SkillBindingsTab.tsx` | 增强：绑定关系图 + grant 详情 |
| `AssetList.tsx` | 增强：权限摘要标签 |

---

## 验证方式

1. PermissionPreview 显示后端计算的 deny_reasons
2. PreviewTab 显示的数据与后端权限裁剪一致
3. SkillBindingsTab 可展开查看 grant 详情和可见字段
4. 无权限时显示清晰的"为何被拒绝"提示
