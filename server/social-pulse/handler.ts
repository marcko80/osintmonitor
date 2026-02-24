
import type { RouteDescriptor } from '../router';

interface PulseAsset { id: string; name: string; query: string; tags: string[]; }
interface PulseSource { id: string; platform: string; channelId: string; displayName: string; }

let assets: PulseAsset[] = [];
let sources: PulseSource[] = [];

export const socialPulseRoutes: RouteDescriptor[] = [
  {
    method: 'GET', path: '/social/assets',
    handler: async () => new Response(JSON.stringify(assets), { headers: { 'content-type': 'application/json' } }),
  },
  {
    method: 'POST', path: '/social/assets',
    handler: async (req) => {
      const body = await req.json();
      const asset: PulseAsset = { id: crypto.randomUUID(), name: body.name, query: body.query || '', tags: body.tags || [] };
      assets.push(asset);
      return new Response(JSON.stringify(asset), { status: 201, headers: { 'content-type': 'application/json' } });
    },
  },
  {
    method: 'GET', path: '/social/sources',
    handler: async () => new Response(JSON.stringify(sources), { headers: { 'content-type': 'application/json' } }),
  },
  {
    method: 'POST', path: '/social/sources',
    handler: async (req) => {
      const body = await req.json();
      const source: PulseSource = { id: crypto.randomUUID(), platform: 'telegram', channelId: body.channelId, displayName: body.displayName };
      sources.push(source);
      return new Response(JSON.stringify(source), { status: 201, headers: { 'content-type': 'application/json' } });
    },
  },
  {
    method: 'GET', path: '/social/pulse',
    handler: async (req) => {
      const url = new URL(req.url);
      const assetId = url.searchParams.get('asset_id');
      const bucket = url.searchParams.get('bucket') || '15m';
      // MVP: return mock timeseries
      const now = Date.now();
      const buckets = Array.from({ length: 24 }, (_, i) => ({
        timestamp: new Date(now - (23 - i) * 900000).toISOString(),
        pulseValue: Math.sin(i * 0.5) * 0.3 + (Math.random() - 0.5) * 0.4,
        volume: Math.floor(Math.random() * 20),
        negShare: Math.random() * 50,
        emotionTop: 'neutral',
        avgPolarity: Math.sin(i * 0.5) * 0.3,
      }));
      return new Response(JSON.stringify({ assetId, buckets, summary: { totalVolume: 120, avgPulse: 0.1, maxZScore: 1.5, negShareAvg: 22, dominantEmotion: 'neutral' }, lastUpdate: new Date().toISOString() }), { headers: { 'content-type': 'application/json' } });
    },
  },
  {
    method: 'GET', path: '/social/signals',
    handler: async () => new Response(JSON.stringify([]), { headers: { 'content-type': 'application/json' } }),
  },
];
