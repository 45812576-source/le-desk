# Phase 2: 视图作为唯一授权面 — 实施计划

## Context

当前视图模型有 `TableViewDetail` 类型（含 view_kind, disclosure_ceiling, allowed_role_group_ids, allowed_skill_ids, row_limit）和后端 `TableView` 模型，但：
- Skill 可以不绑定视图直接读全表（`data_tables.py:211` view_id 可选）
- 前端 `ViewsTab.tsx` 只读，无法创建/编辑视图
- 视图级策略保存 API 存在（`data_assets.py:1310`）但前端 PermissionMatrix 未调用
- 无视图快照/版本化
- view_kind 字段无后端约束

## 依赖

Phase 1（策略引擎）必须先完成。

---

## Step 1: Skill 必须绑定视图才能访问数据

**文件**: `backend/app/services/policy_engine.py` — 修改 `resolve_effective_policy`

```python
# 在 skill_id 路径中，如果 grant 没有 view_id，拒绝
if skill_id and grant and not grant.view_id:
    return PolicyResult(denied=True, deny_reasons=["Skill 必须绑定视图才能访问数据"], ...)
```

**文件**: `backend/app/routers/data_assets.py` — `batch_save_skill_grants` 添加校验

```python
for item in req.grants:
    if item.grant_mode == "allow" and not item.view_id:
        raise HTTPException(400, "授权模式为 allow 时必须指定视图")
```

---

## Step 2: ViewsTab 从只读升级为可编辑

**文件**: `src/app/(app)/data/components/TableDetail/ViewsTab.tsx` — 重构

新增功能：
- 创建视图（POST `/data-assets/tables/{tableId}/views`）
- 编辑视图配置（visible_field_ids, view_kind, disclosure_ceiling, filters, sorts）
- 删除视图（带影响检查：先调 GET `/data-assets/views/{viewId}/impact`）
- 视图类型选择器（list/board/metric/pivot/review_queue）
- disclosure_ceiling 下拉（L0-L4，限制该视图下策略的最高值）
- allowed_role_group_ids 多选（限制哪些角色组能通过此视图访问）

**后端需新增**:
- `POST /data-assets/tables/{table_id}/views` — 创建视图
- `PATCH /data-assets/views/{view_id}` — 更新视图
- `DELETE /data-assets/views/{view_id}` — 删除视图（需检查绑定）

---

## Step 3: PermissionMatrix 支持视图级策略

**文件**: `src/app/(app)/data/components/TableDetail/permissions/PermissionMatrix.tsx`

当前只保存表级策略。增加：
- 视图选择器（当选择视图时，编辑/保存该视图的策略）
- 保存时调用 `PUT /data-assets/views/{viewId}/permission-policies`
- disclosure_level 不能超过视图的 disclosure_ceiling

---

## Step 4: view_kind 约束矩阵

**文件**: `backend/app/services/policy_engine.py` — 新增

```python
VIEW_KIND_CONSTRAINTS = {
    "metric": {"max_disclosure": "L2", "row_access_modes": ["all"]},  # 指标视图只能聚合
    "review_queue": {"max_disclosure": "L4", "requires_approval": True},
    "list": {},  # 无额外约束
    "board": {},
    "pivot": {"max_disclosure": "L3"},
}
```

在 `resolve_effective_policy` 中，如果 view 有 view_kind 约束，强制 cap disclosure。

---

## 修改文件清单

| 文件 | 动作 |
|------|------|
| `backend/app/services/policy_engine.py` | 修改：Skill 必须绑定视图 + view_kind 约束 |
| `backend/app/routers/data_assets.py` | 修改：新增视图 CRUD 端点 + grant 校验 |
| `ViewsTab.tsx` | 重构：从只读升级为可编辑 |
| `PermissionMatrix.tsx` | 修改：支持视图级策略编辑 |
| 前端测试 | 新增 ViewsTab 组件测试 |

---

## 验证方式

1. Skill grant 没有 view_id 时 API 报错
2. 前端可以创建/编辑/删除视图
3. PermissionMatrix 可切换表级/视图级策略
4. metric 类型视图自动 cap 到 L2
