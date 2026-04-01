# Phase 1: 权限引擎核心 — 实施计划

## Context

数据表可视化一期的新权限模型（TableRoleGroup + TablePermissionPolicy + SkillDataGrant）已有完整的数据库模型、CRUD API 和前端 UI，但**后端数据查询完全不走新权限**。`data_tables.py` 的 `list_rows` 仍然使用旧的 `validation_rules.row_scope` + `DataOwnership` + `data_visibility` 三件套。Phase 1 的目标是补齐后端策略引擎，让新权限模型真正执行。

---

## Step 1: 新建统一策略引擎服务

**文件**: `backend/app/services/policy_engine.py`（新建）

核心函数：

```python
def resolve_user_role_groups(
    db: Session, table_id: int, user: User, skill_id: int | None = None
) -> list[TableRoleGroup]:
    """找出用户/Skill 所属的角色组"""
    # 查所有该表的角色组
    # 匹配逻辑：
    #   human_role: user.id in user_ids, or user.department_id in department_ids, or user.role in role_keys, or subject_scope="all"
    #   skill_role: skill_id in skill_ids
    #   mixed: 两者都检查

def resolve_effective_policy(
    db: Session, table_id: int, role_group_ids: list[int],
    view_id: int | None = None, skill_id: int | None = None
) -> PolicyResult:
    """合并多角色组策略，返回生效结果"""
    # 1. 对每个 role_group_id 查 policy（view-specific 优先）
    # 2. 显式 deny (row_access_mode=none) 优先 → 直接返回 denied
    # 3. allow 组：字段取并集，disclosure 取最高
    # 4. 如果有 skill_id，查 SkillDataGrant，取 min(grant.max_disclosure, merged_disclosure)
    # 返回：denied, row_access_mode, visible_field_ids, disclosure_level, masking_rules, export_permission, deny_reasons[]

def compute_visible_fields(
    fields: list[TableField], policy: PolicyResult
) -> list[TableField]:
    """根据策略过滤可见字段"""

def apply_field_masking(
    rows: list[dict], masking_rules: dict, fields: list[TableField]
) -> list[dict]:
    """对行数据应用脱敏规则"""
    # phone_mask: 138****1234
    # name_mask: 张*
    # id_mask: 310***********1234
    # email_mask: z***@example.com
    # amount_range: 10万-50万
    # full_mask: ***

def check_disclosure_capability(level: str) -> dict:
    """返回该披露级别的能力集"""
    # L0: 全禁
    # L1: 只能输出 yes/no 决策
    # L2: 只能输出聚合统计
    # L3: 可输出脱敏后的单行
    # L4: 可输出原始值
```

**数据类**:
```python
@dataclass
class PolicyResult:
    denied: bool
    deny_reasons: list[str]
    row_access_mode: str  # "all" | "owner" | "department" | "rule" | "none"
    row_rule_json: dict
    visible_field_ids: set[int]
    field_access_mode: str
    disclosure_level: str  # "L0"-"L4"
    masking_rules: dict
    export_permission: bool
    tool_permission_mode: str
    source: str  # "skill_grant" | "view_policy" | "table_policy" | "multi_group_merge" | "default_deny"
    matched_role_groups: list[int]
    effective_grant: dict | None  # SkillDataGrant info if applicable
```

---

## Step 2: 集成到 data_tables.py

**文件**: `backend/app/routers/data_tables.py` — 修改 `list_rows()`

修改策略：
1. 检查该表是否有新权限模型数据（有 TableRoleGroup 记录）
2. **有新模型** → 走 `policy_engine`
3. **无新模型** → 保持旧逻辑（向后兼容）

```python
@router.get("/{table_name}/rows")
def list_rows(...):
    bt = _get_registered_table(db, table_name)

    # 检查是否启用新权限模型
    has_new_policy = db.query(TableRoleGroup).filter(
        TableRoleGroup.table_id == bt.id
    ).first() is not None

    if has_new_policy and not is_admin:
        # 新权限引擎路径
        from app.services.policy_engine import resolve_user_role_groups, resolve_effective_policy, ...
        groups = resolve_user_role_groups(db, bt.id, user, skill_id=None)
        policy = resolve_effective_policy(db, bt.id, [g.id for g in groups], view_id)

        if policy.denied:
            return {"total": 0, ...}

        caps = check_disclosure_capability(policy.disclosure_level)
        if not caps["can_see_rows"]:
            return {"total": 0, ...}  # L0/L1/L2 不返回行

        # 构建 SQL + 行过滤
        # 字段过滤
        # 脱敏
    else:
        # 旧逻辑保持不变
```

Admin 用户（SUPER_ADMIN / DEPT_ADMIN）继续跳过权限检查。

---

## Step 3: 权限解释端点

**文件**: `backend/app/routers/data_assets.py` — 新增端点

```python
@router.get("/tables/{table_id}/permission-explain")
def explain_permissions(
    table_id: int,
    user_id: int | None = None,
    skill_id: int | None = None,
    view_id: int | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """返回某用户/Skill 对某表的生效权限解释"""
    # 调用 policy_engine 获取完整结果
    # 返回：matched_role_groups, effective_policy, visible_fields, deny_reasons, source
```

---

## Step 4: 审计日志

**文件**: `backend/app/routers/data_assets.py` — 在现有 CRUD 端点中插入审计写入

在以下端点添加 PermissionAuditLog 写入：
- `batch_save_permission_policies` (PUT `/tables/{id}/permission-policies`)
- `save_view_permission_policies` (PUT `/views/{id}/permission-policies`)
- `batch_save_skill_grants` (PUT `/tables/{id}/skill-grants`)
- `create_role_group` / `patch_role_group` / `delete_role_group`

```python
def _write_audit_log(db, user, action, target_table, target_id, old_values=None, new_values=None):
    log = PermissionAuditLog(
        operator_id=user.id,
        action=action,
        target_table=target_table,
        target_id=target_id,
        old_values=old_values or {},
        new_values=new_values or {},
    )
    db.add(log)
```

---

## Step 5: 后端测试

**文件**: `backend/tests/test_policy_engine.py`（新建）

测试与前端 `permission-engine.test.ts` 对等：
- `test_resolve_user_role_groups` — user/skill 匹配角色组
- `test_resolve_effective_policy_deny_wins` — 多组 deny 优先
- `test_resolve_effective_policy_fields_union` — 多组字段取并集
- `test_resolve_effective_policy_disclosure_max` — 多组 disclosure 取最高
- `test_skill_grant_caps_disclosure` — grant.max_disclosure 限制 policy
- `test_apply_field_masking` — phone/name/id/email 脱敏正确
- `test_disclosure_capabilities` — L0-L4 能力矩阵
- `test_backward_compat` — 无角色组的表走旧逻辑

---

## 修改文件清单

| 文件 | 动作 | 说明 |
|------|------|------|
| `backend/app/services/policy_engine.py` | 新建 | 统一策略引擎 |
| `backend/app/routers/data_tables.py` | 修改 | list_rows 接入新引擎 |
| `backend/app/routers/data_assets.py` | 修改 | 添加 permission-explain 端点 + 审计日志 |
| `backend/tests/test_policy_engine.py` | 新建 | 策略引擎单元测试 |

**不动的文件**：
- `permission_engine.py` / `data_visibility.py` — 旧系统保留，非数据资产表继续用
- 前端组件 — Phase 1 不改前端（除可选 explain 调试）
- 现有测试 — 99/99 继续绿

---

## 验证方式

1. 现有 99 个前端测试全绿
2. 新后端测试覆盖策略引擎核心逻辑
3. 手动测试：有角色组的表 → list_rows 按新策略裁剪；无角色组的表 → 旧逻辑不变
