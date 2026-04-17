import { describe, expect, it } from "vitest";

import {
  buildOrgMemoryRolloutSubject,
  buildOrgMemoryRequestHeaders,
  buildOrgMemoryResponseHeaders,
  buildOrgMemoryRolloutKey,
  canUseLocalWriteFallback,
  getOrgMemoryRolloutBucket,
  ORG_MEMORY_FALLBACK_USED_HEADER,
  ORG_MEMORY_LOCAL_FALLBACK_HEADER,
  ORG_MEMORY_PROXY_MODE_HEADER,
  ORG_MEMORY_RESPONSE_SOURCE_HEADER,
  ORG_MEMORY_ROLLOUT_KEY_HEADER,
  ORG_MEMORY_ROLLOUT_PERCENT_HEADER,
  ORG_MEMORY_ROLLOUT_BUCKET_HEADER,
  ORG_MEMORY_ROUTE_TARGET_HEADER,
  allowDirectOrgMemoryLocalRoute,
  canUseLocalOrgMemoryFallback,
  isLocalOrgMemoryPrimary,
  isOrgMemoryPath,
  readOrgMemoryClientConfig,
  readOrgMemoryProxyConfig,
  shouldEnableOrgMemoryClientFallback,
  shouldRouteOrgMemoryToBackend,
  shouldUseLocalFallbackForStatus,
} from "@/lib/org-memory-proxy";

describe("org-memory-proxy", () => {
  it("defaults to remote-first hybrid mode with local fallback in development", () => {
    const config = readOrgMemoryProxyConfig({ NODE_ENV: "development" });

    expect(config).toEqual({
      mode: "hybrid",
      localFallbackEnabled: true,
      rolloutPercentage: 100,
      nodeEnv: "development",
    });
    expect(canUseLocalOrgMemoryFallback(config)).toBe(true);
    expect(allowDirectOrgMemoryLocalRoute(config)).toBe(true);
    expect(shouldRouteOrgMemoryToBackend(config, "dev-user", "GET")).toBe(true);
  });

  it("defaults to remote mode without local fallback outside development", () => {
    const config = readOrgMemoryProxyConfig({ NODE_ENV: "production" });

    expect(config).toEqual({
      mode: "remote",
      localFallbackEnabled: false,
      rolloutPercentage: 100,
      nodeEnv: "production",
    });
    expect(canUseLocalOrgMemoryFallback(config)).toBe(false);
    expect(allowDirectOrgMemoryLocalRoute(config)).toBe(false);
  });

  it("allows forcing local mode explicitly", () => {
    const config = readOrgMemoryProxyConfig({
      NODE_ENV: "production",
      ORG_MEMORY_PROXY_MODE: "local",
      ORG_MEMORY_LOCAL_FALLBACK_ENABLED: "false",
    });

    expect(config).toEqual({
      mode: "local",
      localFallbackEnabled: true,
      rolloutPercentage: 0,
      nodeEnv: "production",
    });
    expect(isLocalOrgMemoryPrimary(config)).toBe(true);
  });

  it("can disable fallback in hybrid mode", () => {
    const config = readOrgMemoryProxyConfig({
      NODE_ENV: "development",
      ORG_MEMORY_PROXY_MODE: "hybrid",
      ORG_MEMORY_LOCAL_FALLBACK_ENABLED: "false",
      ORG_MEMORY_REMOTE_ROLLOUT_PERCENT: "25",
    });

    expect(config).toEqual({
      mode: "hybrid",
      localFallbackEnabled: false,
      rolloutPercentage: 25,
      nodeEnv: "development",
    });
    expect(canUseLocalOrgMemoryFallback(config)).toBe(false);
  });

  it("defaults client config to remote mode outside development", () => {
    const config = readOrgMemoryClientConfig({ NODE_ENV: "production" });

    expect(config).toEqual({
      mode: "remote",
      localFallbackEnabled: false,
      rolloutPercentage: 100,
      nodeEnv: "production",
    });
    expect(shouldEnableOrgMemoryClientFallback({ NODE_ENV: "production" })).toBe(false);
  });

  it("defaults client config to remote-first hybrid mode with fallback in development", () => {
    const config = readOrgMemoryClientConfig({ NODE_ENV: "development" });

    expect(config).toEqual({
      mode: "hybrid",
      localFallbackEnabled: true,
      rolloutPercentage: 100,
      nodeEnv: "development",
    });
    expect(shouldEnableOrgMemoryClientFallback({ NODE_ENV: "development" })).toBe(true);
  });

  it("allows enabling client fallback with public env", () => {
    const config = readOrgMemoryClientConfig({
      NODE_ENV: "production",
      NEXT_PUBLIC_ORG_MEMORY_PROXY_MODE: "hybrid",
      NEXT_PUBLIC_ORG_MEMORY_LOCAL_FALLBACK_ENABLED: "true",
      NEXT_PUBLIC_ORG_MEMORY_REMOTE_ROLLOUT_PERCENT: "40",
    });

    expect(config).toEqual({
      mode: "hybrid",
      localFallbackEnabled: true,
      rolloutPercentage: 40,
      nodeEnv: "production",
    });
    expect(shouldEnableOrgMemoryClientFallback({
      NODE_ENV: "production",
      NEXT_PUBLIC_ORG_MEMORY_PROXY_MODE: "hybrid",
      NEXT_PUBLIC_ORG_MEMORY_LOCAL_FALLBACK_ENABLED: "true",
      NEXT_PUBLIC_ORG_MEMORY_REMOTE_ROLLOUT_PERCENT: "40",
    })).toBe(true);
  });

  it("builds rollout key and request headers for backend observability", () => {
    const config = readOrgMemoryProxyConfig({
      NODE_ENV: "development",
      ORG_MEMORY_PROXY_MODE: "hybrid",
      ORG_MEMORY_LOCAL_FALLBACK_ENABLED: "true",
      ORG_MEMORY_REMOTE_ROLLOUT_PERCENT: "30",
    });

    expect(buildOrgMemoryRolloutKey(config)).toBe("hybrid-30-fallback-on");
    expect(buildOrgMemoryRequestHeaders(config)).toEqual({
      [ORG_MEMORY_PROXY_MODE_HEADER]: "hybrid",
      [ORG_MEMORY_ROLLOUT_KEY_HEADER]: "hybrid-30-fallback-on",
      [ORG_MEMORY_ROLLOUT_PERCENT_HEADER]: "30",
      [ORG_MEMORY_LOCAL_FALLBACK_HEADER]: "true",
    });
  });

  it("builds response headers that expose backend vs fallback source", () => {
    const config = readOrgMemoryProxyConfig({
      NODE_ENV: "production",
      ORG_MEMORY_PROXY_MODE: "remote",
    });

    expect(buildOrgMemoryResponseHeaders(config, "backend")).toMatchObject({
      [ORG_MEMORY_PROXY_MODE_HEADER]: "remote",
      [ORG_MEMORY_RESPONSE_SOURCE_HEADER]: "backend",
      [ORG_MEMORY_FALLBACK_USED_HEADER]: "false",
    });
    expect(buildOrgMemoryResponseHeaders(config, "local-fallback", { bucket: 17, routeTarget: "backend" })).toMatchObject({
      [ORG_MEMORY_RESPONSE_SOURCE_HEADER]: "local-fallback",
      [ORG_MEMORY_FALLBACK_USED_HEADER]: "true",
      [ORG_MEMORY_ROLLOUT_BUCKET_HEADER]: "17",
      [ORG_MEMORY_ROUTE_TARGET_HEADER]: "backend",
    });
  });

  it("routes hybrid read traffic by stable rollout bucket while forcing writes to backend", () => {
    const config = readOrgMemoryProxyConfig({
      NODE_ENV: "production",
      ORG_MEMORY_PROXY_MODE: "hybrid",
      ORG_MEMORY_LOCAL_FALLBACK_ENABLED: "true",
      ORG_MEMORY_REMOTE_ROLLOUT_PERCENT: "50",
    });
    const subject = buildOrgMemoryRolloutSubject({
      authorization: "Bearer stage4-user",
      path: "/org-memory/proposals",
    });
    const bucket = getOrgMemoryRolloutBucket(subject);

    expect(bucket).toBeGreaterThanOrEqual(0);
    expect(bucket).toBeLessThan(100);
    expect(shouldRouteOrgMemoryToBackend(config, subject, "POST")).toBe(true);
    expect(shouldRouteOrgMemoryToBackend(config, subject, "GET")).toBe(bucket < 50);
  });

  it("only allows local write fallback in development or explicit local mode", () => {
    const prodHybrid = readOrgMemoryProxyConfig({
      NODE_ENV: "production",
      ORG_MEMORY_PROXY_MODE: "hybrid",
      ORG_MEMORY_LOCAL_FALLBACK_ENABLED: "true",
    });
    const devHybrid = readOrgMemoryProxyConfig({
      NODE_ENV: "development",
      ORG_MEMORY_PROXY_MODE: "hybrid",
    });
    const localProd = readOrgMemoryProxyConfig({
      NODE_ENV: "production",
      ORG_MEMORY_PROXY_MODE: "local",
    });

    expect(canUseLocalWriteFallback(prodHybrid)).toBe(false);
    expect(canUseLocalWriteFallback(devHybrid)).toBe(true);
    expect(canUseLocalWriteFallback(localProd)).toBe(true);
  });

  it("recognizes org-memory paths and fallback-worthy statuses", () => {
    expect(isOrgMemoryPath("/org-memory")).toBe(true);
    expect(isOrgMemoryPath("/org-memory/proposals/301")).toBe(true);
    expect(isOrgMemoryPath("/approvals")).toBe(false);

    expect(shouldUseLocalFallbackForStatus(404)).toBe(true);
    expect(shouldUseLocalFallbackForStatus(503)).toBe(true);
    expect(shouldUseLocalFallbackForStatus(500)).toBe(false);
  });
});
