import { test as base, expect, type APIRequestContext, type Page } from "@playwright/test";

export interface HarnessRuntime {
  backendURL: string;
  token: string;
  skillId: number;
  conversationId: number;
  enabled: boolean;
}

export interface SseEvent {
  event: string;
  data: Record<string, unknown>;
}

function enabled() {
  return ["1", "true", "yes", "on"].includes(String(process.env.HARNESS_ENGINEERING_E2E ?? "").toLowerCase());
}

function requiredNumber(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required when HARNESS_ENGINEERING_E2E=1`);
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) throw new Error(`${name} must be an integer, got ${value}`);
  return parsed;
}

async function login(backendURL: string) {
  if (process.env.HARNESS_E2E_TOKEN) return process.env.HARNESS_E2E_TOKEN;
  const username = process.env.HARNESS_E2E_USERNAME;
  const password = process.env.HARNESS_E2E_PASSWORD;
  if (!username || !password) throw new Error("Set HARNESS_E2E_TOKEN or HARNESS_E2E_USERNAME/HARNESS_E2E_PASSWORD");
  const response = await fetch(`${backendURL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  if (!response.ok) throw new Error(`login failed: ${response.status} ${await response.text()}`);
  const data = await response.json();
  return String(data.access_token);
}

export function parseSse(raw: string): SseEvent[] {
  const events: SseEvent[] = [];
  let eventName = "message";
  let dataLines: string[] = [];
  const flush = () => {
    if (dataLines.length === 0) {
      eventName = "message";
      return;
    }
    const rawData = dataLines.join("\n");
    let data: Record<string, unknown>;
    try {
      data = JSON.parse(rawData) as Record<string, unknown>;
    } catch {
      data = { raw: rawData };
    }
    events.push({ event: eventName, data });
    eventName = "message";
    dataLines = [];
  };

  for (const line of raw.split(/\r?\n/)) {
    if (!line) flush();
    else if (line.startsWith(":")) continue;
    else if (line.startsWith("event:")) eventName = line.slice("event:".length).trim();
    else if (line.startsWith("data:")) dataLines.push(line.slice("data:".length).trimStart());
  }
  flush();
  return events;
}

export async function readSseResponse(response: { text: () => Promise<string> }) {
  return parseSse(await response.text());
}

export async function installAuthState(page: Page, runtime: HarnessRuntime) {
  await page.addInitScript(
    ({ token }) => {
      window.localStorage.setItem("token", token);
      window.localStorage.setItem("cached_user", JSON.stringify({ username: "harness-e2e", display_name: "Harness E2E" }));
    },
    { token: runtime.token },
  );
}

export async function backendGet(request: APIRequestContext, runtime: HarnessRuntime, path: string) {
  const response = await request.get(`${runtime.backendURL}${path}`, {
    headers: { Authorization: `Bearer ${runtime.token}` },
  });
  expect(response.ok(), `${path} failed with ${response.status()} ${await response.text()}`).toBeTruthy();
  return response.json();
}

export async function backendPost(request: APIRequestContext, runtime: HarnessRuntime, path: string, body: unknown) {
  const response = await request.post(`${runtime.backendURL}${path}`, {
    headers: { Authorization: `Bearer ${runtime.token}` },
    data: body,
  });
  expect(response.ok(), `${path} failed with ${response.status()} ${await response.text()}`).toBeTruthy();
  return response;
}

export const test = base.extend<{ runtime: HarnessRuntime }>({
  runtime: async ({}, runFixture) => {
    const isEnabled = enabled();
    const backendURL = (process.env.HARNESS_E2E_BACKEND_URL ?? process.env.HARNESS_E2E_BASE_URL ?? "http://localhost:8000").replace(/\/$/, "");
    const token = isEnabled ? await login(backendURL) : "";
    await runFixture({
      enabled: isEnabled,
      backendURL,
      token,
      skillId: isEnabled ? requiredNumber("HARNESS_E2E_SKILL_ID") : 0,
      conversationId: isEnabled ? requiredNumber("HARNESS_E2E_CONVERSATION_ID") : 0,
    });
  },
});

export { expect };
