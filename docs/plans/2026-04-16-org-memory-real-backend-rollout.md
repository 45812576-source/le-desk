# Le Desk 组织 Memory — 真实后端替换与落地实施计划

日期：2026-04-16

## 1. 本 memo 解决什么

当前前端和本地 BFF 已经把组织 Memory 一期主链路跑通：

1. `Source → Snapshot → Proposal`
2. `Proposal → Submit Approval`
3. `Approval → Effective Config`
4. `Effective Config → Version History → Rollback`

但这套链路目前仍建立在 **前端仓库内的 in-memory BFF** 之上，核心限制有三类：

1. 数据不持久化，重启即丢
2. 审批仍是本地模拟，没有接入真实外部审批系统
3. 生产环境无法把 `org-memory` 当成真实后端能力对外提供

本 memo 的目标，是把下一阶段的工作收敛成一份可执行实施计划，用于完成：

- 真实后端服务替换本地 in-memory BFF
- 持久化到数据库
- 真正调用外部审批系统

## 2. 前提与边界

以下计划按这些前提执行：

- 前端现有 REST 契约保持不变，优先复用：
  - `GET /org-memory/sources`
  - `GET /org-memory/snapshots`
  - `GET /org-memory/proposals`
  - `POST /org-memory/proposals/:id/submit`
  - `POST /org-memory/sources/ingest`
  - `POST /org-memory/sources/:id/snapshots`
  - `POST /org-memory/snapshots/:id/proposals`
  - `GET /org-memory/proposals/:id`
  - `GET /org-memory/snapshots/:id/diff`
  - `GET /org-memory/proposals/:id/config-versions`
  - `POST /org-memory/proposals/:id/rollback`
- 前端当前行为已经可作为验收标准，不建议在这阶段重改 UI 结构
- 外部审批系统已经存在基础能力，至少支持：
  - 创建审批单
  - 按 id 查询审批单
  - 接收审批结果回调，或可轮询状态
- 真实后端应成为唯一事实源；前端仓库中的 in-memory BFF 仅保留为开发降级能力

## 3. 推荐方案与备选

### 3.1 推荐方案：独立 org-memory 后端模块 + 数据库持久化 + 审批适配层

核心思路：

- 在真实后端中新增 `org-memory` 模块
- 所有 `Source / Snapshot / Proposal / AppliedConfig / ConfigVersion` 进入数据库
- 通过 `approval adapter` 与外部审批系统交互
- 前端继续走原有 `/api/proxy`，但实际转发到真实后端

优点：

- 与现有前端契约最兼容
- 可逐步替换，不需要前端重做主流程
- 后续扩展数据治理、回滚、生效审计最自然

缺点：

- 需要补完整数据模型和审批回写链路
- 初期会有一段“双实现并存”的过渡成本

### 3.2 备选方案 A：直接把逻辑塞进现有审批/知识治理后端

优点：

- 复用已有数据库、用户、审批上下文
- 部署链路可能更短

缺点：

- 容易把组织 Memory 逻辑散落在多个已有模块里
- 后续维护边界不清

### 3.3 备选方案 B：先只做数据库持久化，审批仍走本地模拟

优点：

- 短期最快

缺点：

- 不能完成真实业务闭环
- 后面仍要二次改审批接入

### 3.4 结论

如果目标是尽快从“演示联调”切到“真实业务闭环”，则推荐采用 **方案 3.1**：独立 `org-memory` 后端模块 + 数据库持久化 + 审批适配层。

## 4. 目标架构

```text
前端页面
  ↓
/api/proxy/org-memory/*
  ↓
真实后端 org-memory 模块
  ├─ org_memory_sources
  ├─ org_memory_snapshots
  ├─ org_memory_proposals
  ├─ org_memory_applied_configs
  ├─ org_memory_config_versions
  ├─ org_memory_approval_links
  └─ org_memory_jobs / events
  ↓
审批适配层
  ↓
外部审批系统
```

### 4.1 模块拆分建议

后端至少拆成 5 层：

1. `router`
   - 暴露 HTTP 接口
2. `service`
   - 承载导入、快照生成、草案生成、提交审批、生效、回滚
3. `repository`
   - 负责数据库读写
4. `approval adapter`
   - 负责外部审批系统创建/查询/回调映射
5. `event / job`
   - 负责长耗时解析与异步状态推进

## 5. 数据模型落地建议

### 5.1 核心表

#### `org_memory_sources`

- `id`
- `title`
- `source_type`
- `source_uri`
- `owner_name`
- `external_version`
- `fetched_at`
- `ingest_status`
- `latest_snapshot_id`
- `latest_snapshot_version`
- `latest_parse_note`
- `created_by`
- `created_at`
- `updated_at`

#### `org_memory_snapshots`

- `id`
- `source_id`
- `snapshot_version`
- `parse_status`
- `confidence_score`
- `summary`
- `entity_counts_json`
- `units_json`
- `roles_json`
- `people_json`
- `okrs_json`
- `processes_json`
- `low_confidence_items_json`
- `created_at`

#### `org_memory_proposals`

- `id`
- `snapshot_id`
- `title`
- `proposal_status`
- `risk_level`
- `summary`
- `impact_summary`
- `structure_changes_json`
- `classification_rules_json`
- `skill_mounts_json`
- `approval_impacts_json`
- `evidence_refs_json`
- `submitted_at`
- `created_at`
- `updated_at`

#### `org_memory_applied_configs`

- `id`
- `proposal_id`
- `approval_request_id`
- `status`
- `applied_at`
- `knowledge_paths_json`
- `classification_rule_count`
- `skill_mount_count`
- `conditions_json`

#### `org_memory_config_versions`

- `id`
- `proposal_id`
- `applied_config_id`
- `version`
- `action`
- `status`
- `applied_at`
- `knowledge_paths_json`
- `classification_rule_count`
- `skill_mount_count`
- `conditions_json`
- `note`

#### `org_memory_approval_links`

- `id`
- `proposal_id`
- `approval_request_id`
- `external_approval_type`
- `external_status`
- `last_synced_at`
- `callback_payload_json`

### 5.2 建模原则

- 快照与草案优先按一期需求存 JSON 聚合字段，不在这期过度拆分子表
- 所有面向前端展示的字段保持与当前 DTO 契约一致
- 所有“生效”和“回滚”动作必须保留版本记录，不允许只做当前态覆盖

## 6. 外部审批系统接入方案

### 6.1 最小接入能力

必须至少实现：

1. 创建审批单
2. 记录 `approval_request_id`
3. 查询审批单状态
4. 审批完成后回写组织 Memory 草案状态
5. 审批通过时写入正式配置
6. 审批拒绝时更新草案状态，不写正式配置

### 6.2 建议接入模式

优先顺序：

1. **Webhook 回调优先**
   - 外部审批系统在状态变化时推送回调
2. **定时补偿轮询**
   - 防止 webhook 丢失
3. **人工补偿任务**
   - 对异常审批单做重试和人工修复

### 6.3 审批映射规则

建议统一映射：

- 外部 `approved` → 内部 `proposal_status=approved` 或 `partially_approved`
- 外部 `rejected` → 内部 `proposal_status=rejected`
- 外部 `cancelled / withdrawn` → 内部保留提交记录但不生效

## 7. 替换路径

如果目标是 **最低风险替换**，则建议按 **真实后端模块 → 数据库持久化 → 外部审批接入 → 正式配置写入 → 灰度切流** 五段推进。

### Stage 0：真实后端模块落位

目标：

- 先把 `org-memory` 从“前端仓库内的 in-memory BFF”拆成“真实后端中的独立模块”
- 保持前端现有 REST 契约不变，只把真实后端能力准备好
- 让 `/api/proxy` 成为唯一切换点，本地 in-memory 实现退化为 dev fallback

任务：

1. 在真实后端创建 `org-memory` 模块，明确 `router / service / repository / approval adapter / config writer`
2. 固化 DTO、状态枚举和错误码，确保与当前前端契约一致
3. 约定模块内的扩展点：数据库仓储接口、审批适配接口、正式配置写入接口
4. 盘点前端当前依赖的全部 `/org-memory/*` GET/POST 路由，作为迁移清单

验收：

- 真实后端存在可承接 `org-memory` 的模块骨架
- 前端无需改动页面或 REST 调用方式
- 切换点收敛到 `/api/proxy`

### Stage 1：数据库持久化与现有接口迁移

目标：

- 先把 `Source / Snapshot / Proposal / AppliedConfig / ConfigVersion` 真实落库
- 把当前所有 GET/POST `/org-memory/*` 从 in-memory 实现迁到真实 service

任务：

1. 建表与迁移脚本，落库 `Source / Snapshot / Proposal / AppliedConfig / ConfigVersion`
2. 实现 repository 与 service，把导入、快照生成、草案生成、版本查询、回滚链路统一迁到真实后端
3. 迁移当前全部接口到真实 service，包括：
   - `GET /org-memory/sources`
   - `GET /org-memory/snapshots`
   - `GET /org-memory/proposals`
   - `GET /org-memory/proposals/:id`
   - `GET /org-memory/snapshots/:id/diff`
   - `GET /org-memory/proposals/:id/config-versions`
   - `POST /org-memory/sources/ingest`
   - `POST /org-memory/sources/:id/snapshots`
   - `POST /org-memory/snapshots/:id/proposals`
   - `POST /org-memory/proposals/:id/submit`
   - `POST /org-memory/proposals/:id/rollback`
4. 把当前 `resolveOrgMemoryRequest` 内的解析、组装、状态流转逻辑迁到真实 service，前端仓库只保留降级 fallback

验收：

- 服务重启后 `Source / Snapshot / Proposal / AppliedConfig / ConfigVersion` 数据不丢失
- 当前所有 GET/POST `/org-memory/*` 都能由真实 service 返回
- 前端页面、查询参数和返回字段保持不变

### Stage 2：外部审批接入

目标：

- 把 `POST /org-memory/proposals/:id/submit` 从“本地模拟提交”改成“真实创建外部审批单”
- 回写 `approval_request_id` 与审批状态

任务：

1. 实现 `approval adapter`，统一封装创建审批单、查询状态、回调映射
2. 增加 `org_memory_approval_links`，记录 `proposal_id`、`approval_request_id`、外部状态与同步时间
3. 改造 `POST /org-memory/proposals/:id/submit`，提交时真实创建审批单并写回 `approval_request_id`
4. 通过 webhook 或轮询把外部审批状态同步回 `proposal_status`
5. 对接 `/approvals` 详情透出，保证能从审批系统反查到组织 Memory 草案

验收：

- 提交草案后返回真实 `approval_request_id`
- 审批状态能从外部系统同步回组织 Memory
- 前端跳转审批页后能看到真实工单

### Stage 3：正式配置写入与版本回滚

目标：

- 审批通过后真正写入正式配置源，而不是只在页面上显示“已生效”
- 保留完整版本历史；回滚时按版本链路回退正式配置

任务：

1. 抽象正式配置写入器，把知识目录、分类规则、Skill 挂载等写入正式配置源
2. 审批通过后创建 `AppliedConfig` 与 `ConfigVersion`，并记录版本快照
3. 改造 `POST /org-memory/proposals/:id/rollback`，让回滚基于 `ConfigVersion` 链路回退正式配置
4. 写入生效审计与回滚审计，确保每次变更都可追溯

验收：

- 审批通过后正式配置源发生真实写入
- 版本历史与当前生效态保持一致
- 回滚会沿版本链路回退正式配置，而不是只改展示状态

### Stage 4：灰度切流与移除主路径 in-memory BFF

目标：

- 前端继续走原 REST 契约，只切 `/api/proxy` 后面的真实后端
- 逐步移除主路径上的 in-memory BFF，实现灰度切流

任务：

1. 在 `/api/proxy` 后引入真实后端开关、灰度范围和回退策略
2. 预发环境验证读写、审批回写、正式配置写入与回滚
3. 分批把线上流量切到真实后端
4. 观测稳定后移除主路径 in-memory 实现，仅保留开发环境 fallback

验收：

- 前端无须改 REST 契约即可接入真实后端
- 生产流量已从 in-memory BFF 切到真实后端
- in-memory BFF 不再承担主链路职责

## 8. 后端实施拆分建议

### 第一批提交

- 建立真实后端 `org-memory` 模块骨架
- 固化 DTO、状态枚举和 service 边界
- 补齐数据库、审批、正式配置写入三个扩展接口

### 第二批提交

- 建表与迁移脚本
- `Source / Snapshot / Proposal / AppliedConfig / ConfigVersion` 基础 repository
- 全部 GET `/org-memory/*` 切到真实数据库

### 第三批提交

- `ingest / snapshot / proposal / submit / rollback` 等 POST 接口切到真实 service
- 前端验证所有 GET/POST `/org-memory/*` 已脱离 in-memory BFF

### 第四批提交

- 接外部审批系统
- 打通 `submit → external approval → status sync → proposal status backfill`

### 第五批提交

- 审批通过后真实写入正式配置
- 回滚按 `ConfigVersion` 链路回退
- `/api/proxy` 灰度切流并移除主路径 in-memory 依赖

## 9. 风险与对策

### 9.1 风险：审批系统字段不兼容

对策：

- 增加 adapter 层，不让前端感知外部系统字段

### 9.2 风险：解析与草案生成耗时较长

对策：

- 动作接口先返回 job/status
- 前端继续用当前“processing/ready”状态模型

### 9.3 风险：生效逻辑直接写正式配置有破坏性

对策：

- 先写版本表，再写当前态
- 所有生效都可回滚

### 9.4 风险：灰度期间双写不一致

对策：

- 切换阶段只允许一个真实写路径
- in-memory 路径只读或仅开发环境可写

## 10. 最小验收标准

如果以下 8 条都满足，则这轮“真实后端替换计划”可视为完成：

1. `org-memory` 全部主接口由真实后端提供
2. `Source / Snapshot / Proposal` 数据可持久化
3. 生效配置与版本历史可持久化
4. 回滚会真实写入版本记录
5. 提交草案会创建真实外部审批单
6. 审批状态会自动回写组织 Memory
7. 审批通过后会真实写入正式配置
8. 前端无需改主契约即可切换到真实后端

## 11. 实施计划（建议工期）

如果团队本周启动真实后端替换，则建议按下面节奏推进：

- 第 1 周：
  - 完成 `org-memory` 真实后端模块落位
  - 完成数据库建模与迁移脚本
  - 迁移全部 GET `/org-memory/*`
- 第 2 周：
  - 迁移全部 POST `/org-memory/*`
  - 把现有 in-memory 解析、草案生成、版本链路迁到真实 service
  - 保证前端继续按原 REST 契约联调
- 第 3 周：
  - 接外部审批 adapter
  - 改造 `POST /org-memory/proposals/:id/submit`
  - 回写 `approval_request_id` 与审批状态
- 第 4 周：
  - 审批通过后真实写入正式配置源
  - 打通版本历史与回滚链路
  - 完成预发联调、灰度切流与主路径 in-memory 下线

## 12. 结论

如果下一阶段的目标是把组织 Memory 从“前端联调演示链路”升级成“真实生产能力”，则推荐按本文档的 `Stage 0 → Stage 4` 分阶段推进；如果先完成真实后端模块落位，再做数据库持久化、外部审批接入、正式配置写入，最后通过 `/api/proxy` 灰度切流，则风险最低，且能最大程度复用当前前端已经完成的主链路。
