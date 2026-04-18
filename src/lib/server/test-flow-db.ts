import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import type { TestFlowRunLink } from "@/lib/test-flow-types";

export interface TestFlowPersistentState {
  schema_version: 1;
  run_links_by_session_id: Record<string, TestFlowRunLink>;
}

const DEFAULT_STATE_FILE = path.join(process.cwd(), ".skill-governance", "test-flow.json");

let updateQueue: Promise<void> = Promise.resolve();

function stateFilePath() {
  return process.env.TEST_FLOW_STATE_FILE || DEFAULT_STATE_FILE;
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function createSeedState(): TestFlowPersistentState {
  return {
    schema_version: 1,
    run_links_by_session_id: {},
  };
}

function normalizeState(value: unknown): TestFlowPersistentState {
  const candidate = typeof value === "object" && value !== null
    ? value as Partial<TestFlowPersistentState>
    : {};

  return {
    schema_version: 1,
    run_links_by_session_id:
      typeof candidate.run_links_by_session_id === "object" && candidate.run_links_by_session_id !== null
        ? candidate.run_links_by_session_id
        : {},
  };
}

async function persistState(state: TestFlowPersistentState) {
  const filePath = stateFilePath();
  await mkdir(path.dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(tempPath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
  await rename(tempPath, filePath);
}

export async function readTestFlowState(): Promise<TestFlowPersistentState> {
  try {
    const raw = await readFile(stateFilePath(), "utf8");
    return normalizeState(JSON.parse(raw));
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      const seed = createSeedState();
      await persistState(seed);
      return seed;
    }
    throw error;
  }
}

export async function updateTestFlowState<T>(
  updater: (state: TestFlowPersistentState) => T | Promise<T>,
): Promise<T> {
  let result!: T;
  const run = updateQueue.then(async () => {
    const state = await readTestFlowState();
    result = await updater(state);
    await persistState(state);
  });
  updateQueue = run.then(() => undefined, () => undefined);
  await run;
  return result;
}

export async function saveTestFlowRunLink(link: TestFlowRunLink) {
  return updateTestFlowState((state) => {
    state.run_links_by_session_id[String(link.session_id)] = clone(link);
    return clone(link);
  });
}

export async function updateTestFlowRunLink(sessionId: number, patch: Partial<TestFlowRunLink>) {
  return updateTestFlowState((state) => {
    const current = state.run_links_by_session_id[String(sessionId)];
    if (!current) return null;
    const next = { ...current, ...clone(patch) };
    state.run_links_by_session_id[String(sessionId)] = next;
    return clone(next);
  });
}
