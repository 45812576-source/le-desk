import { describe, expect, it } from "vitest";
import { canUserManageDraftTable, getTableCapabilities, isPublishedTable } from "../types";

describe("table capability helpers", () => {
  it("allows owner to manage unpublished imported tables", () => {
    const table = { source_type: "imported", owner_id: 7, publish_status: "draft" };
    const user = { id: 7, role: "employee" as const };

    expect(canUserManageDraftTable(table, user)).toBe(true);

    const capabilities = getTableCapabilities(table, user);
    expect(capabilities.can_edit_schema).toBe(true);
    expect(capabilities.can_manage_views).toBe(true);
    expect(capabilities.can_delete_table).toBe(true);
    expect(capabilities.can_manage_bindings).toBe(false);
  });

  it("requires publish before skill binding", () => {
    const table = { source_type: "imported", owner_id: 7, publish_status: "draft" };
    const user = { id: 7, role: "employee" as const };

    expect(getTableCapabilities(table, user).can_manage_bindings).toBe(false);
    expect(getTableCapabilities({ ...table, publish_status: "published" }, user).can_manage_bindings).toBe(true);
  });

  it("blocks deleting published local tables", () => {
    const table = { source_type: "blank", owner_id: 7, publish_status: "published" };
    const user = { id: 7, role: "employee" as const };

    expect(isPublishedTable(table)).toBe(true);

    const capabilities = getTableCapabilities(table, user);
    expect(capabilities.can_delete_table).toBe(false);
    expect(capabilities.can_edit_schema).toBe(false);
    expect(capabilities.can_manage_publish).toBe(true);
  });

  it("lets admins manage published tables", () => {
    const table = { source_type: "imported", owner_id: 7, publish_status: "published" };
    const user = { id: 99, role: "super_admin" as const };

    const capabilities = getTableCapabilities(table, user);
    expect(capabilities.can_edit_rows).toBe(true);
    expect(capabilities.can_manage_views).toBe(true);
    expect(capabilities.can_manage_role_groups).toBe(true);
    expect(capabilities.can_manage_bindings).toBe(true);
  });
});
