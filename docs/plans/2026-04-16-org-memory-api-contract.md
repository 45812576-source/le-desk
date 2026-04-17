# Le Desk 组织 Memory — 前后端字段约定

日期：2026-04-16

## 1. 目的

本文档用于收敛 `Le Desk` 前端与后端在组织 Memory 一期上的接口字段约定，重点覆盖三类对象：

1. `Source`：源文档
2. `Snapshot`：结构化快照
3. `Proposal`：统一草案

同时补充 `Proposal 提交审批` 的返回契约，确保前端能在提交后跳转到审批页对应工单。

## 2. 兼容原则

前端当前已经按“宽容 DTO 适配”实现，意味着：

- 如果后端直接返回数组，前端可消费
- 如果后端返回 `{ items: [...] }`，前端可消费
- 如果后端返回 `{ data: [...] }` 或 `{ results: [...] }`，前端也可消费

但如果要稳定联调，建议后端统一成：

- 列表接口：`{ items: [...] }`
- 动作接口：`{ ...result }`

## 3. 列表接口

### 3.1 `GET /api/org-memory/sources`

建议返回：

```json
{
  "items": [
    {
      "id": 101,
      "title": "销售组织治理文档（2026Q2）",
      "source_type": "feishu_doc",
      "source_uri": "https://...",
      "owner_name": "销售运营组",
      "external_version": "v2026.04.14",
      "fetched_at": "2026-04-15T09:30:00+08:00",
      "ingest_status": "ready",
      "latest_snapshot_version": "snapshot-2026-04-15-01",
      "latest_parse_note": "关键章节齐全"
    }
  ]
}
```

字段要求：

- `source_type`：`feishu_doc | notion | markdown | upload`
- `ingest_status`：`ready | processing | warning | failed`

### 3.2 `GET /api/org-memory/snapshots`

建议返回：

```json
{
  "items": [
    {
      "id": 201,
      "source_id": 101,
      "source_title": "销售组织治理文档（2026Q2）",
      "snapshot_version": "snapshot-2026-04-15-01",
      "parse_status": "ready",
      "confidence_score": 0.92,
      "created_at": "2026-04-15T09:42:00+08:00",
      "summary": "已抽取 6 类对象",
      "entity_counts": {
        "units": 5,
        "roles": 4,
        "people": 18,
        "okrs": 3,
        "processes": 3
      },
      "units": [],
      "roles": [],
      "people": [],
      "okrs": [],
      "processes": [],
      "low_confidence_items": []
    }
  ]
}
```

字段要求：

- `parse_status`：`ready | processing | warning | failed`
- `confidence_score`：`0 ~ 1`
- 六类实体都允许为空数组，但字段要存在

### 3.3 `GET /api/org-memory/proposals`

建议返回：

```json
{
  "items": [
    {
      "id": 301,
      "snapshot_id": 201,
      "title": "销售组织 Memory 草案 #301",
      "proposal_status": "draft",
      "risk_level": "medium",
      "summary": "新增目录与共享规则建议",
      "impact_summary": "涉及 3 个目录、2 条分类规则",
      "created_at": "2026-04-15T10:00:00+08:00",
      "submitted_at": null,
      "structure_changes": [],
      "classification_rules": [],
      "skill_mounts": [],
      "approval_impacts": [],
      "evidence_refs": []
    }
  ]
}
```

字段要求：

- `proposal_status`：`draft | pending_approval | approved | rejected | partially_approved`
- `risk_level`：`high | medium | low`

## 4. 子对象字段约定

### 4.1 `evidence_refs`

所有快照和草案中的证据字段统一为：

```json
{
  "label": "案例复盘流程",
  "section": "6.2 客户案例复盘流程",
  "excerpt": "部门共享需先匿名化，再形成案例卡供培训复用。"
}
```

### 4.2 `structure_changes`

```json
{
  "id": 1,
  "change_type": "create",
  "target_path": "/销售中心/销售管理/培训与复盘",
  "dept_scope": "销售管理部",
  "rationale": "部门职责与 OKR 都显示这是稳定知识域",
  "confidence_score": 0.93
}
```

### 4.3 `classification_rules`

```json
{
  "id": 11,
  "target_scope": "商务一部客户案例文档",
  "match_signals": ["涉及客户复盘", "归属商务一部"],
  "default_folder_path": "/销售中心/商务一部/客户案例卡",
  "origin_scope": "manager_chain",
  "allowed_scope": "department",
  "usage_purpose": "training",
  "redaction_mode": "masked",
  "rationale": "原始案例仅允许本人和 leader 查看，部门共享必须匿名化。"
}
```

字段要求：

- `origin_scope / allowed_scope`：
  - `self`
  - `manager_chain`
  - `department`
  - `cross_department`
  - `company`
- `usage_purpose`：
  - `execution`
  - `management_review`
  - `training`
  - `knowledge_reuse`
  - `llm_qa`
- `redaction_mode`：
  - `raw`
  - `masked`
  - `summary`
  - `pattern_only`

### 4.4 `skill_mounts`

```json
{
  "id": 21,
  "skill_id": 402,
  "skill_name": "销售复盘助手",
  "target_scope": "销售管理部知识域",
  "required_domains": ["培训与复盘", "销售 OKR"],
  "max_allowed_scope": "department",
  "required_redaction_mode": "summary",
  "decision": "allow",
  "rationale": "Skill 仅做复盘总结，消费摘要即可。"
}
```

字段要求：

- `decision`：`allow | require_approval | deny`

### 4.5 `approval_impacts`

```json
{
  "id": 31,
  "impact_type": "knowledge.scope.expand",
  "target_asset_name": "商务一部客户案例卡",
  "risk_reason": "原始范围是本人/leader，现扩展到部门共享。",
  "requires_manual_approval": true
}
```

## 5. 提交审批接口

### 5.1 `POST /api/org-memory/proposals/:id/submit`

前端提交后需要两件事：

1. 显示“已提交审批”
2. 如果后端已创建审批单，则跳到 `/approvals?tab=outgoing&request_id=xxx`

因此建议后端返回：

```json
{
  "proposal_id": 301,
  "approval_request_id": 912,
  "status": "submitted",
  "message": "已提交审批"
}
```

### 5.2 兼容返回

前端当前也兼容以下字段别名：

- `approval_id`
- `request_id`
- `id`

但建议后端最终统一为 `approval_request_id`。

## 6. 审批页目标定位约定

当前前端已支持：

- `GET /approvals?tab=outgoing&request_id=912`
- `GET /approvals?tab=all&request_id=912`

行为如下：

1. 根据 `tab` 选择主 tab
2. 根据 `request_id` 自动展开对应审批单
3. 自动滚动到该审批单
4. 以“目标工单”标签高亮

因此如果后端在提交成功后返回 `approval_request_id`，前端就能直接完成跳转闭环。

## 7. 前端当前实现位置

- 共享数据层：`src/lib/org-memory.ts`
- mock 数据：`src/lib/org-memory-mock.ts`
- 草案提交页：`src/components/org-memory/OrgMemoryProposalsTab.tsx`
- 审批页定位：`src/app/(app)/approvals/page.tsx`

## 8. 结论

如果后端按本文档统一 `Source / Snapshot / Proposal / SubmitResult` 字段，则前端现有组织 Memory 页面已经可以稳定接入；如果后端短期内仍存在 `items/data/results` 或 `approval_request_id/request_id` 的命名差异，则当前前端也已做兼容适配，但建议尽快统一到本文档定义。
