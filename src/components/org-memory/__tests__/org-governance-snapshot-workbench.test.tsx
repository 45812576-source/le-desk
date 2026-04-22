import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type {
  WorkspaceSnapshotDetail,
  WorkspaceSnapshotEventResult,
  WorkspaceSnapshotSummary,
} from "@/lib/types";
import OrgGovernanceSnapshotWorkbench from "../OrgGovernanceSnapshotWorkbench";
import * as orgMemoryApi from "@/lib/org-memory";

vi.mock("@/lib/org-memory", async () => {
  const actual = await vi.importActual<typeof import("@/lib/org-memory")>("@/lib/org-memory");
  return {
    ...actual,
    createWorkspaceSnapshotEvent: vi.fn(),
    loadWorkspaceSnapshotDetail: vi.fn(),
    loadWorkspaceSnapshotRun: vi.fn(),
    loadWorkspaceSnapshots: vi.fn(),
    loadOrgMemorySources: vi.fn(),
  };
});

const mockedLoadWorkspaceSnapshots = vi.mocked(orgMemoryApi.loadWorkspaceSnapshots);
const mockedLoadWorkspaceSnapshotDetail = vi.mocked(orgMemoryApi.loadWorkspaceSnapshotDetail);
const mockedCreateWorkspaceSnapshotEvent = vi.mocked(orgMemoryApi.createWorkspaceSnapshotEvent);
const mockedLoadOrgMemorySources = vi.mocked(orgMemoryApi.loadOrgMemorySources);
const mockedLoadWorkspaceSnapshotRun = vi.mocked(orgMemoryApi.loadWorkspaceSnapshotRun);

const baseSummary: WorkspaceSnapshotSummary = {
  id: 101,
  title: "组织治理快照",
  version: "gov-snapshot-2026-04-22-a1b2c3d4",
  scope: "full",
  status: "ready_for_review",
  missing_count: 0,
  conflict_count: 0,
  created_at: "2026-04-22T01:00:00Z",
  updated_at: "2026-04-22T02:00:00Z",
};

function makeDetail(overrides: Partial<WorkspaceSnapshotDetail> = {}): WorkspaceSnapshotDetail {
  return {
    id: 101,
    title: "组织治理快照",
    version: "gov-snapshot-2026-04-22-a1b2c3d4",
    scope: "full",
    status: "ready_for_review",
    created_at: "2026-04-22T01:00:00Z",
    updated_at: "2026-04-22T02:00:00Z",
    markdown_by_tab: {
      organization: "# 组织",
    },
    structured_by_tab: {
      organization: { title: "组织" },
    },
    governance_outputs: {},
    missing_items: [],
    conflicts: [],
    low_confidence_items: [],
    separation_of_duty_risks: [],
    change_summary: { added: [], changed: [], removed: [] },
    sync_status: {
      markdown_saved: true,
      structured_updated: true,
      failed_sections: [],
      parser_warnings: [],
    },
    ...overrides,
  };
}

describe("OrgGovernanceSnapshotWorkbench", () => {
  beforeEach(() => {
    mockedLoadWorkspaceSnapshots.mockReset();
    mockedLoadWorkspaceSnapshotDetail.mockReset();
    mockedCreateWorkspaceSnapshotEvent.mockReset();
    mockedLoadOrgMemorySources.mockReset();
    mockedLoadWorkspaceSnapshotRun.mockReset();

    mockedLoadWorkspaceSnapshots.mockResolvedValue([baseSummary]);
    mockedLoadWorkspaceSnapshotDetail.mockResolvedValue(makeDetail());
    mockedLoadOrgMemorySources.mockResolvedValue({
      data: [{
        id: 1,
        title: "部门台账",
        source_type: "markdown",
        source_uri: "memory://dept",
        owner_name: "组织治理",
        external_version: null,
        fetched_at: null,
        ingest_status: "ready",
        latest_snapshot_version: null,
        latest_parse_note: null,
      }],
      fallback: false,
    });
    mockedLoadWorkspaceSnapshotRun.mockResolvedValue({
      run_id: "unused",
      snapshot_id: null,
      status: "idle",
    });
  });

  it("keeps the drawer open and shows missing-items form when backend returns needs_input", async () => {
    const needsInputDetail = makeDetail({
      id: 202,
      missing_items: [{
        id: "owner",
        field_key: "owner",
        label: "负责人",
        description: "需要补充负责人信息",
        input_type: "text",
        required: true,
      }],
    });
    mockedLoadWorkspaceSnapshotDetail.mockReset();
    mockedLoadWorkspaceSnapshotDetail
      .mockResolvedValueOnce(makeDetail())
      .mockResolvedValue(needsInputDetail);

    mockedCreateWorkspaceSnapshotEvent.mockResolvedValue({
      run_id: "run-202",
      snapshot_id: 202,
      status: "needs_input",
    } as WorkspaceSnapshotEventResult);

    render(<OrgGovernanceSnapshotWorkbench />);

    await waitFor(() => expect(screen.getByRole("button", { name: "更新快照" })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "更新快照" }));

    await waitFor(() => expect(screen.getByText("选择参与生成的资料")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "开始生成" }));

    await waitFor(() => expect(mockedCreateWorkspaceSnapshotEvent).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByText("补充信息")).toBeInTheDocument());
    expect(screen.getAllByText("需要补充负责人信息").length).toBeGreaterThan(0);
  });

  it("submits append action with append_sources event type", async () => {
    mockedCreateWorkspaceSnapshotEvent.mockResolvedValue({
      run_id: "run-append",
      snapshot_id: 101,
      status: "ready_for_review",
    } as WorkspaceSnapshotEventResult);
    mockedLoadWorkspaceSnapshotDetail
      .mockResolvedValueOnce(makeDetail())
      .mockResolvedValueOnce(makeDetail());

    render(<OrgGovernanceSnapshotWorkbench />);

    await waitFor(() => expect(screen.getByRole("button", { name: "追加资料" })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "追加资料" }));

    await waitFor(() => expect(screen.getByText("选择要追加的资料")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "追加并更新" }));

    await waitFor(() => {
      expect(mockedCreateWorkspaceSnapshotEvent).toHaveBeenCalledWith(expect.objectContaining({
        event_type: "snapshot.append_sources",
        snapshot_id: 101,
        source_ids: [1],
      }));
    });
  });

  it("reports the workspace snapshot id to downstream governance panels", async () => {
    const onSelectedSnapshotChange = vi.fn();
    mockedLoadWorkspaceSnapshotDetail.mockResolvedValue(makeDetail({
      id: 101,
      source_snapshot_id: 1,
    }));

    render(<OrgGovernanceSnapshotWorkbench onSelectedSnapshotChange={onSelectedSnapshotChange} />);

    await waitFor(() => expect(onSelectedSnapshotChange).toHaveBeenCalledWith(101));
    expect(onSelectedSnapshotChange).not.toHaveBeenCalledWith(1);
  });
});
