import { NextRequest, NextResponse } from 'next/server';
import { getHistory } from '@/lib/finance-api';
import { ALL_INSTRUMENTS } from '@/components/dashboard/types';

// Allow up to 60 seconds for large scans
export const maxDuration = 60;

// ======================== TYPES ========================

interface PriceBar {
  close: number;
  high: number;
  low: number;
  open: number;
  volume: number;
}

interface ScannedPattern {
  instrumentSymbol: string;
  instrumentName: string;
  patternType: string;
  direction: 'bullish' | 'bearish' | 'neutral';
  confidence: number;
  priceLevel: number;
  description: string;
  category: string;
}

// ======================== IN-MEMORY SCAN CACHE ========================

const scanCache = new Map<string, { data: ScannedPattern[]; timestamp: number }>();
const SCAN_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function getCachedScan(key: string): ScannedPattern[] | null {
  const entry = scanCache.get(key);
  if (entry && Date.now() - entry.timestamp < SCAN_CACHE_TTL) {
    return entry.data;
  }
  if (entry) scanCache.delete(key);
  return null;
}

function setCachedScan(key: string, data: ScannedPattern[]): void {
  if (scanCache.size > 50) {
    const oldest = [...scanCache.entries()].sort((a, b) => a[1].timestamp - b[1].timestamp);
    for (let i = 0; i < 10; i++) scanCache.delete(oldest[i][0]);
  }
  scanCache.set(key, { data, timestamp: Date.now() });
}

// ======================== SIMPLIFIED PATTERN DETECTION ========================

/** Quick RSI calculation (simplified for scanning speed) */
function quickRSI(closes: number[], period: number = 14): number {
  if (closes.length < period + 1) return 50;
  let avgGain = 0;
  let avgLoss = 0;
  for (let i = 1; i <= period; i++) {
    const change = closes[i] - closes[i - 1];
    if (change > 0) avgGain += change;
    else avgLoss += Math.abs(change);
  }
  avgGain /= period;
  avgLoss /= period;
  for (let i = period + 1; i < closes.length; i++) {
    const change = closes[i] - closes[i - 1];
    avgGain = (avgGain * (period - 1) + (change > 0 ? change : 0)) / period;
    avgLoss = (avgLoss * (period - 1) + (change < 0 ? Math.abs(change) : 0)) / period;
  }
  if (avgLoss === 0) return 100;
  return 100 - (100 / (1 + avgGain / avgLoss));
}

/** Detect SMC patterns (simplified for scanning) */
function scanSMCPatterns(bars: PriceBar[], currentPrice: number, symbol: string, name: string, category: string): ScannedPattern[] {
  const patterns: ScannedPattern[] = [];
  if (bars.length < 10) return patterns;

  const recent = bars.slice(-30);

  // --- Order Block Detection ---
  for (let i = recent.length - 5; i >= 2; i--) {
    const bar = recent[i];
    const nextBars = recent.slice(i + 1, Math.min(i + 4, recent.length));
    if (nextBars.length < 2) continue;

    // Bullish OB
    if (bar.close < bar.open && nextBars.every(nb => nb.close > nb.open)) {
      const moveUp = nextBars.reduce((s, nb) => s + (nb.close - nb.open), 0);
      const barSize = Math.abs(bar.open - bar.close);
      if (moveUp > barSize * 2) {
        patterns.push({
          instrumentSymbol: symbol,
          instrumentName: name,
          patternType: 'Order Block',
          direction: 'bullish',
          confidence: Math.min(85, 55 + Math.round((moveUp / barSize - 2) * 8)),
          priceLevel: bar.high,
          description: `Bullish OB — zona de demanda em ${formatScanLevel(bar.high, currentPrice)}`,
          category,
        });
        break;
      }
    }

    // Bearish OB
    if (bar.close > bar.open && nextBars.every(nb => nb.close < nb.open)) {
      const moveDown = nextBars.reduce((s, nb) => s + (nb.open - nb.close), 0);
      const barSize = Math.abs(bar.close - bar.open);
      if (moveDown > barSize * 2) {
        patterns.push({
          instrumentSymbol: symbol,
          instrumentName: name,
          patternType: 'Order Block',
          direction: 'bearish',
          confidence: Math.min(85, 55 + Math.round((moveDown / barSize - 2) * 8)),
          priceLevel: bar.low,
          description: `Bearish OB — zona de oferta em ${formatScanLevel(bar.low, currentPrice)}`,
          category,
        });
        break;
      }
    }
  }

  // --- Fair Value Gap Detection ---
  for (let i = recent.length - 6; i < recent.length - 2; i++) {
    if (recent[i].high < recent[i + 2].low) {
      const gapSize = ((recent[i + 2].low - recent[i].high) / currentPrice * 100);
      patterns.push({
        instrumentSymbol: symbol,
        instrumentName: name,
        patternType: 'FVG',
        direction: 'bullish',
        confidence: Math.min(80, 50 + Math.round(gapSize * 50)),
        priceLevel: (recent[i].high + recent[i + 2].low) / 2,
        description: `Bullish FVG (${gapSize.toFixed(3)}%) — gap comprador`,
        category,
      });
      break;
    }
    if (recent[i].low > recent[i + 2].high) {
      const gapSize = ((recent[i].low - recent[i + 2].high) / currentPrice * 100);
      patterns.push({
        instrumentSymbol: symbol,
        instrumentName: name,
        patternType: 'FVG',
        direction: 'bearish',
        confidence: Math.min(80, 50 + Math.round(gapSize * 50)),
        priceLevel: (recent[i].low + recent[i + 2].high) / 2,
        description: `Bearish FVG (${gapSize.toFixed(3)}%) — gap vendedor`,
        category,
      });
      break;
    }
  }

  // --- BOS / CHOCH Detection ---
  const recentHighs: number[] = [];
  const recentLows: number[] = [];
  for (let i = 3; i < recent.length - 1; i++) {
    if (recent[i].high > recent[i - 1].high && recent[i].high > recent[i + 1].high) {
      recentHighs.push(recent[i].high);
    }
    if (recent[i].low < recent[i - 1].low && recent[i].low < recent[i + 1].low) {
      recentLows.push(recent[i].low);
    }
  }

  if (recentHighs.length >= 2 && recentLows.length >= 2) {
    const lastHigh = recentHighs[recentHighs.length - 1];
    const prevHigh = recentHighs[recentHighs.length - 2];
    const lastLow = recentLows[recentLows.length - 1];
    const prevLow = recentLows[recentLows.length - 2];

    if (lastHigh > prevHigh && lastLow > prevLow) {
      patterns.push({
        instrumentSymbol: symbol,
        instrumentName: name,
        patternType: 'BOS',
        direction: 'bullish',
        confidence: 70,
        priceLevel: lastHigh,
        description: 'BOS Altista — topos e fundos ascendentes',
        category,
      });
    } else if (lastHigh < prevHigh && lastLow < prevLow) {
      patterns.push({
        instrumentSymbol: symbol,
        instrumentName: name,
        patternType: 'BOS',
        direction: 'bearish',
        confidence: 70,
        priceLevel: lastLow,
        description: 'BOS Baixista — topos e fundos descendentes',
        category,
      });
    } else if (lastHigh < prevHigh && lastLow > prevLow) {
      patterns.push({
        instrumentSymbol: symbol,
        instrumentName: name,
        patternType: 'CHOCH',
        direction: 'bearish',
        confidence: 65,
        priceLevel: lastLow,
        description: 'CHOCH Baixista — possível reversão',
        category,
      });
    } else if (lastHigh > prevHigh && lastLow < prevLow) {
      patterns.push({
        instrumentSymbol: symbol,
        instrumentName: name,
        patternType: 'CHOCH',
        direction: 'bullish',
        confidence: 65,
        priceLevel: lastHigh,
        description: 'CHOCH Altista — possível reversão',
        category,
      });
    }
  }

  return patterns;
}

/** Detect Price Action patterns (simplified for scanning) */
function scanPriceActionPatterns(bars: PriceBar[], currentPrice: number, symbol: string, name: string, category: string): ScannedPattern[] {
  const patterns: ScannedPattern[] = [];
  if (bars.length < 5) return patterns;

  const last = bars[bars.length - 1];
  const prev = bars[bars.length - 2];
  const prev2 = bars[bars.length - 3];

  const bodySize = Math.abs(last.close - last.open);
  const totalRange = last.high - last.low;
  const upperWick = last.high - Math.max(last.close, last.open);
  const lowerWick = Math.min(last.close, last.open) - last.low;
  const isBullish = last.close > last.open;
  const isBearish = last.close < last.open;
  const prevBodySize = Math.abs(prev.close - prev.open);
  const prevIsBullish = prev.close > prev.open;
  const prevIsBearish = prev.close < prev.open;

  // Doji
  if (totalRange > 0 && bodySize / totalRange < 0.1) {
    patterns.push({
      instrumentSymbol: symbol,
      instrumentName: name,
      patternType: 'Doji',
      direction: 'neutral',
      confidence: 45,
      priceLevel: last.close,
      description: 'Doji — indecisão do mercado',
      category,
    });
  }

  // Hammer
  if (lowerWick > bodySize * 2 && upperWick < bodySize * 0.5 && totalRange > 0) {
    patterns.push({
      instrumentSymbol: symbol,
      instrumentName: name,
      patternType: 'Hammer',
      direction: 'bullish',
      confidence: isBullish ? 70 : 55,
      priceLevel: last.close,
      description: isBullish ? 'Martelo — sinal de reversão altista' : 'Martelo Invertido — possível reversão altista',
      category,
    });
  }

  // Shooting Star
  if (upperWick > bodySize * 2 && lowerWick < bodySize * 0.5 && totalRange > 0) {
    patterns.push({
      instrumentSymbol: symbol,
      instrumentName: name,
      patternType: 'Shooting Star',
      direction: 'bearish',
      confidence: 65,
      priceLevel: last.close,
      description: 'Estrela Cadente — sinal de reversão baixista',
      category,
    });
  }

  // Bullish Engulfing
  if (prevIsBearish && isBullish && last.close > prev.open && last.open < prev.close) {
    patterns.push({
      instrumentSymbol: symbol,
      instrumentName: name,
      patternType: 'Engulfing',
      direction: 'bullish',
      confidence: 75,
      priceLevel: last.close,
      description: 'Engolfo de Alta — forte sinal comprador',
      category,
    });
  }

  // Bearish Engulfing
  if (prevIsBullish && isBearish && last.open > prev.close && last.close < prev.open) {
    patterns.push({
      instrumentSymbol: symbol,
      instrumentName: name,
      patternType: 'Engulfing',
      direction: 'bearish',
      confidence: 75,
      priceLevel: last.close,
      description: 'Engolfo de Baixa — forte sinal vendedor',
      category,
    });
  }

  // Morning / Evening Star
  if (bars.length >= 3) {
    const prev2Bearish = prev2.close < prev2.open;
    const prevSmallBody = Math.abs(prev.close - prev.open) < prevBodySize * 0.5;
    const prev2Bullish = prev2.close > prev2.open;

    if (prev2Bearish && prevSmallBody && isBullish && last.close > (prev2.open + prev2.close) / 2) {
      patterns.push({
        instrumentSymbol: symbol,
        instrumentName: name,
        patternType: 'Morning Star',
        direction: 'bullish',
        confidence: 78,
        priceLevel: last.close,
        description: 'Estrela da Manhã — reversão altista de 3 velas',
        category,
      });
    }

    if (prev2Bullish && prevSmallBody && isBearish && last.close < (prev2.open + prev2.close) / 2) {
      patterns.push({
        instrumentSymbol: symbol,
        instrumentName: name,
        patternType: 'Evening Star',
        direction: 'bearish',
        confidence: 78,
        priceLevel: last.close,
        description: 'Estrela da Noite — reversão baixista de 3 velas',
        category,
      });
    }

    // Three White Soldiers
    if (prev2Bullish && prevIsBullish && isBullish &&
        last.close > prev.close && prev.close > prev2.close) {
      patterns.push({
        instrumentSymbol: symbol,
        instrumentName: name,
        patternType: '3 Soldiers',
        direction: 'bullish',
        confidence: 80,
        priceLevel: last.close,
        description: 'Três Soldados Brancos — forte momentum altista',
        category,
      });
    }

    // Three Black Crows
    if (prev2.close < prev2.open && prevIsBearish && isBearish &&
        last.close < prev.close && prev.close < prev2.close) {
      patterns.push({
        instrumentSymbol: symbol,
        instrumentName: name,
        patternType: '3 Crows',
        direction: 'bearish',
        confidence: 80,
        priceLevel: last.close,
        description: 'Três Corvos Negros — forte momentum baixista',
        category,
      });
    }
  }

  // Tweezer patterns
  if (Math.abs(last.high - prev.high) / currentPrice < 0.001) {
    patterns.push({
      instrumentSymbol: symbol,
      instrumentName: name,
      patternType: 'Tweezer',
      direction: 'bearish',
      confidence: 55,
      priceLevel: last.high,
      description: 'Tweezer Top — possível resistência dupla',
      category,
    });
  }
  if (Math.abs(last.low - prev.low) / currentPrice < 0.001) {
    patterns.push({
      instrumentSymbol: symbol,
      instrumentName: name,
      patternType: 'Tweezer',
      direction: 'bullish',
      confidence: 55,
      priceLevel: last.low,
      description: 'Tweezer Bottom — possível suporte duplo',
      category,
    });
  }

  // RSI-based patterns
  const closes = bars.map(b => b.close);
  const rsi = quickRSI(closes, 14);

  if (rsi < 30) {
    patterns.push({
      instrumentSymbol: symbol,
      instrumentName: name,
      patternType: 'RSI Oversold',
      direction: 'bullish',
      confidence: Math.min(75, 55 + Math.round((30 - rsi) * 2)),
      priceLevel: last.close,
      description: `RSI em ${Math.round(rsi)} — zona de sobrevenda`,
      category,
    });
  } else if (rsi > 70) {
    patterns.push({
      instrumentSymbol: symbol,
      instrumentName: name,
      patternType: 'RSI Overbought',
      direction: 'bearish',
      confidence: Math.min(75, 55 + Math.round((rsi - 70) * 2)),
      priceLevel: last.close,
      description: `RSI em ${Math.round(rsi)} — zona de sobrecompra`,
      category,
    });
  }

  return patterns;
}

/** Format a price level for display */
function formatScanLevel(level: number, currentPrice: number): string {
  if (currentPrice < 1) return level.toFixed(6);
  if (currentPrice < 100) return level.toFixed(4);
  return level.toFixed(2);
}

// ======================== MAIN SCAN HANDLER ========================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { instruments: instrumentSymbols, strategy = 'hybrid' } = body as {
      instruments: string[];
      strategy: 'smc' | 'price_action' | 'hybrid';
    };

    // Validate inputs
    if (!instrumentSymbols || !Array.isArray(instrumentSymbols)) {
      return NextResponse.json(
        { success: false, error: 'Lista de instrumentos inválida.' },
        { status: 400 }
      );
    }

    const symbols = instrumentSymbols;

    if (symbols.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Nenhum instrumento selecionado.' },
        { status: 400 }
      );
    }

    // Check cache
    const cacheKey = `${strategy}:${symbols.sort().join(',')}`;
    const cached = getCachedScan(cacheKey);
    if (cached) {
      return NextResponse.json({ success: true, patterns: cached, fromCache: true });
    }

    // Resolve instrument info
    const instrumentMap = new Map<string, { name: string; category: string }>();
    for (const sym of symbols) {
      const inst = ALL_INSTRUMENTS.find(i => i.symbol === sym);
      if (inst) {
        instrumentMap.set(sym, { name: inst.name, category: inst.category });
      } else {
        instrumentMap.set(sym, { name: sym, category: 'unknown' });
      }
    }

    // Scan each instrument in parallel (but with concurrency limit of 10)
    const allPatterns: ScannedPattern[] = [];
    const CONCURRENCY = 10;

    for (let i = 0; i < symbols.length; i += CONCURRENCY) {
      const batch = symbols.slice(i, i + CONCURRENCY);

      const batchResults = await Promise.allSettled(
        batch.map(async (symbol) => {
          try {
            // Fetch mini-history (30 candles daily)
            const historyData = await getHistory(symbol, '1d');
            const bars: PriceBar[] = (historyData?.body || [])
              .filter((q: any) => q && q.close > 0)
              .map((q: any) => ({
                close: q.close,
                high: q.high,
                low: q.low,
                open: q.open,
                volume: q.volume,
              }));

            // Only use last 30 candles for speed
            const recentBars = bars.slice(-30);
            if (recentBars.length < 10) return [];

            const currentPrice = recentBars[recentBars.length - 1].close;
            const info = instrumentMap.get(symbol) || { name: symbol, category: 'unknown' };
            const detectedPatterns: ScannedPattern[] = [];

            // Run pattern detection based on strategy
            if (strategy === 'smc' || strategy === 'hybrid') {
              detectedPatterns.push(...scanSMCPatterns(recentBars, currentPrice, symbol, info.name, info.category));
            }

            if (strategy === 'price_action' || strategy === 'hybrid') {
              detectedPatterns.push(...scanPriceActionPatterns(recentBars, currentPrice, symbol, info.name, info.category));
            }

            // Sort by confidence (highest first) and take top 3 per instrument
            detectedPatterns.sort((a, b) => b.confidence - a.confidence);
            return detectedPatterns.slice(0, 3);
          } catch {
            return [];
          }
        })
      );

      for (const result of batchResults) {
        if (result.status === 'fulfilled' && result.value) {
          allPatterns.push(...result.value);
        }
      }
    }

    // Sort all patterns by confidence (highest first)
    allPatterns.sort((a, b) => b.confidence - a.confidence);

    // Cache the results
    setCachedScan(cacheKey, allPatterns);

    return NextResponse.json({
      success: true,
      patterns: allPatterns,
      fromCache: false,
      scannedAt: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Scan API error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Erro interno no scanner.' },
      { status: 500 }
    );
  }
}
