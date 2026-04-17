import type { Department, OrgMemorySnapshot, SkillDetail, User } from "@/lib/types";

export interface PositionLite {
  id: number;
  name: string;
  department_id: number | null;
}

export interface AssetLite {
  asset_name: string;
  asset_type: string;
  risk_flags?: string[];
}

export interface RoleRecommendationItem {
  key: string;
  org_path: string;
  department_name: string;
  position_name: string;
  position_level: string;
  role_label: string;
  confidence: "high" | "medium" | "low";
  score: number;
  reason_summary: string;
  skill_reasons: string[];
  org_memory_reasons: string[];
  matched_terms: string[];
  fallback: boolean;
}

export interface RoleRecommendationResult {
  mode: "recommended" | "fallback";
  overall_confidence: "high" | "medium" | "low";
  summary: string;
  items: RoleRecommendationItem[];
}

const DOMAIN_KEYWORDS = [
  "招聘",
  "候选人",
  "简历",
  "面试",
  "offer",
  "入职",
  "绩效",
  "考核",
  "kpi",
  "okr",
  "销售",
  "商务",
  "客户",
  "商机",
  "线索",
  "复盘",
  "案例",
  "培训",
  "sop",
  "流程",
  "知识库",
  "知识",
  "权限",
  "脱敏",
  "遮蔽",
  "审批",
  "财务",
  "预算",
  "合同",
  "回款",
  "利润",
  "成本",
  "运营",
  "投放",
  "素材",
  "创意",
  "分析",
  "报表",
  "治理",
  "协作",
];

function normalizeText(value: string | null | undefined) {
  return (value || "").toLowerCase().replace(/\s+/g, " ").trim();
}

function includesTerm(text: string, term: string) {
  return text.includes(term.toLowerCase());
}

function unique<T>(items: T[]) {
  return Array.from(new Set(items));
}

function compact(items: Array<string | null | undefined>) {
  return items.map((item) => (item || "").trim()).filter(Boolean);
}

function inferPositionLevel(name: string) {
  if (/总监|负责人|head/i.test(name)) return "M1";
  if (/经理|主管|leader/i.test(name)) return "M0";
  if (/专家|顾问|分析师/i.test(name)) return "P2";
  if (/专员|助理|协调/i.test(name)) return "P1";
  return "";
}

function buildOrgPath(snapshot: OrgMemorySnapshot, departmentName: string) {
  const unit = snapshot.units.find((item) => item.name === departmentName);
  if (!unit) return departmentName;
  return unit.parent_name ? `${unit.parent_name}/${unit.name}` : unit.name;
}

function buildSkillCorpus(skill: SkillDetail, assets: AssetLite[]) {
  const texts = compact([
    skill.name,
    skill.description,
    skill.system_prompt,
    ...(skill.knowledge_tags || []),
    ...((skill.data_queries || []).flatMap((query) => [query.query_name, query.table_name, query.description || ""])),
    ...assets.flatMap((asset) => [asset.asset_name, asset.asset_type, ...(asset.risk_flags || [])]),
  ]);
  const joined = normalizeText(texts.join(" "));
  const matchedTerms = DOMAIN_KEYWORDS.filter((term) => includesTerm(joined, term));
  return { joined, matchedTerms };
}

function scoreRoleCandidate(input: {
  skillText: string;
  matchedSkillTerms: string[];
  snapshot: OrgMemorySnapshot;
  role: OrgMemorySnapshot["roles"][number];
  skill: SkillDetail;
  departments: Department[];
}) {
  const { skillText, matchedSkillTerms, snapshot, role, skill, departments } = input;
  const roleText = normalizeText([
    role.name,
    role.department_name,
    ...role.responsibilities,
  ].join(" "));

  const skillReasons: string[] = [];
  const orgReasons: string[] = [];
  const matchedTerms: string[] = [];
  let score = 0;

  if (includesTerm(skillText, role.name)) {
    score += 4;
    skillReasons.push(`Skill 内容直接出现了岗位名「${role.name}」`);
  }

  if (includesTerm(skillText, role.department_name)) {
    score += 3;
    skillReasons.push(`Skill 内容直接指向部门「${role.department_name}」`);
  }

  matchedSkillTerms.forEach((term) => {
    if (includesTerm(roleText, term)) {
      score += 2;
      matchedTerms.push(term);
    }
  });

  if (matchedTerms.length > 0) {
    skillReasons.push(`Skill 与岗位职责命中了 ${unique(matchedTerms).slice(0, 4).join("、")} 等关键词`);
  }

  const relatedUnit = snapshot.units.find((unit) => unit.name === role.department_name);
  if (relatedUnit) {
    const unitMatched = matchedSkillTerms.filter((term) =>
      includesTerm(normalizeText(relatedUnit.responsibilities.join(" ")), term),
    );
    if (unitMatched.length > 0) {
      score += 2;
      orgReasons.push(`组织职责中提到 ${unique(unitMatched).slice(0, 3).join("、")}`);
    }
  }

  const relatedProcesses = snapshot.processes.filter((process) =>
    process.participants.some((participant) => participant.includes(role.name))
    || process.owner_name.includes(role.department_name),
  );
  relatedProcesses.forEach((process) => {
    const processText = normalizeText([
      process.name,
      ...process.outputs,
      ...process.risk_points,
    ].join(" "));
    const terms = matchedSkillTerms.filter((term) => includesTerm(processText, term));
    if (terms.length > 0) {
      score += 2;
      orgReasons.push(`流程「${process.name}」覆盖 ${unique(terms).slice(0, 3).join("、")}`);
    }
  });

  const relatedOkrs = snapshot.okrs.filter((okr) =>
    okr.owner_name.includes(role.department_name) || okr.owner_name.includes(role.name),
  );
  relatedOkrs.forEach((okr) => {
    const okrText = normalizeText([okr.objective, ...okr.key_results].join(" "));
    const terms = matchedSkillTerms.filter((term) => includesTerm(okrText, term));
    if (terms.length > 0) {
      score += 1;
      orgReasons.push(`OKR「${okr.objective}」关联 ${unique(terms).slice(0, 2).join("、")}`);
    }
  });

  const skillDept = departments.find((dept) => dept.id === skill.department_id);
  if (skillDept && skillDept.name === role.department_name) {
    score += 1;
    skillReasons.push(`Skill 当前归属部门与「${role.department_name}」一致`);
  }

  const confidence = score >= 8 && skillReasons.length > 0 && orgReasons.length > 0
    ? "high"
    : score >= 4 && skillReasons.length > 0 && orgReasons.length > 0
      ? "medium"
      : "low";

  return {
    key: `${role.department_name}::${role.name}`,
    org_path: buildOrgPath(snapshot, role.department_name),
    department_name: role.department_name,
    position_name: role.name,
    position_level: inferPositionLevel(role.name),
    role_label: `${role.name}${inferPositionLevel(role.name) ? `（${inferPositionLevel(role.name)}）` : ""}`,
    confidence,
    score,
    reason_summary:
      confidence === "high"
        ? "Skill 内容与组织职责高度吻合"
        : confidence === "medium"
          ? "Skill 与组织语义存在交集，建议确认后使用"
          : "证据较弱，建议人工校正",
    skill_reasons: unique(skillReasons).slice(0, 3),
    org_memory_reasons: unique(orgReasons).slice(0, 3),
    matched_terms: unique(matchedTerms),
    fallback: false,
  } satisfies RoleRecommendationItem;
}

function buildFallbackRole(input: {
  user: User | null;
  departments: Department[];
  positions: PositionLite[];
}) {
  const { user, departments, positions } = input;
  const departmentName = departments.find((item) => item.id === user?.department_id)?.name || "编辑人部门";
  const positionName = positions.find((item) => item.id === user?.position_id)?.name || `${departmentName}角色`;
  const positionLevel = inferPositionLevel(positionName);

  return {
    key: `fallback::${departmentName}::${positionName}`,
    org_path: departmentName,
    department_name: departmentName,
    position_name: positionName,
    position_level: positionLevel,
    role_label: `${positionName}${positionLevel ? `（${positionLevel}）` : ""}`,
    confidence: "low",
    score: 1,
    reason_summary: "当前未形成高置信度角色交集，已降级到编辑人部门角色",
    skill_reasons: ["Skill 与 org memory 暂未形成稳定角色交集"],
    org_memory_reasons: ["默认降级推荐编辑人部门角色，等待人工确认"],
    matched_terms: [],
    fallback: true,
  } satisfies RoleRecommendationItem;
}

export function recommendRoleList(input: {
  skill: SkillDetail;
  assets: AssetLite[];
  snapshots: OrgMemorySnapshot[];
  departments: Department[];
  positions: PositionLite[];
  user: User | null;
}): RoleRecommendationResult {
  const { skill, assets, snapshots, departments, positions, user } = input;
  const { joined: skillText, matchedTerms } = buildSkillCorpus(skill, assets);

  const candidates = snapshots.flatMap((snapshot) =>
    snapshot.roles.map((role) =>
      scoreRoleCandidate({
        skillText,
        matchedSkillTerms: matchedTerms,
        snapshot,
        role,
        skill,
        departments,
      }),
    ),
  );

  const deduped = Array.from(
    candidates.reduce((acc, item) => {
      const current = acc.get(item.key);
      if (!current || current.score < item.score) {
        acc.set(item.key, item);
      }
      return acc;
    }, new Map<string, RoleRecommendationItem>()),
  ).map(([, item]) => item);

  const sorted = deduped
    .filter((item) => item.confidence !== "low")
    .sort((left, right) => right.score - left.score)
    .slice(0, 5);

  if (sorted.length === 0) {
    const fallback = buildFallbackRole({ user, departments, positions });
    return {
      mode: "fallback",
      overall_confidence: "low",
      summary: "未形成高置信度推荐，已降级到编辑人部门角色。",
      items: [fallback],
    };
  }

  const overall = sorted.some((item) => item.confidence === "high") ? "high" : "medium";

  return {
    mode: "recommended",
    overall_confidence: overall,
    summary: overall === "high"
      ? "已结合 Skill 与 org memory 生成高置信度推荐角色 list。"
      : "已生成推荐角色 list，建议确认后再生成权限 package。",
    items: sorted,
  };
}

export function recommendationToServiceRole(item: RoleRecommendationItem) {
  return {
    id: -Date.now(),
    org_path: item.org_path,
    position_name: item.position_name,
    position_level: item.position_level,
    role_label: item.role_label,
    status: "active",
  };
}

export function serviceRoleKey(role: {
  org_path: string;
  position_name: string;
  position_level?: string | null;
}) {
  return `${role.org_path}::${role.position_name}::${role.position_level || ""}`;
}
