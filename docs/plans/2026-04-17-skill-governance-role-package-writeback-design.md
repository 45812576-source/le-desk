# Skill Studio 角色 Package 可编辑写回接口草案

日期：2026-04-17
状态：前端联动已接入，后端待实现
范围：`Skill Studio` 权限快捷挂载助手的角色 package 写回链路

## 1. 背景

上一版已经把权限入口调整为“AI 推荐角色 list → 搜索校正 → 角色 package 总览”。当前 package 总览仍主要是只读投影：表字段规则来自 `role-asset-policies` / `granular_rules`，知识遮蔽来自 `mounted-permissions`，资产挂载来自 `mount-context`。

如果用户要在角色维度校正整套权限，则需要把 package 变成可编辑 draft，并把编辑结果写回后端，让后端统一刷新下游声明和测试集。

## 2. 目标

如果用户在某个角色下修改 package，则前端应提交一个角色级 package payload，后端负责落库、重算投影，并将下游产物标记为 stale。

本轮前端已接入：

- 表字段 package：编辑字段策略、脱敏方式、确认状态
- 知识遮蔽 package：编辑遮蔽等级、启用 / 停用知识授权
- 资产挂载 package：编辑资产启用状态和挂载模式
- 写回 endpoint：`PUT /skill-governance/{skill_id}/role-packages/{role_key}`

## 3. 后端接口草案

### 3.1 写回角色 package

`PUT /api/skill-governance/{skill_id}/role-packages/{role_key}`

请求体：

```json
{
  "role_key": "公司经营发展中心/人力资源部::招聘主管::M0",
  "role": {
    "org_path": "公司经营发展中心/人力资源部",
    "position_name": "招聘主管",
    "position_level": "M0",
    "role_label": "招聘主管（M0）"
  },
  "writeback_mode": "upsert_role_package",
  "stale_downstream": [
    "mounted_permissions",
    "permission_declaration",
    "sandbox_case_plan"
  ],
  "package": {
    "field_rules": [
      {
        "policy_id": 101,
        "rule_id": 301,
        "asset_id": 21,
        "target_ref": "candidate_phone",
        "suggested_policy": "mask",
        "mask_style": "partial",
        "confirmed": true,
        "author_override_reason": null
      }
    ],
    "knowledge_permissions": [
      {
        "asset_id": 31,
        "asset_ref": "knowledge_base:31",
        "knowledge_id": 31,
        "desensitization_level": "L2",
        "grant_actions": ["read"],
        "enabled": true,
        "source_refs": [{ "type": "knowledge", "id": 31 }]
      }
    ],
    "asset_mounts": [
      {
        "asset_id": 21,
        "asset_ref_type": "table",
        "asset_ref_id": 21,
        "binding_mode": "table_bound",
        "enabled": true
      }
    ]
  }
}
```

响应体：

```json
{
  "ok": true,
  "data": {
    "role_key": "公司经营发展中心/人力资源部::招聘主管::M0",
    "package_version": 1,
    "governance_version": 6,
    "stale_downstream": [
      "mounted_permissions",
      "permission_declaration",
      "sandbox_case_plan"
    ]
  }
}
```

### 3.2 可选读取角色 package

`GET /api/skill-governance/{skill_id}/role-packages?include_projection=true`

后端后续如果落实体，可以返回所有角色 package；前端当前可继续从 `role-asset-policies`、`mounted-permissions`、`mount-context` 本地聚合，不强依赖这个读取接口。

## 4. 落库建议

如果后端要保持最小改造，则可以先不新增完整 `role_package` 主表：

- 字段规则：复用 `role_asset_granular_rules`，按 `rule_id` 更新策略、脱敏方式、确认状态
- 知识遮蔽：新增或复用角色级知识授权 override 表，字段至少包含 `skill_id`、`role_key`、`knowledge_id`、`desensitization_level`、`enabled`
- 资产挂载：新增或复用角色级资产挂载 override 表，字段至少包含 `skill_id`、`role_key`、`asset_id`、`binding_mode`、`enabled`

如果后端要一次性做完整模型，则建议新增 `skill_role_packages` 与 `skill_role_package_items`：

- `skill_role_packages`：记录角色、版本、治理版本、状态
- `skill_role_package_items`：用 `item_type` 区分 `field_rule`、`knowledge_permission`、`asset_mount`
- 每次写回生成 package version，并把权限声明与 case plan 标记为 stale

## 5. 前端联动

前端新增 `src/components/skill-studio/role-package.ts`：

- `buildRolePackageDraft`：把现有投影聚合成角色 package draft
- `serializeRolePackageWriteback`：序列化为后端写回 payload

`RoleRecommendationWorkbench` 已支持：

- 按角色切换 package
- 编辑字段规则、知识遮蔽、资产挂载
- 只有 draft 与当前投影不一致时才允许保存

`SkillGovernancePanel` 已接入：

- `saveRolePackage`
- `PUT /skill-governance/{skill_id}/role-packages/{role_key}`
- 写回成功后重新调用 `load()` 刷新投影和 stale 状态

## 6. 验收标准

- 如果用户编辑字段策略，则 payload 中 `package.field_rules` 包含新的 `suggested_policy`
- 如果用户编辑知识遮蔽等级，则 payload 中 `package.knowledge_permissions` 包含新的 `desensitization_level`
- 如果用户关闭资产挂载，则 payload 中 `package.asset_mounts.enabled` 为 `false`
- 如果写回成功，则前端刷新治理视图，权限声明和测试集应显示 stale 或阻断原因
- 如果后端暂未实现接口，则前端会通过 API 错误提示用户，不影响角色推荐和只读 package 查看
