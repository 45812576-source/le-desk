# Phase 4: 文件管理 + 未归档治理 — 实施计划

## Context

当前文件管理有基础的 FolderTree + AssetList + UnfiledWorkbench + batch-classify API，但缺少治理能力：
- 分类操作无 reason 字段（无审计追溯）
- 无自动分类规则引擎
- 批量归档无冲突检测（目标 folder 可能有同名表）
- DataFolder 无权限模型（任何人都能看到所有 folder）
- AssetList 缺少结构化风险展示

---

## Step 1: 分类操作添加审计

**文件**: `backend/app/routers/data_assets.py` — 修改 `classify_table` 和 `batch_classify_tables`

```python
class ClassifyRequest(BaseModel):
    folder_id: int
    reason: str | None = None  # 可选的分类原因

@router.post("/tables/{table_id}/classify")
def classify_table(...):
    # ... existing logic ...
    # 写审计日志
    _write_audit_log(db, user, "classify", "business_tables", table_id,
        old_values={"folder_id": old_folder_id},
        new_values={"folder_id": req.folder_id, "reason": req.reason})
```

`batch_classify_tables` 同理，返回逐条结果：

```python
class BatchClassifyResult(BaseModel):
    table_id: int
    success: bool
    error: str | None = None

@router.post("/batch-classify")
def batch_classify_tables(...):
    results = []
    for tid in req.table_ids:
        try:
            bt = db.get(BusinessTable, tid)
            if not bt:
                results.append({"table_id": tid, "success": False, "error": "表不存在"})
                continue
            old = bt.folder_id
            bt.folder_id = req.folder_id
            results.append({"table_id": tid, "success": True})
            _write_audit_log(...)
        except Exception as e:
            results.append({"table_id": tid, "success": False, "error": str(e)})
    db.commit()
    return {"results": results}
```

---

## Step 2: 批量冲突检测

**文件**: `backend/app/routers/data_assets.py` — 修改 `batch_classify_tables`

在归档前检查目标 folder 是否已有同 display_name 的表：

```python
# 查目标 folder 下已有的 display_name
existing_names = {t.display_name for t in
    db.query(BusinessTable).filter(BusinessTable.folder_id == req.folder_id).all()}

for tid in req.table_ids:
    bt = db.get(BusinessTable, tid)
    if bt.display_name in existing_names:
        results.append({"table_id": tid, "success": False, "error": f"目标目录已有同名表: {bt.display_name}"})
        continue
```

---

## Step 3: 自动分类建议

**文件**: `backend/app/routers/data_assets.py` — 新增端点

```python
@router.get("/unfiled/classify-suggestions")
def suggest_classifications(db: Session = Depends(get_db), ...):
    """基于表名/字段特征，建议未归档表应归入哪个 folder"""
    # 策略：
    # 1. 表名前缀匹配（如 hr_xxx → HR 文件夹）
    # 2. source_type 匹配（bitable → 飞书同步表 文件夹）
    # 3. 字段相似度（与已归档表的字段集交集最大的 folder）
```

---

## Step 4: 目录可见性（轻量版）

**文件**: `backend/app/models/business.py` — DataFolder 新增字段

```python
class DataFolder(Base):
    # ... existing fields ...
    visibility_scope = Column(String(20), default="all")  # "all" | "department" | "private"
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    department_ids = Column(JSON, default=list)
```

**文件**: `backend/app/routers/data_assets.py` — 修改 `list_folders`

非管理员只能看到 visibility_scope="all" 或匹配自己部门/user_id 的 folder。

---

## Step 5: AssetList 风险展示

**文件**: `AssetList.tsx` — 增强风险态展示

当前 `risk_warnings` 已从后端返回（`_risk_warnings` in table enrichment），但前端只做过滤。增加：
- 每个表旁显示风险图标 + tooltip
- 风险类型：`no_policy`（无权限策略）、`no_folder`（未归档）、`stale_sync`（同步超时）、`sensitive_exposed`（敏感字段无脱敏规则）

---

## 修改文件清单

| 文件 | 动作 |
|------|------|
| `backend/app/routers/data_assets.py` | 修改：classify 审计 + 冲突检测 + 批量结果 + 分类建议 |
| `backend/app/models/business.py` | 修改：DataFolder 新增可见性字段 |
| `AssetList.tsx` | 修改：风险态展示 |
| `UnfiledWorkbench.tsx` | 修改：显示分类建议 + 冲突提示 |

---

## 验证方式

1. classify 操作写入 PermissionAuditLog
2. batch-classify 同名冲突时返回错误
3. 目录可见性过滤生效
4. 风险图标正确显示
