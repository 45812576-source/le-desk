# Le Desk 多主题系统设计

日期：2026-03-16

## 背景

Le Desk 当前使用 Pixel Art 风格（Roboto Mono、2px 硬边框、像素图标、青色配色），命名为 **Lab Edition**。需新增参照 shadcn/ui 的正式风格主题，支持 Light / Dark 两种配色，并可与 Lab Edition 互相切换。

## 目标

- 三套主题：`lab`（Pixel Art）、`light`（shadcn 正式白色）、`dark`（shadcn 深色）
- 用户在设置页选择，即时生效，持久化到 localStorage
- Lab Edition 现有代码和组件完全不变
- 真正安装 shadcn/ui 组件库（@radix-ui），不是仿写

## 架构

```
Theme: "lab" | "light" | "dark"
         ↓
ThemeProvider (React Context, src/lib/theme.tsx)
  - 读/写 localStorage key: "le_desk_theme"
  - 在 <html> 上设置 data-theme="lab|light|dark"
         ↓
globals.css 三套 CSS variables
  [data-theme="lab"]   → 现有 Pixel Art tokens（不变）
  [data-theme="light"] → shadcn/ui 官方 light tokens
  [data-theme="dark"]  → shadcn/ui 官方 dark tokens
         ↓
组件层（并存）
  src/components/pixel/  ← Lab 专用，保持不变
  src/components/ui/     ← shadcn 组件，CLI 生成
```

## 防闪烁方案

在根 `layout.tsx` 的 `<head>` 注入 inline script，在 React hydration 之前同步读取 localStorage 并设置 `data-theme`，避免 SSR 白屏或主题跳变。

## CSS Variables 结构

```css
@import "tailwindcss";

[data-theme="lab"] {
  --font-sans: "Roboto Mono", monospace;
  --color-primary: #00D1FF;
  --color-primary-dark: #00A3C4;
  --color-accent: #00CC99;
  --color-bg: #F0F4F8;
  --color-sidebar: #EBF4F7;
  --color-text: #1A202C;
  --color-border: #1A202C;
}

[data-theme="light"] {
  /* shadcn/ui 官方 new-york style light tokens */
  --background: 0 0% 100%;
  --foreground: 240 10% 3.9%;
  --card: 0 0% 100%;
  --primary: 240 5.9% 10%;
  --muted: 240 4.8% 95.9%;
  --border: 240 5.9% 90%;
  --radius: 0.5rem;
  /* ...完整 token 列表见实施时生成的 globals.css */
}

[data-theme="dark"] {
  /* shadcn/ui 官方 new-york style dark tokens */
  --background: 240 10% 3.9%;
  --foreground: 0 0% 98%;
  --primary: 0 0% 98%;
  --border: 240 3.7% 15.9%;
  /* ...完整 token 列表见实施时生成的 globals.css */
}
```

## shadcn 配置

```json
{
  "style": "new-york",
  "tailwind": { "cssVariables": true },
  "aliases": {
    "components": "@/components/ui",
    "utils": "@/lib/utils"
  }
}
```

选 **new-york** style：更紧凑、更正式，与 Lab Edition 的精简感一致。

字体：Light/Dark 主题使用系统无衬线字体（Inter / -apple-system），Lab 保留 Roboto Mono。

## 设置页面

路由：`/settings`，侧边栏底部加入口（用户头像区旁）。

UI：三个主题选择卡片，点击即时切换，无需保存按钮。

```
外观主题
┌─────────────────────────────────────────┐
│  ○ Lab Edition    像素艺术风格，实验室版  │
│  ○ 正式 Light     清爽白色，商务正式      │
│  ○ 正式 Dark      深色护眼，长时间使用    │
└─────────────────────────────────────────┘
  切换即时生效，自动保存
```

## 迁移策略

### 第一阶段（本次实施）

| 文件 | 操作 |
|------|------|
| `globals.css` | 重构为三套 CSS variable 块 |
| `src/lib/theme.tsx` | 新建 ThemeProvider + useTheme hook |
| `src/app/layout.tsx` | 挂 ThemeProvider + 防闪烁 inline script |
| `src/app/(app)/settings/page.tsx` | 新建设置页 |
| `src/components/layout/Sidebar.tsx` | 加设置入口 |
| shadcn CLI | 初始化 + 安装基础组件（Button、Input、Card、Dialog、Table） |

### 第二阶段（后续按需）

- 优先替换高频页面：`/chat`、`/knowledge`、`/skills`
- Light/Dark 主题下逐步用 shadcn 组件替换 pixel 组件
- Lab 主题下 pixel 组件完全不变

### 不做的事

- 不改 pixel 组件内部代码
- 不强制所有页面同时迁移
- 不删除任何现有组件

## 组件共存规则

页面组件通过 `useTheme()` 获取当前主题，按需条件渲染不同组件，或直接用 CSS variable 让 shadcn 组件在 lab 主题下隐藏/降级。两套组件库互不干涉。
