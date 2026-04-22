import {
  backendGet,
  backendPost,
  expect,
  installAuthState,
  readSseResponse,
  test,
} from "./harness-engineering.fixtures";

test.describe("Skill Studio Harness Engineering E2E/Chaos", () => {
  test.beforeEach(async ({ runtime }) => {
    test.skip(!runtime.enabled, "Set HARNESS_ENGINEERING_E2E=1 to run live Harness Engineering Playwright gates");
  });

  test("renders Skill Studio and recovers queue state after refresh", async ({ page, request, runtime }) => {
    await installAuthState(page, runtime);
    const session = await backendGet(request, runtime, `/api/skills/${runtime.skillId}/studio/session`);
    const queue = session.queue_window ?? session.card_queue_window;
    expect(queue, "studio/session must expose queue_window/card_queue_window").toBeTruthy();

    await page.goto(`/chat/${runtime.conversationId}?ws=skill_studio&skill_id=${runtime.skillId}`);
    await expect(page.locator("body")).toContainText(/Skill|Studio|治理|卡片|发送/, { timeout: 20_000 });

    await page.reload();
    await expect(page.locator("body")).toContainText(/Skill|Studio|治理|卡片|发送/, { timeout: 20_000 });
    await page.screenshot({
      path: `test-results/harness-engineering/queue-recovery-${runtime.conversationId}.png`,
      fullPage: true,
    });
  });

  test("streams a run through the frontend proxy and replays through backend after_sequence", async ({ page, request, runtime }) => {
    await installAuthState(page, runtime);
    await page.goto(`/chat/${runtime.conversationId}?ws=skill_studio&skill_id=${runtime.skillId}`);

    const stream = await page.evaluate(
      async ({ conversationId, skillId }) => {
        const token = window.localStorage.getItem("token");
        const response = await fetch(`/api/proxy/conversations/${conversationId}/messages/stream`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
          body: JSON.stringify({
            content: "Harness Engineering Playwright gate: emit queue, patch, and first useful response.",
            selected_skill_id: skillId,
            editor_is_dirty: false,
          }),
        });
        const runId = response.headers.get("X-Studio-Run-Id");
        const text = await response.text();
        return { ok: response.ok, status: response.status, runId, text };
      },
      { conversationId: runtime.conversationId, skillId: runtime.skillId },
    );

    expect(stream.ok, `stream failed with ${stream.status}`).toBeTruthy();
    expect(stream.runId, "frontend proxy must preserve X-Studio-Run-Id").toBeTruthy();
    const liveEvents = stream.text.match(/^event:/gm) ?? [];
    expect(liveEvents.length, "frontend proxy stream should carry SSE events").toBeGreaterThan(0);

    const replayResponse = await request.get(`${runtime.backendURL}/api/conversations/${runtime.conversationId}/studio-runs/${stream.runId}/events?after=0`, {
      headers: { Authorization: `Bearer ${runtime.token}` },
    });
    expect(replayResponse.ok()).toBeTruthy();
    const replayEvents = await readSseResponse(replayResponse);
    expect(replayEvents.some((event) => event.event === "patch_applied")).toBeTruthy();

    const patch = replayEvents.find((event) => event.event === "patch_applied")?.data;
    expect(patch?.run_id).toBe(stream.runId);
    expect(patch?.payload).toBeTruthy();
  });

  test("external tool handoff and bind-back stay API-backed", async ({ request, runtime }) => {
    await backendPost(request, runtime, `/api/skills/${runtime.skillId}/studio/session/init`, {
      session_mode: "optimize",
    });
    const cardResponse = await backendPost(request, runtime, `/api/skills/${runtime.skillId}/studio/cards`, {
      card_type: "governance",
      title: "Playwright Harness Tool Handoff",
      summary: "Tool work must leave through a structured handoff and return through bind-back.",
      phase: "phase_2_what",
      priority: "high",
      target_file: "tools/playwright_harness_fixture.py",
      origin: "harness_engineering_playwright",
      activate: true,
    });
    const card = await cardResponse.json();
    expect(card.ok).toBeTruthy();
    const cardId = String(card.card_id ?? card.id ?? "");
    expect(cardId).toBeTruthy();

    const handoffResponse = await backendPost(request, runtime, `/api/skills/${runtime.skillId}/studio/cards/${cardId}/handoff`, {
      target_role: "tool",
      target_file: "tools/playwright_harness_fixture.py",
      handoff_policy: "open_development_studio",
      route_kind: "external",
      destination: "dev_studio",
      return_to: "bind_back",
      summary: "Playwright Harness external implementation package.",
      acceptance_criteria: ["handoff request persisted", "bind-back enters confirm or validate"],
      activate_target: true,
    });
    const handoff = await handoffResponse.json();
    expect(handoff.ok).toBeTruthy();
    expect(handoff.derived_card_id).toBeTruthy();

    const bindResponse = await backendPost(
      request,
      runtime,
      `/api/skills/${runtime.skillId}/studio/cards/${handoff.derived_card_id}/bind-back`,
      {
        source: "harness_engineering_playwright",
        summary: "External implementation completed and returned with evidence.",
        required_checks: ["contract", "validation"],
      },
    );
    const bindBack = await bindResponse.json();
    expect(bindBack.ok).toBeTruthy();
  });

  test("late old-run replay keeps its own public_run_id", async ({ page, request, runtime }) => {
    await installAuthState(page, runtime);
    await page.goto(`/chat/${runtime.conversationId}?ws=skill_studio&skill_id=${runtime.skillId}`);

    const firstRun = await page.evaluate(
      async ({ conversationId, skillId }) => {
        const token = window.localStorage.getItem("token");
        const response = await fetch(`/api/proxy/conversations/${conversationId}/messages/stream`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
          body: JSON.stringify({
            content: "Harness Engineering old run: produce replayable patches.",
            selected_skill_id: skillId,
          }),
        });
        await response.text();
        return response.headers.get("X-Studio-Run-Id");
      },
      { conversationId: runtime.conversationId, skillId: runtime.skillId },
    );
    const secondRun = await page.evaluate(
      async ({ conversationId, skillId }) => {
        const token = window.localStorage.getItem("token");
        const response = await fetch(`/api/proxy/conversations/${conversationId}/messages/stream`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
          body: JSON.stringify({
            content: "Harness Engineering new run: must not be polluted by old replay.",
            selected_skill_id: skillId,
          }),
        });
        await response.text();
        return response.headers.get("X-Studio-Run-Id");
      },
      { conversationId: runtime.conversationId, skillId: runtime.skillId },
    );
    expect(firstRun).toBeTruthy();
    expect(secondRun).toBeTruthy();
    expect(firstRun).not.toBe(secondRun);

    const oldReplay = await request.get(`${runtime.backendURL}/api/conversations/${runtime.conversationId}/studio-runs/${firstRun}/events?after=0`, {
      headers: { Authorization: `Bearer ${runtime.token}` },
    });
    expect(oldReplay.ok()).toBeTruthy();
    const oldEvents = await readSseResponse(oldReplay);
    const oldPatches = oldEvents.filter((event) => event.event === "patch_applied");
    expect(oldPatches.length).toBeGreaterThan(0);
    for (const patch of oldPatches) {
      expect(patch.data.run_id).toBe(firstRun);
      expect((patch.data.payload as { run_id?: string } | undefined)?.run_id).toBe(firstRun);
    }
  });
});
