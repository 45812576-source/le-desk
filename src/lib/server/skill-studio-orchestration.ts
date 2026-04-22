export interface SkillStudioActiveCardContext {
  id: string | null;
  contractId: string | null;
  title: string | null;
  mode: string | null;
  target: Record<string, unknown> | null;
  sourceCardId: string | null;
  stagedEditId: string | null;
  validationSource: Record<string, unknown> | null;
}

export interface SkillStudioCardPrompt {
  contractId: string;
  title: string;
  objective: string;
  rules: string[];
  allowedTools: string[];
  forbiddenActions: string[];
  exitCriteria: string[];
  nextCards: string[];
  artifactKeys: string[];
}

export interface SkillStudioOrchestrationPayload {
  protocol_version: "card_queue_v1";
  system_prompt: string;
  active_card: SkillStudioActiveCardContext;
  card_prompt: SkillStudioCardPrompt;
  scheduling_summary: {
    should_continue_active_card: boolean;
    should_block_cross_phase: boolean;
    should_stage_file_edits: boolean;
  };
}

export interface SkillStudioSsePreludeEvent {
  event: "card_patch" | "artifact_patch";
  data: Record<string, unknown>;
}

export interface SkillStudioStreamOrchestration {
  payload: Record<string, unknown>;
  preludeEvents: SkillStudioSsePreludeEvent[];
}

const STUDIO_CHAT_SYSTEM_PROMPT = [
  "你是 Skill Studio 的 Studio Chat 总调度器。",
  "必须先服务当前 active card，再判断是否切换卡片或生成新卡。",
  "如果用户在当前卡未退场时请求跨阶段动作，则说明缺失前置并继续当前卡。",
  "如果 AI 输出会修改 SKILL.md 或 source file，则只能生成 staged edit，不得直接写入。",
  "如果 Sandbox 或治理失败，则必须回流为 Card Queue 中的整改卡。",
  "每轮只能围绕当前卡推进一个最小可确认动作。",
].join("\n");

const CARD_ID_TO_CONTRACT_ID: Record<string, string> = {
  // ── Architect (create) ──
  "create:architect:5whys": "architect.why.5whys",
  "create:architect:first-principles": "architect.why.first_principles",
  "create:architect:jtbd": "architect.why.jtbd",
  "create:architect:cynefin": "architect.why.cynefin",
  "create:architect:mece": "architect.what.mece",
  "create:architect:issue-tree": "architect.what.issue_tree",
  "create:architect:value-chain": "architect.what.value_chain",
  "create:architect:scenario": "architect.what.scenario_planning",
  "create:architect:pyramid": "architect.how.pyramid",
  "create:architect:pre-mortem": "architect.how.pre_mortem",
  "create:architect:red-team": "architect.how.red_team",
  "create:architect:sensitivity": "architect.how.sensitivity",
  "create:architect:zero-based": "architect.how.zero_based",
  "create:architect:ooda": "architect.how.ooda",
  // ── Optimize ──
  "optimize:governance:audit-review": "optimize.governance.audit_review",
  "optimize:governance:constraint-check": "optimize.governance.constraint_check",
  "optimize:refine:prompt-edit": "optimize.refine.prompt_edit",
  "optimize:refine:example-edit": "optimize.refine.example_edit",
  "optimize:refine:tool-binding": "optimize.refine.tool_binding",
  "optimize:validation:preflight": "optimize.validation.preflight",
  "optimize:validation:sandbox-run": "optimize.validation.sandbox_run",
  // ── Audit ──
  "audit:scan:quality": "audit.scan.quality",
  "audit:scan:security": "audit.scan.security",
  "audit:fixing:critical": "audit.fixing.critical",
  "audit:fixing:moderate": "audit.fixing.moderate",
  "audit:release:preflight-recheck": "audit.release.preflight_recheck",
  "audit:release:publish-gate": "audit.release.publish_gate",
};

const CARD_PROMPTS: Record<string, SkillStudioCardPrompt> = {
  "architect.why.5whys": {
    contractId: "architect.why.5whys",
    title: "5 Whys 根因卡",
    objective: "找到用户真正需要这个 Skill 的业务根因，而不是满足表面需求。",
    rules: [
      "一次只问一个问题。",
      "每个问题必须基于用户上一轮回答继续追问。",
      "至少完成 3 层 why，理想完成 5 层。",
      "不要替用户脑补根因。",
    ],
    allowedTools: ["studio_chat.ask_one_question", "studio_artifact.update"],
    forbiddenActions: ["不要生成 SKILL.md。", "不要调用治理、测试或文件写入工具。"],
    exitCriteria: ["why_chain 足够清楚", "用户确认 root_cause"],
    nextCards: ["architect.why.first_principles"],
    artifactKeys: ["surface_request", "why_chain", "root_cause"],
  },
  "architect.why.first_principles": {
    contractId: "architect.why.first_principles",
    title: "第一性原理卡",
    objective: "剥离惯性假设，确认不可删减的真实约束。",
    rules: ["只讨论不可改变的事实、约束和目标。", "明确哪些原始假设可以丢弃。"],
    allowedTools: ["studio_chat.ask_one_question", "studio_artifact.update"],
    forbiddenActions: ["不要进入测试或发布。"],
    exitCriteria: ["true_constraints 已确认", "assumptions_to_drop 已确认"],
    nextCards: ["architect.why.jtbd"],
    artifactKeys: ["true_constraints", "assumptions_to_drop"],
  },
  "architect.why.jtbd": {
    contractId: "architect.why.jtbd",
    title: "JTBD 场景卡",
    objective: "确认谁在什么情境下雇佣这个 Skill，以及期望替代什么方案。",
    rules: ["一次只确认一个场景变量。", "必须包含使用者、触发情境、焦虑和期望结果。"],
    allowedTools: ["studio_chat.ask_one_question", "studio_artifact.update"],
    forbiddenActions: ["不要把场景泛化成抽象口号。"],
    exitCriteria: ["jtbd_scene 已确认", "expected_outcome 已确认"],
    nextCards: ["architect.why.cynefin"],
    artifactKeys: ["jtbd_scene", "user_anxiety", "expected_outcome", "alternative_solution"],
  },
  "architect.why.cynefin": {
    contractId: "architect.why.cynefin",
    title: "Cynefin 分类卡",
    objective: "判断问题复杂度，决定 Skill 是刚性流程、专家判断还是探索迭代型。",
    rules: ["先分类问题复杂度，再决定设计模式。", "分类理由必须来自已确认场景。"],
    allowedTools: ["studio_chat.ask_one_question", "studio_artifact.update"],
    forbiddenActions: ["不要在复杂度未确认时生成草稿。"],
    exitCriteria: ["problem_complexity 已分类", "skill_design_mode 已确认"],
    nextCards: ["architect.what.mece"],
    artifactKeys: ["problem_complexity", "skill_design_mode"],
  },
  "architect.what.mece": {
    contractId: "architect.what.mece",
    title: "MECE 维度卡",
    objective: "穷举影响结论质量的输入维度，保证不重叠、不遗漏。",
    rules: ["维度必须互斥且共同穷尽。", "发现重叠时先修正分类。"],
    allowedTools: ["studio_chat.ask_one_question", "studio_artifact.update"],
    forbiddenActions: ["不要把所有维度都标为同等重要。"],
    exitCriteria: ["dimension_groups 已确认", "mece_conflicts 已处理"],
    nextCards: ["architect.what.issue_tree"],
    artifactKeys: ["dimension_groups", "dimension_items", "mece_conflicts"],
  },
  "architect.what.issue_tree": {
    contractId: "architect.what.issue_tree",
    title: "Issue Tree 卡",
    objective: "把核心问题拆成可验证的子问题树。",
    rules: ["树的每个分支必须能对应到后续输入或判断。"],
    allowedTools: ["studio_chat.ask_one_question", "studio_artifact.update"],
    forbiddenActions: ["不要生成无法验证的抽象分支。"],
    exitCriteria: ["issue_tree 已确认"],
    nextCards: ["architect.what.value_chain"],
    artifactKeys: ["issue_tree"],
  },
  "architect.what.value_chain": {
    contractId: "architect.what.value_chain",
    title: "Value Chain 卡",
    objective: "拆解输入、处理、输出链条，并找出瓶颈环节。",
    rules: ["必须说明每个瓶颈如何影响最终输出质量。"],
    allowedTools: ["studio_chat.ask_one_question", "studio_artifact.update"],
    forbiddenActions: ["不要忽略上游输入质量。"],
    exitCriteria: ["value_chain 已确认", "关键瓶颈已确认"],
    nextCards: ["architect.what.scenario_planning"],
    artifactKeys: ["value_chain"],
  },
  "architect.what.scenario_planning": {
    contractId: "architect.what.scenario_planning",
    title: "Scenario Planning 卡",
    objective: "用最佳、最差和边缘场景补齐隐藏维度。",
    rules: ["必须至少覆盖一个边缘场景。"],
    allowedTools: ["studio_chat.ask_one_question", "studio_artifact.update"],
    forbiddenActions: ["不要只讨论理想场景。"],
    exitCriteria: ["hidden_dimensions 已处理"],
    nextCards: ["architect.how.pyramid"],
    artifactKeys: ["best_case_scenario", "worst_case_scenario", "edge_case_scenario", "hidden_dimensions"],
  },
  "architect.how.pyramid": {
    contractId: "architect.how.pyramid",
    title: "金字塔验证卡",
    objective: "把核心结论、证据和子论点串成可验证结构。",
    rules: ["每个结论必须能回连到已确认维度。"],
    allowedTools: ["studio_chat.ask_one_question", "studio_artifact.update"],
    forbiddenActions: ["不要让结论脱离证据链。"],
    exitCriteria: ["conclusion_evidence_tree 已确认"],
    nextCards: ["architect.how.pre_mortem"],
    artifactKeys: ["conclusion_evidence_tree"],
  },
  "architect.how.pre_mortem": {
    contractId: "architect.how.pre_mortem",
    title: "Pre-Mortem 卡",
    objective: "假设 Skill 上线失败，倒推至少 3 个失败原因。",
    rules: ["少于 3 个失败原因不得退场。"],
    allowedTools: ["studio_chat.ask_one_question", "studio_artifact.update"],
    forbiddenActions: ["不要只列泛泛风险。"],
    exitCriteria: ["failure_reasons 至少 3 项", "failure_prevention 已确认"],
    nextCards: ["architect.how.red_team"],
    artifactKeys: ["failure_reasons", "failure_prevention"],
  },
  "architect.how.red_team": {
    contractId: "architect.how.red_team",
    title: "Red Team 卡",
    objective: "挑战已有维度，找反例、冲突和伪重要维度。",
    rules: ["必须主动寻找反例。"],
    allowedTools: ["studio_chat.ask_one_question", "studio_artifact.update"],
    forbiddenActions: ["不要只强化原方案。"],
    exitCriteria: ["red_team_counterexamples 已确认", "dimension_conflicts 已处理"],
    nextCards: ["architect.how.sensitivity"],
    artifactKeys: ["red_team_counterexamples", "dimension_conflicts"],
  },
  "architect.how.sensitivity": {
    contractId: "architect.how.sensitivity",
    title: "Sensitivity 卡",
    objective: "判断每个输入维度对最终结论的敏感度，并输出 P0/P1/P2。",
    rules: ["如果维度变化会改变结论，则标为 P0。", "如果只影响置信度或表达细节，则标为 P1。", "不允许所有维度都是 P0。"],
    allowedTools: ["studio_chat.ask_one_question", "studio_artifact.update"],
    forbiddenActions: ["不要把所有维度都保留为必填项。"],
    exitCriteria: ["priority_matrix 已确认", "P0/P1/P2 分级合理"],
    nextCards: ["architect.how.zero_based"],
    artifactKeys: ["priority_matrix", "p0_dimensions", "p1_dimensions", "p2_dimensions"],
  },
  "architect.how.zero_based": {
    contractId: "architect.how.zero_based",
    title: "归零思维卡",
    objective: "从零重审哪些维度可以删除，避免 Skill 变成臃肿表单。",
    rules: ["必须说明删除维度不会破坏核心判断。"],
    allowedTools: ["studio_chat.ask_one_question", "studio_artifact.update"],
    forbiddenActions: ["不要因为已有投入就保留低价值维度。"],
    exitCriteria: ["removed_dimensions 已确认"],
    nextCards: ["architect.how.ooda"],
    artifactKeys: ["removed_dimensions"],
  },
  "architect.how.ooda": {
    contractId: "architect.how.ooda",
    title: "OODA 收敛卡",
    objective: "通过观察、判断、决策和行动确认框架已稳定，可进入草稿生成。",
    rules: ["如果两轮变化仍很大，则回调到 Why 或 What。", "ready_for_draft_summary 必须由用户确认。"],
    allowedTools: ["studio_chat.ask_one_question", "studio_artifact.update", "skill_draft.stage_edit"],
    forbiddenActions: ["不要在未确认 ready_for_draft_summary 时生成最终草稿。"],
    exitCriteria: ["ooda_rounds 已记录", "ready_for_draft_summary 已确认"],
    nextCards: ["architect.draft.skill_md"],
    artifactKeys: ["ooda_rounds", "ready_for_draft_summary"],
  },
  "architect.phase.execute": {
    contractId: "architect.phase.execute",
    title: "架构阶段执行卡",
    objective: "围绕当前 Why / What / How 阶段继续追问、拆解和收敛。",
    rules: ["一次只问一个问题。", "阶段未退场前不要生成最终草稿。"],
    allowedTools: ["studio_chat.ask_one_question", "studio_artifact.update"],
    forbiddenActions: ["不要提前进入治理、测试或发布。"],
    exitCriteria: ["当前阶段 artifact 已确认"],
    nextCards: ["create.summary_ready", "refine.draft_ready"],
    artifactKeys: ["current_phase_notes"],
  },
};

const GENERIC_CARD_PROMPTS: Record<string, SkillStudioCardPrompt> = {
  "create.summary_ready": {
    contractId: "create.summary_ready",
    title: "需求摘要确认卡",
    objective: "确认 AI 对需求的理解，再决定进入目录或草稿生成。",
    rules: ["等待用户确认或修正摘要。"],
    allowedTools: ["studio_artifact.update", "skill_draft.generate"],
    forbiddenActions: ["不要跳过用户确认直接生成草稿。"],
    exitCriteria: ["用户确认摘要"],
    nextCards: ["architect.phase.execute", "refine.draft_ready"],
    artifactKeys: ["requirement_summary"],
  },
  "refine.draft_ready": {
    contractId: "refine.draft_ready",
    title: "草稿确认卡",
    objective: "让草稿先以待确认修改的形式进入工作区，再决定采纳与否。",
    rules: ["任何文件改动必须 staged edit。"],
    allowedTools: ["skill_draft.stage_edit", "staged_edit.adopt", "staged_edit.reject"],
    forbiddenActions: ["不要未经确认直接覆盖编辑区。"],
    exitCriteria: ["草稿被采纳或拒绝"],
    nextCards: ["refine.file_split", "governance.panel", "validation.test_ready"],
    artifactKeys: ["draft_review"],
  },
  "confirm.staged_edit_review": {
    contractId: "confirm.staged_edit_review",
    title: "待确认修改卡",
    objective: "让文件改动以 staged edit 方式进入确认流，而不是直接落盘。",
    rules: ["只解释变更影响，不直接写入。"],
    allowedTools: ["skill_file.open", "staged_edit.adopt", "staged_edit.reject"],
    forbiddenActions: ["不要跳过确认步骤直接采纳。"],
    exitCriteria: ["用户采纳或拒绝 staged edit"],
    nextCards: ["validation.test_ready", "fixing.task", "release.submit"],
    artifactKeys: ["edit_review"],
  },
  "fixing.task": {
    contractId: "fixing.task",
    title: "整改任务卡",
    objective: "聚焦单个问题项，定位目标文件并开始修复。",
    rules: ["一次只修一个任务。", "修复产生文件改动时必须 staged edit。"],
    allowedTools: ["skill_file.open", "skill_file.stage_edit", "studio_chat.ask_one_question"],
    forbiddenActions: ["不要同时并行修多个未确认问题。"],
    exitCriteria: ["整改方案已确认", "必要 staged edit 已生成"],
    nextCards: ["fixing.targeted_retest"],
    artifactKeys: ["fix_task_result"],
  },
  // ── Optimize 模式 ──
  "optimize.governance.audit_review": {
    contractId: "optimize.governance.audit_review",
    title: "审计结果确认卡",
    objective: "确认 Skill 审计结果，了解当前状态。",
    rules: ["先展示审计结论再让用户决策。"],
    allowedTools: ["studio_chat.ask_one_question"],
    forbiddenActions: ["不要跳过审计直接修改。"],
    exitCriteria: ["审计结果已确认"],
    nextCards: ["optimize.governance.constraint_check"],
    artifactKeys: ["audit_review"],
  },
  "optimize.governance.constraint_check": {
    contractId: "optimize.governance.constraint_check",
    title: "约束检查卡",
    objective: "检查 Skill 是否满足优化前置约束条件。",
    rules: ["约束不满足时必须说明原因。"],
    allowedTools: ["studio_chat.ask_one_question"],
    forbiddenActions: ["不要在约束未满足时继续优化。"],
    exitCriteria: ["约束条件已检查"],
    nextCards: ["optimize.refine.prompt_edit"],
    artifactKeys: ["constraint_check"],
  },
  "optimize.refine.prompt_edit": {
    contractId: "optimize.refine.prompt_edit",
    title: "Prompt 优化卡",
    objective: "根据审计和约束结果，优化 Prompt 内容。",
    rules: ["任何文件改动必须 staged edit。"],
    allowedTools: ["skill_file.stage_edit", "staged_edit.adopt", "staged_edit.reject"],
    forbiddenActions: ["不要未经确认直接覆盖。"],
    exitCriteria: ["修改被采纳或拒绝"],
    nextCards: ["optimize.refine.example_edit"],
    artifactKeys: ["prompt_edit_review"],
  },
  "optimize.refine.example_edit": {
    contractId: "optimize.refine.example_edit",
    title: "示例优化卡",
    objective: "优化或补充 Skill 示例。",
    rules: ["任何文件改动必须 staged edit。"],
    allowedTools: ["skill_file.stage_edit", "staged_edit.adopt", "staged_edit.reject"],
    forbiddenActions: ["不要未经确认直接覆盖。"],
    exitCriteria: ["修改被采纳或拒绝"],
    nextCards: ["optimize.refine.tool_binding"],
    artifactKeys: ["example_edit_review"],
  },
  "optimize.refine.tool_binding": {
    contractId: "optimize.refine.tool_binding",
    title: "工具绑定优化卡",
    objective: "优化 Skill 的工具绑定配置。",
    rules: ["等待用户确认绑定方案。"],
    allowedTools: ["studio_chat.ask_one_question", "studio_artifact.update"],
    forbiddenActions: ["不要跳过确认直接绑定。"],
    exitCriteria: ["绑定方案已确认"],
    nextCards: ["optimize.validation.preflight"],
    artifactKeys: ["tool_binding_review"],
  },
  "optimize.validation.preflight": {
    contractId: "optimize.validation.preflight",
    title: "优化预检卡",
    objective: "在优化后执行预检验证。",
    rules: ["必须展示预检结果。"],
    allowedTools: ["sandbox.run"],
    forbiddenActions: [],
    exitCriteria: ["预检完成"],
    nextCards: ["optimize.validation.sandbox_run"],
    artifactKeys: ["preflight_result"],
  },
  "optimize.validation.sandbox_run": {
    contractId: "optimize.validation.sandbox_run",
    title: "优化验证卡",
    objective: "运行 Sandbox 验证优化后的 Skill。",
    rules: ["展示验证结论。"],
    allowedTools: ["sandbox.run"],
    forbiddenActions: [],
    exitCriteria: ["验证完成"],
    nextCards: [],
    artifactKeys: ["sandbox_result"],
  },
  // ── Audit 模式 ──
  "audit.scan.quality": {
    contractId: "audit.scan.quality",
    title: "质量扫描卡",
    objective: "对导入的 Skill 执行质量扫描，发现潜在问题。",
    rules: ["扫描结果必须分维度展示。"],
    allowedTools: ["studio_chat.ask_one_question"],
    forbiddenActions: [],
    exitCriteria: ["质量扫描完成"],
    nextCards: ["audit.scan.security"],
    artifactKeys: ["quality_scan"],
  },
  "audit.scan.security": {
    contractId: "audit.scan.security",
    title: "安全扫描卡",
    objective: "对导入的 Skill 执行安全扫描。",
    rules: ["必须检查 prompt injection 风险。"],
    allowedTools: ["studio_chat.ask_one_question"],
    forbiddenActions: [],
    exitCriteria: ["安全扫描完成"],
    nextCards: ["audit.fixing.critical"],
    artifactKeys: ["security_scan"],
  },
  "audit.fixing.critical": {
    contractId: "audit.fixing.critical",
    title: "严重问题整改卡",
    objective: "修复扫描发现的严重问题。",
    rules: ["一次只修一个问题。", "修复产生文件改动时必须 staged edit。"],
    allowedTools: ["skill_file.open", "skill_file.stage_edit", "studio_chat.ask_one_question"],
    forbiddenActions: ["不要跳过严重问题。"],
    exitCriteria: ["严重问题已修复"],
    nextCards: ["audit.fixing.moderate"],
    artifactKeys: ["critical_fix_result"],
  },
  "audit.fixing.moderate": {
    contractId: "audit.fixing.moderate",
    title: "中等问题整改卡",
    objective: "修复扫描发现的中等问题。",
    rules: ["修复产生文件改动时必须 staged edit。"],
    allowedTools: ["skill_file.open", "skill_file.stage_edit", "studio_chat.ask_one_question"],
    forbiddenActions: [],
    exitCriteria: ["中等问题已修复"],
    nextCards: ["audit.release.preflight_recheck"],
    artifactKeys: ["moderate_fix_result"],
  },
  "audit.release.preflight_recheck": {
    contractId: "audit.release.preflight_recheck",
    title: "整改后复检卡",
    objective: "整改完成后重新执行预检。",
    rules: ["必须展示复检结论。"],
    allowedTools: ["sandbox.run"],
    forbiddenActions: [],
    exitCriteria: ["复检完成"],
    nextCards: ["audit.release.publish_gate"],
    artifactKeys: ["recheck_result"],
  },
  "audit.release.publish_gate": {
    contractId: "audit.release.publish_gate",
    title: "发布门禁卡",
    objective: "确认所有问题已修复，可以发布。",
    rules: ["有未修复的严重问题时不可发布。"],
    allowedTools: ["studio_chat.ask_one_question"],
    forbiddenActions: ["不要跳过未修复的严重问题。"],
    exitCriteria: ["发布决策已确认"],
    nextCards: [],
    artifactKeys: ["publish_gate_decision"],
  },
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function readObject(value: unknown): Record<string, unknown> | null {
  return isObject(value) ? value : null;
}

function resolveContractId(payload: Record<string, unknown>): string | null {
  const explicit = readString(payload.active_card_contract_id);
  const cardId = readString(payload.active_card_id);
  if (explicit && explicit !== "architect.phase.execute") {
    return explicit;
  }
  if (cardId && CARD_ID_TO_CONTRACT_ID[cardId]) {
    return CARD_ID_TO_CONTRACT_ID[cardId];
  }
  return explicit;
}

function getCardPrompt(contractId: string | null): SkillStudioCardPrompt | null {
  if (!contractId) return null;
  return CARD_PROMPTS[contractId] ?? GENERIC_CARD_PROMPTS[contractId] ?? null;
}

function buildActiveCardContext(payload: Record<string, unknown>, contractId: string): SkillStudioActiveCardContext {
  return {
    id: readString(payload.active_card_id),
    contractId,
    title: readString(payload.active_card_title),
    mode: readString(payload.active_card_mode),
    target: readObject(payload.active_card_target),
    sourceCardId: readString(payload.active_card_source_card_id),
    stagedEditId: readString(payload.active_card_staged_edit_id),
    validationSource: readObject(payload.active_card_validation_source),
  };
}

function resolveCardKindFromContractId(contractId: string): string | undefined {
  if (contractId.startsWith("architect.") || contractId.startsWith("create.")) return "create";
  if (contractId.startsWith("refine.") || contractId.startsWith("optimize.refine.")) return "refine";
  if (contractId.startsWith("confirm.")) return "refine";
  if (contractId.startsWith("governance.") || contractId.startsWith("optimize.governance.") || contractId.startsWith("audit.scan.")) return "governance";
  if (contractId.startsWith("validation.") || contractId.startsWith("optimize.validation.")) return "validation";
  if (contractId.startsWith("fixing.") || contractId.startsWith("audit.fixing.")) return "fixing";
  if (contractId.startsWith("release.") || contractId.startsWith("audit.release.")) return "release";
  return undefined;
}

function buildCardPatch(activeCard: SkillStudioActiveCardContext, cardPrompt: SkillStudioCardPrompt): Record<string, unknown> {
  return {
    id: activeCard.id || `runtime:${cardPrompt.contractId}`,
    contract_id: cardPrompt.contractId,
    title: activeCard.title || cardPrompt.title,
    summary: cardPrompt.objective,
    status: "active",
    kind: resolveCardKindFromContractId(cardPrompt.contractId),
    mode: activeCard.mode || "analysis",
    phase: cardPrompt.contractId.split(".").slice(0, 2).join("_"),
    priority: 120,
    target: activeCard.target || { type: "analysis", key: null },
    artifact_refs: cardPrompt.artifactKeys.map((key) => `artifact:${key}`),
    source_card_id: activeCard.sourceCardId,
    staged_edit_id: activeCard.stagedEditId,
    validation_source: activeCard.validationSource,
  };
}

function buildArtifactPatch(payload: Record<string, unknown>, activeCard: SkillStudioActiveCardContext, cardPrompt: SkillStudioCardPrompt): Record<string, unknown> | null {
  const content = readString(payload.content);
  if (!content || !cardPrompt.contractId.startsWith("architect.")) {
    return null;
  }
  const artifactKey = cardPrompt.artifactKeys[0] || "current_phase_notes";
  return {
    card_id: activeCard.id,
    contract_id: cardPrompt.contractId,
    artifact_key: artifactKey,
    phase: cardPrompt.contractId.split(".").slice(0, 2).join("_"),
    summary: content.length > 80 ? `${content.slice(0, 80)}…` : content,
    artifact: {
      latest_user_answer: content,
      needs_ai_followup: true,
    },
  };
}

export function resolveSkillStudioStreamOrchestration(input: {
  method: string;
  targetPath: string;
  payload: Record<string, unknown>;
}): SkillStudioStreamOrchestration | null {
  if (input.method !== "POST" || !/^\/conversations\/\d+\/messages\/stream$/.test(input.targetPath)) {
    return null;
  }
  const contractId = resolveContractId(input.payload);
  const cardPrompt = getCardPrompt(contractId);
  if (!contractId || !cardPrompt) {
    return null;
  }

  const activeCard = buildActiveCardContext(input.payload, contractId);
  const orchestration: SkillStudioOrchestrationPayload = {
    protocol_version: "card_queue_v1",
    system_prompt: STUDIO_CHAT_SYSTEM_PROMPT,
    active_card: activeCard,
    card_prompt: cardPrompt,
    scheduling_summary: {
      should_continue_active_card: true,
      should_block_cross_phase: true,
      should_stage_file_edits: true,
    },
  };

  const preludeEvents: SkillStudioSsePreludeEvent[] = [
    { event: "card_patch", data: buildCardPatch(activeCard, cardPrompt) },
  ];
  const artifactPatch = buildArtifactPatch(input.payload, activeCard, cardPrompt);
  if (artifactPatch) {
    preludeEvents.push({ event: "artifact_patch", data: artifactPatch });
  }

  return {
    payload: {
      ...input.payload,
      active_card_contract_id: contractId,
      studio_orchestration: orchestration,
    },
    preludeEvents,
  };
}
