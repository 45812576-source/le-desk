# Phase 6: 测试 + 回归基线 — 实施计划

## Context

现有测试 99/99 全绿（修复后），覆盖：
- 权限引擎纯逻辑（19 用例）
- 字段字典（13 用例）
- Skill 授权（14 用例）
- E2E 场景（17 用例）
- 组件测试：FieldsTab(11)、SkillBindingsTab(6)、RoleGroupPanel(7)、PermissionMatrix(5)、PermissionPreview(7)

缺失的测试维度：
- 历史兼容性（旧数据格式能被新引擎正确处理）
- 反向提权（低权限用户不能通过组合操作获得高权限）
- 配置变更回归（修改策略后立即生效，不缓存旧结果）
- 后端策略引擎单元测试（Phase 1 新增）
- 前后端一致性（前端预览与后端实际裁剪结果一致）

---

## Step 1: 后端策略引擎测试（Phase 1 已包含，这里补全）

**文件**: `backend/tests/test_policy_engine.py`

补充用例：
- `test_empty_role_groups_default_deny` — 表无角色组 → 默认拒绝
- `test_admin_bypass` — SUPER_ADMIN 跳过所有检查
- `test_masking_correctness` — 各种脱敏规则的输出格式验证
- `test_row_rule_json_evaluation` — 自定义行规则的 SQL 生成

---

## Step 2: 历史兼容性测试

**文件**: `src/__tests__/data-assets/backward-compat.test.ts`（新建）

```typescript
describe("历史兼容性", () => {
  it("无 v1 扩展字段的 TableDetail 仍可解析", () => {
    // 模拟旧格式：没有 field_role_tags, is_enum, is_free_text 等 v1 字段
    const oldField = { id: 1, field_name: "name", field_type: "text" };
    // 确保 resolveVisibleFields 不崩溃
  });

  it("空 permission_policies 表等同默认拒绝", () => {
    const detail = makeTableDetail({ permission_policies: [] });
    // 对所有角色组都应返回默认拒绝
  });

  it("旧 masking_rule_json 格式仍可识别", () => {
    // 旧格式可能是 {field: "mask_type"} 而非新格式
    // 确保 apply_masking 不崩溃
  });

  it("role_group_id 引用已删除的角色组时策略降级为 deny", () => {
    // policy 引用了不存在的 role_group_id
  });
});
```

---

## Step 3: 反向提权测试

**文件**: `src/__tests__/data-assets/anti-escalation.test.ts`（新建）

```typescript
describe("反向提权防护", () => {
  it("用户不能通过切换视图获得更高 disclosure", () => {
    // 用户在视图 A 是 L2，切到视图 B 不能超过角色组的表级上限
  });

  it("Skill grant 不能超过绑定视图的 disclosure_ceiling", () => {
    // grant.max_disclosure=L4 但 view.disclosure_ceiling=L2 → 生效 L2
  });

  it("多角色组合并不能超过各组最宽权限的并集", () => {
    // 验证合并后不会产生任何单个组都没有的权限
  });

  it("deny 组不可被 allow 组覆盖", () => {
    // 用户同属 deny 组和 allow 组 → deny 胜
  });

  it("外部 Skill 不能申请无审批的 L4", () => {
    // external skill + L4 → approval_required 必须为 true
  });
});
```

---

## Step 4: 配置变更回归测试

**文件**: `src/__tests__/data-assets/config-change-regression.test.ts`（新建）

```typescript
describe("配置变更回归", () => {
  it("删除角色组后关联策略失效", () => {
    // 角色组被删 → 使用该角色组的 policy 不再匹配任何用户
  });

  it("修改字段为敏感后策略立即生效", () => {
    // 字段 is_sensitive 变更 → masking_rule 生效
  });

  it("视图删除后 Skill grant 失效", () => {
    // view 被删 → grant.view_id 指向不存在的视图 → deny
  });

  it("策略从 all 改为 allowlist 后字段立即减少", () => {
    // 验证策略变更不需要缓存刷新
  });
});
```

---

## Step 5: 前后端一致性测试

**文件**: `src/__tests__/data-assets/frontend-backend-parity.test.ts`（新建）

```typescript
describe("前后端权限计算一致性", () => {
  // 用相同的输入数据，验证前端 resolveVisibleFields 和后端 compute_visible_fields 输出一致
  // 这些测试定义 contract：如果前端改了逻辑，这里会失败

  it("allowlist 字段计算与后端一致", () => { ... });
  it("blocklist 字段计算与后端一致", () => { ... });
  it("disclosure capability 矩阵与后端一致", () => { ... });
  it("多角色组合并逻辑与后端一致", () => { ... });
});
```

---

## Step 6: 组件测试补全

补充已有组件测试缺失的边界：

**文件**: `PermissionPreview.test.tsx` — 新增
- deny reason 展示测试
- explain 端点调用测试

**文件**: `PermissionMatrix.test.tsx` — 新增
- 视图级策略编辑测试
- disclosure_ceiling 限制测试

**文件**: `ViewsTab.test.tsx`（新建）
- 视图 CRUD 测试
- 影响检查测试

---

## 修改文件清单

| 文件 | 动作 |
|------|------|
| `backend/tests/test_policy_engine.py` | 补全：边界用例 |
| `src/__tests__/data-assets/backward-compat.test.ts` | 新建 |
| `src/__tests__/data-assets/anti-escalation.test.ts` | 新建 |
| `src/__tests__/data-assets/config-change-regression.test.ts` | 新建 |
| `src/__tests__/data-assets/frontend-backend-parity.test.ts` | 新建 |
| `PermissionPreview.test.tsx` | 补充 |
| `PermissionMatrix.test.tsx` | 补充 |
| `ViewsTab.test.tsx` | 新建 |

---

## 验证方式

1. 全部前端测试绿色
2. 全部后端测试绿色
3. 总测试用例数 ≥ 150（当前 99 + Phase 1-5 新增 + Phase 6 补充）
4. 无 skip / pending 测试
