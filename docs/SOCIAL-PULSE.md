# Social Pulse - Sentiment Waveform for OSINTmonitor

## Overview
Social Pulse adds a real-time sentiment waveform panel to World Monitor.
It monitors Telegram channels (and future social sources) and visualizes
sentiment oscillation over time for configured assets.

## Quick Start
1. Open the **Social Monitor** panel and add at least one **Source** (Telegram channel)
2. Add at least one **Asset** with keywords to match
3. The **Social Pulse** panel will display sentiment wave for selected asset

## Panel Controls
- **Asset dropdown**: select which asset to visualize
- **Timeframe**: 1h / 6h / 24h / 7d
- **Bucket size**: 5m / 15m / 60m (granularity of aggregation)
- **Last update**: timestamp of latest computation

## Waveform Interpretation
- Y-axis: sentiment [-1, +1] where -1 = fully negative, +1 = fully positive
- X-axis: time buckets
- Line oscillates around zero (neutral baseline)
- Area fill shows sentiment deviation from neutral

## Signal Detection
Two automatic triggers generate SocialSignals:
1. **Volume Spike**: z-score(volume) > 3.0 on rolling baseline
2. **Sentiment Shift**: negative share > 45%%

Signals appear with severity badges (low/med/high) in the panel.

## Server Sidecar Endpoints
| Method | Path | Description |
|--------|------|-------------|
| GET | /social/assets | List configured assets |
| POST | /social/assets | Create new asset |
| GET | /social/sources | List Telegram sources |
| POST | /social/sources | Add Telegram channel |
| GET | /social/pulse?asset_id=...&bucket=... | Get pulse timeseries |
| GET | /social/signals?asset_id=... | Get active signals |

## Asset Query Syntax
Boolean queries with OR/NOT and quoted phrases:
```
("dinova" OR "dinova.it") NOT ("job" OR "hiring")
```

## Configuration
- Telegram channels: add via Social Monitor > Sources tab
- Assets: add via Social Monitor > Assets tab
- Server URL: set SOCIAL_COLLECTOR_URL env var (default: http://localhost:3001)
- Telegram token: set TELEGRAM_BOT_TOKEN env var (server-side only)

## Architecture
```
[Telegram API] --> [Sidecar Collector] --> [SQLite/Cache]
                        |
                   [REST API]
                        |
              [Frontend Service] --> [Social Pulse Panel]
```
