import type {
  Department,
  TableDetail,
  TableFieldDetail,
} from "@/app/(app)/data/components/shared/types";

export interface DataAssetSummaryResponse {
  summary: string;
  capability_summary: string;
  limitation_summary: string;
  related_departments: string[];
  suitable_skills: string[];
  suitable_skill_types: string[];
  use_cases: string[];
  generated_at: string;
}

interface ResolveOptions {
  tableId: number;
  backendUrl: string;
  authorization?: string | null;
}

const SOURCE_LABELS: Record<string, string> = {
  lark_bitable: "飞书多维表",
  bitable: "飞书多维表",
  mysql: "数据库表",
  imported: "导入数据表",
  blank: "手动表",
};

function uniqueStrings(values: Array<string | null | undefined>): string[] {
  return Array.from(new Set(values.map((value) => value?.trim()).filter((value): value is string => Boolean(value))));
}

function getNonSystemFields(detail: TableDetail): TableFieldDetail[] {
  return detail.fields.filter((field) => !field.is_system);
}

function getDimensionFields(detail: TableDetail): TableFieldDetail[] {
  return getNonSystemFields(detail).filter((field) => field.is_groupable || field.field_role_tags?.includes("dimension"));
}

function getMetricFields(detail: TableDetail): TableFieldDetail[] {
  return getNonSystemFields(detail).filter((field) => field.field_type === "number" || field.field_role_tags?.includes("metric"));
}

function getSensitiveFields(detail: TableDetail): TableFieldDetail[] {
  return getNonSystemFields(detail).filter((field) => field.is_sensitive || field.field_role_tags?.includes("sensitive"));
}

function getFieldLabels(fields: TableFieldDetail[], limit = 3): string {
  const names = fields
    .slice(0, limit)
    .map((field) => field.display_name || field.field_name)
    .filter(Boolean);
  return names.join("、");
}

export function collectRelatedDepartmentIds(detail: TableDetail): number[] {
  const ids = new Set<number>();

  if (detail.department_id) ids.add(detail.department_id);

  for (const roleGroup of detail.role_groups) {
    for (const departmentId of roleGroup.department_ids || []) {
      if (departmentId) ids.add(departmentId);
    }
  }

  for (const departmentId of detail.access_policy.access_department_ids || []) {
    if (departmentId) ids.add(departmentId);
  }
  for (const departmentId of detail.access_policy.row_department_ids || []) {
    if (departmentId) ids.add(departmentId);
  }
  for (const departmentId of detail.access_policy.column_department_ids || []) {
    if (departmentId) ids.add(departmentId);
  }

  return Array.from(ids);
}

export function resolveRelatedDepartmentNames(detail: TableDetail, departments: Department[]): string[] {
  if (departments.length === 0) return [];
  const deptMap = new Map(departments.map((department) => [department.id, department.name]));
  return collectRelatedDepartmentIds(detail)
    .map((id) => deptMap.get(id))
    .filter((name): name is string => Boolean(name));
}

function buildSummary(detail: TableDetail, departmentNames: string[]): string {
  const sourceLabel = SOURCE_LABELS[detail.source_type] || detail.source_type;
  const dimensionFields = getDimensionFields(detail);
  const metricFields = getMetricFields(detail);
  const base = detail.description?.trim()
    || `${detail.display_name} 是一张${sourceLabel}，当前沉淀了 ${detail.record_count ?? "未统计"} 行数据和 ${getNonSystemFields(detail).length} 个业务字段。`;

  const capabilityParts: string[] = [];
  if (dimensionFields.length > 0) capabilityParts.push(`可按 ${getFieldLabels(dimensionFields)} 做筛选或分组`);
  if (metricFields.length > 0) capabilityParts.push(`可围绕 ${getFieldLabels(metricFields)} 做统计分析`);
  if (departmentNames.length > 0) capabilityParts.push(`当前主要服务 ${departmentNames.join("、")}`);

  return capabilityParts.length > 0 ? `${base} ${capabilityParts.join("，")}。` : base;
}

function buildUseCases(detail: TableDetail): string[] {
  const metricFields = getMetricFields(detail);
  const dimensionFields = getDimensionFields(detail);
  const sensitiveFields = getSensitiveFields(detail);
  const useCases: string[] = [];

  if (metricFields.length > 0 && dimensionFields.length > 0) {
    useCases.push("经营分析", "复盘分析");
  }
  if (dimensionFields.some((field) => field.field_type === "person")) {
    useCases.push("负责人检索");
  }
  if (sensitiveFields.length > 0) {
    useCases.push("脱敏查询");
  }
  if (useCases.length === 0) {
    useCases.push("资料查询");
  }

  return uniqueStrings(useCases);
}

function buildSuitableSkills(detail: TableDetail): string[] {
  return uniqueStrings([
    ...detail.bindings.map((binding) => binding.skill_name),
    ...detail.skill_grants.map((grant) => grant.skill_name),
  ]);
}

function buildCapabilitySummary(detail: TableDetail): string {
  const actualSkills = buildSuitableSkills(detail);
  if (actualSkills.length > 0) {
    return `当前已被 ${actualSkills.join("、")} 使用，可继续作为这些 Skill 的数据资产输入。`;
  }

  const useCases = buildUseCases(detail);
  return `适合支撑 ${useCases.join("、")} 类 Skill，在 Skill 编辑阶段帮助判断字段覆盖和数据可用性。`;
}

function buildLimitationSummary(detail: TableDetail): string {
  const limits: string[] = [];

  if (detail.sync_status === "failed" || detail.sync_error) {
    limits.push("当前存在同步异常，样例和统计信息可能不是最新");
  }
  if (!detail.last_synced_at && detail.source_type !== "blank") {
    limits.push("尚未完成首次同步");
  }
  if (detail.record_count === 0) {
    limits.push("当前表为空，Skill 编辑人暂时无法验证数据覆盖");
  }
  if (detail.fields.length === 0) {
    limits.push("当前还没有解析出字段结构");
  }
  if (detail.views.length === 0) {
    limits.push("还没有可复用视图范围");
  }

  limits.push("具体用户运行时的权限、脱敏和审批统一在 SkillStudio 处理");
  return uniqueStrings(limits).join("；");
}

export function buildDataAssetSummary(detail: TableDetail, departments: Department[]): DataAssetSummaryResponse {
  const relatedDepartments = resolveRelatedDepartmentNames(detail, departments);
  const suitableSkills = buildSuitableSkills(detail);
  const useCases = buildUseCases(detail);

  return {
    summary: buildSummary(detail, relatedDepartments),
    capability_summary: buildCapabilitySummary(detail),
    limitation_summary: buildLimitationSummary(detail),
    related_departments: relatedDepartments,
    suitable_skills: suitableSkills,
    suitable_skill_types: useCases,
    use_cases: useCases,
    generated_at: new Date().toISOString(),
  };
}

async function fetchJson<T>(url: string, authorization?: string | null): Promise<T> {
  const response = await fetch(url, {
    headers: authorization ? { Authorization: authorization } : undefined,
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return response.json() as Promise<T>;
}

async function fetchTableDetail(tableId: number, backendUrl: string, authorization?: string | null): Promise<TableDetail> {
  return fetchJson<TableDetail>(`${backendUrl}/api/data-assets/tables/${tableId}`, authorization);
}

async function fetchDepartments(backendUrl: string, authorization?: string | null): Promise<Department[]> {
  const candidates = [
    `${backendUrl}/api/org-management/departments`,
    `${backendUrl}/api/admin/departments`,
  ];

  for (const url of candidates) {
    try {
      const data = await fetchJson<Department[] | { items: Department[] }>(url, authorization);
      if (Array.isArray(data)) return data;
      if (Array.isArray(data.items)) return data.items;
    } catch {
    }
  }

  return [];
}

export async function resolveDataAssetSummary({ tableId, backendUrl, authorization }: ResolveOptions): Promise<DataAssetSummaryResponse> {
  const [detail, departments] = await Promise.all([
    fetchTableDetail(tableId, backendUrl, authorization),
    fetchDepartments(backendUrl, authorization),
  ]);

  return buildDataAssetSummary(detail, departments);
}
