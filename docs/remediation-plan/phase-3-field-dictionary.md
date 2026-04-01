# Phase 3: 字段字典治理 — 实施计划

## Context

字段字典已有基础设施（FieldValueDictionary 模型、CRUD API、FieldsTab UI），但缺少治理规则：
- 枚举源优先级未定义（synced/manual/inferred 混用）
- free→enum 升级只有手动 PATCH，无自动流程
- 敏感字段的 sample_values 不受控（field_profiler.py 对所有字段填 sample）
- 无 permission_anchor 概念（字段与权限策略的正式关联）

---

## Step 1: 枚举源优先级

**文件**: `backend/app/services/field_profiler.py` — 修改 `_profile_from_scratch`

```python
ENUM_SOURCE_PRIORITY = {"synced": 3, "manual": 2, "inferred": 1, "observed": 0}

# 推断枚举时，如果字段已有更高优先级的来源，不覆盖
if existing_source_priority >= new_source_priority:
    continue  # 不覆盖
```

**文件**: `backend/app/routers/data_assets.py` — `save_field_dictionary` 添加合并逻辑

当 `is_enum=True` 且写入新字典时：
- synced 值不可被 manual 删除（只能标记 is_active=false）
- manual 值可以覆盖 inferred 值
- 更新 `TableField.enum_values` 为活跃值的 value 列表

---

## Step 2: 敏感字段 sample_values 保护

**文件**: `backend/app/services/field_profiler.py` — 修改 `_fill_stats`

```python
def _fill_stats(db, table_name, col_name, tf):
    # ... existing logic ...

    # 敏感字段不采集 sample_values
    if tf.is_sensitive:
        tf.sample_values = []
        return

    # 非敏感字段正常采集
    result = db.execute(text(...))
    tf.sample_values = [str(r[0]) for r in result if r[0] is not None]
```

---

## Step 3: free→enum 自动升级建议

**文件**: `backend/app/services/field_profiler.py` — 新增 `suggest_enum_upgrade`

```python
def suggest_enum_upgrade(db: Session, table_id: int) -> list[dict]:
    """找出可能应该升级为枚举的 free text 字段"""
    fields = db.query(TableField).filter(
        TableField.table_id == table_id,
        TableField.is_free_text == True,
        TableField.is_enum == False,
    ).all()

    suggestions = []
    for tf in fields:
        if tf.distinct_count_cache and tf.distinct_count_cache <= 20:
            total = db.execute(text(f"SELECT COUNT(*) FROM `{bt.table_name}`")).scalar() or 1
            ratio = tf.distinct_count_cache / total
            if ratio <= 0.5:
                suggestions.append({
                    "field_id": tf.id,
                    "field_name": tf.field_name,
                    "distinct_count": tf.distinct_count_cache,
                    "suggested_values": tf.sample_values[:20],
                })
    return suggestions
```

**文件**: `backend/app/routers/data_assets.py` — 新增端点

```python
@router.get("/tables/{table_id}/enum-suggestions")
def get_enum_suggestions(table_id: int, ...):
    return {"suggestions": suggest_enum_upgrade(db, table_id)}
```

**文件**: `FieldsTab.tsx` — 新增"升级建议"提示

显示建议升级的字段，点击可一键将 `is_free_text=false, is_enum=true` 并生成字典。

---

## Step 4: 字段字典批量操作

**文件**: `FieldsTab.tsx` — 新增批量功能

- 批量标记敏感（选中多个字段 → PATCH is_sensitive=true）
- 批量设置角色标签（选中多个字段 → PATCH field_role_tags）
- 批量导入枚举值（上传 CSV → PUT /fields/{id}/dictionary）

---

## 修改文件清单

| 文件 | 动作 |
|------|------|
| `backend/app/services/field_profiler.py` | 修改：枚举源优先级 + 敏感字段 sample 保护 + 升级建议 |
| `backend/app/routers/data_assets.py` | 修改：字典合并逻辑 + enum-suggestions 端点 |
| `FieldsTab.tsx` | 修改：升级建议 + 批量操作 |
| 前端测试 | 新增字典治理测试 |

---

## 验证方式

1. synced 枚举值不被手动操作删除
2. 敏感字段画像后 sample_values 为空
3. free text 字段有升级建议显示
4. 批量操作正确调用 API
