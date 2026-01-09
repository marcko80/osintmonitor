import type { MarketData, CryptoData } from '@/types';
import { API_URLS, CRYPTO_MAP } from '@/config';
import { chunkArray, fetchWithProxy } from '@/utils';

interface YahooFinanceResponse {
  chart: {
    result: Array<{
      meta: {
        regularMarketPrice: number;
        chartPreviousClose?: number;
        previousClose?: number;
      };
    }>;
  };
}

interface CoinGeckoResponse {
  [key: string]: {
    usd: number;
    usd_24h_change: number;
  };
}

export async function fetchStockQuote(
  symbol: string,
  name: string,
  display: string
): Promise<MarketData> {
  try {
    const url = API_URLS.yahooFinance(symbol);
    const response = await fetchWithProxy(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data: YahooFinanceResponse = await response.json();

    const meta = data.chart.result[0]?.meta;
    if (!meta) {
      return { symbol, name, display, price: null, change: null };
    }

    const price = meta.regularMarketPrice;
    const prevClose = meta.chartPreviousClose || meta.previousClose || price;
    const change = ((price - prevClose) / prevClose) * 100;

    return {
      symbol,
      name,
      display,
      price,
      change,
    };
  } catch (e) {
    console.error(`Failed to fetch ${symbol}:`, e);
    return { symbol, name, display, price: null, change: null };
  }
}

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export async function fetchMultipleStocks(
  symbols: Array<{ symbol: string; name: string; display: string }>,
  options: {
    batchSize?: number;
    delayMs?: number;
    onBatch?: (results: MarketData[]) => void;
  } = {}
): Promise<MarketData[]> {
  const results: MarketData[] = [];
  const batchSize = options.batchSize ?? 5;
  const delayMs = options.delayMs ?? 2500;
  const batches = chunkArray(symbols, batchSize);

  for (const [index, batch] of batches.entries()) {
    const batchResults = await Promise.all(
      batch.map((s) => fetchStockQuote(s.symbol, s.name, s.display))
    );
    results.push(...batchResults);

    const visibleResults = results.filter((r) => r.price !== null);
    options.onBatch?.(visibleResults);

    if (delayMs > 0 && index < batches.length - 1) {
      await delay(delayMs);
    }
  }

  return results.filter((r) => r.price !== null);
}

export async function fetchCrypto(): Promise<CryptoData[]> {
  try {
    const response = await fetchWithProxy(API_URLS.coingecko);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data: CoinGeckoResponse = await response.json();

    return Object.entries(CRYPTO_MAP).map(([id, info]) => {
      const coinData = data[id];
      return {
        name: info.name,
        symbol: info.symbol,
        price: coinData?.usd ?? 0,
        change: coinData?.usd_24h_change ?? 0,
      };
    });
  } catch (e) {
    console.error('Failed to fetch crypto:', e);
    return [];
  }
}
