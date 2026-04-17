export function rewriteOpenCodeScriptAssetPaths(source: string): string {
  return source
    // "./assets/" 和 "/assets/" → 绝对路径 "/api/opencode/assets/"
    .replace(/(["'`])(?:\.\/|\/)assets\//g, "$1/api/opencode/assets/")
    // 裸 "assets/" → 不带前导斜杠的 "api/opencode/assets/"
    // Vite 的 __vitePreload 会做 "/" + dep 拼接，保留相对形式避免双斜杠
    .replace(/(["'`])assets\//g, "$1api/opencode/assets/")
    // 兜底：修复可能残留的协议相对双斜杠
    .replace(/(["'`])\/\/api\/opencode\/assets\//g, "$1/api/opencode/assets/");
}

export function rewriteOpenCodeCssAssetPaths(source: string): string {
  return source
    .replace(/url\(\s*\/assets\//g, "url(/api/opencode/assets/")
    .replace(/url\(\s*\/\/api\/opencode\/assets\//g, "url(/api/opencode/assets/");
}
