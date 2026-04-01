// ─── Adapter/Normalizer 层 ────────────────────────────────────────────────────
// 旧接口缺字段 → 自动填默认值，不报错

import type {
  TableDetail,
  TableDetailV2,
  TableFieldDetail,
  TableFieldDetailV2,
  DataAssetTable,
  DataAssetTableV2,
  SensitivityLevel,
  SmallSampleProtectionConfig,
} from "./types";

const DEFAULT_SMALL_SAMPLE: SmallSampleProtectionConfig = {
  enabled: false,
  threshold: 5,
  fallback: "hide_bucket",
};

/** 推断敏感分级：is_sensitive → S2，否则 S0 */
function inferSensitivityLevel(isSensitive: boolean): SensitivityLevel {
  return isSensitive ? "S2_sensitive" : "S0_public";
}

/** 标准化单个字段为 V2 */
export function normalizeField(raw: TableFieldDetail): TableFieldDetailV2 {
  const v2 = raw as Partial<TableFieldDetailV2> & TableFieldDetail;
  return {
    ...raw,
    sensitivity_level: v2.sensitivity_level ?? inferSensitivityLevel(raw.is_sensitive),
    lifecycle_status: v2.lifecycle_status ?? "inferred",
  };
}

/** 标准化表详情为 V2 */
export function normalizeTableDetail(raw: TableDetail): TableDetailV2 {
  const v2 = raw as Partial<TableDetailV2> & TableDetail;
  return {
    ...raw,
    fields: raw.fields.map(normalizeField),
    risk_assessment: v2.risk_assessment ?? null,
    source_profile: v2.source_profile ?? null,
    small_sample_protection: v2.small_sample_protection ?? { ...DEFAULT_SMALL_SAMPLE },
  };
}

/** 标准化资产列表项为 V2 */
export function normalizeAssetTable(raw: DataAssetTable): DataAssetTableV2 {
  const v2 = raw as Partial<DataAssetTableV2> & DataAssetTable;
  return {
    ...raw,
    risk_level: v2.risk_level ?? null,
  };
}
