"use client";

import React, { useState } from "react";
import { PixelButton } from "@/components/pixel/PixelButton";
import { useAuth } from "@/lib/auth";
import { useV2DataAssets } from "../shared/feature-flags";
import type { TableDetail, TableDetailV2, TableCapabilities } from "../shared/types";
import RoleGroupPanel from "./permissions/RoleGroupPanel";
import PermissionMatrix from "./permissions/PermissionMatrix";
import PermissionPreview from "./permissions/PermissionPreview";
import PermissionResultCard from "./security/PermissionResultCard";
import AccessSimulator from "./security/AccessSimulator";
import PermissionWizard from "./security/PermissionWizard";
import SmallSampleProtection from "./security/SmallSampleProtection";
import PolicyVersionPanel from "./security/PolicyVersionPanel";
import InlineAuditPanel from "./security/InlineAuditPanel";

type PermissionMode = "wizard" | "expert";

interface Props {
  detail: TableDetail;
  onRefresh: () => void;
  capabilities?: TableCapabilities;
}

export default function PermissionsTab({ detail, onRefresh, capabilities }: Props) {
  const isV2 = useV2DataAssets();
  const { user } = useAuth();
  const isAdmin = user?.role === "super_admin" || user?.role === "dept_admin";
  const [mode, setMode] = useState<PermissionMode>("wizard");

  if (detail.field_profile_status === "pending" && detail.fields.length === 0) {
    return (
      <div className="p-4">
        <div className="flex items-center gap-2 px-3 py-2 bg-yellow-50 border border-yellow-200 text-[9px] text-yellow-700 font-bold mb-4">
          <span>⚠</span>
          <span>字段画像待分析，权限配置可能受限。同步完成后将自动分析字段信息。</span>
        </div>
      </div>
    );
  }

  // V1 模式：完整保留现有实现
  if (!isV2) {
    return (
      <div className="p-4 space-y-4">
        <RoleGroupPanel
          tableId={detail.id}
          roleGroups={detail.role_groups || []}
          onRefresh={onRefresh}
          canManage={capabilities?.can_manage_role_groups ?? false}
          published={detail.publish_status === "published"}
        />
        <PermissionMatrix
          tableId={detail.id}
          roleGroups={detail.role_groups || []}
          policies={detail.permission_policies || []}
          views={detail.views || []}
          onRefresh={onRefresh}
        />
        <PermissionPreview detail={detail} />
      </div>
    );
  }

  // V2 模式
  return (
    <div className="p-4 space-y-4">
      {/* 模式切换 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          <PixelButton
            size="sm"
            variant={mode === "wizard" ? "primary" : "secondary"}
            onClick={() => setMode("wizard")}
          >
            向导模式
          </PixelButton>
          {isAdmin && (
            <PixelButton
              size="sm"
              variant={mode === "expert" ? "primary" : "secondary"}
              onClick={() => setMode("expert")}
            >
              专家模式
            </PixelButton>
          )}
        </div>
        <span className="text-[8px] text-gray-400">
          {mode === "wizard" ? "引导式配置，适合常见场景" : "完整策略编辑，适合高级需求"}
        </span>
      </div>

      {/* 角色组面板（两种模式共用） */}
      <RoleGroupPanel
        tableId={detail.id}
        roleGroups={detail.role_groups || []}
        onRefresh={onRefresh}
        canManage={capabilities?.can_manage_role_groups ?? false}
        published={detail.publish_status === "published"}
      />

      {mode === "wizard" ? (
        <>
          {/* 向导模式 */}
          <PermissionWizard detail={detail} onSaved={onRefresh} />

          {/* 结果卡：每个角色组一张 */}
          {detail.role_groups.length > 0 && (
            <div>
              <div className="text-[9px] font-bold uppercase tracking-widest text-[#00A3C4] mb-2">权限结果概览</div>
              <div className="space-y-2">
                {detail.role_groups.map((rg) => {
                  const policy = detail.permission_policies.find(
                    (p) => p.role_group_id === rg.id && !p.view_id
                  ) || null;
                  return (
                    <PermissionResultCard key={rg.id} group={rg} policy={policy} detail={detail} />
                  );
                })}
              </div>
            </div>
          )}

          {/* 访问模拟器 */}
          <AccessSimulator detail={detail} />
        </>
      ) : (
        <>
          {/* 专家模式：现有组件 */}
          <PermissionMatrix
            tableId={detail.id}
            roleGroups={detail.role_groups || []}
            policies={detail.permission_policies || []}
            views={detail.views || []}
            onRefresh={onRefresh}
          />
          <PermissionPreview detail={detail} />
          {/* 专家模式也可用模拟器 */}
          <AccessSimulator detail={detail} />
        </>
      )}

      {/* V2: 策略版本历史 */}
      <PolicyVersionPanel policies={detail.permission_policies || []} onRefresh={onRefresh} />

      {/* V2: 小样本保护配置 */}
      <SmallSampleProtection detail={detail as TableDetailV2} onSaved={onRefresh} />

      {/* V2: 页内审计面板 */}
      <InlineAuditPanel tableId={detail.id} />
    </div>
  );
}
