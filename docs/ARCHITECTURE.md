# OSINT Monitor — Architecture Overview

> **Fase B deliverable** — Reverse engineering of the original World Monitor codebase.
> This document maps the frontend architecture so that the Social Monitoring
> extension can be added without breaking existing functionality.

---

## 1. High-level stack

| Layer | Technology |
|-------|-----------|
| Language | TypeScript (strict) |
| Bundler | Vite 6 + SWC |
| UI | Vanilla TS — no framework (plain DOM + class-based components) |
| Map | deck.gl (WebGL) on desktop, D3/SVG fallback on mobile |
| State | In-memory on the `App` class + `localStorage` for persistence |
| Workers | Web Workers for ML inference and news clustering |
| PWA | vite-plugin-pwa (offline support) |
| Desktop | Tauri (optional — `src-tauri/`) |
| Backend proxy | Vite dev proxy → external APIs (see `vite.config.ts` proxy map) |
| Protobuf | `proto/` → `src/generated/` (gRPC-style service clients) |

---

## 2. Directory map

```
osintmonitor/
├── api/                  # Serverless API handlers (Vercel edge functions)
├── convex/               # Convex backend (realtime DB, optional)
├── data/                 # Static data files (GeoJSON, etc.)
├── deploy/               # Deployment scripts
├── docs/                 # Project documentation (this file lives here)
├── e2e/                  # Playwright end-to-end tests
├── proto/                # Protobuf service definitions
├── public/               # Static assets served as-is
├── scripts/              # Build/utility scripts
├── server/               # Sidecar/backend server code
├── src/                  # Main frontend source
│   ├── App.ts            # Root orchestrator (≈3000 LOC)
│   ├── main.ts           # Entry point — mounts App
│   ├── bootstrap/        # Startup/init helpers
│   ├── components/       # All UI panels and widgets (40+ files)
│   ├── config/           # Static config: feeds, panels, geo, markets
│   │   ├── index.ts      # Re-exports: FEEDS, PANELS, STORAGE_KEYS, etc.
│   │   ├── feeds.ts      # RSS/Atom feed definitions per category
│   │   ├── panels.ts     # DEFAULT_PANELS, REFRESH_INTERVALS, MAP_LAYERS
│   │   ├── geo.ts        # INTEL_HOTSPOTS, CONFLICT_ZONES, MILITARY_BASES
│   │   ├── markets.ts    # MARKET_SYMBOLS, COMMODITIES, SECTORS
│   │   └── variants/     # Per-variant overrides (full, tech, finance)
│   ├── e2e/              # E2E test helpers
│   ├── generated/        # Auto-generated protobuf clients
│   ├── locales/          # i18n translation files (en, it, fr, etc.)
│   ├── services/         # Business logic + API fetchers (30+ modules)
│   ├── styles/           # CSS files
│   ├── types/            # Shared TypeScript interfaces
│   ├── utils/            # Pure utility functions
│   └── workers/          # Web Worker entry points (ML, analysis)
├── src-tauri/            # Tauri desktop wrapper
└── vite.config.ts        # Vite config with Brotli plugin + proxy map
```

---

## 3. Data flow

```
                  ┌──────────────┐
                  │  External    │
                  │  APIs / RSS  │
                  └──────┬───────┘
                         │ fetch (via Vite proxy or direct)
                         ▼
              ┌──────────────────────┐
              │  src/services/*      │  ← fetch, parse, normalize
              │  (fetchers + logic)  │
              └──────────┬───────────┘
                         │ typed data
                         ▼
              ┌──────────────────────┐
              │  App.ts              │  ← orchestrates load, refresh,
              │  (central hub)       │     caching, signal aggregation
              └──────────┬───────────┘
                    ┌────┴────┐
                    ▼         ▼
          ┌─────────────┐ ┌──────────────┐
          │ components/* │ │ MapContainer │
          │ (panels)     │ │ (deck.gl)    │
          └─────────────┘ └──────────────┘
                    │         │
                    ▼         ▼
              ┌──────────────────────┐
              │  DOM / Browser       │
              └──────────────────────┘
```

### Key points:
- **App.ts** is the single orchestrator — it owns all panels, the map, and
  all data loading/refresh timers.
- **Services** are pure fetch+transform modules — they have no DOM dependency.
- **Components** extend `Panel` base class — each manages its own DOM element
  via `getElement()`.
- **Config** is variant-aware — `SITE_VARIANT` (full | tech | finance) gates
  which panels, feeds, and map layers are shown.

---

## 4. Component model

All panels inherit from `Panel` (in `components/Panel.ts`):

```
Panel (base)
├── getElement(): HTMLElement
├── toggle(visible: boolean)
├── showLoading() / showError()
└── setDeviation(zScore, pctChange, level)

Specialized panels:
├── NewsPanel        — renders RSS items with time-range filtering
├── MarketPanel      — stock tickers + sparklines
├── CryptoPanel      — crypto prices (CoinGecko)
├── PredictionPanel  — Polymarket prediction markets
├── CIIPanel         — Country Instability Index
├── MapContainer     — wraps DeckGLMap + D3 SVG fallback
├── MonitorPanel     — user-defined keyword monitors
├── EconomicPanel    — FRED data + oil analytics
├── InsightsPanel    — AI-generated insights (ML worker)
└── ... (40+ total)
```

### Panel lifecycle:
1. `App.createPanels()` instantiates all panels and appends to `#panelsGrid`.
2. `App.applyPanelSettings()` toggles visibility from `localStorage`.
3. `App.loadAllData()` calls the relevant `load*()` method which fetches data
   from services and calls `panel.render*(data)`.
4. `App.setupRefreshIntervals()` schedules periodic re-fetches.

---

## 5. Storage model

| Key pattern | Purpose |
|------------|---------|
| `worldmonitor-panels` | Panel enabled/disabled state |
| `worldmonitor-map-layers` | Map layer visibility toggles |
| `worldmonitor-monitors` | User-defined keyword monitors |
| `worldmonitor-variant` | Active site variant (full/tech/finance) |
| `panel-order` | Drag-and-drop panel ordering |
| `worldmonitor-panel-spans` | Panel column span sizes |
| `worldmonitor-disabled-feeds` | Disabled RSS sources |
| `map-height` | User-preferred map section height |
| `map-pinned` | Map pin state |

All reads/writes go through `loadFromStorage()` / `saveToStorage()` utilities.

---

## 6. Variant system

The app supports three variants controlled by `SITE_VARIANT` env var:

- **full** — geopolitical OSINT (default): CII, protests, military, conflicts
- **tech** — tech/startup focus: AI labs, startup ecosystems, tech events
- **finance** — financial focus: stock exchanges, central banks, ETF flows

Variants affect:
- Which panels are created in `createPanels()`
- Which feeds are loaded (`config/feeds.ts` + `config/variants/`)
- Which map layers are available
- Search modal sources

---

## 7. Extension points for Social Monitoring

Based on the architecture analysis, the Social Monitoring module should:

1. **New panel**: `SocialMonitoringPanel` extending `Panel` — added to
   `panelsGrid` like all other panels.
2. **New config entry**: Add to `config/panels.ts` `DEFAULT_PANELS` so it
   appears in settings toggle.
3. **New service**: `services/social-telegram.ts` — fetches data from a
   server-side collector (sidecar) and normalizes to common types.
4. **Storage**: Use existing `localStorage` pattern for user-defined channels
   and keywords.
5. **No changes needed** to `App.ts` orchestrator beyond registering the new
   panel and its load/refresh cycle.

---

## 8. API proxy pattern

`vite.config.ts` defines a `proxy` map that routes `/api/*` requests to
external services (Yahoo Finance, OpenSky, ACLED, GDELT, etc.). The Social
Monitoring collector should follow the same pattern — either as a new proxy
entry or as a standalone sidecar on a separate port.

---

*Document generated during Fase B — Reverse engineering.*
*Last updated: 2026-02-23*
