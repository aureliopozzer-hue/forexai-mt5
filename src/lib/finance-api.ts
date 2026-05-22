// Finance API - uses Yahoo Finance v8/v7 REST API directly via fetch()
// No heavy libraries needed — works on Netlify, Vercel, or any serverless platform
// Falls back to mock data when API is unavailable

// ======================== YAHOO FINANCE DIRECT API ========================
// Uses Yahoo Finance v8/v7 REST API with crumb-based authentication
// Works on Netlify, Vercel, or any serverless platform

const YF_CHART_URL = 'https://query1.finance.yahoo.com/v8/finance/chart';
const YF_QUOTE_URL = 'https://query2.finance.yahoo.com/v7/finance/quote';
const YF_CRUMB_URL = 'https://query2.finance.yahoo.com/v1/test/getcrumb';

// Common headers to mimic a browser request (avoids blocks)
const YF_HEADERS: Record<string, string> = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Accept': 'application/json,text/html,application/xhtml+xml',
  'Accept-Language': 'en-US,en;q=0.9',
  'Connection': 'keep-alive',
};

// ======================== CRUMB AUTH ========================
// Yahoo Finance requires a crumb (CSRF token) since 2023
// We fetch it once and cache it with the session cookies

let cachedCrumb: string | null = null;
let crumbCookies: string | null = null;
let crumbExpiry = 0;
let crumbFailUntil = 0; // Don't retry crumb fetch until this time (backoff on failure)

// Mutex to prevent race conditions when multiple requests fetch crumb simultaneously
let crumbPromise: Promise<string | null> | null = null;

/** Get a valid crumb from Yahoo Finance (cached for 1 hour, with failure backoff) */
async function getCrumb(): Promise<string | null> {
  if (cachedCrumb && crumbExpiry > Date.now()) return cachedCrumb;
  // Backoff: if crumb fetch recently failed, don't retry for 5 minutes
  if (Date.now() < crumbFailUntil) return null;

  // If another request is already fetching the crumb, wait for it
  if (crumbPromise) return crumbPromise;

  crumbPromise = fetchCrumbInternal();
  try {
    return await crumbPromise;
  } finally {
    crumbPromise = null;
  }
}

async function fetchCrumbInternal(): Promise<string | null> {
  // Double-check after acquiring lock
  if (cachedCrumb && crumbExpiry > Date.now()) return cachedCrumb;
  if (Date.now() < crumbFailUntil) return null;

  try {
    // Step 1: Get session cookies from Yahoo's lightweight cookie endpoint
    // Using fc.yahoo.com instead of finance.yahoo.com to avoid UND_ERR_HEADERS_OVERFLOW
    // (Yahoo Finance homepage returns too many Set-Cookie headers for Node.js undici)
    const homeResponse = await fetch('https://fc.yahoo.com/', {
      headers: {
        ...YF_HEADERS,
        'Accept': 'text/html',
      },
      signal: AbortSignal.timeout(10000),
      redirect: 'follow',
    });

    // Extract Set-Cookie headers using Node.js 20+ getSetCookie() API
    const setCookies: string[] = [];
    try {
      // Modern Node.js fetch (undici) exposes getSetCookie()
      const cookieHeaders = (homeResponse.headers as any).getSetCookie?.() as string[] | undefined;
      if (cookieHeaders && cookieHeaders.length > 0) {
        for (const c of cookieHeaders) {
          setCookies.push(c.split(';')[0]);
        }
      }
    } catch {
      // Fallback: try get() for set-cookie (may only return first value)
      const sc = homeResponse.headers.get('set-cookie');
      if (sc) setCookies.push(sc.split(';')[0]);
    }

    crumbCookies = setCookies.length > 0 ? setCookies.join('; ') : null;

    // Step 2: Get crumb using the session cookies
    // Note: crumb endpoint returns plain text, so don't use Accept: application/json
    const crumbHeaders: Record<string, string> = {
      'User-Agent': YF_HEADERS['User-Agent'],
      'Accept': '*/*',
      'Accept-Language': YF_HEADERS['Accept-Language'],
    };
    if (crumbCookies) crumbHeaders['Cookie'] = crumbCookies;

    const crumbResponse = await fetch(YF_CRUMB_URL, {
      headers: crumbHeaders,
      signal: AbortSignal.timeout(10000),
    });

    if (crumbResponse.ok) {
      cachedCrumb = await crumbResponse.text();
      crumbExpiry = Date.now() + 3600000; // Cache for 1 hour
      console.log('[YF] Crumb obtained successfully');
      return cachedCrumb;
    } else {
      console.warn(`[YF] Crumb fetch returned ${crumbResponse.status}`);
      crumbFailUntil = Date.now() + 300000; // Backoff 5 minutes on failure
      return null;
    }
  } catch (err: any) {
    console.warn('[YF] Crumb fetch failed:', err.message);
    crumbFailUntil = Date.now() + 300000; // Backoff 5 minutes on failure
    return null;
  }
}

/** Build headers with crumb cookies */
function buildAuthHeaders(): Record<string, string> {
  const headers = { ...YF_HEADERS };
  if (crumbCookies) headers['Cookie'] = crumbCookies;
  return headers;
}

/** Fetch chart data from Yahoo Finance v8 API */
async function fetchYFChart(symbol: string, interval: string, range: string): Promise<any | null> {
  try {
    const crumb = await getCrumb();
    const crumbParam = crumb ? `&crumb=${encodeURIComponent(crumb)}` : '';
    const url = `${YF_CHART_URL}/${encodeURIComponent(symbol)}?interval=${interval}&range=${range}&includePrePost=false${crumbParam}`;
    const response = await fetch(url, {
      headers: buildAuthHeaders(),
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) {
      // If 401, invalidate crumb so it's refreshed on next call
      if (response.status === 401) {
        cachedCrumb = null;
        crumbExpiry = 0;
      }
      console.warn(`[YF] Chart API returned ${response.status} for ${symbol}`);
      return null;
    }
    const json = await response.json();
    if (json.chart?.error) {
      console.warn(`[YF] Chart API error for ${symbol}:`, json.chart.error.description || json.chart.error);
      return null;
    }
    return json.chart?.result?.[0] || null;
  } catch (err: any) {
    console.warn(`[YF] Chart fetch failed for ${symbol}:`, err.message);
    return null;
  }
}

/** Fetch quote data from Yahoo Finance v7 API */
async function fetchYFQuote(symbol: string): Promise<any | null> {
  try {
    const crumb = await getCrumb();
    const crumbParam = crumb ? `&crumb=${encodeURIComponent(crumb)}` : '';
    const url = `${YF_QUOTE_URL}?symbols=${encodeURIComponent(symbol)}${crumbParam}`;
    const response = await fetch(url, {
      headers: buildAuthHeaders(),
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) {
      if (response.status === 401) {
        cachedCrumb = null;
        crumbExpiry = 0;
      }
      console.warn(`[YF] Quote API returned ${response.status} for ${symbol}`);
      return null;
    }
    const json = await response.json();
    return json.quoteResponse?.result?.[0] || null;
  } catch (err: any) {
    console.warn(`[YF] Quote fetch failed for ${symbol}:`, err.message);
    return null;
  }
}

/** Fetch batch quotes from Yahoo Finance v7 API */
async function fetchYFQuotes(symbols: string[]): Promise<any[]> {
  const results: any[] = [];
  const crumb = await getCrumb();
  const crumbParam = crumb ? `&crumb=${encodeURIComponent(crumb)}` : '';
  const hasCookies = !!crumbCookies;
  const BATCH_SIZE = 20;

  if (!crumb) {
    console.warn('[YF] No crumb available for quotes request, skipping YF API');
    return results;
  }
  if (!hasCookies) {
    console.warn('[YF] No cookies available for quotes request, skipping YF API');
    return results;
  }

  for (let i = 0; i < symbols.length; i += BATCH_SIZE) {
    const batch = symbols.slice(i, i + BATCH_SIZE);
    try {
      const url = `${YF_QUOTE_URL}?symbols=${batch.map(s => encodeURIComponent(s)).join(',')}${crumbParam}`;
      const response = await fetch(url, {
        headers: buildAuthHeaders(),
        signal: AbortSignal.timeout(15000),
      });
      if (response.ok) {
        const json = await response.json();
        const quotes = json.quoteResponse?.result || [];
        results.push(...quotes);
      } else {
        if (response.status === 401) {
          cachedCrumb = null;
          crumbExpiry = 0;
        }
        console.warn(`[YF] Batch quotes returned ${response.status}`);
      }
    } catch (err: any) {
      console.warn(`[YF] Batch quotes failed:`, err.message);
    }
    if (i + BATCH_SIZE < symbols.length) await delay(200);
  }
  return results;
}

// ======================== FINANCE GATEWAY (for news) ========================
let gatewayBaseUrl: string | null = null;

async function getGatewayConfig(): Promise<{ baseUrl: string; headers: Record<string, string> } | null> {
  if (gatewayBaseUrl) {
    return {
      baseUrl: gatewayBaseUrl,
      headers: { 'X-Z-AI-From': 'Z' },
    };
  }

  try {
    // Try to get the gateway URL from z-ai-web-dev-sdk (available on z.ai platform)
    const ZAI = (await import('z-ai-web-dev-sdk')).default;
    const zai = await ZAI.create();
    const baseUrl = zai.config?.baseUrl;
    if (baseUrl) {
      gatewayBaseUrl = baseUrl.replace(/\/v1$/, '');
      return {
        baseUrl: gatewayBaseUrl,
        headers: {
          'Authorization': `Bearer ${zai.config.apiKey}`,
          'X-Z-AI-From': 'Z',
        },
      };
    }
  } catch {
    // z-ai-web-dev-sdk not available (e.g., Netlify deployment)
  }

  return null;
}

// ======================== IN-MEMORY CACHE ========================
const cache = new Map<string, { data: any; timestamp: number; ttl: number }>();

function getCached(key: string): any | null {
  const c = cache.get(key);
  if (c && Date.now() - c.timestamp < c.ttl) return c.data;
  return null;
}

function setCache(key: string, data: any, ttl: number): void {
  cache.set(key, { data, timestamp: Date.now(), ttl });
}

/** Clear a specific cache entry (used for force-refresh) */
export function clearCacheEntry(key: string): void {
  cache.delete(key);
}

function delay(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

// ======================== MOCK DATA FALLBACK ========================

const MOCK_PRICES: Record<string, number> = {
  'EURUSD=X': 1.0852, 'GBPUSD=X': 1.2634, 'USDJPY=X': 154.32, 'USDCHF=X': 0.8912,
  'AUDUSD=X': 0.6523, 'USDCAD=X': 1.3645, 'NZDUSD=X': 0.6012, 'EURGBP=X': 0.8592,
  'EURJPY=X': 167.45, 'GBPJPY=X': 194.87, 'AUDJPY=X': 100.56, 'CHFJPY=X': 173.12,
  'EURAUD=X': 1.6634, 'EURCHF=X': 0.9671, 'GBPAUD=X': 1.9367, 'GBPAUD=X': 1.9367,
  'GBPCHF=X': 1.1257, 'AUDNZD=X': 1.0856, 'NZDJPY=X': 92.67, 'CADJPY=X': 113.12,
  'AUDCAD=X': 0.8845, 'USDBRL=X': 5.72, 'USDMXN=X': 17.15, 'USDZAR=X': 18.45,
  'USDSGD=X': 1.3412, 'USDHKD=X': 7.8215, 'USDTRY=X': 32.45, 'USDNOK=X': 10.87,
  'USDSEK=X': 10.56, 'USDCNY=X': 7.245, 'USDINR=X': 83.45,
  'EURBRL=X': 6.21, 'GBPBRL=X': 7.23, 'JPYBRL=X': 0.0371,
  '^GSPC': 5920.85, '^DJI': 42856.32, '^IXIC': 18945.67, '^RUT': 2089.45,
  '^VIX': 14.23, '^GSPTSE': 24789.12, '^MXX': 52345.67, '^BVSP': 134567.89,
  '^MERV': 89234.56, '^IPSA': 5678.90,
  '^FTSE': 8234.56, '^GDAXI': 19876.43, '^FCHI': 7890.12, '^STOXX50E': 4987.65,
  '^IBEX': 12345.67, 'FTSEMIB.MI': 34567.89, '^SSMI': 11234.56, '^AEX': 890.12,
  '^OMX': 2567.89, '^N225': 39876.54,
  '^HSI': 20123.45, '000001.SS': 3234.56, '399001.SZ': 10876.54, '000300.SS': 3987.65,
  '^KS11': 2678.90, '^TWII': 19876.54, '^AXJO': 7890.12, '^STI': 3234.56,
  '^NZ50': 12345.67, '^SET.BK': 1567.89,
  '^NSEI': 23456.78, '^BSESN': 76543.21,
  '^TASI.SR': 12345.67, 'J200.L': 78901.23,
  'GC=F': 2345.60, 'SI=F': 28.45, 'PL=F': 985.30, 'PA=F': 1025.40,
  'HG=F': 4.52, 'CL=F': 62.34, 'BZ=F': 65.87, 'NG=F': 2.145,
  'ZW=F': 542.25, 'ZC=F': 445.75, 'ZS=F': 1185.50, 'CT=F': 82.34,
  'SB=F': 18.45, 'CC=F': 8234.50,
  'BTC-USD': 67890.12, 'ETH-USD': 3456.78, 'SOL-USD': 145.67, 'XRP-USD': 0.5234,
  'BNB-USD': 612.34, 'ADA-USD': 0.4567, 'DOGE-USD': 0.1234, 'AVAX-USD': 35.67,
  'DOT-USD': 6.89, 'LINK-USD': 14.56, 'MATIC-USD': 0.7234, 'UNI7083-USD': 7.89,
  'ATOM-USD': 8.90, 'LTC-USD': 82.34, 'NEAR-USD': 5.67, 'ALGO-USD': 0.1789,
  'ARB11841-USD': 0.89, 'OP-USD': 2.34, 'FIL-USD': 5.67, 'AAVE-USD': 95.23,
  'RENDER-USD': 7.89, 'INJ-USD': 24.56, 'SUI20947-USD': 1.23, 'TON11419-USD': 5.67,
  'AAPL': 198.45, 'MSFT': 425.67, 'GOOGL': 167.89, 'AMZN': 185.23,
  'NVDA': 923.45, 'META': 512.34, 'TSLA': 245.67, 'JPM': 198.76,
  'V': 289.45, 'MA': 467.89, 'GS': 487.65, 'JNJ': 156.78,
  'UNH': 534.56, 'PFE': 28.34, 'XOM': 112.45, 'CVX': 156.78,
  'WMT': 67.89, 'NKE': 94.56, 'MCD': 298.12, 'SBUX': 78.45,
  'AMD': 167.89, 'INTC': 34.56, 'AVGO': 1345.67, 'QCOM': 178.90,
  'MU': 98.76, 'DIS': 112.34, 'NFLX': 678.90, 'CRM': 256.78,
  'ADBE': 489.56, 'ORCL': 126.78, 'IBM': 189.45, 'PYPL': 67.89,
  'COST': 798.12, 'BA': 189.34, 'CAT': 345.67,
  'SPY': 592.34, 'QQQ': 498.56, 'DIA': 398.45, 'IWM': 218.67,
  'XLK': 234.56, 'XLF': 38.90, 'XLE': 34.56, 'XLV': 134.78,
  'XLY': 167.89, 'XLP': 38.90, 'XLI': 98.76, 'XLU': 67.89,
  'XLRE': 34.56, 'XLB': 56.78, 'XLC': 89.12, 'GLD': 214.56,
  'SLV': 26.78, 'USO': 56.78, 'TLT': 92.34, 'IEF': 72.45,
  'HYG': 76.89, 'IBIT': 34.56, 'ETHA': 23.45, 'EWZ': 34.56,
  'FXI': 28.90, 'EWG': 32.45, 'EWJ': 56.78, 'EWN': 56.78,
  'UVXY': 12.34,
  'PETR4.SA': 38.45, 'VALE3.SA': 61.23, 'ITUB4.SA': 32.45, 'BBDC4.SA': 15.67,
  'BBAS3.SA': 56.78, 'SANB11.SA': 43.21, 'PETR3.SA': 39.87, 'VBBR3.SA': 21.34,
  'EGIE3.SA': 42.56, 'TAEE11.SA': 38.90, 'ABEV3.SA': 12.34, 'MGLU3.SA': 2.45,
  'COGN3.SA': 3.12, 'WEGE3.SA': 35.67, 'SUZB3.SA': 56.78, 'KLBN11.SA': 24.56,
  'CSAN3.SA': 15.67, 'CSNA3.SA': 11.23, 'GGBR4.SA': 23.45, 'RENT3.SA': 56.78,
  'BPAC11.SA': 28.90, 'IRBR3.SA': 34.56, 'RADL3.SA': 23.45, 'FLRY3.SA': 18.90,
  'HYPE3.SA': 67.89, 'UGPA3.SA': 14.56, 'BEEF3.SA': 89.12, 'SMTO3.SA': 11.23,
};

// ======================== SEEDED PRNG (stable data per symbol) ========================
function hashStr(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) - h + str.charCodeAt(i)) | 0;
  }
  return h;
}

function seededRandom(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

// Interval-to-millisecond mapping for proper intraday timestamps
const INTERVAL_MS: Record<string, number> = {
  '1m': 60000, '2m': 120000, '5m': 300000, '15m': 900000,
  '30m': 1800000, '60m': 3600000, '90m': 5400000, '1h': 3600000, '4h': 14400000,
  '1d': 86400000, '5d': 432000000, '1wk': 604800000, '1mo': 2592000000,
};

function mockQuote(symbol: string): any {
  const base = MOCK_PRICES[symbol] || 100;
  const rng = seededRandom(hashStr(symbol));
  const change = (rng() - 0.48) * base * 0.005;
  const price = base + change;
  const changePct = (change / base) * 100;
  const isJpy = symbol.includes('JPY') || symbol.includes('JPYBRL');
  const isCrypto = symbol.includes('USD') && (symbol.startsWith('BTC') || symbol.startsWith('ETH') || symbol.startsWith('SOL'));
  const isJpyBrl = symbol === 'JPYBRL=X';
  const decimals = isJpy ? 2 : isJpyBrl ? 4 : isCrypto ? 2 : symbol.includes('BRL') ? 2 : 4;

  return {
    symbol,
    regularMarketPrice: price,
    regularMarketChange: change,
    regularMarketChangePercent: changePct,
    regularMarketOpen: base - change * 0.3,
    regularMarketDayHigh: price + Math.abs(change) * 0.5,
    regularMarketDayLow: price - Math.abs(change) * 0.5,
    regularMarketVolume: Math.floor(rng() * 50000000) + 100000,
    regularMarketPreviousClose: base,
    fiftyTwoWeekHigh: base * 1.15,
    fiftyTwoWeekLow: base * 0.85,
    shortName: symbol.replace('=X', '').replace('-USD', ''),
    currency: symbol.includes('BRL') ? 'BRL' : symbol.includes('JPY') ? 'JPY' : 'USD',
  };
}

function mockHistoryData(symbol: string, interval: string, count: number): any[] {
  const base = MOCK_PRICES[symbol] || 100;
  const isJpy = symbol.includes('JPY');
  const isCrypto = symbol.includes('BTC') || symbol.includes('ETH') || symbol.includes('SOL');
  const candles: any[] = [];
  const now = Date.now();
  const rng = seededRandom(hashStr(symbol + ':' + interval));
  const intervalMs = INTERVAL_MS[interval] || 86400000;
  const isIntraday = intervalMs < 86400000;

  // Determine volatility based on instrument type and interval
  // Higher volatility per candle = more visible candlesticks
  let volatilityPct: number;
  if (isCrypto) {
    volatilityPct = isIntraday ? 0.003 : 0.008;
  } else if (isJpy) {
    volatilityPct = isIntraday ? 0.001 : 0.004;
  } else if (symbol.includes('BRL') || symbol.includes('MXN') || symbol.includes('ZAR')) {
    volatilityPct = isIntraday ? 0.002 : 0.006;
  } else if (symbol.includes('=X')) {
    volatilityPct = isIntraday ? 0.0015 : 0.005;
  } else if (symbol.startsWith('^') || symbol.includes('.SA')) {
    volatilityPct = isIntraday ? 0.002 : 0.007;
  } else {
    volatilityPct = isIntraday ? 0.002 : 0.006;
  }

  // Start price near base for realistic chart
  // Intraday: tight range (±0.2%), Daily: wider range (±3%)
  let price = isIntraday
    ? base * (0.998 + rng() * 0.004)
    : base * (0.97 + rng() * 0.06);

  for (let i = count; i >= 0; i--) {
    // Skip non-trading hours for forex intraday (weekends)
    if (isIntraday && symbol.includes('=X')) {
      const d = new Date(now - i * intervalMs);
      const day = d.getUTCDay();
      // Skip weekends (0=Sun, 6=Sat) — forex is closed
      if (day === 0 || day === 6) continue;
    }

    // Multi-wave price movement for realistic charts
    const wave1 = Math.sin(i * 0.3 + rng() * 0.5) * base * volatilityPct * 0.5;
    const wave2 = Math.sin(i * 0.07 + rng() * 2.0) * base * volatilityPct * 0.3;
    const noise = (rng() - 0.5) * base * volatilityPct * 0.4;
    const change = wave1 + wave2 + noise;

    price += change;
    // Keep price within realistic range
    // Intraday: tight (±2%), Daily: wider (±12%)
    const rangePct = isIntraday ? 0.02 : 0.12;
    price = Math.max(base * (1 - rangePct), Math.min(base * (1 + rangePct), price));

    // Generate proper timestamp based on interval
    let date: Date;
    if (isIntraday) {
      const ts = now - i * intervalMs;
      date = new Date(ts);
    } else {
      date = new Date(now - i * intervalMs);
    }

    // Generate OHLC with visible body and wicks
    const bodySize = Math.abs(change) * (0.6 + rng() * 0.8);
    const wickUp = rng() * bodySize * (0.5 + rng() * 1.0);
    const wickDown = rng() * bodySize * (0.5 + rng() * 1.0);

    const isUp = change >= 0;
    const open = isUp ? price - bodySize : price + bodySize;
    const close = price;
    const high = Math.max(open, close) + wickUp;
    const low = Math.min(open, close) - wickDown;

    // Format timestamp
    let dateStr: string;
    if (isIntraday) {
      dateStr = date.toISOString();
    } else {
      dateStr = date.toISOString().split('T')[0];
    }

    const decimals = isJpy ? 2 : (symbol.includes('BRL') ? 2 : (isCrypto ? 2 : (base >= 100 ? 2 : 4)));
    const mult = Math.pow(10, decimals);

    candles.push({
      date: dateStr,
      date_utc: Math.floor(date.getTime() / 1000),
      open: Math.round(open * mult) / mult,
      high: Math.round(high * mult) / mult,
      low: Math.round(low * mult) / mult,
      close: Math.round(close * mult) / mult,
      adjclose: Math.round(close * mult) / mult,
      volume: Math.floor(rng() * 10000000) + 100000,
    });
  }

  // Align last candle close with the mock quote price for consistency
  // Also smooth the transition to the last candle to prevent visual spikes
  if (candles.length > 1) {
    const quotePrice = MOCK_PRICES[symbol] || base;
    const decimals = isJpy ? 2 : (symbol.includes('BRL') ? 2 : (isCrypto ? 2 : (base >= 100 ? 2 : 4)));
    const mult = Math.pow(10, decimals);
    const lastCandle = candles[candles.length - 1];
    const prevCandle = candles[candles.length - 2];

    // Smooth transition: gradually move the last few candles towards the quote price
    const smoothCount = Math.min(3, candles.length - 1);
    for (let j = 0; j < smoothCount; j++) {
      const idx = candles.length - smoothCount + j;
      const blendFactor = (j + 1) / (smoothCount + 1); // 0.25, 0.5, 0.75
      const originalClose = candles[idx].close;
      const targetClose = j === smoothCount - 1 ? quotePrice :
        originalClose + (quotePrice - originalClose) * blendFactor * 0.3;

      candles[idx].close = Math.round(targetClose * mult) / mult;
      candles[idx].high = Math.round(Math.max(candles[idx].high, candles[idx].close) * mult) / mult;
      candles[idx].low = Math.round(Math.min(candles[idx].low, candles[idx].close) * mult) / mult;
      candles[idx].adjclose = candles[idx].close;
    }
  } else if (candles.length > 0) {
    const quotePrice = MOCK_PRICES[symbol] || base;
    const decimals = isJpy ? 2 : (symbol.includes('BRL') ? 2 : (isCrypto ? 2 : (base >= 100 ? 2 : 4)));
    const mult = Math.pow(10, decimals);
    const lastCandle = candles[candles.length - 1];
    lastCandle.close = Math.round(quotePrice * mult) / mult;
    lastCandle.high = Math.round(Math.max(lastCandle.high, quotePrice) * mult) / mult;
    lastCandle.low = Math.round(Math.min(lastCandle.low, quotePrice) * mult) / mult;
    lastCandle.adjclose = lastCandle.close;
  }

  return candles;
}

// ======================== INSTRUMENT TYPES ========================

export interface ApiInstrument {
  id: string;
  symbol: string;
  name: string;
  flag: string;
}

export type MarketCategory = 'forex' | 'indices' | 'metals' | 'crypto' | 'brazil' | 'stocks' | 'etfs';

// Forex pairs
export const FOREX_PAIRS: ApiInstrument[] = [
  { id: 'eurusd', symbol: 'EURUSD=X', name: 'EUR/USD', flag: '🇪🇺🇺🇸' },
  { id: 'gbpusd', symbol: 'GBPUSD=X', name: 'GBP/USD', flag: '🇬🇧🇺🇸' },
  { id: 'usdjpy', symbol: 'USDJPY=X', name: 'USD/JPY', flag: '🇺🇸🇯🇵' },
  { id: 'usdchf', symbol: 'USDCHF=X', name: 'USD/CHF', flag: '🇺🇸🇨🇭' },
  { id: 'audusd', symbol: 'AUDUSD=X', name: 'AUD/USD', flag: '🇦🇺🇺🇸' },
  { id: 'usdcad', symbol: 'USDCAD=X', name: 'USD/CAD', flag: '🇺🇸🇨🇦' },
  { id: 'nzdusd', symbol: 'NZDUSD=X', name: 'NZD/USD', flag: '🇳🇿🇺🇸' },
  { id: 'eurgbp', symbol: 'EURGBP=X', name: 'EUR/GBP', flag: '🇪🇺🇬🇧' },
  { id: 'eurjpy', symbol: 'EURJPY=X', name: 'EUR/JPY', flag: '🇪🇺🇯🇵' },
  { id: 'gbpjpy', symbol: 'GBPJPY=X', name: 'GBP/JPY', flag: '🇬🇧🇯🇵' },
  { id: 'audjpy', symbol: 'AUDJPY=X', name: 'AUD/JPY', flag: '🇦🇺🇯🇵' },
  { id: 'chfjpy', symbol: 'CHFJPY=X', name: 'CHF/JPY', flag: '🇨🇭🇯🇵' },
  { id: 'euraud', symbol: 'EURAUD=X', name: 'EUR/AUD', flag: '🇪🇺🇦🇺' },
  { id: 'eurchf', symbol: 'EURCHF=X', name: 'EUR/CHF', flag: '🇪🇺🇨🇭' },
  { id: 'gbpaud', symbol: 'GBPAUD=X', name: 'GBP/AUD', flag: '🇬🇧🇦🇺' },
  { id: 'gbpchf', symbol: 'GBPCHF=X', name: 'GBP/CHF', flag: '🇬🇧🇨🇭' },
  { id: 'audnzd', symbol: 'AUDNZD=X', name: 'AUD/NZD', flag: '🇦🇺🇳🇿' },
  { id: 'nzdjpy', symbol: 'NZDJPY=X', name: 'NZD/JPY', flag: '🇳🇿🇯🇵' },
  { id: 'cadjpy', symbol: 'CADJPY=X', name: 'CAD/JPY', flag: '🇨🇦🇯🇵' },
  { id: 'audcad', symbol: 'AUDCAD=X', name: 'AUD/CAD', flag: '🇦🇺🇨🇦' },
  { id: 'usdbrl', symbol: 'USDBRL=X', name: 'USD/BRL', flag: '🇺🇸🇧🇷' },
  { id: 'usdmxn', symbol: 'USDMXN=X', name: 'USD/MXN', flag: '🇺🇸🇲🇽' },
  { id: 'usdzar', symbol: 'USDZAR=X', name: 'USD/ZAR', flag: '🇺🇸🇿🇦' },
  { id: 'usdsgd', symbol: 'USDSGD=X', name: 'USD/SGD', flag: '🇺🇸🇸🇬' },
  { id: 'usdhkd', symbol: 'USDHKD=X', name: 'USD/HKD', flag: '🇺🇸🇭🇰' },
  { id: 'usdtry', symbol: 'USDTRY=X', name: 'USD/TRY', flag: '🇺🇸🇹🇷' },
  { id: 'usdnok', symbol: 'USDNOK=X', name: 'USD/NOK', flag: '🇺🇸🇳🇴' },
  { id: 'usdsek', symbol: 'USDSEK=X', name: 'USD/SEK', flag: '🇺🇸🇸🇪' },
  { id: 'usdcny', symbol: 'USDCNY=X', name: 'USD/CNY', flag: '🇺🇸🇨🇳' },
  { id: 'usdinr', symbol: 'USDINR=X', name: 'USD/INR', flag: '🇺🇸🇮🇳' },
  { id: 'eurbbrl', symbol: 'EURBRL=X', name: 'EUR/BRL', flag: '🇪🇺🇧🇷' },
  { id: 'gbpbrl', symbol: 'GBPBRL=X', name: 'GBP/BRL', flag: '🇬🇧🇧🇷' },
  { id: 'jpybrl', symbol: 'JPYBRL=X', name: 'JPY/BRL', flag: '🇯🇵🇧🇷' },
];

// Indices
export const INDICES: ApiInstrument[] = [
  // North America
  { id: 'sp500', symbol: '^GSPC', name: 'S&P 500', flag: '🇺🇸' },
  { id: 'dji', symbol: '^DJI', name: 'Dow Jones', flag: '🇺🇸' },
  { id: 'nasdaq', symbol: '^IXIC', name: 'Nasdaq', flag: '🇺🇸' },
  { id: 'russell', symbol: '^RUT', name: 'Russell 2000', flag: '🇺🇸' },
  { id: 'vix', symbol: '^VIX', name: 'VIX', flag: '🇺🇸' },
  { id: 'tsx', symbol: '^GSPTSE', name: 'S&P/TSX', flag: '🇨🇦' },
  { id: 'ipc', symbol: '^MXX', name: 'IPC Mexico', flag: '🇲🇽' },
  // Latin America
  { id: 'ibov', symbol: '^BVSP', name: 'IBOVESPA', flag: '🇧🇷' },
  { id: 'merval', symbol: '^MERV', name: 'MERVAL', flag: '🇦🇷' },
  { id: 'ipsa', symbol: '^IPSA', name: 'IPSA', flag: '🇨🇱' },
  // Europe
  { id: 'ftse', symbol: '^FTSE', name: 'UK100', flag: '🇬🇧' },
  { id: 'dax', symbol: '^GDAXI', name: 'DAX 40', flag: '🇩🇪' },
  { id: 'cac40', symbol: '^FCHI', name: 'CAC 40', flag: '🇫🇷' },
  { id: 'eurostoxx', symbol: '^STOXX50E', name: 'Euro Stoxx 50', flag: '🇪🇺' },
  { id: 'ibex', symbol: '^IBEX', name: 'IBEX 35', flag: '🇪🇸' },
  { id: 'ftsemib', symbol: 'FTSEMIB.MI', name: 'FTSE MIB', flag: '🇮🇹' },
  { id: 'smi', symbol: '^SSMI', name: 'SMI', flag: '🇨🇭' },
  { id: 'aex', symbol: '^AEX', name: 'AEX', flag: '🇳🇱' },
  { id: 'omx', symbol: '^OMX', name: 'OMX Stockholm', flag: '🇸🇪' },
  // Japan
  { id: 'nikkei', symbol: '^N225', name: 'Nikkei 225', flag: '🇯🇵' },
  // China & Hong Kong
  { id: 'hangseng', symbol: '^HSI', name: 'Hang Seng', flag: '🇭🇰' },
  { id: 'shanghai', symbol: '000001.SS', name: 'Shanghai Comp', flag: '🇨🇳' },
  { id: 'shenzhen', symbol: '399001.SZ', name: 'Shenzhen Comp', flag: '🇨🇳' },
  { id: 'csi300', symbol: '000300.SS', name: 'CSI 300', flag: '🇨🇳' },
  // Asia-Pacific
  { id: 'kospi', symbol: '^KS11', name: 'KOSPI', flag: '🇰🇷' },
  { id: 'taiex', symbol: '^TWII', name: 'TAIEX', flag: '🇹🇼' },
  { id: 'asx', symbol: '^AXJO', name: 'ASX 200', flag: '🇦🇺' },
  { id: 'sti', symbol: '^STI', name: 'Straits Times', flag: '🇸🇬' },
  { id: 'nz50', symbol: '^NZ50', name: 'NZX 50', flag: '🇳🇿' },
  { id: 'set', symbol: '^SET.BK', name: 'SET Index', flag: '🇹🇭' },
  // South Asia
  { id: 'nifty', symbol: '^NSEI', name: 'NIFTY 50', flag: '🇮🇳' },
  { id: 'sensex', symbol: '^BSESN', name: 'SENSEX', flag: '🇮🇳' },
  // Middle East & Africa
  { id: 'tadawul', symbol: '^TASI.SR', name: 'Tadawul', flag: '🇸🇦' },
  { id: 'jse', symbol: 'J200.L', name: 'FTSE/JSE Top 40', flag: '🇿🇦' },
];

// Metals & Commodities
export const METALS: ApiInstrument[] = [
  { id: 'gold', symbol: 'GC=F', name: 'Gold', flag: '🥇' },
  { id: 'silver', symbol: 'SI=F', name: 'Silver', flag: '🥈' },
  { id: 'platinum', symbol: 'PL=F', name: 'Platinum', flag: '⬜' },
  { id: 'palladium', symbol: 'PA=F', name: 'Palladium', flag: '🔲' },
  { id: 'copper', symbol: 'HG=F', name: 'Copper', flag: '🟤' },
  { id: 'oil', symbol: 'CL=F', name: 'Crude Oil WTI', flag: '🛢️' },
  { id: 'brent', symbol: 'BZ=F', name: 'UKOIL', flag: '🛢️' },
  { id: 'natgas', symbol: 'NG=F', name: 'Natural Gas', flag: '🔥' },
  { id: 'wheat', symbol: 'ZW=F', name: 'Wheat', flag: '🌾' },
  { id: 'corn', symbol: 'ZC=F', name: 'Corn', flag: '🌽' },
  { id: 'soy', symbol: 'ZS=F', name: 'Soybeans', flag: '🫘' },
  { id: 'cotton', symbol: 'CT=F', name: 'Cotton', flag: '🧵' },
  { id: 'coffee', symbol: 'KC=F', name: 'Coffee', flag: '☕' },
  { id: 'sugar', symbol: 'SB=F', name: 'Sugar', flag: '🍬' },
  { id: 'cocoa', symbol: 'CC=F', name: 'Cocoa', flag: '🍫' },
];

// Cryptocurrencies
export const CRYPTO: ApiInstrument[] = [
  { id: 'btc', symbol: 'BTC-USD', name: 'Bitcoin', flag: '₿' },
  { id: 'eth', symbol: 'ETH-USD', name: 'Ethereum', flag: '⟠' },
  { id: 'sol', symbol: 'SOL-USD', name: 'Solana', flag: '◎' },
  { id: 'xrp', symbol: 'XRP-USD', name: 'XRP', flag: '✕' },
  { id: 'bnb', symbol: 'BNB-USD', name: 'BNB', flag: '🔶' },
  { id: 'ada', symbol: 'ADA-USD', name: 'Cardano', flag: '🔵' },
  { id: 'doge', symbol: 'DOGE-USD', name: 'Dogecoin', flag: '🐕' },
  { id: 'avax', symbol: 'AVAX-USD', name: 'Avalanche', flag: '🔺' },
  { id: 'dot', symbol: 'DOT-USD', name: 'Polkadot', flag: '⚪' },
  { id: 'link', symbol: 'LINK-USD', name: 'Chainlink', flag: '🔗' },
  { id: 'matic', symbol: 'MATIC-USD', name: 'Polygon', flag: '💜' },
  { id: 'uni', symbol: 'UNI7083-USD', name: 'Uniswap', flag: '🦄' },
  { id: 'atom', symbol: 'ATOM-USD', name: 'Cosmos', flag: '⚛️' },
  { id: 'ltc', symbol: 'LTC-USD', name: 'Litecoin', flag: '🪙' },
  { id: 'near', symbol: 'NEAR-USD', name: 'NEAR Protocol', flag: '🌐' },
  { id: 'apt', symbol: 'ALGO-USD', name: 'Algorand', flag: '🅰️' },
  { id: 'arb', symbol: 'ARB11841-USD', name: 'Arbitrum', flag: '🔵' },
  { id: 'op', symbol: 'OP-USD', name: 'Optimism', flag: '🔴' },
  { id: 'fil', symbol: 'FIL-USD', name: 'Filecoin', flag: '📁' },
  { id: 'aave', symbol: 'AAVE-USD', name: 'Aave', flag: '👻' },
  { id: 'render', symbol: 'RENDER-USD', name: 'Render', flag: '🎨' },
  { id: 'inj', symbol: 'INJ-USD', name: 'Injective', flag: '💉' },
  { id: 'sui', symbol: 'SUI20947-USD', name: 'Sui', flag: '💧' },
  { id: 'ton', symbol: 'TON11419-USD', name: 'Toncoin', flag: '💎' },
];

// US Stocks
export const STOCKS: ApiInstrument[] = [
  { id: 'aapl', symbol: 'AAPL', name: 'Apple', flag: '🍎' },
  { id: 'msft', symbol: 'MSFT', name: 'Microsoft', flag: '🪟' },
  { id: 'googl', symbol: 'GOOGL', name: 'Alphabet', flag: '🔍' },
  { id: 'amzn', symbol: 'AMZN', name: 'Amazon', flag: '📦' },
  { id: 'nvda', symbol: 'NVDA', name: 'NVIDIA', flag: '🟢' },
  { id: 'meta', symbol: 'META', name: 'Meta', flag: '👤' },
  { id: 'tsla', symbol: 'TSLA', name: 'Tesla', flag: '⚡' },
  { id: 'jpm', symbol: 'JPM', name: 'JPMorgan', flag: '🏦' },
  { id: 'v', symbol: 'V', name: 'Visa', flag: '💳' },
  { id: 'ma', symbol: 'MA', name: 'Mastercard', flag: '💳' },
  { id: 'gs', symbol: 'GS', name: 'Goldman Sachs', flag: '🏦' },
  { id: 'jnj', symbol: 'JNJ', name: 'Johnson & Johnson', flag: '💊' },
  { id: 'unh', symbol: 'UNH', name: 'UnitedHealth', flag: '🏥' },
  { id: 'pfe', symbol: 'PFE', name: 'Pfizer', flag: '💊' },
  { id: 'xom', symbol: 'XOM', name: 'ExxonMobil', flag: '🛢️' },
  { id: 'cvx', symbol: 'CVX', name: 'Chevron', flag: '⛽' },
  { id: 'wmt', symbol: 'WMT', name: 'Walmart', flag: '🛒' },
  { id: 'nke', symbol: 'NKE', name: 'Nike', flag: '👟' },
  { id: 'mcd', symbol: 'MCD', name: 'McDonald\'s', flag: '🍔' },
  { id: 'sbux', symbol: 'SBUX', name: 'Starbucks', flag: '☕' },
  { id: 'amd', symbol: 'AMD', name: 'AMD', flag: '🔴' },
  { id: 'intc', symbol: 'INTC', name: 'Intel', flag: '🔵' },
  { id: 'avgo', symbol: 'AVGO', name: 'Broadcom', flag: '🟣' },
  { id: 'qcom', symbol: 'QCOM', name: 'Qualcomm', flag: '📡' },
  { id: 'mu', symbol: 'MU', name: 'Micron', flag: '💾' },
  { id: 'dis', symbol: 'DIS', name: 'Disney', flag: '🏰' },
  { id: 'nflx', symbol: 'NFLX', name: 'Netflix', flag: '🎬' },
  { id: 'crm', symbol: 'CRM', name: 'Salesforce', flag: '☁️' },
  { id: 'adbe', symbol: 'ADBE', name: 'Adobe', flag: '🎨' },
  { id: 'orcl', symbol: 'ORCL', name: 'Oracle', flag: '🗄️' },
  { id: 'ibm', symbol: 'IBM', name: 'IBM', flag: '💻' },
  { id: 'pypl', symbol: 'PYPL', name: 'PayPal', flag: '💰' },
  { id: 'cost', symbol: 'COST', name: 'Costco', flag: '🏪' },
  { id: 'ba', symbol: 'BA', name: 'Boeing', flag: '✈️' },
  { id: 'cat', symbol: 'CAT', name: 'Caterpillar', flag: '🚜' },
];

// ETFs
export const ETFS: ApiInstrument[] = [
  { id: 'spy', symbol: 'SPY', name: 'SPDR S&P 500', flag: '📊' },
  { id: 'qqq', symbol: 'QQQ', name: 'Invesco QQQ', flag: '📊' },
  { id: 'dia', symbol: 'DIA', name: 'SPDR Dow Jones', flag: '📊' },
  { id: 'iwm', symbol: 'IWM', name: 'iShares Russell 2000', flag: '📊' },
  { id: 'xlk', symbol: 'XLK', name: 'Technology Select', flag: '💻' },
  { id: 'xlf', symbol: 'XLF', name: 'Financial Select', flag: '🏦' },
  { id: 'xle', symbol: 'XLE', name: 'Energy Select', flag: '🛢️' },
  { id: 'xlv', symbol: 'XLV', name: 'Health Care Select', flag: '💊' },
  { id: 'xly', symbol: 'XLY', name: 'Consumer Disc.', flag: '🛍️' },
  { id: 'xlp', symbol: 'XLP', name: 'Consumer Staples', flag: '🛒' },
  { id: 'xli', symbol: 'XLI', name: 'Industrial Select', flag: '🏭' },
  { id: 'xlu', symbol: 'XLU', name: 'Utilities Select', flag: '⚡' },
  { id: 'xlre', symbol: 'XLRE', name: 'Real Estate Select', flag: '🏠' },
  { id: 'xlb', symbol: 'XLB', name: 'Materials Select', flag: '⛏️' },
  { id: 'xlc', symbol: 'XLC', name: 'Communication Select', flag: '📡' },
  { id: 'gld', symbol: 'GLD', name: 'SPDR Gold', flag: '🥇' },
  { id: 'slv', symbol: 'SLV', name: 'iShares Silver', flag: '🥈' },
  { id: 'uso', symbol: 'USO', name: 'United States Oil', flag: '🛢️' },
  { id: 'tlt', symbol: 'TLT', name: 'iShares 20+ Yr Treasury', flag: '📜' },
  { id: 'ief', symbol: 'IEF', name: 'iShares 7-10 Yr Treasury', flag: '📜' },
  { id: 'hyg', symbol: 'HYG', name: 'iShares High Yield', flag: '📜' },
  { id: 'ibit', symbol: 'IBIT', name: 'iShares Bitcoin ETF', flag: '₿' },
  { id: 'etha', symbol: 'ETHA', name: 'iShares Ethereum ETF', flag: '⟠' },
  { id: 'ewz', symbol: 'EWZ', name: 'iShares Brazil', flag: '🇧🇷' },
  { id: 'fxi', symbol: 'FXI', name: 'iShares China', flag: '🇨🇳' },
  { id: 'ewg', symbol: 'EWG', name: 'iShares Germany', flag: '🇩🇪' },
  { id: 'ewj', symbol: 'EWJ', name: 'iShares Japan', flag: '🇯🇵' },
  { id: 'ewn', symbol: 'EWN', name: 'iShares Netherlands', flag: '🇳🇱' },
  { id: 'uvxy', symbol: 'UVXY', name: 'ProShares Ultra VIX', flag: '📊' },
];

// Brazilian Market
export const BRAZIL: ApiInstrument[] = [
  { id: 'mini-ind', symbol: '^BVSP', name: 'Mini Índice', flag: '📈' },
  { id: 'mini-dol', symbol: 'USDBRL=X', name: 'Mini Dólar', flag: '💵' },
  { id: 'br-ibov', symbol: '^BVSP', name: 'IBOVESPA', flag: '🇧🇷' },
  { id: 'br-usdbrl', symbol: 'USDBRL=X', name: 'USD/BRL', flag: '🇧🇷🇺🇸' },
  { id: 'br-btc', symbol: 'BTC-USD', name: 'Bitcoin', flag: '₿' },
  { id: 'petr4', symbol: 'PETR4.SA', name: 'Petrobras', flag: '🛢️' },
  { id: 'vale3', symbol: 'VALE3.SA', name: 'Vale', flag: '⛏️' },
  { id: 'itub4', symbol: 'ITUB4.SA', name: 'Itaú Unibanco', flag: '🏦' },
  { id: 'bbdc4', symbol: 'BBDC4.SA', name: 'Bradesco', flag: '🏦' },
  { id: 'bbas3', symbol: 'BBAS3.SA', name: 'Banco do Brasil', flag: '🏦' },
  { id: 'sanb11', symbol: 'SANB11.SA', name: 'Santander', flag: '🏦' },
  { id: 'petr3', symbol: 'PETR3.SA', name: 'Petrobras ON', flag: '🛢️' },
  { id: 'vbbr3', symbol: 'VBBR3.SA', name: 'Vibra Energia', flag: '⚡' },
  { id: 'egie3', symbol: 'EGIE3.SA', name: 'Engie Brasil', flag: '⚡' },
  { id: 'taee11', symbol: 'TAEE11.SA', name: 'Taesa', flag: '⚡' },
  { id: 'abev3', symbol: 'ABEV3.SA', name: 'Ambev', flag: '🍺' },
  { id: 'mglu3', symbol: 'MGLU3.SA', name: 'Magazine Luiza', flag: '🛍️' },
  { id: 'cogn3', symbol: 'COGN3.SA', name: 'Cogna', flag: '📚' },
  { id: 'wege3', symbol: 'WEGE3.SA', name: 'WEG', flag: '⚡' },
  { id: 'suzb3', symbol: 'SUZB3.SA', name: 'Suzano', flag: '🌲' },
  { id: 'klbn11', symbol: 'KLBN11.SA', name: 'Klabin', flag: '📦' },
  { id: 'csan3', symbol: 'CSAN3.SA', name: 'Cosan', flag: '⛽' },
  { id: 'csna3', symbol: 'CSNA3.SA', name: 'CSN', flag: '🏗️' },
  { id: 'ggbr4', symbol: 'GGBR4.SA', name: 'Gerdau', flag: '🏗️' },
  { id: 'rent3', symbol: 'RENT3.SA', name: 'Localiza', flag: '🚗' },
  { id: 'bpac11', symbol: 'BPAC11.SA', name: 'BTG Pactual', flag: '🏦' },
  { id: 'irbr3', symbol: 'IRBR3.SA', name: 'IRB Brasil', flag: '🏦' },
  { id: 'radl3', symbol: 'RADL3.SA', name: 'Raia Drogasil', flag: '💊' },
  { id: 'flry3', symbol: 'FLRY3.SA', name: 'Fleury', flag: '🏥' },
  { id: 'hype3', symbol: 'HYPE3.SA', name: 'Hypera', flag: '💊' },
  { id: 'ugpa3', symbol: 'UGPA3.SA', name: 'Ultrapar', flag: '🛢️' },
  { id: 'beef3', symbol: 'BEEF3.SA', name: 'Minerva', flag: '🍗' },
  { id: 'smto3', symbol: 'SMTO3.SA', name: 'São Martinho', flag: '🍬' },
];

export function getInstruments(category: MarketCategory): ApiInstrument[] {
  switch (category) {
    case 'forex': return FOREX_PAIRS;
    case 'indices': return INDICES;
    case 'metals': return METALS;
    case 'crypto': return CRYPTO;
    case 'stocks': return STOCKS;
    case 'etfs': return ETFS;
    case 'brazil': return BRAZIL;
    default: return FOREX_PAIRS;
  }
}

// ======================== DATA FETCHING ========================

// Interval-to-range mapping for Yahoo Finance chart API
const INTERVAL_CONFIG: Record<string, { yahooInterval: string; yahooRange: string }> = {
  '1m':  { yahooInterval: '1m',  yahooRange: '5d' },
  '2m':  { yahooInterval: '2m',  yahooRange: '5d' },
  '5m':  { yahooInterval: '5m',  yahooRange: '5d' },
  '15m': { yahooInterval: '15m', yahooRange: '10d' },
  '30m': { yahooInterval: '30m', yahooRange: '10d' },
  '60m': { yahooInterval: '60m', yahooRange: '30d' },
  '90m': { yahooInterval: '90m', yahooRange: '30d' },
  '1h':  { yahooInterval: '1h',  yahooRange: '30d' },
  '4h':  { yahooInterval: '1h',  yahooRange: '60d' },  // fetch 1h, frontend aggregates to 4h
  '1d':  { yahooInterval: '1d',  yahooRange: '2y' },
  '5d':  { yahooInterval: '5d',  yahooRange: '5y' },
  '1wk': { yahooInterval: '1wk', yahooRange: '5y' },
  '1mo': { yahooInterval: '1mo', yahooRange: '10y' },
};

// Get batch snapshot quotes (30s cache) — uses Yahoo Finance v7 API, falls back to chart API, then mock data
export async function getSnapshotQuotes(symbols: string[]): Promise<any> {
  const cacheKey = `quotes:${symbols.join(',')}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  // Try Yahoo Finance v7 API directly
  try {
    const allResults = await fetchYFQuotes(symbols);
    if (allResults.length > 0) {
      const data = { meta: {}, body: allResults };
      setCache(cacheKey, data, 30000);
      return data;
    }
  } catch (err: any) {
    console.warn('[Finance] Yahoo Finance API quotes failed, trying chart fallback:', err.message);
  }

  // Fallback: Use v8 chart API to get current prices (doesn't always require crumb)
  // Fetch chart with range=5d for each symbol in parallel batches
  try {
    const BATCH_SIZE = 10;
    const allResults: any[] = [];

    for (let i = 0; i < symbols.length; i += BATCH_SIZE) {
      const batch = symbols.slice(i, i + BATCH_SIZE);
      const batchResults = await Promise.allSettled(
        batch.map(async (symbol) => {
          try {
            const result = await fetchYFChart(symbol, '1d', '5d');
            if (!result) return null;
            const meta = result.meta || {};
            const closes = result.indicators?.quote?.[0]?.close || [];
            const previousClose = meta.chartPreviousClose || meta.previousClose || 0;
            const regularMarketPrice = meta.regularMarketPrice || 0;

            if (regularMarketPrice <= 0) return null;

            const change = regularMarketPrice - previousClose;
            const changePercent = previousClose > 0 ? (change / previousClose) * 100 : 0;

            return {
              symbol,
              regularMarketPrice,
              regularMarketChange: change,
              regularMarketChangePercent: changePercent,
              regularMarketOpen: meta.regularMarketPrice - change * 0.3,
              regularMarketDayHigh: meta.regularMarketPrice + Math.abs(change) * 0.5,
              regularMarketDayLow: meta.regularMarketPrice - Math.abs(change) * 0.5,
              regularMarketVolume: meta.regularMarketVolume || 0,
              regularMarketPreviousClose: previousClose,
              fiftyTwoWeekHigh: meta.fiftyTwoWeekHigh || 0,
              fiftyTwoWeekLow: meta.fiftyTwoWeekLow || 0,
              shortName: symbol.replace('=X', '').replace('-USD', ''),
              currency: meta.currency || 'USD',
            };
          } catch {
            return null;
          }
        })
      );

      for (const r of batchResults) {
        if (r.status === 'fulfilled' && r.value) allResults.push(r.value);
      }

      if (i + BATCH_SIZE < symbols.length) await delay(100);
    }

    if (allResults.length > 0) {
      const data = { meta: { fromChart: true }, body: allResults };
      setCache(cacheKey, data, 30000);
      return data;
    }
  } catch (err: any) {
    console.warn('[Finance] Chart-based quotes fallback failed:', err.message);
  }

  // Final fallback: mock data
  const allResults = symbols.map(s => mockQuote(s));
  const data = { meta: { mock: true }, body: allResults };
  setCache(cacheKey, data, 30000);
  return data;
}

// Get real-time quote for a single instrument
export async function getQuote(symbol: string, _type: string = 'STOCKS'): Promise<any> {
  const cacheKey = `quote:${symbol}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  // Try Yahoo Finance v7 API directly
  try {
    const result = await fetchYFQuote(symbol);
    if (result && result.symbol) {
      setCache(cacheKey, result, 15000);
      return result;
    }
  } catch (err) {
    console.warn(`[Finance] Quote error for ${symbol}, trying chart fallback`);
  }

  // Fallback: Use v8 chart API to get current price
  try {
    const result = await fetchYFChart(symbol, '1d', '5d');
    if (result) {
      const meta = result.meta || {};
      const regularMarketPrice = meta.regularMarketPrice || 0;
      const previousClose = meta.chartPreviousClose || meta.previousClose || 0;
      if (regularMarketPrice > 0) {
        const change = regularMarketPrice - previousClose;
        const changePercent = previousClose > 0 ? (change / previousClose) * 100 : 0;
        const quoteResult = {
          symbol,
          regularMarketPrice,
          regularMarketChange: change,
          regularMarketChangePercent: changePercent,
          regularMarketOpen: regularMarketPrice - change * 0.3,
          regularMarketDayHigh: regularMarketPrice + Math.abs(change) * 0.5,
          regularMarketDayLow: regularMarketPrice - Math.abs(change) * 0.5,
          regularMarketVolume: meta.regularMarketVolume || 0,
          regularMarketPreviousClose: previousClose,
          fiftyTwoWeekHigh: meta.fiftyTwoWeekHigh || 0,
          fiftyTwoWeekLow: meta.fiftyTwoWeekLow || 0,
          shortName: symbol.replace('=X', '').replace('-USD', ''),
          currency: meta.currency || 'USD',
        };
        setCache(cacheKey, quoteResult, 15000);
        return quoteResult;
      }
    }
  } catch (err) {
    console.warn(`[Finance] Chart quote fallback failed for ${symbol}`);
  }

  const result = mockQuote(symbol);
  setCache(cacheKey, result, 15000);
  return result;
}

// Get historical chart data — uses Yahoo Finance v8 API, falls back to mock data
export async function getHistory(symbol: string, interval: string = '1d'): Promise<any> {
  const cacheKey = `history:${symbol}:${interval}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const isIntraday = ['1m', '2m', '5m', '15m', '30m', '60m', '90m', '1h'].includes(interval);
  const ttl = isIntraday ? 60000 : 300000;

  // Try Yahoo Finance v8 chart API directly
  const config = INTERVAL_CONFIG[interval] || INTERVAL_CONFIG['1d'];
  try {
    const result = await fetchYFChart(symbol, config.yahooInterval, config.yahooRange);
    if (result) {
      const timestamps: number[] = result.timestamp || [];
      const quoteData = result.indicators?.quote?.[0] || {};
      const meta = result.meta || {};

      const opens = quoteData.open || [];
      const highs = quoteData.high || [];
      const lows = quoteData.low || [];
      const closes = quoteData.close || [];
      const volumes = quoteData.volume || [];
      const adjCloses = quoteData.adjclose?.[0]?.adjclose || closes; // adjclose may be in separate object

      const body: any[] = [];
      for (let i = 0; i < timestamps.length; i++) {
        const close = closes[i];
        if (close == null || close <= 0) continue; // skip invalid candles

        const ts = timestamps[i];
        const d = new Date(ts * 1000);
        const dateStr = isIntraday ? d.toISOString() : d.toISOString().split('T')[0];

        body.push({
          date: dateStr,
          date_utc: ts,
          open: opens[i] || close,
          high: highs[i] || close,
          low: lows[i] || close,
          close: close,
          adjclose: (Array.isArray(adjCloses) ? adjCloses[i] : close) || close,
          volume: volumes[i] || 0,
        });
      }

      if (body.length > 0) {
        const data: any = {
          meta: {
            symbol,
            currency: meta.currency,
            exchangeTimezoneName: meta.exchangeTimezoneName,
            fiftyTwoWeekHigh: meta.fiftyTwoWeekHigh || 0,
            fiftyTwoWeekLow: meta.fiftyTwoWeekLow || 0,
            regularMarketPrice: meta.regularMarketPrice,
          },
          body,
        };

        setCache(cacheKey, data, ttl);
        return data;
      }
    }
  } catch (err: any) {
    console.warn(`[Finance] History error for ${symbol} (${interval}), using mock:`, err.message);
  }

  // Fallback: mock history data
  const INTERVAL_COUNTS: Record<string, number> = {
    '1m': 390, '2m': 390, '5m': 390, '15m': 240,
    '30m': 200, '60m': 200, '90m': 200, '1h': 200, '4h': 200,
    '1d': 250, '5d': 250, '1wk': 250, '1mo': 250,
  };
  const count = INTERVAL_COUNTS[interval] || (isIntraday ? 200 : 250);
  const body = mockHistoryData(symbol, interval, count);
  const data: any = {
    meta: {
      symbol,
      currency: symbol.includes('BRL') ? 'BRL' : 'USD',
      exchangeTimezoneName: 'America/New_York',
      fiftyTwoWeekHigh: (MOCK_PRICES[symbol] || 100) * 1.15,
      fiftyTwoWeekLow: (MOCK_PRICES[symbol] || 100) * 0.85,
      regularMarketPrice: MOCK_PRICES[symbol] || 100,
      mock: true,
    },
    body,
  };

  setCache(cacheKey, data, ttl);
  return data;
}

// ======================== RSS NEWS FEEDS ========================

const RSS_FEEDS = [
  { url: 'https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=100003114', name: 'CNBC' },
  { url: 'https://rss.nytimes.com/services/xml/rss/nyt/Business.xml', name: 'NYT Business' },
  { url: 'https://www.marketwatch.com/rss/topstories', name: 'MarketWatch' },
];

interface RSSNewsItem {
  title: string;
  link: string;
  publisher: string;
  publishTime: string;
  source: string;
  description: string;
  guid: string;
  sentiment: 'positivo' | 'negativo' | 'neutro';
}

/** Parse XML text and extract item nodes */
function extractXmlItems(xmlText: string): string[] {
  const items: string[] = [];
  // Match all <item>...</item> blocks (greedy inner content)
  const itemRegex = /<item[^>]*>([\s\S]*?)<\/item>/gi;
  let match: RegExpExecArray | null;
  while ((match = itemRegex.exec(xmlText)) !== null) {
    items.push(match[1]);
  }
  return items;
}

/** Extract text from an XML element, handling both plain text and CDATA */
function extractElementText(itemXml: string, tagName: string): string {
  // Try CDATA first: <tagName><![CDATA[...]]></tagName>
  const cdataRegex = new RegExp(`<${tagName}[^>]*>\\s*<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>\\s*</${tagName}>`, 'i');
  const cdataMatch = itemXml.match(cdataRegex);
  if (cdataMatch) return cdataMatch[1].trim();

  // Try plain text: <tagName>...</tagName>
  const plainRegex = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)</${tagName}>`, 'i');
  const plainMatch = itemXml.match(plainRegex);
  if (plainMatch) {
    // Strip any remaining HTML tags
    return plainMatch[1].trim().replace(/<[^>]*>/g, '');
  }

  return '';
}

/** Parse a single RSS <item> block into a NewsItem */
function parseRSSItem(itemXml: string, feedName: string): RSSNewsItem | null {
  const title = extractElementText(itemXml, 'title');
  if (!title) return null;

  const link = extractElementText(itemXml, 'link');
  const pubDate = extractElementText(itemXml, 'pubDate');
  const description = extractElementText(itemXml, 'description');
  const guid = extractElementText(itemXml, 'guid') || link || title;

  // Decode HTML entities
  const decodeHTML = (s: string) => s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");

  return {
    title: decodeHTML(title),
    link: link || '#',
    publisher: feedName,
    publishTime: pubDate,
    source: feedName,
    description: decodeHTML(description),
    guid,
    sentiment: getHeuristicSentiment(decodeHTML(title)),
  };
}

/** Fetch and parse a single RSS feed */
async function fetchRSSFeed(feed: { url: string; name: string }): Promise<RSSNewsItem[]> {
  try {
    const response = await fetch(feed.url, {
      signal: AbortSignal.timeout(15000),
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; FinanceDashboard/1.0)',
        'Accept': 'application/rss+xml, application/xml, text/xml, */*',
      },
    });

    if (!response.ok) {
      console.warn(`RSS feed ${feed.name} returned ${response.status}`);
      return [];
    }

    const xmlText = await response.text();
    const itemXmls = extractXmlItems(xmlText);

    const items: RSSNewsItem[] = [];
  for (const itemXml of itemXmls) {
    const item = parseRSSItem(itemXml, feed.name);
    if (item) items.push(item);
  }

  return items;
  } catch (err: any) {
    console.warn(`Failed to fetch RSS feed ${feed.name}:`, err.message);
    return [];
  }
}

/** Deduplicate news items by title (case-insensitive) */
function deduplicateNews(items: RSSNewsItem[]): RSSNewsItem[] {
  const seen = new Set<string>();
  return items.filter(item => {
    const key = item.title.toLowerCase().trim();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Sort news items by publish date (newest first) */
function sortByDate(items: RSSNewsItem[]): RSSNewsItem[] {
  return [...items].sort((a, b) => {
    const dateA = a.publishTime ? new Date(a.publishTime).getTime() : 0;
    const dateB = b.publishTime ? new Date(b.publishTime).getTime() : 0;
    return dateB - dateA;
  });
}

/** Fetch news via RSS feeds (primary source) */
async function getNewsFromRSS(): Promise<RSSNewsItem[]> {
  const results = await Promise.allSettled(
    RSS_FEEDS.map(feed => fetchRSSFeed(feed))
  );

  let allItems: RSSNewsItem[] = [];
  for (const result of results) {
    if (result.status === 'fulfilled') {
      allItems = allItems.concat(result.value);
    }
  }

  // Deduplicate and sort
  allItems = deduplicateNews(allItems);
  allItems = sortByDate(allItems);

  return allItems;
}

/** Fetch news via Finance API gateway (fallback) */
async function getNewsFromGateway(ticker?: string): Promise<RSSNewsItem[]> {
  try {
    const config = await getGatewayConfig();
    if (!config) return [];

    const params = ticker ? `?ticker=${encodeURIComponent(ticker)}` : '';
    const url = `${config.baseUrl}/external/finance/v1/markets/news${params}`;

    const response = await fetch(url, {
      headers: config.headers,
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) return [];

    const data = await response.json();
    const newsItems = data.body || [];

    if (!Array.isArray(newsItems)) return [];

    return newsItems.map((item: any) => ({
      title: item.title || '',
      link: item.link || item.url || '#',
      publisher: item.source || item.publisher || '',
      publishTime: item.pubDate || item.publishTime || '',
      source: item.source || item.publisher || '',
      description: item.description || item.summary || '',
      guid: item.guid || item.id || '',
      sentiment: getHeuristicSentiment(item.title || ''),
    }));
  } catch (err: any) {
    console.warn('Gateway news fallback failed:', err.message);
    return [];
  }
}

// Market news — uses RSS feeds as primary source, gateway as fallback
export async function getMarketNews(ticker?: string): Promise<any> {
  const cacheKey = `news:${ticker || 'all'}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  try {
    // Primary: fetch from RSS feeds
    let newsItems = await getNewsFromRSS();

    // Fallback: if no RSS items, try gateway
    if (newsItems.length === 0) {
      console.log('RSS feeds returned no items, trying gateway fallback...');
      newsItems = await getNewsFromGateway(ticker);
    }

    const result = { meta: { source: 'rss' }, body: newsItems };
    setCache(cacheKey, result, 300000); // 5 min cache
    return result;
  } catch (err: any) {
    console.warn('Failed to fetch news:', err.message);
    return { meta: {}, body: [] };
  }
}

// Simple heuristic sentiment from news title (returns Portuguese for UI)
function getHeuristicSentiment(title: string): 'positivo' | 'negativo' | 'neutro' {
  if (!title) return 'neutro';
  const lower = title.toLowerCase();
  const positiveWords = ['surge', 'rally', 'gain', 'jump', 'rise', 'soar', 'boom', 'profit', 'growth', 'record high', 'beat', 'bullish', 'upgrade', 'buy', 'high', 'top', 'best', 'strong', 'recovery'];
  const negativeWords = ['drop', 'fall', 'crash', 'plunge', 'slump', 'loss', 'decline', 'cut', 'miss', 'bearish', 'downgrade', 'sell', 'fear', 'risk', 'warning', 'low', 'worst', 'weak', 'recession', 'debt'];
  
  const hasPositive = positiveWords.some(w => lower.includes(w));
  const hasNegative = negativeWords.some(w => lower.includes(w));
  
  if (hasPositive && !hasNegative) return 'positivo';
  if (hasNegative && !hasPositive) return 'negativo';
  return 'neutro';
}

// getPeriod1 removed — v8 API uses range parameter directly
