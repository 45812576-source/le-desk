import { describe, expect, it } from "vitest";
import {
  FOCUS_RANK,
  getWorkbenchCardFocusRank,
  resolveFocusedWorkbenchCardId,
  isActionableWorkbenchCard,
  isPendingFileConfirmationCard,
  type WorkbenchCard,
} from "../workbench-types";

function makeCard(overrides: Partial<WorkbenchCard> & { id: string }): WorkbenchCard {
  return {
    title: overrides.id,
    summary: "",
    status: "pending",
    kind: "create",
    mode: "analysis",
    phase: "discover",
    source: "runtime",
    priority: 100,
    target: { type: null, key: null },
    ...overrides,
  };
}

// ─── isActionableWorkbenchCard ────────────────────────────────────────────────

describe("isActionableWorkbenchCard", () => {
  it.each(["pending", "active", "reviewing"] as const)("returns true for %s", (status) => {
    expect(isActionableWorkbenchCard(makeCard({ id: "a", status }))).toBe(true);
  });

  it.each(["adopted", "rejected", "dismissed", "stale"] as const)("returns false for %s", (status) => {
    expect(isActionableWorkbenchCard(makeCard({ id: "a", status }))).toBe(false);
  });
});

// ─── isPendingFileConfirmationCard ───────────────────────────────────────────

describe("isPendingFileConfirmationCard", () => {
  it("returns true for card with stagedEditId", () => {
    expect(isPendingFileConfirmationCard(makeCard({ id: "x", stagedEditId: "se-1" }))).toBe(true);
  });

  it("returns true for refine:draft-ready", () => {
    expect(isPendingFileConfirmationCard(makeCard({ id: "refine:draft-ready" }))).toBe(true);
  });

  it("returns true for refine:file-split", () => {
    expect(isPendingFileConfirmationCard(makeCard({ id: "refine:file-split" }))).toBe(true);
  });

  it("returns true for source=pending_draft", () => {
    expect(isPendingFileConfirmationCard(makeCard({ id: "x", source: "pending_draft" }))).toBe(true);
  });

  it("returns false for non-actionable card even with stagedEditId", () => {
    expect(isPendingFileConfirmationCard(makeCard({ id: "x", status: "adopted", stagedEditId: "se-1" }))).toBe(false);
  });

  it("returns false for normal actionable card", () => {
    expect(isPendingFileConfirmationCard(makeCard({ id: "x" }))).toBe(false);
  });
});

// ─── getWorkbenchCardFocusRank ───────────────────────────────────────────────

describe("getWorkbenchCardFocusRank", () => {
  it("returns 0 for non-actionable cards", () => {
    expect(getWorkbenchCardFocusRank(makeCard({ id: "a", status: "adopted" }))).toBe(0);
    expect(getWorkbenchCardFocusRank(makeCard({ id: "a", status: "rejected" }))).toBe(0);
    expect(getWorkbenchCardFocusRank(makeCard({ id: "a", status: "stale" }))).toBe(0);
  });

  it("external returned_waiting_bindback > pending file confirmation", () => {
    const bindback = getWorkbenchCardFocusRank(
      makeCard({ id: "a", externalBuildStatus: "returned_waiting_bindback" }),
    );
    const confirm = getWorkbenchCardFocusRank(
      makeCard({ id: "refine:draft-ready" }),
    );
    expect(bindback).toBeGreaterThan(confirm);
  });

  it("external returned_waiting_validation > fixing:current", () => {
    const extVal = getWorkbenchCardFocusRank(
      makeCard({ id: "a", externalBuildStatus: "returned_waiting_validation" }),
    );
    const fixCurrent = getWorkbenchCardFocusRank(
      makeCard({ id: "fixing:current:1", kind: "fixing" }),
    );
    expect(extVal).toBeGreaterThan(fixCurrent);
  });

  it("pending file confirmation > fixing:current", () => {
    const confirm = getWorkbenchCardFocusRank(makeCard({ id: "refine:draft-ready" }));
    const fixCurrent = getWorkbenchCardFocusRank(makeCard({ id: "fixing:current:1", kind: "fixing" }));
    expect(confirm).toBeGreaterThan(fixCurrent);
  });

  it("fixing:current > fixing:overview > fixing generic", () => {
    const current = getWorkbenchCardFocusRank(makeCard({ id: "fixing:current:1", kind: "fixing" }));
    const overview = getWorkbenchCardFocusRank(makeCard({ id: "fixing:overview", kind: "fixing" }));
    const generic = getWorkbenchCardFocusRank(makeCard({ id: "fixing:task:1", kind: "fixing" }));
    expect(current).toBeGreaterThan(overview);
    expect(overview).toBeGreaterThan(generic);
  });

  it("governance mode > testing:test-ready > validation kind", () => {
    const govMode = getWorkbenchCardFocusRank(makeCard({ id: "g1", kind: "governance", mode: "governance" }));
    const testReady = getWorkbenchCardFocusRank(makeCard({ id: "testing:test-ready", kind: "validation" }));
    const valKind = getWorkbenchCardFocusRank(makeCard({ id: "v1", kind: "validation" }));
    expect(govMode).toBeGreaterThan(testReady);
    expect(testReady).toBeGreaterThan(valKind);
  });

  it("create:architect active > create:architect pending", () => {
    const active = getWorkbenchCardFocusRank(
      makeCard({ id: "create:architect:mece", kind: "create", status: "active" }),
    );
    const pending = getWorkbenchCardFocusRank(
      makeCard({ id: "create:architect:mece", kind: "create", status: "pending" }),
    );
    expect(active).toBeGreaterThan(pending);
  });

  it("create kind > refine kind > release kind > architect kind", () => {
    const create = getWorkbenchCardFocusRank(makeCard({ id: "c1", kind: "create" }));
    const refine = getWorkbenchCardFocusRank(makeCard({ id: "r1", kind: "refine" }));
    const release = getWorkbenchCardFocusRank(makeCard({ id: "rel1", kind: "release" }));
    const architect = getWorkbenchCardFocusRank(makeCard({ id: "a1", kind: "architect" }));
    expect(create).toBeGreaterThan(refine);
    expect(refine).toBeGreaterThan(release);
    expect(release).toBeGreaterThan(architect);
  });

  it("release:test-passed > generic release", () => {
    const testPassed = getWorkbenchCardFocusRank(makeCard({ id: "release:test-passed", kind: "release" }));
    const generic = getWorkbenchCardFocusRank(makeCard({ id: "release:other", kind: "release" }));
    expect(testPassed).toBeGreaterThan(generic);
  });

  it("selection source gets lowest actionable rank", () => {
    const selection = getWorkbenchCardFocusRank(makeCard({ id: "sel", kind: "system", source: "selection" }));
    expect(selection).toBe(10);
  });

  it("FOCUS_RANK constants are used by getWorkbenchCardFocusRank", () => {
    expect(getWorkbenchCardFocusRank(makeCard({ id: "a", status: "adopted" }))).toBe(FOCUS_RANK.INACTIVE);
    expect(getWorkbenchCardFocusRank(makeCard({ id: "refine:draft-ready" }))).toBe(FOCUS_RANK.PENDING_FILE_CONFIRMATION);
    expect(getWorkbenchCardFocusRank(makeCard({ id: "r1", kind: "refine" }))).toBe(FOCUS_RANK.REFINE);
  });

  it("create:summary-ready ranks below governance kind (no collision)", () => {
    const govKind = getWorkbenchCardFocusRank(makeCard({ id: "gk1", kind: "governance", mode: "analysis" }));
    const summaryReady = getWorkbenchCardFocusRank(makeCard({ id: "create:summary-ready", kind: "create" }));
    expect(govKind).toBeGreaterThan(summaryReady);
  });

  it("full ordering is monotonically decreasing across tiers", () => {
    const cards = [
      makeCard({ id: "a", externalBuildStatus: "returned_waiting_bindback" }),
      makeCard({ id: "refine:draft-ready" }),
      makeCard({ id: "b", externalBuildStatus: "returned_waiting_validation" }),
      makeCard({ id: "fixing:current:1", kind: "fixing" }),
      makeCard({ id: "fixing:overview", kind: "fixing" }),
      makeCard({ id: "fixing:task:1", kind: "fixing" }),
      makeCard({ id: "g1", kind: "governance", mode: "governance" }),
      makeCard({ id: "testing:test-ready", kind: "validation" }),
      makeCard({ id: "v1", kind: "validation" }),
      makeCard({ id: "gk1", kind: "governance", mode: "analysis" }),
      makeCard({ id: "create:summary-ready", kind: "create" }),
      makeCard({ id: "create:architect:mece", kind: "create", status: "active" }),
      makeCard({ id: "c1", kind: "create" }),
      makeCard({ id: "r1", kind: "refine" }),
      makeCard({ id: "release:test-passed", kind: "release" }),
      makeCard({ id: "rel1", kind: "release" }),
      makeCard({ id: "a1", kind: "architect" }),
    ];
    const ranks = cards.map((c) => getWorkbenchCardFocusRank(c));
    for (let i = 1; i < ranks.length; i++) {
      expect(ranks[i]).toBeLessThanOrEqual(ranks[i - 1]);
    }
  });
});

// ─── resolveFocusedWorkbenchCardId ───────────────────────────────────────────

describe("resolveFocusedWorkbenchCardId", () => {
  it("returns null for empty array", () => {
    expect(resolveFocusedWorkbenchCardId([])).toBeNull();
  });

  it("returns the highest-rank card", () => {
    const cards = [
      makeCard({ id: "c1", kind: "create" }),
      makeCard({ id: "refine:draft-ready" }),
    ];
    expect(resolveFocusedWorkbenchCardId(cards)).toBe("refine:draft-ready");
  });

  it("prefers preferredActiveId when same rank as best", () => {
    const cards = [
      makeCard({ id: "c1", kind: "create", priority: 100 }),
      makeCard({ id: "c2", kind: "create", priority: 100 }),
    ];
    expect(resolveFocusedWorkbenchCardId(cards, "c2")).toBe("c2");
  });

  it("ignores preferredActiveId when best card has higher rank", () => {
    const cards = [
      makeCard({ id: "refine:draft-ready" }),
      makeCard({ id: "c1", kind: "create" }),
    ];
    expect(resolveFocusedWorkbenchCardId(cards, "c1")).toBe("refine:draft-ready");
  });

  it("uses priority as tiebreaker within same rank", () => {
    const cards = [
      makeCard({ id: "r1", kind: "refine", priority: 50 }),
      makeCard({ id: "r2", kind: "refine", priority: 200 }),
    ];
    expect(resolveFocusedWorkbenchCardId(cards)).toBe("r2");
  });

  it("falls back to preferredActiveId when best has rank 0", () => {
    const cards = [
      makeCard({ id: "a", status: "adopted" }),
      makeCard({ id: "b", status: "rejected" }),
    ];
    // all rank 0, preferredActiveId 存在于列表中
    expect(resolveFocusedWorkbenchCardId(cards, "b")).toBe("b");
  });

  it("falls back to first card when all rank 0 and no preferred", () => {
    const cards = [
      makeCard({ id: "a", status: "adopted" }),
      makeCard({ id: "b", status: "rejected" }),
    ];
    expect(resolveFocusedWorkbenchCardId(cards)).toBe("a");
  });

  it("uses id as stable tiebreaker when rank and priority are equal", () => {
    const cards = [
      makeCard({ id: "r-beta", kind: "refine", priority: 100 }),
      makeCard({ id: "r-alpha", kind: "refine", priority: 100 }),
    ];
    // "r-alpha" < "r-beta" lexicographically, so r-alpha wins
    expect(resolveFocusedWorkbenchCardId(cards)).toBe("r-alpha");
    // reversed input order should give same result
    expect(resolveFocusedWorkbenchCardId([...cards].reverse())).toBe("r-alpha");
  });

  it("preferred card not in list is ignored", () => {
    const cards = [
      makeCard({ id: "c1", kind: "create" }),
    ];
    expect(resolveFocusedWorkbenchCardId(cards, "not-exist")).toBe("c1");
  });
});
