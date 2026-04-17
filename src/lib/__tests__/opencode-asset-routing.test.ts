import { describe, expect, it } from "vitest";

import {
  rewriteOpenCodeCssAssetPaths,
  rewriteOpenCodeScriptAssetPaths,
} from "@/lib/opencode-asset-routing";

describe("opencode asset routing", () => {
  it("rewrites Vite script asset references through the opencode proxy", () => {
    const source = [
      'const css="/assets/index-DsD6RzLv.css";',
      'import("./assets/chunk.js");',
      'new URL("assets/icon.svg", import.meta.url);',
    ].join("");

    expect(rewriteOpenCodeScriptAssetPaths(source)).toBe([
      'const css="/api/opencode/assets/index-DsD6RzLv.css";',
      'import("/api/opencode/assets/chunk.js");',
      // 裸 assets/ 保持无前导 /，Vite 的 "/" + dep 拼接会补上
      'new URL("api/opencode/assets/icon.svg", import.meta.url);',
    ].join(""));
  });

  it("keeps bare assets/ paths without leading slash for Vite __vitePreload compat", () => {
    // Vite: const dep = "assets/index-DsD6RzLv.css"; link.href = "/" + dep;
    const source = 'const dep="assets/index-DsD6RzLv.css";link.href="/"+dep;';
    const result = rewriteOpenCodeScriptAssetPaths(source);
    expect(result).toBe('const dep="api/opencode/assets/index-DsD6RzLv.css";link.href="/"+dep;');
  });

  it("does not leave protocol-relative proxy URLs behind", () => {
    expect(
      rewriteOpenCodeScriptAssetPaths('const css="//api/opencode/assets/index-DsD6RzLv.css";'),
    ).toBe('const css="/api/opencode/assets/index-DsD6RzLv.css";');
  });

  it("rewrites CSS url references through the opencode proxy", () => {
    expect(rewriteOpenCodeCssAssetPaths("body{background:url(/assets/bg.png)}")).toBe(
      "body{background:url(/api/opencode/assets/bg.png)}",
    );
    expect(rewriteOpenCodeCssAssetPaths("body{background:url(//api/opencode/assets/bg.png)}")).toBe(
      "body{background:url(/api/opencode/assets/bg.png)}",
    );
  });
});
