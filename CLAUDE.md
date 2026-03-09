# Le Desk — AI Skill Workbench

Next.js 16 frontend for the universal-kb backend (Python FastAPI). Pixel Art design system.

## Architecture

- **Frontend**: Next.js 16 App Router, Tailwind CSS, custom Pixel Art components
- **Backend**: Proxied to FastAPI at `BACKEND_URL` (default `http://localhost:8000`) via `/api/proxy/[...path]`
- **Design System**: Pixel Art style — 2px borders, monospace font (Roboto Mono), uppercase labels, pixel grid icons

## Key Directories

| Path | Purpose |
|------|---------|
| `src/app/(app)/` | Authenticated pages (sidebar layout) |
| `src/app/(auth)/` | Login page |
| `src/app/api/proxy/` | API proxy to FastAPI backend |
| `src/components/pixel/` | Pixel Art design system (PixelIcon, PixelButton, PixelBadge) |
| `src/components/layout/` | Layout components (Sidebar, PageShell) |
| `src/lib/` | API client, types, utilities |

## Design Tokens

```
Primary:    #00D1FF (bright cyan)
Dark:       #00A3C4 (deep cyan)
Accent:     #00CC99 (green)
Background: #F0F4F8 (light gray-blue)
Sidebar:    #EBF4F7 (lighter gray-blue)
Text:       #1A202C (dark gray)
Border:     #1A202C 2px solid (thick borders)
Font:       Roboto Mono (monospace)
```

## Commands

```bash
npm run dev          # dev server (port 5023)
npm run build        # production build
npm run lint         # eslint
```

## Backend Dependency

This frontend requires the universal-kb backend running. Start it with:
```bash
cd /Users/liaoxia/projects/universal-kb/backend
uvicorn app.main:app --reload --port 8000
```
