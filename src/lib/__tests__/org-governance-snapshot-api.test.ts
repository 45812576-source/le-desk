import { beforeEach, describe, expect, it, vi } from "vitest";

const mockApiFetch = vi.fn();

vi.mock("@/lib/api", () => ({
  apiFetch: (...args: unknown[]) => mockApiFetch(...args),
  getToken: vi.fn(),
}));

describe("org-governance-snapshot api", () => {
  beforeEach(() => {
    mockApiFetch.mockReset();
  });

  it("maps frontend event payload to backend protocol and normalizes response", async () => {
    mockApiFetch.mockResolvedValue({
      id: 42,
      run_id: "run-42",
      status: "ready_for_review",
      missing_items: [{
        field: "sources",
        label: "来源资料",
        reason: "还缺少来源资料",
        suggested_input_type: "text",
      }],
    });

    const { createWorkspaceSnapshotEvent } = await import("@/lib/org-memory");
    const result = await createWorkspaceSnapshotEvent({
      event_type: "snapshot.append_sources",
      snapshot_id: 42,
      scope: "current_tab_only",
      tab_key: "role",
      source_ids: [1, 2],
      missing_item_answers: { owner: "Alice" },
    });

    expect(mockApiFetch).toHaveBeenCalledWith(
      "/org-memory/workspace-snapshot-events",
      expect.objectContaining({
        method: "POST",
      }),
    );

    const [, options] = mockApiFetch.mock.calls[0] as [string, { body: string }];
    expect(JSON.parse(options.body)).toEqual(expect.objectContaining({
      event_type: "snapshot.append_sources",
      workspace: {
        app: "le-desk",
        workspace_id: "org-management",
        workspace_type: "workspace",
      },
      snapshot: expect.objectContaining({
        scope: "active_tab",
        active_tab: "role",
        snapshot_id: 42,
      }),
      sources: {
        source_ids: [1, 2],
      },
      form: {
        owner: "Alice",
      },
    }));

    expect(result).toEqual(expect.objectContaining({
      run_id: "run-42",
      snapshot_id: 42,
      status: "ready_for_review",
    }));
    expect(result.missing_items?.[0]).toEqual(expect.objectContaining({
      field_key: "sources",
      input_type: "text",
      description: "还缺少来源资料",
    }));
  });

  it("normalizes snapshot list and run status from backend responses", async () => {
    mockApiFetch
      .mockResolvedValueOnce({
        items: [{
          id: 7,
          title: "组织治理快照",
          version: "gov-snapshot-2026-04-22-abcd1234",
          scope: "all",
          status: "ready_for_review",
          missing_count: 2,
          conflict_count: 1,
          created_at: "2026-04-22T01:00:00Z",
          updated_at: "2026-04-22T02:00:00Z",
        }],
      })
      .mockResolvedValueOnce({
        run_id: "run-7",
        status: "completed",
        response_summary: {
          status: "partial_sync",
          snapshot_id: 7,
        },
      });

    const { loadWorkspaceSnapshotRun, loadWorkspaceSnapshots } = await import("@/lib/org-memory");
    const snapshots = await loadWorkspaceSnapshots({ app: "le-desk" });
    const run = await loadWorkspaceSnapshotRun("run-7");

    expect(snapshots).toEqual([
      expect.objectContaining({
        id: 7,
        scope: "full",
        missing_count: 2,
        conflict_count: 1,
      }),
    ]);
    expect(run).toEqual(expect.objectContaining({
      run_id: "run-7",
      snapshot_id: 7,
      status: "partial_sync",
    }));
  });

  it("normalizes save-tab response into per-tab sync result", async () => {
    mockApiFetch.mockResolvedValue({
      id: 9,
      status: "partial_sync",
      scope: "all",
      markdown_by_tab: {
        organization: "---\nsnapshot_type: organization\n---",
      },
      structured_by_tab: {},
      governance_outputs: {},
      missing_items: [],
      conflicts: [],
      low_confidence_items: [],
      separation_of_duty_risks: [],
      change_summary: { added: [], changed: [], removed: [] },
      sync_status: {
        markdown_saved: true,
        structured_updated: false,
        failed_sections: [{ section: "facts", reason: "invalid markdown block" }],
        parser_warnings: ["Markdown 已保存，但结构化同步未覆盖旧数据。"],
      },
      created_at: "2026-04-22T01:00:00Z",
      updated_at: "2026-04-22T02:00:00Z",
    });

    const { saveWorkspaceSnapshotTabMarkdown } = await import("@/lib/org-memory");
    const result = await saveWorkspaceSnapshotTabMarkdown(9, "organization", "# Title");

    expect(result).toEqual(expect.objectContaining({
      tab_key: "organization",
      status: "partial_sync",
      synced_sections: [],
      failed_sections: [{ section: "facts", reason: "invalid markdown block" }],
      parser_warnings: ["Markdown 已保存，但结构化同步未覆盖旧数据。"],
    }));
    expect(result.detail).toEqual(expect.objectContaining({
      id: 9,
      status: "partial_sync",
    }));
  });

  it("loads workspace snapshot governance version from workspace endpoint", async () => {
    mockApiFetch.mockResolvedValue({
      id: 9,
      derived_from_snapshot_id: 9,
      derived_from_snapshot_version: "gov-snapshot-2026-04-22-abcd1234",
      version: 1,
      status: "draft",
      summary: "组织治理快照 的候选治理版本",
      impact_summary: "候选策略",
      knowledge_bases: ["组织治理快照"],
      data_tables: [],
      affected_skills: [{ skill_id: 0, skill_name: "组织治理候选策略" }],
      skill_access_rules: [{
        id: 1,
        skill_id: 0,
        skill_name: "组织治理候选策略",
        knowledge_bases: ["组织治理快照"],
        data_tables: [],
        access_scope: "department",
        redaction_mode: "summary",
        decision: "allow",
        rationale: "由工作台治理中间产物派生",
        required_domains: [],
      }],
      created_at: "2026-04-22T01:00:00Z",
      activated_at: null,
    });

    const { loadWorkspaceSnapshotGovernanceVersion } = await import("@/lib/org-memory");
    const result = await loadWorkspaceSnapshotGovernanceVersion(9);

    expect(mockApiFetch).toHaveBeenCalledWith("/org-memory/workspace-snapshots/9/governance-version");
    expect(result).toEqual(expect.objectContaining({
      fallback: false,
      data: expect.objectContaining({
        derived_from_snapshot_id: 9,
        status: "draft",
        skill_access_rules: [expect.objectContaining({ skill_name: "组织治理候选策略" })],
      }),
    }));
  });
});
