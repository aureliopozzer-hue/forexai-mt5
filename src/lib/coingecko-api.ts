// CoinGecko API Integration Module
// Provides cryptocurrency market data from CoinGecko's FREE public API
// No API key required — rate limited to ~30 requests/minute
// SERVER-SIDE ONLY — do not use on the client

// ======================== TYPE DEFINITIONS ========================

export interface CoinMarket {
  id: string;
  symbol: string;
  name: string;
  image: string;
  current_price: number;
  market_cap: number;
  market_cap_rank: number;
  fully_diluted_valuation: number | null;
  total_volume: number;
  high_24h: number;
  low_24h: number;
  price_change_24h: number;
  price_change_percentage_24h: number;
  market_cap_change_24h: number;
  market_cap_change_percentage_24h: number;
  circulating_supply: number;
  total_supply: number | null;
  max_supply: number | null;
  ath: number;
  ath_change_percentage: number;
  ath_date: string;
  atl: number;
  atl_change_percentage: number;
  atl_date: string;
  last_updated: string;
  sparkline_in_7d?: { price: number[] };
}

export interface SimplePrice {
  usd: number;
  usd_market_cap?: number;
  usd_24h_vol?: number;
  usd_24h_change?: number;
  last_updated_at?: number;
}

export interface CoinChart {
  prices: [number, number][];
  market_caps: [number, number][];
  total_volumes: [number, number][];
}

export interface GlobalData {
  data: {
    active_cryptocurrencies: number;
    markets: number;
    total_market_cap: Record<string, number>;
    total_volume: Record<string, number>;
    market_cap_percentage: Record<string, number>;
    market_cap_change_percentage_24h_usd: number;
  };
}

export interface TrendingCoin {
  item: {
    id: string;
    coin_id: number;
    name: string;
    symbol: string;
    market_cap_rank: number;
    thumb: string;
    small: string;
    large: string;
    slug: string;
    price_btc: number;
    score: number;
  };
}

export interface CryptoMarketInfo {
  marketCap: number;
  marketCapRank: number;
  volume24h: number;
  high24h: number;
  low24h: number;
  circulatingSupply: number;
  maxSupply: number | null;
  ath: number;
  athChangePercent: number;
  atl: number;
  atlChangePercent: number;
  priceChange24h: number;
  priceChangePercent24h: number;
}

// ======================== SYMBOL MAPPING ========================

/** Map from Yahoo Finance crypto symbols to CoinGecko coin IDs */
const YAHOO_TO_COINGECKO: Record<string, string> = {
  'BTC-USD': 'bitcoin',
  'ETH-USD': 'ethereum',
  'SOL-USD': 'solana',
  'XRP-USD': 'ripple',
  'BNB-USD': 'binancecoin',
  'ADA-USD': 'cardano',
  'DOGE-USD': 'dogecoin',
  'AVAX-USD': 'avalanche-2',
  'DOT-USD': 'polkadot',
  'LINK-USD': 'chainlink',
  'MATIC-USD': 'matic-network',
  'UNI7083-USD': 'uniswap',
  'ATOM-USD': 'cosmos',
  'LTC-USD': 'litecoin',
  'NEAR-USD': 'near',
  'ALGO-USD': 'algorand',
  'ARB11841-USD': 'arbitrum',
  'OP-USD': 'optimism',
  'FIL-USD': 'filecoin',
  'AAVE-USD': 'aave',
  'RENDER-USD': 'render-token',
  'INJ-USD': 'injective-protocol',
  'SUI20947-USD': 'sui',
  'TON11419-USD': 'the-open-network',
  'PEPE24478-USD': 'pepe',
  'SHIB-USD': 'shiba-inu',
  'TRX-USD': 'tron',
  'USDT-USD': 'tether',
  'USDC-USD': 'usd-coin',
  // New crypto symbols
  'APT-USD': 'aptos',
  'TIA-USD': 'celestia',
  'SEI-USD': 'sei-network',
  'IMX-USD': 'immutable-x',
  'STX-USD': 'blockstack',
  'TIA21959-USD': 'celestia',
  'RUNE-USD': 'thorchain',
  'MKR-USD': 'maker',
  'SNX-USD': 'havven',
  'GRT-USD': 'the-graph',
  'APE-USD': 'apecoin',
  'ARB-USD': 'arbitrum',
  'COMP-USD': 'compound-governance-token',
  'CRV-USD': 'curve-dao-token',
  'LDO-USD': 'lido-dao',
  'CFX-USD': 'conflux-token',
  'WLD-USD': 'worldcoin-wld',
  'PENDLE-USD': 'pendle',
  'JUP-USD': 'jupiter-exchange-solana',
  'ENA-USD': 'ethena',
  'ONDO-USD': 'ondo-finance',
  'WIF-USD': 'dogwifcoin',
  'BONK-USD': 'bonk',
  'FET-USD': 'fetch-ai',
  'ALT-USD': 'altlayer',
  'DYM-USD': 'dymension',
  'STRK-USD': 'starknet',
  'PIXEL-USD': 'pixel',
  'PORTAL-USD': 'portal',
  'AEVO-USD': 'aevo',
  // Short-form variants (same CoinGecko IDs as the numbered versions above)
  'TON-USD': 'the-open-network',
  'SUI-USD': 'sui',
  'RNDR-USD': 'render-token',
};

/** Reverse map: CoinGecko coin ID → Yahoo Finance symbol */
const COINGECKO_TO_YAHOO: Record<string, string> = {};
for (const [yahoo, cgId] of Object.entries(YAHOO_TO_COINGECKO)) {
  // Only store the first mapping for each CoinGecko ID (avoid duplicates)
  if (!COINGECKO_TO_YAHOO[cgId]) {
    COINGECKO_TO_YAHOO[cgId] = yahoo;
  }
}

/**
 * Convert Yahoo Finance crypto symbol to CoinGecko coin ID
 * e.g., "BTC-USD" → "bitcoin"
 */
export function yahooToCoinGeckoId(yahooSymbol: string): string | null {
  return YAHOO_TO_COINGECKO[yahooSymbol] ?? null;
}

/**
 * Convert CoinGecko coin ID to Yahoo Finance symbol
 * e.g., "bitcoin" → "BTC-USD"
 */
export function coinGeckoIdToYahoo(coinId: string): string | null {
  return COINGECKO_TO_YAHOO[coinId] ?? null;
}

// ======================== CONSTANTS ========================

const BASE_URL = 'https://api.coingecko.com/api/v3';

const REQUEST_TIMEOUT = 10000; // 10 seconds

// Cache TTLs (in milliseconds)
const CACHE_TTL = {
  MARKET: 60_000,      // 60 seconds
  SIMPLE_PRICE: 30_000, // 30 seconds
  CHART: 300_000,       // 5 minutes
  GLOBAL: 300_000,      // 5 minutes
  TRENDING: 600_000,    // 10 minutes
} as const;

// Rate limiting config
const RATE_LIMIT_MAX_REQUESTS = 25; // Max requests per minute (safety margin from 30)
const RATE_LIMIT_WINDOW = 60_000;   // 1 minute window
const REQUEST_DELAY = 2000;         // 2-second delay between requests

// ======================== IN-MEMORY CACHE ========================

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

const cache = new Map<string, CacheEntry<unknown>>();

function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (entry && Date.now() - entry.timestamp < entry.ttl) {
    return entry.data as T;
  }
  if (entry) {
    cache.delete(key); // Expired entry cleanup
  }
  return null;
}

function setCache<T>(key: string, data: T, ttl: number): void {
  cache.set(key, { data, timestamp: Date.now(), ttl });
}

/** Clear all CoinGecko cache entries */
export function clearCoinGeckoCache(): void {
  cache.clear();
}

/** Clear a specific cache entry by key */
export function clearCoinGeckoCacheEntry(key: string): void {
  cache.delete(key);
}

// ======================== RATE LIMITER ========================

let requestTimestamps: number[] = [];

/**
 * Simple rate limiter: tracks requests per minute.
 * If we've made >= RATE_LIMIT_MAX_REQUESTS in the last minute, waits before proceeding.
 */
async function enforceRateLimit(): Promise<void> {
  const now = Date.now();

  // Remove timestamps older than the window
  requestTimestamps = requestTimestamps.filter(ts => now - ts < RATE_LIMIT_WINDOW);

  if (requestTimestamps.length >= RATE_LIMIT_MAX_REQUESTS) {
    // Calculate how long to wait until the oldest request exits the window
    const oldestInWindow = requestTimestamps[0];
    const waitTime = RATE_LIMIT_WINDOW - (now - oldestInWindow) + 100; // +100ms safety
    console.log(`[CoinGecko] Rate limit reached (${requestTimestamps.length} req/min). Waiting ${Math.ceil(waitTime / 1000)}s...`);
    await delay(waitTime);
  }

  // Add delay between requests as a safety measure
  requestTimestamps.push(Date.now());
}

// ======================== UTILITY FUNCTIONS ========================

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Core fetch function with rate limiting, timeout, error handling, and retry on 429
 */
async function coinGeckoFetch<T>(
  endpoint: string,
  params: Record<string, string> = {}
): Promise<T | null> {
  await enforceRateLimit();

  const urlParams = new URLSearchParams(params);
  const url = `${BASE_URL}${endpoint}?${urlParams.toString()}`;

  const headers: Record<string, string> = {
    'Accept': 'application/json',
    'User-Agent': 'ForexAI-Pro/1.0 (contact@forexai.pro)',
  };

  try {
    const response = await fetch(url, {
      headers,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT),
    });

    // Handle rate limit response (429)
    if (response.status === 429) {
      console.warn('[CoinGecko] Rate limited (429). Retrying after cooldown...');
      // Wait and retry once
      const retryAfter = parseInt(response.headers.get('Retry-After') || '60', 10);
      const waitMs = Math.min(retryAfter * 1000, 60_000); // Cap at 60s
      await delay(waitMs);

      const retryResponse = await fetch(url, {
        headers,
        signal: AbortSignal.timeout(REQUEST_TIMEOUT),
      });

      if (retryResponse.ok) {
        return await retryResponse.json() as T;
      }

      console.error(`[CoinGecko] Retry failed with status ${retryResponse.status}`);
      return null;
    }

    if (!response.ok) {
      console.error(`[CoinGecko] API error: ${response.status} ${response.statusText} for ${endpoint}`);
      return null;
    }

    return await response.json() as T;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[CoinGecko] Request failed for ${endpoint}:`, message);
    return null;
  }
}

// ======================== API FUNCTIONS ========================

/**
 * Get market data for top coins (with market cap, volume, rank, etc.)
 * Uses CoinGecko /coins/markets endpoint
 */
export async function getCoinMarkets(
  coinIds: string[],
  vsCurrency: string = 'usd'
): Promise<CoinMarket[]> {
  if (coinIds.length === 0) return [];

  const cacheKey = `markets:${coinIds.sort().join(',')}:${vsCurrency}`;
  const cached = getCached<CoinMarket[]>(cacheKey);
  if (cached) return cached;

  const data = await coinGeckoFetch<CoinMarket[]>('/coins/markets', {
    vs_currency: vsCurrency,
    ids: coinIds.join(','),
    order: 'market_cap_desc',
    per_page: String(Math.min(coinIds.length, 250)),
    page: '1',
    sparkline: 'true',
    price_change_percentage: '24h',
  });

  if (data) {
    setCache(cacheKey, data, CACHE_TTL.MARKET);
    return data;
  }

  return [];
}

/**
 * Get simple prices for multiple coins
 * Uses CoinGecko /simple/price endpoint
 */
export async function getSimplePrices(
  coinIds: string[],
  vsCurrency: string = 'usd'
): Promise<Record<string, SimplePrice>> {
  if (coinIds.length === 0) return {};

  const cacheKey = `simple:${coinIds.sort().join(',')}:${vsCurrency}`;
  const cached = getCached<Record<string, SimplePrice>>(cacheKey);
  if (cached) return cached;

  const data = await coinGeckoFetch<Record<string, Record<string, number>>>('/simple/price', {
    ids: coinIds.join(','),
    vs_currencies: vsCurrency,
    include_market_cap: 'true',
    include_24hr_vol: 'true',
    include_24hr_change: 'true',
    include_last_updated_at: 'true',
  });

  if (data) {
    // Transform CoinGecko response to our SimplePrice interface
    const result: Record<string, SimplePrice> = {};
    for (const [coinId, priceData] of Object.entries(data)) {
      result[coinId] = {
        usd: priceData.usd ?? 0,
        usd_market_cap: priceData.usd_market_cap,
        usd_24h_vol: priceData.usd_24h_vol,
        usd_24h_change: priceData.usd_24h_change,
        last_updated_at: priceData.last_updated_at,
      };
    }
    setCache(cacheKey, result, CACHE_TTL.SIMPLE_PRICE);
    return result;
  }

  return {};
}

/**
 * Get historical chart data for a single coin
 * Uses CoinGecko /coins/{id}/market_chart endpoint
 */
export async function getCoinChart(
  coinId: string,
  days: number,
  vsCurrency: string = 'usd'
): Promise<CoinChart> {
  const cacheKey = `chart:${coinId}:${days}:${vsCurrency}`;
  const cached = getCached<CoinChart>(cacheKey);
  if (cached) return cached;

  const emptyChart: CoinChart = { prices: [], market_caps: [], total_volumes: [] };

  const data = await coinGeckoFetch<CoinChart>(`/coins/${coinId}/market_chart`, {
    vs_currency: vsCurrency,
    days: String(days),
  });

  if (data) {
    setCache(cacheKey, data, CACHE_TTL.CHART);
    return data;
  }

  return emptyChart;
}

/**
 * Get global crypto market data (total market cap, volume, BTC dominance)
 * Uses CoinGecko /global endpoint
 */
export async function getGlobalData(): Promise<GlobalData | null> {
  const cacheKey = 'global';
  const cached = getCached<GlobalData>(cacheKey);
  if (cached) return cached;

  const data = await coinGeckoFetch<GlobalData>('/global');

  if (data) {
    setCache(cacheKey, data, CACHE_TTL.GLOBAL);
    return data;
  }

  return null;
}

/**
 * Get trending coins
 * Uses CoinGecko /search/trending endpoint
 */
export async function getTrendingCoins(): Promise<TrendingCoin[]> {
  const cacheKey = 'trending';
  const cached = getCached<TrendingCoin[]>(cacheKey);
  if (cached) return cached;

  const data = await coinGeckoFetch<{ coins: TrendingCoin[] }>('/search/trending');

  if (data?.coins) {
    setCache(cacheKey, data.coins, CACHE_TTL.TRENDING);
    return data.coins;
  }

  return [];
}

/**
 * Get enriched market data merged with our crypto symbols.
 * Converts Yahoo Finance symbols to CoinGecko IDs, fetches market data,
 * and returns a map keyed by the original Yahoo Finance symbols.
 */
export async function getCryptoMarketData(
  symbols: string[]
): Promise<Record<string, CryptoMarketInfo>> {
  if (symbols.length === 0) return {};

  const result: Record<string, CryptoMarketInfo> = {};

  // Map Yahoo symbols to CoinGecko IDs, keeping track of the mapping
  const symbolToCoinGeckoId = new Map<string, string>();
  const coinGeckoIds: string[] = [];

  for (const symbol of symbols) {
    const cgId = yahooToCoinGeckoId(symbol);
    if (cgId) {
      symbolToCoinGeckoId.set(symbol, cgId);
      if (!coinGeckoIds.includes(cgId)) {
        coinGeckoIds.push(cgId);
      }
    }
  }

  if (coinGeckoIds.length === 0) return {};

  // Fetch market data from CoinGecko
  const marketData = await getCoinMarkets(coinGeckoIds);

  // Build a lookup by CoinGecko ID
  const marketById = new Map<string, CoinMarket>();
  for (const coin of marketData) {
    marketById.set(coin.id, coin);
  }

  // Map results back to Yahoo Finance symbols
  symbolToCoinGeckoId.forEach((cgId, yahooSymbol) => {
    const coin = marketById.get(cgId);
    if (coin) {
      result[yahooSymbol] = {
        marketCap: coin.market_cap,
        marketCapRank: coin.market_cap_rank,
        volume24h: coin.total_volume,
        high24h: coin.high_24h,
        low24h: coin.low_24h,
        circulatingSupply: coin.circulating_supply,
        maxSupply: coin.max_supply,
        ath: coin.ath,
        athChangePercent: coin.ath_change_percentage,
        atl: coin.atl,
        atlChangePercent: coin.atl_change_percentage,
        priceChange24h: coin.price_change_24h,
        priceChangePercent24h: coin.price_change_percentage_24h,
      };
    }
  });

  return result;
}

// ======================== CONVENIENCE FUNCTIONS ========================

/**
 * Get the CoinGecko coin ID for a Yahoo Finance crypto symbol.
 * Alias for yahooToCoinGeckoId with a more descriptive name.
 */
export function resolveCoinGeckoId(yahooSymbol: string): string | null {
  return yahooToCoinGeckoId(yahooSymbol);
}

/**
 * Check if a Yahoo Finance symbol is a supported crypto symbol
 */
export function isCryptoSymbol(symbol: string): boolean {
  return yahooToCoinGeckoId(symbol) !== null;
}

/**
 * Get all supported Yahoo Finance crypto symbols
 */
export function getSupportedCryptoSymbols(): string[] {
  return Object.keys(YAHOO_TO_COINGECKO);
}

/**
 * Get all supported CoinGecko coin IDs
 */
export function getSupportedCoinGeckoIds(): string[] {
  return Array.from(new Set(Object.values(YAHOO_TO_COINGECKO)));
}
