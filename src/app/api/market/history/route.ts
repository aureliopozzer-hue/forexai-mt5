import { NextRequest, NextResponse } from 'next/server';
import { getHistory, getSnapshotQuotes } from '@/lib/finance-api';

// Check if symbol is a forex pair (needs precision enhancement for intraday)
function isForexSymbol(symbol: string): boolean {
  return symbol.includes('=X');
}

// Detect if candle data has low precision
// For forex: check if there are suspiciously few unique price levels or low decimal precision
function isLowPrecisionData(items: any[]): boolean {
  if (items.length < 5) return false;

  // Check 1: All OHLC identical in recent candles (intraday flat line)
  const sample = items.slice(-20);
  const allSame = sample.every(item =>
    item.open === item.close &&
    item.open === item.high &&
    item.open === item.low
  );
  if (allSame) return true;

  // Check 2: Too few unique close values relative to total candles (low granularity)
  const closes = items.map(i => i.close);
  const uniqueCloses = new Set(closes);
  if (items.length >= 50 && uniqueCloses.size <= items.length * 0.05) {
    return true;
  }

  // Check 3: Close values have too few decimal places for a forex pair
  // If most closes round to 2 decimals and stay the same, the data is low precision
  const roundedSame = closes.filter((c, i) => Math.round(c * 100) / 100 === Math.round(c * 10000) / 10000);
  if (roundedSame.length > closes.length * 0.7 && uniqueCloses.size < items.length * 0.15) {
    return true;
  }

  return false;
}

// Extract a number value from either flat or nested quote format
function extractNum(val: any): number {
  if (val === undefined || val === null) return 0;
  if (typeof val === 'number') return val;
  if (typeof val === 'object' && val.raw !== undefined) return val.raw;
  return 0;
}

/**
 * Enhance low-precision forex candle data using the precise quote.
 *
 * IMPORTANT: Previous version generated completely synthetic data using sine waves,
 * which produced fake price movements that didn't match TradingView at all.
 *
 * New approach: PRESERVE actual close prices from Yahoo Finance (they are the most
 * reliable data point). Only enhance individual candles where OHLC are all identical
 * (flat/zero-range candles) by adding realistic wicks and slight open variation.
 * This keeps the chart as close to real market data as possible.
 */
function enhanceForexCandles(items: any[], quote: any, symbol: string, _meta: any): any[] {
  if (!quote || items.length === 0) return items;

  const precisePrice = extractNum(quote.regularMarketPrice);
  const preciseHigh = extractNum(quote.regularMarketDayHigh);
  const preciseLow = extractNum(quote.regularMarketDayLow);

  if (!precisePrice || precisePrice <= 0) return items;

  // Determine precision based on symbol and price
  const isJpy = symbol.includes('JPY');
  let precision = 4;
  if (isJpy) precision = 3;     // JPY pairs: 3 decimals for proper wicks
  else if (precisePrice >= 100) precision = 3;
  else if (precisePrice >= 10) precision = 4;

  // Calculate realistic candle range from the data itself
  // Use non-flat candles to determine what a normal candle looks like
  const nonFlatRanges: number[] = [];
  for (const item of items) {
    const range = (item.high || 0) - (item.low || 0);
    if (range > 0) nonFlatRanges.push(range);
  }

  // Estimate a typical candle range for wick generation
  let typicalRange: number;
  if (nonFlatRanges.length > 3) {
    const sorted = [...nonFlatRanges].sort((a, b) => a - b);
    typicalRange = sorted[Math.floor(sorted.length / 2)];
  } else {
    // Fallback: estimate from the quote's day range
    const dayHigh = preciseHigh || precisePrice * 1.005;
    const dayLow = preciseLow || precisePrice * 0.995;
    typicalRange = (dayHigh - dayLow) / Math.max(items.length, 10);
  }

  // Ensure minimum wick size
  typicalRange = Math.max(typicalRange, precisePrice * 0.0001);

  // Deterministic pseudo-random for consistent chart rendering
  function seededRandom(seed: number): number {
    const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
    return x - Math.floor(x);
  }

  const mult = Math.pow(10, precision);
  const candles: any[] = [];

  for (let index = 0; index < items.length; index++) {
    const item = items[index];
    const originalClose = item.close || 0;
    const originalOpen = item.open || 0;
    const originalHigh = item.high || 0;
    const originalLow = item.low || 0;

    const isFlat = originalOpen === originalClose && originalOpen === originalHigh && originalOpen === originalLow;

    if (isFlat && originalClose > 0) {
      // This candle has zero range (OHLC all identical) — enhance it
      const close = originalClose;

      // Open: small gap from close for realism, or use previous close
      let open: number;
      if (candles.length > 0) {
        // Gap from previous candle's close
        const gap = (seededRandom(index * 7 + 3) - 0.5) * typicalRange * 0.3;
        open = close + gap;
      } else {
        open = close;
      }

      const bodyHigh = Math.max(open, close);
      const bodyLow = Math.min(open, close);

      // Add realistic wicks
      const wickUp = seededRandom(index * 13 + 7) * typicalRange * 0.4;
      const wickDown = seededRandom(index * 17 + 11) * typicalRange * 0.4;

      let high = bodyHigh + wickUp;
      let low = bodyLow - wickDown;

      // Ensure OHLC consistency
      high = Math.max(high, bodyHigh);
      low = Math.min(low, bodyLow);

      // Round to proper precision
      open = Math.round(open * mult) / mult;
      high = Math.round(high * mult) / mult;
      low = Math.round(low * mult) / mult;

      candles.push({
        ...item,
        open,
        high,
        low,
        close: Math.round(close * mult) / mult,
      });
    } else if (!isFlat) {
      // Non-flat candle: preserve actual data, just ensure proper precision
      const open = Math.round(originalOpen * mult) / mult;
      const high = Math.round(Math.max(originalHigh, Math.max(originalOpen, originalClose)) * mult) / mult;
      const low = Math.round(Math.min(originalLow, Math.min(originalOpen, originalClose)) * mult) / mult;
      const close = Math.round(originalClose * mult) / mult;

      candles.push({
        ...item,
        open,
        high,
        low,
        close,
      });
    } else {
      // Flat candle with zero close — skip it (invalid data)
      continue;
    }

    // Last candle: update close to match real-time price exactly
    if (index === items.length - 1 && precisePrice > 0) {
      const lastCandle = candles[candles.length - 1];
      lastCandle.close = Math.round(precisePrice * mult) / mult;
      lastCandle.high = Math.round(Math.max(lastCandle.high, precisePrice) * mult) / mult;
      lastCandle.low = Math.round(Math.min(lastCandle.low, precisePrice) * mult) / mult;
    }
  }

  return candles;
}

/**
 * Filter out spike candles that have unreasonable price jumps.
 * Uses a more lenient threshold than before to avoid removing valid volatile candles
 * (e.g., during news events, JPY intervention, etc. which TradingView shows normally).
 *
 * Updated thresholds:
 * - Range filter: 15x median (was 8x) — allows large but real market moves
 * - Close-to-close filter: 30x median (was 15x) — allows gap openings
 * - OHLC consistency check: preserved (always validates high/low vs open/close)
 */
function filterSpikes(items: any[]): any[] {
  if (items.length < 5) return items;

  // Calculate the median candle range
  const ranges = items.map(item => {
    const high = item.high || 0;
    const low = item.low || 0;
    return high - low;
  }).filter(r => r > 0);

  if (ranges.length === 0) return items;

  // Sort ranges to find median
  const sortedRanges = [...ranges].sort((a, b) => a - b);
  const medianRange = sortedRanges[Math.floor(sortedRanges.length / 2)];

  if (medianRange <= 0) return items;

  // Also check close-to-close jumps
  const closeChanges: number[] = [];
  for (let i = 1; i < items.length; i++) {
    const prevClose = items[i - 1].close || 0;
    const currClose = items[i].close || 0;
    if (prevClose > 0) {
      closeChanges.push(Math.abs(currClose - prevClose) / prevClose);
    }
  }

  const medianPctChange = closeChanges.length > 0
    ? [...closeChanges].sort((a, b) => a - b)[Math.floor(closeChanges.length / 2)]
    : 0;

  // Filter: remove candles where range is > 15x median (was 8x)
  // OR close-to-close change is > 30x median (was 15x)
  // These higher thresholds avoid filtering valid volatile candles
  return items.filter((item, index) => {
    const range = (item.high || 0) - (item.low || 0);
    const rangeOk = range <= medianRange * 15;

    // Check close-to-close jump
    let jumpOk = true;
    if (index > 0 && medianPctChange > 0) {
      const prevClose = items[index - 1].close || 0;
      const currClose = item.close || 0;
      if (prevClose > 0) {
        const pctChange = Math.abs(currClose - prevClose) / prevClose;
        jumpOk = pctChange <= medianPctChange * 30;
      }
    }

    // Validate OHLC consistency: high >= max(open,close) and low <= min(open,close)
    const ohlcOk = (item.high || 0) >= Math.max(item.open || 0, item.close || 0) &&
                   (item.low || 0) <= Math.min(item.open || 0, item.close || 0);

    return rangeOk && jumpOk && ohlcOk;
  });
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get('symbol');
    const interval = searchParams.get('interval') || '1d';
    const limit = searchParams.get('limit');
    const bustCache = searchParams.has('_t'); // Cache-busting timestamp from frontend refresh

    if (!symbol) {
      return NextResponse.json(
        { success: false, error: 'Symbol parameter is required' },
        { status: 400 }
      );
    }

    // If user explicitly refreshed, clear the cache for this symbol+interval so we get fresh data
    if (bustCache) {
      const { clearCacheEntry } = await import('@/lib/finance-api');
      clearCacheEntry(`history:${symbol}:${interval}`);
    }

    let data: any;
    try {
      data = await getHistory(symbol, interval);
    } catch (fetchErr: any) {
      // If the finance API fails (rate limit, network error, etc.), return empty data
      // rather than a 500 error so the chart can display "no data" gracefully
      console.warn(`History fetch failed for ${symbol} (${interval}): ${fetchErr.message}`);
      return NextResponse.json({
        success: true,
        symbol,
        interval,
        data: { meta: {}, body: [] },
        warning: 'Data temporarily unavailable due to API rate limits. Please try again shortly.',
      });
    }

    if (!data?.body) {
      return NextResponse.json({
        success: true,
        symbol,
        interval,
        data: { ...data, body: [] },
      });
    }

    // Convert body to array format
    const body = data.body;
    let items: any[];

    if (Array.isArray(body)) {
      items = body;
    } else if (typeof body === 'object') {
      const sortedKeys = Object.keys(body).sort((a, b) => Number(a) - Number(b));
      items = sortedKeys.map(key => body[key]);
    } else {
      items = [];
    }

    // Determine if this is an intraday interval
    const isIntraday = ['1m', '2m', '5m', '15m', '30m', '60m', '90m', '1h'].includes(interval);

    // Enrich the date field with time info from date_utc for intraday data
    // For daily data, normalize timestamps to midnight UTC to avoid timezone display issues
    const enrichedItems = items.map((item: any) => {
      if (isIntraday && item.date_utc) {
        const utcDate = new Date(item.date_utc * 1000);
        if (!isNaN(utcDate.getTime()) && item.date && !item.date.includes('T')) {
          return {
            ...item,
            date: utcDate.toISOString(),
          };
        }
      }
      // For daily data: normalize date to YYYY-MM-DD format for consistent chart rendering
      // Yahoo Finance returns daily data with timezone-offset timestamps (e.g., 23:00 UTC for London)
      // This causes candles to appear on wrong dates in lightweight-charts
      if (!isIntraday && item.date) {
        const d = new Date(item.date);
        if (!isNaN(d.getTime()) && item.date.includes('T')) {
          // Extract just the UTC date portion to normalize to the trading day
          const year = d.getUTCFullYear();
          const month = String(d.getUTCMonth() + 1).padStart(2, '0');
          const day = String(d.getUTCDate()).padStart(2, '0');
          const normalizedDate = `${year}-${month}-${day}`;
          return {
            ...item,
            date: normalizedDate,
            // Also normalize date_utc to midnight UTC
            date_utc: Math.floor(Date.UTC(year, d.getUTCMonth(), d.getUTCDate()) / 1000),
          };
        }
      }
      return item;
    });

    // Filter out invalid/zero candles
    const validItems = enrichedItems.filter((item: any) => {
      const close = item.close || item.adjclose || 0;
      return close > 0;
    });

    // For forex, enhance low-precision data using batch quotes (intraday AND daily)
    // New approach: preserve actual close prices, only add wicks to flat candles
    let enhancedItems = validItems;
    if (isForexSymbol(symbol) && isLowPrecisionData(validItems)) {
      try {
        const quotesData = await getSnapshotQuotes([symbol]);
        if (quotesData?.body) {
          const quotesBody = quotesData.body;
          let quote: any = null;

          if (Array.isArray(quotesBody)) {
            quote = quotesBody.find((q: any) => q.symbol === symbol) || quotesBody[0];
          } else if (typeof quotesBody === 'object') {
            const vals = Object.values(quotesBody);
            quote = (vals as any[]).find((q: any) => q.symbol === symbol) || vals[0];
          }

          if (quote) {
            enhancedItems = enhanceForexCandles(validItems, quote, symbol, data.meta);
          }
        }
      } catch (err) {
        console.error('Failed to enhance forex candles:', err);
      }
    }

    // Filter out spike candles: remove candles where the price change is unreasonable
    const spikeFilteredItems = filterSpikes(enhancedItems);

    // Apply limit AFTER all processing
    const limitNum = limit ? parseInt(limit) : 0;
    const resultItems = limitNum > 0 ? spikeFilteredItems.slice(-limitNum) : spikeFilteredItems;

    // Return new object to avoid mutating the cached data
    return NextResponse.json({
      success: true,
      symbol,
      interval,
      data: { meta: data.meta, body: resultItems },
    });
  } catch (error: any) {
    console.error('History API error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
