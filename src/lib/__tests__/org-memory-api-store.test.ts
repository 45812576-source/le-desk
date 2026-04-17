import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  readOrgMemoryState,
} from "@/lib/server/org-memory-db";
import {
  mergeLocalApprovals,
  resetOrgMemoryLocalState,
  resolveApprovalRequest,
  resolveOrgMemoryRequest,
} from "@/lib/org-memory-api-store";

describe("org-memory-api-store", () => {
  beforeEach(async () => {
    delete process.env.ORG_MEMORY_APPROVAL_MODE;
    delete process.env.ORG_MEMORY_APPROVAL_CREATE_PATH;
    delete process.env.ORG_MEMORY_APPROVAL_TIMEOUT_MS;
    await resetOrgMemoryLocalState();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("returns contract-shaped source and proposal lists", async () => {
    const sources = await resolveOrgMemoryRequest("GET", "/org-memory/sources");
    const proposals = await resolveOrgMemoryRequest("GET", "/org-memory/proposals");

    expect(sources?.status ?? 200).toBe(200);
    expect(proposals?.status ?? 200).toBe(200);
    expect(sources?.body).toMatchObject({
      items: expect.arrayContaining([
        expect.objectContaining({
          id: 101,
          source_type: "feishu_doc",
        }),
      ]),
    });
    expect(proposals?.body).toMatchObject({
      items: expect.arrayContaining([
        expect.objectContaining({
          id: 301,
          proposal_status: "draft",
        }),
      ]),
    });
  });

  it("ingests a source with request payload", async () => {
    const ingest = await resolveOrgMemoryRequest("POST", "/org-memory/sources/ingest", {
      title: "客户成功组织蓝图",
      source_type: "upload",
      source_uri: "upload://customer-success.docx",
      owner_name: "客户成功部",
    });

    expect(ingest?.body).toMatchObject({
      source_id: expect.any(Number),
      status: "processing",
    });

    const sources = await resolveOrgMemoryRequest("GET", "/org-memory/sources");
    expect(sources?.body).toMatchObject({
      items: expect.arrayContaining([
        expect.objectContaining({
          title: "客户成功组织蓝图",
          source_type: "upload",
          owner_name: "客户成功部",
        }),
      ]),
    });
  });

  it("creates snapshot and proposal from newly ingested data", async () => {
    const ingest = await resolveOrgMemoryRequest("POST", "/org-memory/sources/ingest", {
      title: "商务组织协作手册",
      source_type: "feishu_doc",
      source_uri: "https://example.feishu.cn/docx/biz",
    });
    const sourceId = (ingest?.body as { source_id: number }).source_id;

    const snapshot = await resolveOrgMemoryRequest("POST", `/org-memory/sources/${sourceId}/snapshots`);
    const snapshotId = (snapshot?.body as { snapshot_id: number }).snapshot_id;

    const proposal = await resolveOrgMemoryRequest("POST", `/org-memory/snapshots/${snapshotId}/proposals`);

    expect(snapshot?.body).toMatchObject({
      snapshot_id: expect.any(Number),
      status: "ready",
    });
    expect(proposal?.body).toMatchObject({
      proposal_id: expect.any(Number),
      status: "draft",
    });

    const proposals = await resolveOrgMemoryRequest("GET", "/org-memory/proposals");
    expect(proposals?.body).toMatchObject({
      items: expect.arrayContaining([
        expect.objectContaining({
          snapshot_id: snapshotId,
          proposal_status: "draft",
        }),
      ]),
    });
  });

  it("returns proposal detail by id", async () => {
    const proposal = await resolveOrgMemoryRequest("GET", "/org-memory/proposals/301");

    expect(proposal?.status ?? 200).toBe(200);
    expect(proposal?.body).toMatchObject({
      id: 301,
      title: expect.any(String),
      structure_changes: expect.any(Array),
      classification_rules: expect.any(Array),
    });
  });

  it("returns snapshot diff against previous version when available", async () => {
    const ingest = await resolveOrgMemoryRequest("POST", "/org-memory/sources/ingest", {
      title: "交付组织手册",
      source_type: "markdown",
      source_uri: "repo://docs/org-delivery.md",
    });
    const sourceId = (ingest?.body as { source_id: number }).source_id;
    await resolveOrgMemoryRequest("POST", `/org-memory/sources/${sourceId}/snapshots`);
    const secondSnapshot = await resolveOrgMemoryRequest("POST", `/org-memory/sources/${sourceId}/snapshots`);
    const snapshotId = (secondSnapshot?.body as { snapshot_id: number }).snapshot_id;

    const diff = await resolveOrgMemoryRequest("GET", `/org-memory/snapshots/${snapshotId}/diff`);

    expect(diff?.status ?? 200).toBe(200);
    expect(diff?.body).toMatchObject({
      snapshot_id: snapshotId,
      previous_snapshot_id: expect.any(Number),
      summary: expect.any(String),
      units: expect.objectContaining({
        added: expect.any(Array),
        removed: expect.any(Array),
      }),
    });
  });

  it("submits a proposal and exposes it in approval lists", async () => {
    const submit = await resolveOrgMemoryRequest("POST", "/org-memory/proposals/301/submit");

    expect(submit?.body).toMatchObject({
      proposal_id: 301,
      approval_request_id: 900301,
      status: "submitted",
    });

    const myApprovals = await resolveApprovalRequest(
      "GET",
      "/approvals/my",
      new URL("http://localhost/api/proxy/approvals/my"),
    );

    expect(myApprovals?.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 900301,
          request_type: "org_memory_proposal",
          target_id: 301,
          status: "pending",
        }),
      ]),
    );
  });

  it("creates a remote approval when stage 2 adapter is enabled", async () => {
    process.env.ORG_MEMORY_APPROVAL_MODE = "remote";
    process.env.ORG_MEMORY_APPROVAL_CREATE_PATH = "/api/approvals";

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          approval_request_id: 120031,
          status: "pending",
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const submit = await resolveOrgMemoryRequest(
      "POST",
      "/org-memory/proposals/301/submit",
      {},
      { authorization: "Bearer remote-token" },
    );

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:8000/api/approvals",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer remote-token",
        }),
      }),
    );
    expect(submit?.body).toMatchObject({
      proposal_id: 301,
      approval_request_id: 120031,
      status: "submitted",
    });

    const myApprovals = await resolveApprovalRequest(
      "GET",
      "/approvals/my",
      new URL("http://localhost/api/proxy/approvals/my"),
    );
    expect(myApprovals?.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 120031,
          request_type: "org_memory_proposal",
          target_detail: expect.objectContaining({
            title: expect.any(String),
            evidence_refs: expect.any(Array),
          }),
        }),
      ]),
    );
  });

  it("falls back to local shadow approval in hybrid mode when remote create fails", async () => {
    process.env.ORG_MEMORY_APPROVAL_MODE = "hybrid";
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));

    const submit = await resolveOrgMemoryRequest("POST", "/org-memory/proposals/301/submit");

    expect(submit?.body).toMatchObject({
      proposal_id: 301,
      approval_request_id: 900301,
      status: "submitted",
    });
  });

  it("marks proposal approved and writes effective config after approval", async () => {
    const submit = await resolveOrgMemoryRequest("POST", "/org-memory/proposals/301/submit");
    const approvalRequestId = (submit?.body as { approval_request_id: number }).approval_request_id;

    const action = await resolveApprovalRequest(
      "POST",
      `/approvals/${approvalRequestId}/actions`,
      new URL(`http://localhost/api/proxy/approvals/${approvalRequestId}/actions`),
      {
        action: "approve",
        comment: "证据充分，允许生效",
      },
    );
    const proposal = await resolveOrgMemoryRequest("GET", "/org-memory/proposals/301");

    expect(action?.body).toMatchObject({
      id: approvalRequestId,
      status: "approved",
    });
    expect(proposal?.body).toMatchObject({
      id: 301,
      proposal_status: "approved",
      applied_config: expect.objectContaining({
        proposal_id: 301,
        approval_request_id: approvalRequestId,
        status: "effective",
        knowledge_paths: expect.any(Array),
      }),
    });

    const state = await readOrgMemoryState();
    expect(state.formal_config_source).toMatchObject({
      active_proposal_id: 301,
      applied_config_id: 800301,
      knowledge_paths: expect.any(Array),
      classification_rules: expect.any(Array),
      skill_mounts: expect.any(Array),
    });
  });

  it("lists config versions after approval", async () => {
    const submit = await resolveOrgMemoryRequest("POST", "/org-memory/proposals/301/submit");
    const approvalRequestId = (submit?.body as { approval_request_id: number }).approval_request_id;

    await resolveApprovalRequest(
      "POST",
      `/approvals/${approvalRequestId}/actions`,
      new URL(`http://localhost/api/proxy/approvals/${approvalRequestId}/actions`),
      {
        action: "approve",
        comment: "允许生效",
      },
    );

    const versions = await resolveOrgMemoryRequest("GET", "/org-memory/proposals/301/config-versions");

    expect(versions?.body).toMatchObject({
      items: [
        expect.objectContaining({
          proposal_id: 301,
          version: 1,
          action: "apply",
          status: "effective",
        }),
      ],
    });
  });

  it("rolls back effective config and records rollback version", async () => {
    const submit = await resolveOrgMemoryRequest("POST", "/org-memory/proposals/301/submit");
    const approvalRequestId = (submit?.body as { approval_request_id: number }).approval_request_id;

    await resolveApprovalRequest(
      "POST",
      `/approvals/${approvalRequestId}/actions`,
      new URL(`http://localhost/api/proxy/approvals/${approvalRequestId}/actions`),
      {
        action: "approve",
        comment: "允许生效",
      },
    );

    const rollback = await resolveOrgMemoryRequest("POST", "/org-memory/proposals/301/rollback");
    const proposal = await resolveOrgMemoryRequest("GET", "/org-memory/proposals/301");
    const versions = await resolveOrgMemoryRequest("GET", "/org-memory/proposals/301/config-versions");

    expect(rollback?.body).toMatchObject({
      proposal_id: 301,
      status: "rolled_back",
      rolled_back_config_id: 800301,
    });
    expect(proposal?.body).toMatchObject({
      id: 301,
      applied_config: null,
    });
    expect(versions?.body).toMatchObject({
      items: [
        expect.objectContaining({
          version: 2,
          action: "rollback",
        }),
        expect.objectContaining({
          version: 1,
          action: "apply",
        }),
      ],
    });

    const state = await readOrgMemoryState();
    expect(state.formal_config_source).toBeNull();
  });

  it("restores previous formal config snapshot when rolling back newer proposal", async () => {
    const submit301 = await resolveOrgMemoryRequest("POST", "/org-memory/proposals/301/submit");
    const approval301 = (submit301?.body as { approval_request_id: number }).approval_request_id;
    await resolveApprovalRequest(
      "POST",
      `/approvals/${approval301}/actions`,
      new URL(`http://localhost/api/proxy/approvals/${approval301}/actions`),
      {
        action: "approve",
        comment: "允许 301 生效",
      },
    );

    const submit302 = await resolveOrgMemoryRequest("POST", "/org-memory/proposals/302/submit");
    const approval302 = (submit302?.body as { approval_request_id: number }).approval_request_id;
    await resolveApprovalRequest(
      "POST",
      `/approvals/${approval302}/actions`,
      new URL(`http://localhost/api/proxy/approvals/${approval302}/actions`),
      {
        action: "approve",
        comment: "允许 302 生效",
      },
    );

    let state = await readOrgMemoryState();
    expect(state.formal_config_source).toMatchObject({
      active_proposal_id: 302,
      applied_config_id: 800302,
    });

    await resolveOrgMemoryRequest("POST", "/org-memory/proposals/302/rollback");

    state = await readOrgMemoryState();
    expect(state.formal_config_source).toMatchObject({
      active_proposal_id: 301,
      applied_config_id: 800301,
    });
  });

  it("marks proposal partially approved when approved with conditions", async () => {
    const submit = await resolveOrgMemoryRequest("POST", "/org-memory/proposals/301/submit");
    const approvalRequestId = (submit?.body as { approval_request_id: number }).approval_request_id;

    await resolveApprovalRequest(
      "POST",
      `/approvals/${approvalRequestId}/actions`,
      new URL(`http://localhost/api/proxy/approvals/${approvalRequestId}/actions`),
      {
        action: "approve_with_conditions",
        comment: "允许先按部门范围生效",
        conditions: [{ type: "scope_limit", label: "仅限部门", value: "department" }],
      },
    );
    const proposal = await resolveOrgMemoryRequest("GET", "/org-memory/proposals/301");

    expect(proposal?.body).toMatchObject({
      id: 301,
      proposal_status: "partially_approved",
      applied_config: expect.objectContaining({
        status: "effective_with_conditions",
        conditions: expect.arrayContaining([
          expect.objectContaining({ label: "仅限部门" }),
        ]),
      }),
    });
  });

  it("syncs approval target_detail with effective config history", async () => {
    const submit = await resolveOrgMemoryRequest("POST", "/org-memory/proposals/301/submit");
    const approvalRequestId = (submit?.body as { approval_request_id: number }).approval_request_id;

    await resolveApprovalRequest(
      "POST",
      `/approvals/${approvalRequestId}/actions`,
      new URL(`http://localhost/api/proxy/approvals/${approvalRequestId}/actions`),
      {
        action: "approve",
        comment: "允许生效",
      },
    );

    const myApprovals = await resolveApprovalRequest(
      "GET",
      "/approvals/my",
      new URL("http://localhost/api/proxy/approvals/my"),
    );
    const target = (myApprovals?.body as Array<{ id: number; target_detail: Record<string, unknown> }>).find(
      (item) => item.id === approvalRequestId,
    );

    expect(target?.target_detail).toMatchObject({
      applied_config: expect.objectContaining({
        proposal_id: 301,
        status: "effective",
      }),
      config_versions: expect.arrayContaining([
        expect.objectContaining({
          version: 1,
          action: "apply",
        }),
      ]),
    });
  });

  it("merges local approvals into admin approval payloads", async () => {
    await resolveOrgMemoryRequest("POST", "/org-memory/proposals/301/submit");

    const merged = await mergeLocalApprovals(
      "/approvals",
      new URL("http://localhost/api/proxy/approvals?page=1&page_size=20"),
      {
        total: 1,
        page: 1,
        page_size: 20,
        items: [
          {
            id: 12,
            request_type: "skill_publish",
          },
        ],
      },
    ) as { total: number; items: Array<{ id: number }> };

    expect(merged.total).toBe(2);
    expect(merged.items.map((item) => item.id)).toEqual([900301, 12]);
  });
});
