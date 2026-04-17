import { describe, expect, it } from "vitest";

import { createOpencodeInjectScript } from "@/lib/opencode-proxy-client-script";

describe("createOpencodeInjectScript", () => {
  it("routes reloads back through the opencode proxy", () => {
    const script = createOpencodeInjectScript({
      ocPort: "17255",
      normalizeSessionApiPathPattern: "^\\/foo(\\/session\\/[^?#]+(?:[?#].*)?)$",
    });

    expect(script).toContain("window.location.replace(_addPort(_buildProxyPageUrl()))");
    expect(script).not.toContain("Location.prototype.reload = function() {}");
  });

  it("fills missing form actions and patches requestSubmit", () => {
    const script = createOpencodeInjectScript({
      ocPort: "17255",
      normalizeSessionApiPathPattern: "^\\/foo(\\/session\\/[^?#]+(?:[?#].*)?)$",
    });

    expect(script).toContain('el.setAttribute("action", _rewriteRpcPath(location.pathname + location.search));');
    expect(script).toContain("HTMLFormElement.prototype.requestSubmit");
    expect(script).toContain("_rewriteForm(this, submitter);");
  });

  it("normalizes malformed protocol-relative proxy asset paths", () => {
    const script = createOpencodeInjectScript({
      ocPort: "17255",
      normalizeSessionApiPathPattern: "^\\/foo(\\/session\\/[^?#]+(?:[?#].*)?)$",
    });

    expect(script).toContain('url.startsWith("//api/opencode/")');
    expect(script).toContain("return url.slice(1);");
    expect(script).toContain('val && (val.startsWith("/api/opencode/") || val.startsWith("/api/opencode-rpc/"))');
  });
});
