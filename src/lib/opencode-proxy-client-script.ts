export function createOpencodeInjectScript({
  ocPort,
  normalizeSessionApiPathPattern,
}: {
  ocPort: string;
  normalizeSessionApiPathPattern: string;
}): string {
  return `<script>
(function() {
  var _ocPort = ${JSON.stringify(ocPort)};
  var _proxyBase = "/api/opencode";

  try {
    if (location.pathname === _proxyBase || location.pathname.startsWith(_proxyBase + "/")) {
      var _internalPath = location.pathname.slice(_proxyBase.length) || "/";
      history.replaceState(history.state, "", _internalPath + location.search + location.hash);
    }
  } catch (e) {}

  function _addPort(url) {
    if (!_ocPort) return url;
    try {
      var sep = url.includes("?") ? "&" : "?";
      return url + sep + "_oc_port=" + _ocPort;
    } catch(e) { return url; }
  }

  function _normalizeMalformedProxyPath(url) {
    if (!url || typeof url !== "string") return url;
    if (url.startsWith("//api/opencode-rpc/")) return url.slice(1);
    if (url.startsWith("//api/opencode/")) return url.slice(1);
    return url;
  }

  function _resolveSameOriginPath(url) {
    if (!url || typeof url !== "string") return null;
    url = _normalizeMalformedProxyPath(url);
    try {
      var resolved = new URL(url, location.href);
      if (resolved.origin !== location.origin) return null;
      return resolved.pathname + resolved.search + resolved.hash;
    } catch (e) {
      return null;
    }
  }

  function _isStaticPath(path) {
    return !!path && (
      path.startsWith("/assets/") ||
      path === "/favicon.ico" ||
      path.endsWith(".css") ||
      path.endsWith(".js") ||
      path.endsWith(".mjs") ||
      path.endsWith(".png") ||
      path.endsWith(".jpg") ||
      path.endsWith(".jpeg") ||
      path.endsWith(".gif") ||
      path.endsWith(".svg") ||
      path.endsWith(".webp") ||
      path.endsWith(".ico") ||
      path.endsWith(".woff") ||
      path.endsWith(".woff2") ||
      path.endsWith(".ttf") ||
      path.endsWith(".map") ||
      path.endsWith(".webmanifest")
    );
  }

  function _normalizeSessionApiPath(path) {
    if (!path || !path.startsWith("/")) return path;
    return path.replace(new RegExp(${JSON.stringify(normalizeSessionApiPathPattern)}), "$1");
  }

  function _rewriteRpcPath(url) {
    if (!url || typeof url !== "string") return url;
    url = _normalizeMalformedProxyPath(url);
    var path = _resolveSameOriginPath(url) || url;
    if (path.startsWith("/api/")) return _addPort(path);
    if (!path.startsWith("/")) return url;
    path = _normalizeSessionApiPath(path);
    if (_isStaticPath(path)) return _addPort("/api/opencode" + path);
    return _addPort("/api/opencode-rpc" + path);
  }

  function _buildProxyPageUrl() {
    var internalPath = location.pathname || "/";
    if (!internalPath.startsWith("/")) internalPath = "/" + internalPath;
    var pagePath = _proxyBase + (internalPath === "/" ? "" : internalPath);
    return pagePath + location.search + location.hash;
  }

  try {
    localStorage.removeItem("opencode.settings.dat:defaultServerUrl");
    for (var i = 0; i < localStorage.length; i++) {
      var k = localStorage.key(i);
      if (k && k.startsWith("opencode.") && k.includes("Url")) {
        localStorage.removeItem(k); i--;
      }
    }
  } catch(e) {}

  var _origFetch = window.fetch;
  window.fetch = function(input, init) {
    var url = typeof input === "string" ? input : (input instanceof Request ? input.url : String(input));
    var rewritten = _rewriteRpcPath(url);
    if (rewritten !== url) {
      input = typeof input === "string" ? rewritten : new Request(rewritten, input instanceof Request ? input : undefined);
    }
    return _origFetch.call(this, input, init);
  };

  try {
    var _origXHROpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function(method, url) {
      if (typeof url === "string") {
        arguments[1] = _rewriteRpcPath(url);
      }
      return _origXHROpen.apply(this, arguments);
    };
  } catch (e) {}

  try {
    var _origEventSource = window.EventSource;
    if (_origEventSource) {
      window.EventSource = function(url, config) {
        var nextUrl = typeof url === "string" ? _rewriteRpcPath(url) : url;
        return new _origEventSource(nextUrl, config);
      };
      window.EventSource.prototype = _origEventSource.prototype;
    }
  } catch (e) {}

  try {
    var _origReload = Location.prototype.reload;
    Location.prototype.reload = function() {
      try {
        window.location.replace(_addPort(_buildProxyPageUrl()));
      } catch (e) {
        return _origReload.call(this);
      }
    };
  } catch(e) {}

  function _rewriteSubmitter(submitter) {
    if (!submitter || !submitter.getAttribute) return;
    var formAction = submitter.getAttribute("formaction");
    if (formAction) submitter.setAttribute("formaction", _rewriteRpcPath(formAction));
  }

  function _rewriteForm(el, submitter) {
    if (!el || !el.getAttribute) return;
    _rewriteSubmitter(submitter);
    var method = (el.getAttribute("method") || "").toLowerCase();
    if (method === "dialog") return;
    var action = el.getAttribute("action");
    if (action) {
      el.setAttribute("action", _rewriteRpcPath(action));
      return;
    }
    el.setAttribute("action", _rewriteRpcPath(location.pathname + location.search));
  }

  document.addEventListener("submit", function(e) {
    var form = e.target;
    if (form && form.tagName === "FORM") _rewriteForm(form, e.submitter);
  }, true);

  try {
    var _origSubmit = HTMLFormElement.prototype.submit;
    HTMLFormElement.prototype.submit = function() {
      _rewriteForm(this);
      return _origSubmit.call(this);
    };
  } catch(e) {}

  try {
    var _origRequestSubmit = HTMLFormElement.prototype.requestSubmit;
    if (_origRequestSubmit) {
      HTMLFormElement.prototype.requestSubmit = function(submitter) {
        _rewriteForm(this, submitter);
        return _origRequestSubmit.call(this, submitter);
      };
    }
  } catch (e) {}

  var _DOWNLOAD_RE = /\/(file|files|artifact|artifacts|download|workdir)\b/i;
  function _isDownloadUrl(url) {
    if (_DOWNLOAD_RE.test(url)) return true;
    try { if (new URL(url, location.origin).searchParams.has("download")) return true; } catch(e) {}
    return false;
  }

  function _triggerDownload(url) {
    var a = document.createElement("a");
    a.href = typeof url === "string" ? _rewriteRpcPath(url) : url;
    a.download = "";
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    setTimeout(function() { document.body.removeChild(a); }, 200);
  }

  var _origOpen = window.open;
  window.open = function(url, target, features) {
    if (url && typeof url === "string") {
      var path = url;
      if (url.startsWith(location.origin)) {
        path = url.slice(location.origin.length) || "/";
      } else if (/^https?:\/\/(?:127\.0\.0\.1|localhost)(:\d+)?/.test(url)) {
        path = url.replace(/^https?:\/\/(?:127\.0\.0\.1|localhost)(:\d+)?/, "") || "/";
      }
      if (_isDownloadUrl(path)) {
        _triggerDownload(path);
        return null;
      }
      if (path.startsWith("/")) {
        history.pushState(null, "", _addPort(path));
        return null;
      }
    }
    if (url && typeof url === "string") {
      history.pushState(null, "", url);
      return null;
    }
    return _origOpen.call(this, url, target, features);
  };

  document.addEventListener("click", function(e) {
    var el = e.target;
    while (el && el !== document) {
      if (el.tagName === "A") {
        var href = el.getAttribute("href");
        var formaction = el.getAttribute("formaction");
        if (formaction) {
          el.setAttribute("formaction", _rewriteRpcPath(formaction));
        }
        if (el.hasAttribute("download")) {
          if (href && href.startsWith("/") && !href.startsWith("/api/")) {
            el.href = _addPort("/api/opencode-rpc" + href);
          }
          return;
        }
        if (el.getAttribute("target") === "_blank" && href && _isDownloadUrl(href)) {
          e.preventDefault();
          e.stopPropagation();
          _triggerDownload(href);
          return;
        }
        if (el.getAttribute("target") === "_blank") {
          e.preventDefault();
          e.stopPropagation();
          if (href) {
            history.pushState(null, "", href.startsWith("/") ? _addPort(href) : href);
          }
          return;
        }
      }
      el = el.parentElement;
    }
  }, true);

  var _origWS = window.WebSocket;

  try {
    var _rewriteAttr = function(el, attr) {
      var val = _normalizeMalformedProxyPath(el.getAttribute(attr));
      if (val && val.startsWith("/assets/")) {
        el.setAttribute(attr, "/api/opencode" + val);
      } else if (val && val.startsWith("./assets/")) {
        el.setAttribute(attr, "/api/opencode/assets/" + val.slice(9));
      } else if (val && (val.startsWith("/api/opencode/") || val.startsWith("/api/opencode-rpc/"))) {
        el.setAttribute(attr, val);
      } else if (val && val.startsWith("/") && !val.startsWith("/api/")) {
        el.setAttribute(attr, "/api/opencode" + val);
      }
    };
    new MutationObserver(function(mutations) {
      for (var i = 0; i < mutations.length; i++) {
        var nodes = mutations[i].addedNodes;
        for (var j = 0; j < nodes.length; j++) {
          var n = nodes[j];
          if (n.nodeType !== 1) continue;
          var tag = n.tagName;
          if (tag === "LINK") _rewriteAttr(n, "href");
          else if (tag === "SCRIPT" || tag === "IMG") _rewriteAttr(n, "src");
          else if (tag === "FORM") _rewriteForm(n);
          else if (tag === "BUTTON" || tag === "INPUT") _rewriteSubmitter(n);
        }
      }
    }).observe(document.documentElement, { childList: true, subtree: true });
  } catch(e) {}

  window.WebSocket = function(url, protocols) {
    var wsUrl = String(url);
    var originWs = location.origin.replace(/^http/, "ws");
    if (wsUrl.startsWith(originWs + "/") && !wsUrl.includes("/api/")) {
      wsUrl = _addPort(originWs + "/api/opencode-rpc" + wsUrl.slice(originWs.length));
    }
    return protocols ? new _origWS(wsUrl, protocols) : new _origWS(wsUrl);
  };
  window.WebSocket.prototype = _origWS.prototype;
  window.WebSocket.CONNECTING = _origWS.CONNECTING;
  window.WebSocket.OPEN = _origWS.OPEN;
  window.WebSocket.CLOSING = _origWS.CLOSING;
  window.WebSocket.CLOSED = _origWS.CLOSED;

  window.addEventListener("error", function(e) {
    if (e.target && e.target.tagName === "LINK" && e.target.rel === "modulepreload") {
      var failedHref = e.target.href;
      e.target.remove();
      var script = document.createElement("script");
      script.type = "module";
      script.src = failedHref;
      document.head.appendChild(script);
    }
  }, true);
})();
</script>`;
}
