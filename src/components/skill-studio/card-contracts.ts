"use client";

import type { WorkbenchCard } from "./workbench";
import type { StudioFileRole } from "./workbench-types";

export type StudioCardPhase =
  | "create"
  | "refine"
  | "governance"
  | "validation"
  | "fixing"
  | "confirm"
  | "release";

export type StudioCardTool =
  | "studio_chat.ask_one_question"
  | "studio_artifact.save"
  | "studio_artifact.update"
  | "skill_draft.generate"
  | "skill_draft.stage_edit"
  | "skill_file.open"
  | "skill_file.stage_edit"
  | "skill_governance.open_panel"
  | "sandbox.run"
  | "sandbox.targeted_rerun"
  | "staged_edit.adopt"
  | "staged_edit.reject";

export type StudioCardActionId =
  | "chat.start_requirement"
  | "architect.continue"
  | "summary.confirm"
  | "summary.discard"
  | "draft.apply"
  | "draft.discard"
  | "split.confirm"
  | "split.discard"
  | "knowledge.bind"
  | "governance.open_panel"
  | "validation.open_sandbox"
  | "fixing.start_task"
  | "fixing.targeted_retest"
  | "release.submit_approval"
  | "tool.confirm"
  | "handoff.external_build"
  | "handoff.bind_back"
  | "file_role.generate_examples"
  | "file_role.calibrate_examples"
  | "file_role.link_main_prompt"
  | "file_role.summarize_reference"
  | "file_role.extract_rules"
  | "file_role.suggest_prompt_update"
  | "file_role.organize_knowledge"
  | "file_role.bind_knowledge"
  | "file_role.rebuild_index"
  | "file_role.generate_tool_package"
  | "file_role.start_validation";

export interface StudioCardCta {
  actionId: StudioCardActionId;
  label: string;
  tone?: "primary" | "secondary" | "danger";
}

export interface StudioCardContract {
  contractId: string;
  title: string;
  phase: StudioCardPhase;
  objective: string;
  allowedTools: StudioCardTool[];
  forbiddenActions: string[];
  nextCards: string[];
  drawerPolicy: "never" | "manual" | "on_pending_edit";
  ctas: StudioCardCta[];
}

export const FILE_ROLE_CTAS: Record<StudioFileRole, StudioCardCta[]> = {
  main_prompt: [
    { actionId: "architect.continue", label: "继续主文件编排" },
    { actionId: "draft.apply", label: "查看修改" },
    { actionId: "validation.open_sandbox", label: "运行测试" },
  ],
  example: [
    { actionId: "file_role.generate_examples", label: "生成示例" },
    { actionId: "file_role.calibrate_examples", label: "校准示例" },
    { actionId: "file_role.link_main_prompt", label: "关联主 Prompt" },
  ],
  reference: [
    { actionId: "file_role.summarize_reference", label: "摘要资料" },
    { actionId: "file_role.extract_rules", label: "提取引用规则" },
    { actionId: "file_role.suggest_prompt_update", label: "生成主 Prompt 建议" },
  ],
  knowledge_base: [
    { actionId: "file_role.organize_knowledge", label: "整理知识" },
    { actionId: "file_role.bind_knowledge", label: "绑定知识库" },
    { actionId: "governance.open_panel", label: "打开治理面板" },
  ],
  tool: [
    { actionId: "file_role.generate_tool_package", label: "生成工具交接包" },
    { actionId: "handoff.external_build", label: "去外部完成实现", tone: "secondary" },
    { actionId: "file_role.start_validation", label: "开始验证" },
  ],
  template: [{ actionId: "architect.continue", label: "继续编排" }],
  unknown_asset: [{ actionId: "architect.continue", label: "继续编排" }],
};

const CONTRACTS: Record<string, StudioCardContract> = {
  "create.onboarding": {
    contractId: "create.onboarding",
    title: "创作起步卡",
    phase: "create",
    objective: "先把用户问题、目标和场景拉进当前 Skill 的创作上下文。",
    allowedTools: ["studio_chat.ask_one_question", "studio_artifact.save"],
    forbiddenActions: ["不要直接生成最终草稿。", "不要提前跳到治理或测试。"],
    nextCards: ["create.summary_ready", "architect.phase.execute"],
    drawerPolicy: "never",
    ctas: [{ actionId: "chat.start_requirement", label: "开始描述需求" }],
  },
  "create.summary_ready": {
    contractId: "create.summary_ready",
    title: "需求摘要确认卡",
    phase: "create",
    objective: "确认 AI 对需求的理解，再决定进入目录或草稿生成。",
    allowedTools: ["studio_artifact.update", "skill_draft.generate"],
    forbiddenActions: ["不要跳过用户确认直接生成草稿。"],
    nextCards: ["architect.phase.execute", "refine.draft_ready"],
    drawerPolicy: "never",
    ctas: [
      { actionId: "summary.confirm", label: "确认摘要" },
      { actionId: "summary.discard", label: "放弃", tone: "danger" },
    ],
  },
  "architect.phase.execute": {
    contractId: "architect.phase.execute",
    title: "架构阶段执行卡",
    phase: "create",
    objective: "围绕当前 Why / What / How 阶段继续追问、拆解和收敛。",
    allowedTools: ["studio_chat.ask_one_question", "studio_artifact.save", "studio_artifact.update"],
    forbiddenActions: ["不要在阶段未收敛时提前生成最终草稿。"],
    nextCards: ["create.summary_ready", "refine.draft_ready"],
    drawerPolicy: "never",
    ctas: [{ actionId: "architect.continue", label: "继续当前阶段" }],
  },
  "refine.draft_ready": {
    contractId: "refine.draft_ready",
    title: "草稿确认卡",
    phase: "refine",
    objective: "让草稿先以待确认修改的形式进入工作区，再决定采纳与否。",
    allowedTools: ["skill_draft.stage_edit", "staged_edit.adopt", "staged_edit.reject"],
    forbiddenActions: ["不要未经确认直接覆盖编辑区。"],
    nextCards: ["refine.file_split", "governance.panel", "validation.test_ready"],
    drawerPolicy: "on_pending_edit",
    ctas: [
      { actionId: "draft.apply", label: "应用草稿" },
      { actionId: "draft.discard", label: "放弃", tone: "danger" },
    ],
  },
  "refine.file_split": {
    contractId: "refine.file_split",
    title: "文件拆分确认卡",
    phase: "refine",
    objective: "在真正写入前确认拆分结构和主 Prompt 的变更。",
    allowedTools: ["skill_file.stage_edit", "staged_edit.adopt", "staged_edit.reject"],
    forbiddenActions: ["不要未确认直接创建拆分文件。"],
    nextCards: ["governance.panel", "validation.test_ready"],
    drawerPolicy: "on_pending_edit",
    ctas: [
      { actionId: "split.confirm", label: "确认拆分" },
      { actionId: "split.discard", label: "放弃", tone: "danger" },
    ],
  },
  "refine.tool_suggestion": {
    contractId: "refine.tool_suggestion",
    title: "工具绑定建议卡",
    phase: "refine",
    objective: "逐个确认 AI 推荐的外部工具绑定，或跳转外部完成实现。",
    allowedTools: ["studio_chat.ask_one_question", "studio_artifact.update"],
    forbiddenActions: ["不要跳过确认直接绑定。"],
    nextCards: ["governance.panel", "validation.test_ready"],
    drawerPolicy: "never",
    ctas: [
      { actionId: "tool.confirm", label: "在 Studio 中完成绑定" },
      { actionId: "handoff.external_build", label: "去外部完成实现", tone: "secondary" },
    ],
  },
  "refine.knowledge_binding_hint": {
    contractId: "refine.knowledge_binding_hint",
    title: "知识绑定建议卡",
    phase: "refine",
    objective: "补齐知识标签或引用来源，避免 Skill 失去上下文支撑。",
    allowedTools: ["studio_chat.ask_one_question", "studio_artifact.update"],
    forbiddenActions: ["不要把知识绑定当成可跳过的隐形步骤。"],
    nextCards: ["governance.panel", "validation.test_ready"],
    drawerPolicy: "manual",
    ctas: [{ actionId: "knowledge.bind", label: "绑定知识库" }],
  },
  "governance.panel": {
    contractId: "governance.panel",
    title: "治理推进卡",
    phase: "governance",
    objective: "让权限、挂载、测试方案等治理动作回到主线推进。",
    allowedTools: ["skill_governance.open_panel", "studio_artifact.update"],
    forbiddenActions: ["不要让治理动作停留在旁路提示里。"],
    nextCards: ["validation.test_ready", "fixing.overview"],
    drawerPolicy: "manual",
    ctas: [{ actionId: "governance.open_panel", label: "打开治理面板" }],
  },
  "validation.test_ready": {
    contractId: "validation.test_ready",
    title: "测试就绪卡",
    phase: "validation",
    objective: "把当前 Skill 推入 Sandbox 或测试流，拿到可回流的结果。",
    allowedTools: ["sandbox.run"],
    forbiddenActions: ["不要只在聊天里口头说可以测试。"],
    nextCards: ["fixing.overview", "release.test_passed"],
    drawerPolicy: "manual",
    ctas: [{ actionId: "validation.open_sandbox", label: "打开 Sandbox" }],
  },
  "fixing.overview": {
    contractId: "fixing.overview",
    title: "整改概览卡",
    phase: "fixing",
    objective: "把 failed 报告转成明确的整改任务队列和下一步动作。",
    allowedTools: ["studio_artifact.update", "sandbox.targeted_rerun"],
    forbiddenActions: ["不要只解释报告而不生成整改路径。"],
    nextCards: ["fixing.task", "fixing.targeted_retest"],
    drawerPolicy: "manual",
    ctas: [],
  },
  "fixing.task": {
    contractId: "fixing.task",
    title: "整改任务卡",
    phase: "fixing",
    objective: "聚焦单个问题项，定位目标文件并开始修复。",
    allowedTools: ["skill_file.open", "skill_file.stage_edit", "studio_chat.ask_one_question"],
    forbiddenActions: ["不要同时并行修多个未确认问题。"],
    nextCards: ["fixing.targeted_retest", "release.test_passed"],
    drawerPolicy: "manual",
    ctas: [{ actionId: "fixing.start_task", label: "修复此项" }],
  },
  "fixing.targeted_retest": {
    contractId: "fixing.targeted_retest",
    title: "局部重测卡",
    phase: "fixing",
    objective: "针对已修复问题做局部验证，避免每次都跑全量。",
    allowedTools: ["sandbox.targeted_rerun"],
    forbiddenActions: ["不要遗漏 source report 和 issue 范围。"],
    nextCards: ["release.test_passed", "fixing.task"],
    drawerPolicy: "manual",
    ctas: [{ actionId: "fixing.targeted_retest", label: "运行局部重测" }],
  },
  "confirm.staged_edit_review": {
    contractId: "confirm.staged_edit_review",
    title: "待确认修改卡",
    phase: "confirm",
    objective: "让文件改动以 staged edit 方式进入确认流，而不是直接落盘。",
    allowedTools: ["skill_file.open", "staged_edit.adopt", "staged_edit.reject"],
    forbiddenActions: ["不要跳过确认步骤直接采纳。"],
    nextCards: ["validation.test_ready", "fixing.task", "release.submit"],
    drawerPolicy: "on_pending_edit",
    ctas: [],
  },
  "confirm.bind_back": {
    contractId: "confirm.bind_back",
    title: "外部编辑回绑卡",
    phase: "confirm",
    objective: "外部实现已返回，先确认变更再进入验证。",
    allowedTools: ["skill_file.open", "staged_edit.adopt", "staged_edit.reject", "sandbox.run"],
    forbiddenActions: ["不要跳过回绑直接继续。"],
    nextCards: ["validation.test_ready", "fixing.overview"],
    drawerPolicy: "on_pending_edit",
    ctas: [
      { actionId: "handoff.bind_back", label: "确认变更并进入验证" },
      { actionId: "draft.discard", label: "放弃外部变更", tone: "danger" },
    ],
  },
  "release.test_passed": {
    contractId: "release.test_passed",
    title: "测试通过卡",
    phase: "release",
    objective: "在测试通过后，把用户带到审批或发布前复核。",
    allowedTools: ["studio_chat.ask_one_question"],
    forbiddenActions: ["不要测试通过后让用户自己找下一步。"],
    nextCards: ["release.submit"],
    drawerPolicy: "manual",
    ctas: [{ actionId: "release.submit_approval", label: "提交审批" }],
  },
  "release.submit": {
    contractId: "release.submit",
    title: "提交审批卡",
    phase: "release",
    objective: "执行提审或发布动作，闭合主流程。",
    allowedTools: ["studio_chat.ask_one_question"],
    forbiddenActions: ["不要停留在‘可以提交’的口头提示。"],
    nextCards: ["release.completed"],
    drawerPolicy: "manual",
    ctas: [{ actionId: "release.submit_approval", label: "执行提交" }],
  },

  // ── Optimize 模式 ──
  "optimize.governance.audit_review": {
    contractId: "optimize.governance.audit_review",
    title: "审计结果确认卡",
    phase: "governance",
    objective: "确认 Skill 审计结果，了解当前状态。",
    allowedTools: ["studio_chat.ask_one_question"],
    forbiddenActions: [],
    nextCards: ["optimize.governance.constraint_check"],
    drawerPolicy: "never",
    ctas: [{ actionId: "architect.continue", label: "查看审计结果" }],
  },
  "optimize.governance.constraint_check": {
    contractId: "optimize.governance.constraint_check",
    title: "约束检查卡",
    phase: "governance",
    objective: "检查 Skill 是否满足优化前置约束条件。",
    allowedTools: ["studio_chat.ask_one_question"],
    forbiddenActions: [],
    nextCards: ["optimize.refine.prompt_edit"],
    drawerPolicy: "never",
    ctas: [{ actionId: "architect.continue", label: "查看约束检查" }],
  },
  "optimize.refine.prompt_edit": {
    contractId: "optimize.refine.prompt_edit",
    title: "Prompt 优化卡",
    phase: "refine",
    objective: "根据审计和约束结果，优化 Prompt 内容。",
    allowedTools: ["skill_file.stage_edit", "staged_edit.adopt", "staged_edit.reject"],
    forbiddenActions: ["不要未经确认直接覆盖。"],
    nextCards: ["optimize.refine.example_edit"],
    drawerPolicy: "on_pending_edit",
    ctas: [{ actionId: "draft.apply", label: "应用修改" }, { actionId: "draft.discard", label: "放弃", tone: "danger" }],
  },
  "optimize.refine.example_edit": {
    contractId: "optimize.refine.example_edit",
    title: "示例优化卡",
    phase: "refine",
    objective: "优化或补充 Skill 示例。",
    allowedTools: ["skill_file.stage_edit", "staged_edit.adopt", "staged_edit.reject"],
    forbiddenActions: ["不要未经确认直接覆盖。"],
    nextCards: ["optimize.refine.tool_binding"],
    drawerPolicy: "on_pending_edit",
    ctas: [{ actionId: "draft.apply", label: "应用修改" }, { actionId: "draft.discard", label: "放弃", tone: "danger" }],
  },
  "optimize.refine.tool_binding": {
    contractId: "optimize.refine.tool_binding",
    title: "工具绑定优化卡",
    phase: "refine",
    objective: "优化 Skill 的工具绑定配置。",
    allowedTools: ["studio_chat.ask_one_question", "studio_artifact.update"],
    forbiddenActions: [],
    nextCards: ["optimize.validation.preflight"],
    drawerPolicy: "never",
    ctas: [
      { actionId: "tool.confirm", label: "在 Studio 中完成绑定" },
      { actionId: "handoff.external_build", label: "去外部完成实现", tone: "secondary" },
    ],
  },
  "optimize.validation.preflight": {
    contractId: "optimize.validation.preflight",
    title: "优化预检卡",
    phase: "validation",
    objective: "在优化后执行预检验证。",
    allowedTools: ["sandbox.run"],
    forbiddenActions: [],
    nextCards: ["optimize.validation.sandbox_run"],
    drawerPolicy: "manual",
    ctas: [{ actionId: "validation.open_sandbox", label: "运行预检" }],
  },
  "optimize.validation.sandbox_run": {
    contractId: "optimize.validation.sandbox_run",
    title: "优化验证卡",
    phase: "validation",
    objective: "运行 Sandbox 验证优化后的 Skill。",
    allowedTools: ["sandbox.run"],
    forbiddenActions: [],
    nextCards: [],
    drawerPolicy: "manual",
    ctas: [{ actionId: "validation.open_sandbox", label: "打开 Sandbox" }],
  },

  // ── Audit 模式 ──
  "audit.scan.quality": {
    contractId: "audit.scan.quality",
    title: "质量扫描卡",
    phase: "governance",
    objective: "对导入的 Skill 执行质量扫描，发现潜在问题。",
    allowedTools: ["studio_chat.ask_one_question"],
    forbiddenActions: [],
    nextCards: ["audit.scan.security"],
    drawerPolicy: "never",
    ctas: [{ actionId: "architect.continue", label: "查看扫描结果" }],
  },
  "audit.scan.security": {
    contractId: "audit.scan.security",
    title: "安全扫描卡",
    phase: "governance",
    objective: "对导入的 Skill 执行安全扫描。",
    allowedTools: ["studio_chat.ask_one_question"],
    forbiddenActions: [],
    nextCards: ["audit.fixing.critical"],
    drawerPolicy: "never",
    ctas: [{ actionId: "architect.continue", label: "查看扫描结果" }],
  },
  "audit.fixing.critical": {
    contractId: "audit.fixing.critical",
    title: "严重问题整改卡",
    phase: "fixing",
    objective: "修复扫描发现的严重问题。",
    allowedTools: ["skill_file.open", "skill_file.stage_edit", "studio_chat.ask_one_question"],
    forbiddenActions: ["不要跳过严重问题。"],
    nextCards: ["audit.fixing.moderate"],
    drawerPolicy: "manual",
    ctas: [{ actionId: "fixing.start_task", label: "修复此项" }],
  },
  "audit.fixing.moderate": {
    contractId: "audit.fixing.moderate",
    title: "中等问题整改卡",
    phase: "fixing",
    objective: "修复扫描发现的中等问题。",
    allowedTools: ["skill_file.open", "skill_file.stage_edit", "studio_chat.ask_one_question"],
    forbiddenActions: [],
    nextCards: ["audit.release.preflight_recheck"],
    drawerPolicy: "manual",
    ctas: [{ actionId: "fixing.start_task", label: "修复此项" }],
  },
  "audit.release.preflight_recheck": {
    contractId: "audit.release.preflight_recheck",
    title: "整改后复检卡",
    phase: "release",
    objective: "整改完成后重新执行预检。",
    allowedTools: ["sandbox.run"],
    forbiddenActions: [],
    nextCards: ["audit.release.publish_gate"],
    drawerPolicy: "manual",
    ctas: [{ actionId: "validation.open_sandbox", label: "运行复检" }],
  },
  "audit.release.publish_gate": {
    contractId: "audit.release.publish_gate",
    title: "发布门禁卡",
    phase: "release",
    objective: "确认所有问题已修复，可以发布。",
    allowedTools: ["studio_chat.ask_one_question"],
    forbiddenActions: ["不要跳过未修复的严重问题。"],
    nextCards: [],
    drawerPolicy: "manual",
    ctas: [{ actionId: "release.submit_approval", label: "确认发布" }],
  },
};

export function getStudioCardContract(contractId: string | null | undefined): StudioCardContract | null {
  if (!contractId) return null;
  return CONTRACTS[contractId] ?? null;
}

/** card.id → contractId 的静态映射（用于 contractId 未显式设置时的 fallback） */
const CARD_ID_TO_CONTRACT: Record<string, string> = {
  "fixing:overview": "fixing.overview",
  "create:onboarding": "create.onboarding",
  "create:summary-ready": "create.summary_ready",
  "refine:draft-ready": "refine.draft_ready",
  "refine:file-split": "refine.file_split",
  "refine:tool-suggestion": "refine.tool_suggestion",
  "refine:knowledge-hint": "refine.knowledge_binding_hint",
  "testing:test-ready": "validation.test_ready",
  "release:test-passed": "release.test_passed",
  "release:submit": "release.submit",
};

/** card.id prefix → contractId 的前缀匹配（按优先级排序） */
const CARD_ID_PREFIX_TO_CONTRACT: [string, string][] = [
  ["create:architect:", "architect.phase.execute"],
  ["fixing:current:", "fixing.task"],
];

function withFileRoleCtas(contract: StudioCardContract, card: WorkbenchCard): StudioCardContract {
  if (contract.ctas.length === 0 && card.fileRole && FILE_ROLE_CTAS[card.fileRole]) {
    return { ...contract, ctas: FILE_ROLE_CTAS[card.fileRole] };
  }
  return contract;
}

function resolveContractByCardShape(card: WorkbenchCard): StudioCardContract | null {
  // 1. bind_back 回绑卡
  if (card.returnTo === "confirm" || card.source === "bind_back" || card.raw?.origin === "bind_back") {
    return CONTRACTS["confirm.bind_back"];
  }
  // 2. staged edit 待确认
  if (card.stagedEditId) return CONTRACTS["confirm.staged_edit_review"];
  // 3. 精确 id 匹配
  const exact = CARD_ID_TO_CONTRACT[card.id];
  if (exact) return CONTRACTS[exact];
  // 4. 前缀匹配
  for (const [prefix, contractId] of CARD_ID_PREFIX_TO_CONTRACT) {
    if (card.id.startsWith(prefix)) return CONTRACTS[contractId];
  }
  // 5. fixing:task:* 需要判断子类型
  if (card.id.startsWith("fixing:task:")) {
    return card.fixTask?.type === "run_targeted_retest"
      ? CONTRACTS["fixing.targeted_retest"]
      : CONTRACTS["fixing.task"];
  }
  // 6. governance mode 兜底
  if (card.mode === "governance") return CONTRACTS["governance.panel"];
  return null;
}

export function resolveStudioCardContract(card: WorkbenchCard | null): StudioCardContract | null {
  if (!card) return null;
  // 优先用显式 contractId 查找
  if (card.contractId) {
    const contract = getStudioCardContract(card.contractId);
    if (contract) return withFileRoleCtas(contract, card);
  }
  // fallback: 根据卡的结构特征推断
  const contract = resolveContractByCardShape(card);
  return contract ? withFileRoleCtas(contract, card) : null;
}
