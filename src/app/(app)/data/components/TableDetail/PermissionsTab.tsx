"use client";

import React from "react";
import type { TableDetail } from "../shared/types";
import RoleGroupPanel from "./permissions/RoleGroupPanel";
import PermissionMatrix from "./permissions/PermissionMatrix";
import PermissionPreview from "./permissions/PermissionPreview";

interface Props {
  detail: TableDetail;
  onRefresh: () => void;
}

export default function PermissionsTab({ detail, onRefresh }: Props) {
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

  return (
    <div className="p-4 space-y-4">
      {/* 1. 角色组面板 */}
      <RoleGroupPanel
        tableId={detail.id}
        roleGroups={detail.role_groups || []}
        onRefresh={onRefresh}
      />

      {/* 2. 权限矩阵 */}
      <PermissionMatrix
        tableId={detail.id}
        roleGroups={detail.role_groups || []}
        policies={detail.permission_policies || []}
        views={detail.views || []}
        onRefresh={onRefresh}
      />

      {/* 3. 生效预览 */}
      <PermissionPreview detail={detail} />
    </div>
  );
}
