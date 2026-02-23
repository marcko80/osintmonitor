# OSINT Monitor - Local Development Setup

## Prerequisites

| Tool | Version | Notes |
|------|---------|-------|
| **Node.js** | >= 18.x (LTS recommended: 20.x) | Required for Vite and TypeScript |
| **npm** | >= 9.x (bundled with Node) | Package manager |
| **Git** | >= 2.x | Version control |
| **Vercel CLI** | Latest (`npm i -g vercel`) | **Optional** - only needed for full API layer |

> **Windows note**: Use PowerShell or Git Bash. WSL2 also works.

## Clone & Install

```bash
# Clone into your working directory
git clone https://github.com/marcko80/osintmonitor.git D:/AI/OSINTmonitor
cd D:/AI/OSINTmonitor

# Install dependencies
npm install
```

## Environment Variables

The dashboard works **without any API keys** - panels for unconfigured services simply won't appear.

```bash
# Copy the example env file
cp .env.example .env.local
```

### Key Variables for Static Frontend Mode

```env
# Site variant (full = geopolitical, tech, finance)
VITE_VARIANT=full

# Map interaction mode (3d = globe with pitch/rotation, flat = 2D)
VITE_MAP_INTERACTION_MODE=3d
```

### Optional API Keys (add later as needed)

| Variable | Service | Free Tier |
|----------|---------|----------|
| `GROQ_API_KEY` | AI Summarization | 14,400 req/day |
| `UPSTASH_REDIS_REST_URL` + `TOKEN` | Cross-user caching | 10K cmd/day |
| `ACLED_ACCESS_TOKEN` | Conflict data | Free for researchers |
| `NASA_FIRMS_API_KEY` | Satellite fire detection | Free |
| `FINNHUB_API_KEY` | Stock quotes | Free tier |

Full list with registration links: see `.env.example`

## Running the Application

### Option 1: Static Frontend Only (Recommended for UI development)

```bash
npm run dev
```

- Opens at **http://localhost:5173**
- Vite dev server with HMR (hot module replacement)
- Map and static data layers work (bases, cables, pipelines)
- News feeds and API-dependent panels **won't load** (no edge functions)
- Browser-side ML models still work (Transformers.js)

### Option 2: Full Stack with Vercel CLI

```bash
npm install -g vercel
vercel dev
```

- Opens at **http://localhost:3000**
- All 60+ edge functions run locally
- News feeds, AI summaries, market data all work
- Requires API keys in `.env.local` for each service

### Build Commands

```bash
# Type checking
npm run typecheck

# Production build (full variant)
npm run build:full

# Production build (tech variant)
npm run build:tech

# Production build (finance variant)
npm run build:finance
```

## Project Structure Overview

```
osintmonitor/
|-- api/                    # Vercel Edge Functions (60+ endpoints)
|-- data/                   # Static data files (GeoJSON, etc.)
|-- docs/                   # Documentation
|-- proto/                  # Protocol Buffer definitions (17 services)
|-- public/                 # Static assets
|-- scripts/                # Build scripts, relay server
|-- server/                 # Server-side handlers
|-- src/
|   |-- bootstrap/          # App initialization sequence
|   |-- components/         # UI panels (40+ components)
|   |   |-- Panel.ts        # Base class for all panels
|   |   |-- NewsPanel.ts    # News feed panel
|   |   |-- MonitorPanel.ts # Keyword monitor panel
|   |   |-- Map.ts          # Main map component
|   |   +-- index.ts        # Component exports barrel
|   |-- config/             # Configuration files
|   |   |-- panels.ts       # Panel definitions (name, enabled, priority)
|   |   |-- feeds.ts        # RSS feed sources
|   |   |-- index.ts        # Config exports
|   |   +-- variants/       # Variant-specific configs
|   |-- generated/          # Auto-generated sebuf clients/servers
|   |-- locales/            # i18n translations (16 languages)
|   |-- services/           # Business logic services
|   |-- styles/             # CSS styles
|   |-- types/              # TypeScript type definitions
|   |-- utils/              # Utility functions
|   |-- workers/            # Web Workers (ML pipeline)
|   |-- App.ts              # Main application orchestrator
|   +-- main.ts             # Entry point
|-- src-tauri/              # Desktop app (Tauri/Rust)
|-- tests/                  # Test files
|-- .env.example            # Environment variables template
|-- index.html              # HTML entry point
|-- package.json            # Dependencies and scripts
|-- vite.config.ts          # Vite build configuration
+-- vercel.json             # Vercel deployment config
```

## Common Issues & Fixes

### `npm install` fails with node-gyp errors
- Ensure Node.js >= 18. Run `node -v` to check.
- On Windows, install build tools: `npm install -g windows-build-tools`

### Map tiles don't load
- MapTiler tiles require an internet connection
- Check browser console for CORS errors
- Try clearing browser cache

### TypeScript errors on first build
- Run `npm run typecheck` to see detailed errors
- Generated types may need regeneration: check `src/generated/`

### Port 5173 already in use
- Kill existing process: `npx kill-port 5173`
- Or use: `npm run dev -- --port 5174`

### "vercel dev" requires login
- Run `vercel login` first
- Use `npm run dev` instead if you don't need API layer

## Smoke Test Checklist

After starting with `npm run dev`:

- [ ] Browser opens to localhost without errors
- [ ] 3D globe/map renders correctly
- [ ] Map layers toggle on/off (sidebar controls)
- [ ] Theme toggle works (dark/light)
- [ ] Language selector works
- [ ] No blocking errors in browser console
- [ ] Panel grid layout renders (even if panels show "No data")

## Next Steps

- See `docs/ARCHITECTURE.md` for system architecture
- See `docs/SOCIAL_EXTENSION_PLAN.md` for Social Monitoring extension plan
- See `README.md` for full feature documentation
