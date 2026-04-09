// ─── 知识资产权限动作 ─────────────────────────────────────────────────────────

export const KNOWLEDGE_ACTION_LABELS: Record<string, string> = {
  // 目录管理类
  "knowledge.folder.view": "查看",
  "knowledge.folder.create_child": "创建子目录",
  "knowledge.folder.rename_child": "重命名子目录",
  "knowledge.folder.delete_child": "删除子目录",
  "knowledge.folder.move_child": "移动子目录",
  "knowledge.folder.manage_grants": "管理授权",
  "knowledge.folder.rerun_reclassify": "重跑分类",
  // 内容审批类
  "knowledge.review.approve": "知识审核-通过",
  "knowledge.review.reject": "知识审核-拒绝",
  "knowledge.edit.approve": "编辑申请-通过",
  "knowledge.edit.reject": "编辑申请-拒绝",
  "knowledge.edit.request_more_info": "编辑申请-补充信息",
  // 发布审批类
  "skill.publish.approve_dept": "Skill发布-部门审批",
  "skill.publish.approve_final": "Skill发布-终审",
  "tool.publish.approve_dept": "Tool发布-部门审批",
  "tool.publish.approve_final": "Tool发布-终审",
  "webapp.publish.approve_dept": "WebApp发布-部门审批",
  "webapp.publish.approve_final": "WebApp发布-终审",
};

export const FOLDER_ACTIONS = [
  "knowledge.folder.view",
  "knowledge.folder.create_child",
  "knowledge.folder.rename_child",
  "knowledge.folder.delete_child",
  "knowledge.folder.move_child",
  "knowledge.folder.manage_grants",
  "knowledge.folder.rerun_reclassify",
] as const;

export const REVIEW_ACTIONS = [
  "knowledge.review.approve",
  "knowledge.review.reject",
  "knowledge.edit.approve",
  "knowledge.edit.reject",
  "knowledge.edit.request_more_info",
] as const;

export const PUBLISH_ACTIONS = [
  "skill.publish.approve_dept",
  "skill.publish.approve_final",
  "tool.publish.approve_dept",
  "tool.publish.approve_final",
  "webapp.publish.approve_dept",
  "webapp.publish.approve_final",
] as const;

export const HIGH_RISK_ACTIONS = new Set([
  "knowledge.folder.delete_child",
  "knowledge.folder.rerun_reclassify",
  "knowledge.folder.manage_grants",
  "skill.publish.approve_final",
  "tool.publish.approve_final",
  "webapp.publish.approve_final",
]);

export const SOURCE_LABELS: Record<string, string> = {
  direct: "直接授权",
  approval: "审批生效",
  role_default: "角色默认",
};

export const SOURCE_COLORS: Record<string, string> = {
  direct: "text-[#00A3C4]",
  approval: "text-amber-600",
  role_default: "text-muted-foreground",
};

// ─── 资产权限模型常量 ─────────────────────────────────────────────────────────

import type { AssetType, AssetAction, UserCapabilityKey } from "./types";

export const ASSET_TYPE_LABELS: Record<AssetType, string> = {
  knowledge_folder: "文件夹",
  business_table: "数据表",
  data_table: "数据表",
  skill: "Skill",
  tool: "Tool",
};

export const ASSET_ACTION_LABELS: Record<AssetAction, string> = {
  owner: "所有者",
  view: "可见",
  edit: "可编辑",
  bind_skill: "可绑 Skill",
  bind_tool: "可绑 Tool",
};

// 每种资产可用的权限动作（不适用的显式排除）
export const ASSET_AVAILABLE_ACTIONS: Record<AssetType, AssetAction[]> = {
  knowledge_folder: ["owner", "view", "edit", "bind_skill", "bind_tool"],
  business_table: ["owner", "view", "edit", "bind_skill", "bind_tool"],
  data_table: ["owner", "view", "edit", "bind_skill", "bind_tool"],
  skill: ["owner", "view", "edit", "bind_tool"],
  tool: ["owner", "view", "edit", "bind_skill"],
};

// 不适用的动作（前端显式禁用而非隐藏）
export const ASSET_DISABLED_ACTIONS: Record<AssetType, AssetAction[]> = {
  knowledge_folder: [],
  business_table: [],
  data_table: [],
  skill: ["bind_skill"],
  tool: ["bind_tool"],
};

// ─── 用户资格能力常量 ─────────────────────────────────────────────────────────

export const CAPABILITY_LABELS: Record<UserCapabilityKey, string> = {
  knowledge_asset_admin: "知识资产管理员",
  knowledge_asset_operator: "知识资产操作员",
  knowledge_folder_governance_admin: "目录治理管理员",
  skill_release_reviewer: "Skill 发布审批员",
  tool_release_reviewer: "Tool 发布审批员",
  data_asset_reviewer: "数据资产审批员",
};

export const CAPABILITY_DESCRIPTIONS: Record<UserCapabilityKey, string> = {
  knowledge_asset_admin: "可管理所有知识资产对象的授权与治理",
  knowledge_asset_operator: "可操作已授权范围内的知识资产",
  knowledge_folder_governance_admin: "可管理目录结构、rerun、分类策略",
  skill_release_reviewer: "可审批 Skill 发布工单",
  tool_release_reviewer: "可审批 Tool 发布工单",
  data_asset_reviewer: "可审批数据资产相关工单",
};

export const CAPABILITY_RISK_LEVEL: Record<UserCapabilityKey, "high" | "low"> = {
  knowledge_asset_admin: "high",
  knowledge_asset_operator: "low",
  knowledge_folder_governance_admin: "high",
  skill_release_reviewer: "high",
  tool_release_reviewer: "high",
  data_asset_reviewer: "high",
};
