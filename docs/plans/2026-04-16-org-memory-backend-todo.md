# Le Desk 组织 Memory — 后端 TODO 清单

日期：2026-04-16

## 1. 目标

本清单用于把组织 Memory 一期后端工作按优先级拆清，保证前端当前已经完成的页面、审批跳转和 DTO 适配能尽快接上真实接口。

前端当前已就绪的能力包括：

- 组织 Memory 入口页：`/admin/org-management`
- 源文档页：`Source`
- 结构化快照页：`Snapshot`
- 统一草案页：`Proposal`
- 草案提交后跳转审批页：`/approvals?tab=outgoing&request_id=...`

因此后端只要按本清单逐步补齐，前端就能从演示模式切到真实联调模式。

## 2. 优先级总览

### P0：必须先做

1. `GET /org-memory/sources`
2. `GET /org-memory/snapshots`
3. `GET /org-memory/proposals`
4. `POST /org-memory/proposals/:id/submit`

### P1：紧随其后

5. `POST /org-memory/sources/ingest`
6. `POST /org-memory/sources/:id/snapshots`
7. `POST /org-memory/snapshots/:id/proposals`
8. 审批单 `target_detail` 对组织 Memory 草案的详情透出

### P2：一期增强

9. `GET /org-memory/snapshots/:id/diff`
10. `GET /org-memory/proposals/:id`
11. 草案审批通过后写入正式配置
12. 草案版本与回滚链路

## 3. P0 必做接口

### 3.1 `GET /org-memory/sources`

**目的**

- 给前端源文档列表页提供真实数据
- 替代当前 mock 数据

**建议返回**

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

**最低验收**

- 能返回空列表
- 能返回至少 1 条真实源文档记录
- `source_type / ingest_status` 使用约定枚举

### 3.2 `GET /org-memory/snapshots`

**目的**

- 给前端快照页提供结构化结果
- 让组织、岗位、人员、OKR、流程 6 类对象能只读展示

**建议返回**

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

**最低验收**

- 六类实体字段都存在
- 每类允许空数组，但不能省略字段
- `confidence_score` 返回 `0~1`
- `low_confidence_items` 支持提示抽取边界不清的问题

### 3.3 `GET /org-memory/proposals`

**目的**

- 给前端统一草案页和 Skill 工作台提示提供真实草案
- 给审批页组织 Memory 类型渲染提供基础数据

**建议返回**

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

**最低验收**

- `structure_changes / classification_rules / skill_mounts / approval_impacts / evidence_refs` 都存在
- 支持空数组
- `proposal_status / risk_level` 使用约定枚举

### 3.4 `POST /org-memory/proposals/:id/submit`

**目的**

- 草案提交审批
- 返回审批单 id，供前端跳转并高亮目标工单

**建议返回**

```json
{
  "proposal_id": 301,
  "approval_request_id": 912,
  "status": "submitted",
  "message": "已提交审批"
}
```

**最低验收**

- 成功时创建审批单
- 返回 `approval_request_id`
- 审批单类型能在 `/approvals` 中查到

## 4. P1 接口

### 4.1 `POST /org-memory/sources/ingest`

**目的**

- 新增源文档记录
- 启动抓取/解析前的导入任务

**建议请求**

```json
{
  "source_type": "feishu_doc",
  "source_uri": "https://...",
  "title": "销售组织治理文档（2026Q2）"
}
```

**建议返回**

```json
{
  "source_id": 101,
  "status": "processing"
}
```

### 4.2 `POST /org-memory/sources/:id/snapshots`

**目的**

- 基于某个源文档生成一次快照

**建议返回**

```json
{
  "snapshot_id": 201,
  "status": "processing"
}
```

### 4.3 `POST /org-memory/snapshots/:id/proposals`

**目的**

- 基于某个快照生成统一草案

**建议返回**

```json
{
  "proposal_id": 301,
  "status": "draft"
}
```

### 4.4 审批单详情透出

**目标**

- 让组织 Memory 草案进入现有审批体系
- 审批单 `target_detail` 里直接包含草案摘要、共享规则、挂载建议、证据链

**建议审批类型**

- `org_memory_proposal`
- `knowledge_scope_expand`
- `knowledge_redaction_lower`
- `skill_mount_org_memory`

**最低验收**

- `/approvals`
- `/approvals/incoming`
- `/approvals/my`

这 3 个接口都能返回相关审批单

## 5. P2 增强能力

### 5.1 `GET /org-memory/snapshots/:id/diff`

**目的**

- 对比两次快照之间的组织结构变化
- 让前端展示“新增/删除/调整”的真实 diff

### 5.2 `GET /org-memory/proposals/:id`

**目的**

- 按 id 拉草案详情
- 便于未来从审批页或外部链接直达草案详情

### 5.3 草案生效

**目标**

- 审批通过后，把草案写入正式配置
- 包括：
  - 知识目录建议
  - 分类规则建议
  - 共享范围/匿名化策略
  - Skill 挂载建议

### 5.4 版本与回滚

**目标**

- 记录哪次 Proposal 生效到哪批正式配置
- 支持按 Proposal 追溯和回滚

## 6. 数据模型建议

### 6.1 Source

- `id`
- `title`
- `source_type`
- `source_uri`
- `owner_name`
- `external_version`
- `fetched_at`
- `ingest_status`
- `latest_snapshot_version`
- `latest_parse_note`

### 6.2 Snapshot

- `id`
- `source_id`
- `source_title`
- `snapshot_version`
- `parse_status`
- `confidence_score`
- `created_at`
- `summary`
- `entity_counts`
- `units`
- `roles`
- `people`
- `okrs`
- `processes`
- `low_confidence_items`

### 6.3 Proposal

- `id`
- `snapshot_id`
- `title`
- `proposal_status`
- `risk_level`
- `summary`
- `impact_summary`
- `created_at`
- `submitted_at`
- `structure_changes`
- `classification_rules`
- `skill_mounts`
- `approval_impacts`
- `evidence_refs`

## 7. 共享边界相关枚举

### 7.1 共享范围

- `self`
- `manager_chain`
- `department`
- `cross_department`
- `company`

### 7.2 使用意图

- `execution`
- `management_review`
- `training`
- `knowledge_reuse`
- `llm_qa`

### 7.3 共享形态

- `raw`
- `masked`
- `summary`
- `pattern_only`

### 7.4 Skill 挂载结论

- `allow`
- `require_approval`
- `deny`

## 8. 联调注意事项

### 8.1 前端当前已兼容的返回差异

前端当前兼容：

- 列表：`items / data / results / list`
- 提交结果：`approval_request_id / approval_id / request_id / id`

但如果后端要降低维护成本，则建议尽快统一成：

- 列表：`items`
- 提交结果：`approval_request_id`

### 8.2 审批跳转

如果后端返回 `approval_request_id`，则前端会自动跳转到：

```text
/approvals?tab=outgoing&request_id=<approval_request_id>
```

审批页会：

1. 切到“我发起的”
2. 展开对应工单
3. 自动滚动到该工单
4. 加“目标工单”高亮

## 9. 后端拆分建议

### 9.1 第一个提交

- 只做 `GET /sources`
- 只做 `GET /snapshots`
- 只做 `GET /proposals`

这样前端 3 个页面就能去掉 mock 主路径。

### 9.2 第二个提交

- 做 `POST /proposals/:id/submit`
- 打通审批跳转闭环

这样产品上就完成“看草案 → 提交审批 → 跳审批单”的第一条闭环。

### 9.3 第三个提交

- 做 ingest / snapshot / proposal 生成动作
- 把组织 Memory 从“静态展示”推进到“可生产新结果”

## 10. 最小联调验收

以下 6 条满足，则后端一期联调成立：

1. `/org-memory/sources` 有真实数据
2. `/org-memory/snapshots` 有真实结构化快照
3. `/org-memory/proposals` 有真实统一草案
4. 草案里有共享范围、匿名化和 Skill 挂载字段
5. 提交草案能创建审批单
6. 返回 `approval_request_id` 后前端能跳到对应审批单

## 11. 结论

如果后端先按 `P0 → P1 → P2` 分阶段推进，则前端现有组织 Memory 页面、审批页和 Skill 挂载提示就能逐步切换为真实联调模式，而不需要再回头改前端主结构。
