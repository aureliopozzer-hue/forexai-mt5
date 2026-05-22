// Binance API Integration Module — ForexAI Pro
// Provides real-time cryptocurrency data from Binance's public REST API
// No API key required for public endpoints
// SERVER-SIDE ONLY — do NOT import this module on the client

// ======================== TYPE DEFINITIONS ========================

export interface BinanceTicker {
  symbol: string;              // e.g., "BTCUSDT"
  priceChange: string;         // 24h price change
  priceChangePercent: string;  // 24h % change
  weightedAvgPrice: string;
  lastPrice: string;
  lastQty: string;
  openPrice: string;
  highPrice: string;
  lowPrice: string;
  volume: string;              // 24h volume in base asset
  quoteVolume: string;         // 24h volume in quote asset (USDT)
  trades: number;
}

export interface BinancePrice {
  symbol: string;
  price: string;
}

export interface BinanceKline {
  openTime: number;
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
  closeTime: number;
  quoteAssetVolume: string;
  numberOfTrades: number;
}

export interface BinanceDepth {
  lastUpdateId: number;
  bids: [string, string][];  // [price, qty]
  asks: [string, string][];  // [price, qty]
}

// ======================== SYMBOL MAPPING ========================
// Maps Yahoo Finance crypto symbols to Binance symbol format
// Binance uses BASE+QUOTE format (e.g., BTCUSDT) whereas Yahoo uses BASE-USD

const YAHOO_TO_BINANCE: Record<string, string> = {
  'BTC-USD': 'BTCUSDT',
  'ETH-USD': 'ETHUSDT',
  'SOL-USD': 'SOLUSDT',
  'XRP-USD': 'XRPUSDT',
  'BNB-USD': 'BNBUSDT',
  'ADA-USD': 'ADAUSDT',
  'DOGE-USD': 'DOGEUSDT',
  'AVAX-USD': 'AVAXUSDT',
  'DOT-USD': 'DOTUSDT',
  'LINK-USD': 'LINKUSDT',
  'MATIC-USD': 'MATICUSDT',
  'UNI7083-USD': 'UNIUSDT',
  'ATOM-USD': 'ATOMUSDT',
  'LTC-USD': 'LTCUSDT',
  'NEAR-USD': 'NEARUSDT',
  'ALGO-USD': 'ALGOUSDT',
  'ARB11841-USD': 'ARBUSDT',
  'OP-USD': 'OPUSDT',
  'FIL-USD': 'FILUSDT',
  'AAVE-USD': 'AAVEUSDT',
  'RENDER-USD': 'RENDERUSDT',
  'INJ-USD': 'INJUSDT',
  'SUI20947-USD': 'SUIUSDT',
  'TON11419-USD': 'TONUSDT',
};

// Reverse mapping: Binance → Yahoo
const BINANCE_TO_YAHOO: Record<string, string> = Object.fromEntries(
  Object.entries(YAHOO_TO_BINANCE).map(([y, b]) => [b, y])
);

/**
 * Convert a Yahoo Finance crypto symbol to Binance format
 * e.g., "BTC-USD" → "BTCUSDT"
 * Returns null if the symbol is not a known crypto pair
 */
export function yahooToBinanceSymbol(yahooSymbol: string): string | null {
  return YAHOO_TO_BINANCE[yahooSymbol] ?? null;
}

/**
 * Convert a Binance symbol back to Yahoo Finance format
 * e.g., "BTCUSDT" → "BTC-USD"
 * Returns null if the symbol is not in the mapping
 */
export function binanceToYahooSymbol(binanceSymbol: string): string | null {
  return BINANCE_TO_YAHOO[binanceSymbol] ?? null;
}

/**
 * Resolve any input symbol to a Binance symbol.
 * Accepts both Yahoo Finance format ("BTC-USD") and native Binance format ("BTCUSDT").
 * Returns the Binance symbol, or null if unrecognized.
 */
function resolveToBinanceSymbol(symbol: string): string | null {
  // Direct match in Yahoo → Binance map
  if (YAHOO_TO_BINANCE[symbol]) return YAHOO_TO_BINANCE[symbol];
  // Already in Binance format (ends with USDT, BTC, ETH, BNB)
  if (/^[A-Z]{2,}(USDT|BTC|ETH|BNB|BRL|BUSD)$/.test(symbol)) return symbol;
  // Try uppercase as fallback
  const upper = symbol.toUpperCase();
  if (YAHOO_TO_BINANCE[upper]) return YAHOO_TO_BINANCE[upper];
  return null;
}

// ======================== IN-MEMORY CACHE ========================
// Same pattern as finance-api.ts

const cache = new Map<string, { data: any; timestamp: number; ttl: number }>();

function getCached(key: string): any | null {
  const c = cache.get(key);
  if (c && Date.now() - c.timestamp < c.ttl) return c.data;
  return null;
}

function setCache(key: string, data: any, ttl: number): void {
  cache.set(key, { data, timestamp: Date.now(), ttl });
}

/** Clear a specific cache entry (useful for force-refresh) */
export function clearBinanceCacheEntry(key: string): void {
  cache.delete(key);
}

/** Clear all Binance cache entries */
export function clearBinanceCache(): void {
  cache.clear();
}

// Cache TTLs (in milliseconds)
const CACHE_TTL_TICKERS = 10_000;   // 10 seconds
const CACHE_TTL_KLINES  = 30_000;   // 30 seconds
const CACHE_TTL_DEPTH   = 5_000;    // 5 seconds
const CACHE_TTL_PRICES  = 10_000;   // 10 seconds

// ======================== RATE LIMITING ========================
// Binance allows 1200 requests per minute for public endpoints
// We track requests in a sliding window and add delays if approaching limits

const RATE_LIMIT_WINDOW = 60_000; // 1 minute
const RATE_LIMIT_MAX = 1100;      // Stay under 1200 with a safety margin
const RATE_LIMIT_COOLDOWN = 1000; // Wait 1s when approaching limit

let requestTimestamps: number[] = [];

/**
 * Check rate limit and wait if necessary before making a request
 */
async function enforceRateLimit(): Promise<void> {
  const now = Date.now();
  // Prune timestamps older than the window
  requestTimestamps = requestTimestamps.filter(ts => now - ts < RATE_LIMIT_WINDOW);

  if (requestTimestamps.length >= RATE_LIMIT_MAX) {
    const oldestInWindow = requestTimestamps[0];
    const waitTime = RATE_LIMIT_WINDOW - (now - oldestInWindow) + 100; // +100ms buffer
    console.warn(`[Binance] Rate limit approaching (${requestTimestamps.length}/${RATE_LIMIT_MAX}), waiting ${waitTime}ms`);
    await delay(Math.min(waitTime, RATE_LIMIT_COOLDOWN));
  }

  requestTimestamps.push(Date.now());
}

// ======================== HTTP HELPERS ========================

const BINANCE_BASE_URL = 'https://api.binance.com';
const REQUEST_TIMEOUT = 10_000; // 10 seconds

/**
 * Fetch with timeout, error handling, and rate limiting
 */
async function binanceFetch<T>(endpoint: string, params: Record<string, string> = {}): Promise<T | null> {
  await enforceRateLimit();

  const url = new URL(`${BINANCE_BASE_URL}${endpoint}`);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  try {
    const response = await fetch(url.toString(), {
      signal: AbortSignal.timeout(REQUEST_TIMEOUT),
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'ForexAI-Pro/1.0',
      },
    });

    if (!response.ok) {
      console.warn(`[Binance] API returned ${response.status} for ${endpoint}`, params);
      // Handle Binance-specific rate limit headers
      if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After');
        const waitMs = retryAfter ? parseInt(retryAfter, 10) * 1000 : RATE_LIMIT_COOLDOWN;
        console.warn(`[Binance] Rate limited (429), Retry-After: ${waitMs}ms`);
        await delay(Math.min(waitMs, 5000));
      }
      return null;
    }

    return await response.json() as T;
  } catch (err: any) {
    // Don't log timeout errors at warn level — they're expected under load
    if (err.name === 'TimeoutError' || err.code === 'UND_ERR_CONNECT_TIMEOUT') {
      console.warn(`[Binance] Request timeout for ${endpoint}`, params);
    } else {
      console.warn(`[Binance] Fetch failed for ${endpoint}:`, err.message);
    }
    return null;
  }
}

function delay(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

// ======================== PUBLIC API FUNCTIONS ========================

/**
 * Get 24h ticker data for specific symbols.
 * Uses the batch endpoint with symbol array for efficiency.
 * @param symbols - Array of symbols in Yahoo Finance format (e.g., ["BTC-USD"]) or Binance format (e.g., ["BTCUSDT"])
 * @returns Array of BinanceTicker objects
 */
export async function getBinanceTickers(symbols: string[]): Promise<BinanceTicker[]> {
  if (symbols.length === 0) return [];

  // Resolve all symbols to Binance format
  const binanceSymbols = symbols
    .map(resolveToBinanceSymbol)
    .filter((s): s is string => s !== null);

  if (binanceSymbols.length === 0) return [];

  const cacheKey = `tickers:${binanceSymbols.sort().join(',')}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  // Binance supports batch queries via JSON array in the symbols param
  // GET /api/v3/ticker/24hr?symbols=["BTCUSDT","ETHUSDT"]
  const symbolsParam = JSON.stringify(binanceSymbols);

  const data = await binanceFetch<BinanceTicker[]>('/api/v3/ticker/24hr', {
    symbols: symbolsParam,
  });

  if (!data || !Array.isArray(data)) {
    // Fallback: try fetching individually (slower but more resilient)
    console.warn('[Binance] Batch ticker fetch failed, trying individual requests');
    const results = await fetchTickersIndividually(binanceSymbols);
    if (results.length > 0) {
      setCache(cacheKey, results, CACHE_TTL_TICKERS);
    }
    return results;
  }

  setCache(cacheKey, data, CACHE_TTL_TICKERS);
  return data;
}

/**
 * Fallback: Fetch tickers one by one when batch endpoint fails
 */
async function fetchTickersIndividually(symbols: string[]): Promise<BinanceTicker[]> {
  const results: BinanceTicker[] = [];
  const BATCH_SIZE = 5;

  for (let i = 0; i < symbols.length; i += BATCH_SIZE) {
    const batch = symbols.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.allSettled(
      batch.map(async (symbol) => {
        return await binanceFetch<BinanceTicker>('/api/v3/ticker/24hr', { symbol });
      })
    );

    for (const r of batchResults) {
      if (r.status === 'fulfilled' && r.value) {
        results.push(r.value);
      }
    }

    // Small delay between batches to stay within rate limits
    if (i + BATCH_SIZE < symbols.length) {
      await delay(100);
    }
  }

  return results;
}

/**
 * Get latest price for specific symbols.
 * More lightweight than full ticker data — just symbol + price.
 * @param symbols - Array of symbols in Yahoo or Binance format
 * @returns Array of BinancePrice objects
 */
export async function getBinancePrices(symbols: string[]): Promise<BinancePrice[]> {
  if (symbols.length === 0) return [];

  const binanceSymbols = symbols
    .map(resolveToBinanceSymbol)
    .filter((s): s is string => s !== null);

  if (binanceSymbols.length === 0) return [];

  const cacheKey = `prices:${binanceSymbols.sort().join(',')}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  // Batch query using symbols parameter
  const symbolsParam = JSON.stringify(binanceSymbols);

  const data = await binanceFetch<BinancePrice[]>('/api/v3/ticker/price', {
    symbols: symbolsParam,
  });

  if (!data || !Array.isArray(data)) {
    // Fallback: individual requests
    const results: BinancePrice[] = [];
    for (const symbol of binanceSymbols) {
      const price = await binanceFetch<BinancePrice>('/api/v3/ticker/price', { symbol });
      if (price) results.push(price);
      await delay(50);
    }
    if (results.length > 0) {
      setCache(cacheKey, results, CACHE_TTL_PRICES);
    }
    return results;
  }

  setCache(cacheKey, data, CACHE_TTL_PRICES);
  return data;
}

/**
 * Get kline/candlestick data from Binance.
 * @param symbol - Symbol in Yahoo or Binance format
 * @param interval - Kline interval: 1s, 1m, 3m, 5m, 15m, 30m, 1h, 2h, 4h, 6h, 8h, 12h, 1d, 3d, 1w, 1M
 * @param limit - Number of candles to return (default 500, max 1000)
 * @returns Array of BinanceKline objects
 */
export async function getBinanceKlines(
  symbol: string,
  interval: string,
  limit: number = 500
): Promise<BinanceKline[]> {
  const binanceSymbol = resolveToBinanceSymbol(symbol);
  if (!binanceSymbol) return [];

  const cacheKey = `klines:${binanceSymbol}:${interval}:${limit}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  // Binance klines return raw arrays: [[openTime, open, high, low, close, volume, closeTime, quoteAssetVolume, ...], ...]
  const rawData = await binanceFetch<any[]>('/api/v3/klines', {
    symbol: binanceSymbol,
    interval,
    limit: String(Math.min(limit, 1000)),
  });

  if (!rawData || !Array.isArray(rawData) || rawData.length === 0) {
    return [];
  }

  // Transform raw array format into typed BinanceKline objects
  const klines: BinanceKline[] = rawData.map((k: any[]) => ({
    openTime: Number(k[0]),
    open: String(k[1]),
    high: String(k[2]),
    low: String(k[3]),
    close: String(k[4]),
    volume: String(k[5]),
    closeTime: Number(k[6]),
    quoteAssetVolume: String(k[7]),
    numberOfTrades: Number(k[8]),
  }));

  setCache(cacheKey, klines, CACHE_TTL_KLINES);
  return klines;
}

/**
 * Get order book depth from Binance.
 * @param symbol - Symbol in Yahoo or Binance format
 * @param limit - Number of price levels (5, 10, 20, 50, 100, 500, 1000, 5000)
 * @returns BinanceDepth object with bids and asks
 */
export async function getBinanceDepth(
  symbol: string,
  limit: number = 20
): Promise<BinanceDepth> {
  const emptyDepth: BinanceDepth = { lastUpdateId: 0, bids: [], asks: [] };

  const binanceSymbol = resolveToBinanceSymbol(symbol);
  if (!binanceSymbol) return emptyDepth;

  const cacheKey = `depth:${binanceSymbol}:${limit}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const validLimits = [5, 10, 20, 50, 100, 500, 1000, 5000];
  const safeLimit = validLimits.includes(limit) ? limit : 20;

  const data = await binanceFetch<BinanceDepth>('/api/v3/depth', {
    symbol: binanceSymbol,
    limit: String(safeLimit),
  });

  if (!data) return emptyDepth;

  // Ensure bids/asks are properly typed as [string, string][]
  const depth: BinanceDepth = {
    lastUpdateId: data.lastUpdateId || 0,
    bids: (data.bids || []).map((b: any) => [String(b[0]), String(b[1])] as [string, string]),
    asks: (data.asks || []).map((a: any) => [String(a[0]), String(a[1])] as [string, string]),
  };

  setCache(cacheKey, depth, CACHE_TTL_DEPTH);
  return depth;
}

/**
 * Get current average price for a symbol from Binance.
 * This is the 5-minute average price used for best price estimation.
 * @param symbol - Symbol in Yahoo or Binance format
 * @returns Object with mins (averaging interval) and price, or null
 */
export async function getBinanceAvgPrice(symbol: string): Promise<{ mins: number; price: string } | null> {
  const binanceSymbol = resolveToBinanceSymbol(symbol);
  if (!binanceSymbol) return null;

  const cacheKey = `avgPrice:${binanceSymbol}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const data = await binanceFetch<{ mins: number; price: string }>('/api/v3/avgPrice', {
    symbol: binanceSymbol,
  });

  if (!data) return null;

  setCache(cacheKey, data, CACHE_TTL_PRICES);
  return data;
}

// ======================== ENRICHED QUOTES ========================
// Merges Binance data into a format compatible with the Yahoo Finance quote structure
// used by the rest of the ForexAI Pro application

/**
 * Get enriched quote data that merges Binance ticker data with Yahoo Finance format.
 * This allows seamless integration with the existing quote display components.
 * @param symbols - Array of symbols in Yahoo Finance format (e.g., ["BTC-USD", "ETH-USD"])
 * @returns Record mapping Yahoo symbols to enriched quote objects
 */
export async function getBinanceEnrichedQuotes(symbols: string[]): Promise<Record<string, any>> {
  if (symbols.length === 0) return {};

  const results: Record<string, any> = {};

  // Filter to only crypto symbols that have a Binance mapping
  const cryptoSymbols = symbols.filter(s => YAHOO_TO_BINANCE[s]);
  if (cryptoSymbols.length === 0) return {};

  try {
    const tickers = await getBinanceTickers(cryptoSymbols);

    // Build a lookup map: Binance symbol → BinanceTicker
    const tickerMap = new Map<string, BinanceTicker>();
    for (const ticker of tickers) {
      tickerMap.set(ticker.symbol, ticker);
    }

    // Transform each Yahoo symbol's Binance data into enriched quote format
    for (const yahooSymbol of cryptoSymbols) {
      const binanceSymbol = YAHOO_TO_BINANCE[yahooSymbol];
      if (!binanceSymbol) continue;

      const ticker = tickerMap.get(binanceSymbol);
      if (!ticker) continue;

      const lastPrice = parseFloat(ticker.lastPrice);
      const priceChange = parseFloat(ticker.priceChange);
      const prevClose = lastPrice - priceChange;
      const changePercent = parseFloat(ticker.priceChangePercent);

      // Map to Yahoo Finance quote format for compatibility
      results[yahooSymbol] = {
        symbol: yahooSymbol,
        // Core price data
        regularMarketPrice: lastPrice,
        regularMarketChange: priceChange,
        regularMarketChangePercent: changePercent,
        regularMarketOpen: parseFloat(ticker.openPrice),
        regularMarketDayHigh: parseFloat(ticker.highPrice),
        regularMarketDayLow: parseFloat(ticker.lowPrice),
        regularMarketVolume: parseFloat(ticker.volume),
        regularMarketPreviousClose: prevClose,

        // Additional Binance-specific fields
        quoteVolume: parseFloat(ticker.quoteVolume),
        weightedAvgPrice: parseFloat(ticker.weightedAvgPrice),
        trades: ticker.trades,

        // 52-week data (Binance doesn't provide this directly, leave as 0)
        fiftyTwoWeekHigh: 0,
        fiftyTwoWeekLow: 0,

        // Metadata
        shortName: yahooSymbol.replace('-USD', ''),
        currency: 'USD',
        marketSource: 'binance',

        // Raw Binance data for advanced use cases
        _raw: ticker,
      };
    }
  } catch (err: any) {
    console.warn('[Binance] Enriched quotes failed:', err.message);
  }

  return results;
}

/**
 * Convert Binance kline data to the Yahoo Finance chart format
 * used by the application's history/chart components.
 * @param klines - Array of BinanceKline objects
 * @param yahooSymbol - The original Yahoo Finance symbol (e.g., "BTC-USD")
 * @returns Object with timestamps and OHLCV arrays compatible with Yahoo chart format
 */
export function klinesToYahooFormat(
  klines: BinanceKline[],
  yahooSymbol: string
): {
  timestamps: number[];
  opens: number[];
  highs: number[];
  lows: number[];
  closes: number[];
  volumes: number[];
} {
  return {
    timestamps: klines.map(k => Math.floor(k.openTime / 1000)),
    opens: klines.map(k => parseFloat(k.open)),
    highs: klines.map(k => parseFloat(k.high)),
    lows: klines.map(k => parseFloat(k.low)),
    closes: klines.map(k => parseFloat(k.close)),
    volumes: klines.map(k => parseFloat(k.volume)),
  };
}

/**
 * Map Yahoo Finance chart intervals to Binance kline intervals.
 * Binance supports: 1s, 1m, 3m, 5m, 15m, 30m, 1h, 2h, 4h, 6h, 8h, 12h, 1d, 3d, 1w, 1M
 */
export function yahooIntervalToBinance(yahooInterval: string): string {
  const mapping: Record<string, string> = {
    '1m': '1m',
    '2m': '1m',   // No 2m on Binance, use 1m
    '5m': '5m',
    '15m': '15m',
    '30m': '30m',
    '60m': '1h',
    '90m': '1h',  // No 90m on Binance, use 1h
    '1h': '1h',
    '4h': '4h',
    '1d': '1d',
    '5d': '3d',   // No 5d on Binance, use 3d
    '1wk': '1w',
    '1mo': '1M',
  };
  return mapping[yahooInterval] || '1d';
}
