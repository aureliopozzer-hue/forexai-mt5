import { NextRequest, NextResponse } from 'next/server';
import { getHistory } from '@/lib/finance-api';
import { getAuthenticatedUser, consumeCredits, fetchUserByEmail } from '@/lib/auth-server';

const COST_ANALYSIS = 5;
const TRIAL_DAYS = 3;

// In-memory analysis cache — helps with repeated requests in same serverless instance
const analysisCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function getCachedAnalysis(key: string): any | null {
  const entry = analysisCache.get(key);
  if (entry && Date.now() - entry.timestamp < CACHE_TTL) {
    return entry.data;
  }
  if (entry) analysisCache.delete(key);
  return null;
}

function setCachedAnalysis(key: string, data: any): void {
  if (analysisCache.size > 100) {
    const oldest = [...analysisCache.entries()].sort((a, b) => a[1].timestamp - b[1].timestamp);
    for (let i = 0; i < 20; i++) analysisCache.delete(oldest[i][0]);
  }
  analysisCache.set(key, { data, timestamp: Date.now() });
}

// ======================== TECHNICAL ANALYSIS ENGINE ========================

interface PriceBar {
  close: number;
  high: number;
  low: number;
  open: number;
  volume: number;
}

/** Calculate RSI using Wilder's smoothing method (14-period) */
function calculateRSI(closes: number[], period: number = 14): number {
  if (closes.length < period + 1) return 50; // Not enough data

  // Calculate initial average gain and average loss
  let avgGain = 0;
  let avgLoss = 0;

  for (let i = 1; i <= period; i++) {
    const change = closes[i] - closes[i - 1];
    if (change > 0) {
      avgGain += change;
    } else {
      avgLoss += Math.abs(change);
    }
  }

  avgGain /= period;
  avgLoss /= period;

  // Apply Wilder's smoothing for remaining periods
  for (let i = period + 1; i < closes.length; i++) {
    const change = closes[i] - closes[i - 1];
    const gain = change > 0 ? change : 0;
    const loss = change < 0 ? Math.abs(change) : 0;

    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
  }

  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
}

/** Calculate Simple Moving Average */
function calculateSMA(closes: number[], period: number): number {
  if (closes.length < period) return closes[closes.length - 1] || 0;
  const slice = closes.slice(-period);
  return slice.reduce((sum, v) => sum + v, 0) / period;
}

/** Find support level — nearest local minimum BELOW current price */
function findSupport(bars: PriceBar[], currentPrice: number, lookback: number = 30): number {
  const recent = bars.slice(-lookback);
  if (recent.length < 5) return currentPrice * 0.98;

  const localMinima: number[] = [];

  // Find all local minima (low that is lower than 2 neighbors on each side)
  for (let i = 2; i < recent.length - 2; i++) {
    if (recent[i].low <= recent[i - 1].low && recent[i].low <= recent[i - 2].low &&
        recent[i].low <= recent[i + 1].low && recent[i].low <= recent[i + 2].low) {
      localMinima.push(recent[i].low);
    }
  }

  // Filter to only levels BELOW current price (valid support)
  const supportsBelow = localMinima.filter(l => l < currentPrice);

  if (supportsBelow.length > 0) {
    // Return the HIGHEST support below current price (closest meaningful support)
    return Math.round(Math.max(...supportsBelow) * 1000) / 1000;
  }

  // Fallback: use the lowest low in the lookback period
  const lowestLow = Math.min(...recent.map(b => b.low));
  return Math.round(lowestLow * 1000) / 1000;
}

/** Find resistance level — nearest local maximum ABOVE current price */
function findResistance(bars: PriceBar[], currentPrice: number, lookback: number = 30): number {
  const recent = bars.slice(-lookback);
  if (recent.length < 5) return currentPrice * 1.02;

  const localMaxima: number[] = [];

  // Find all local maxima (high that is higher than 2 neighbors on each side)
  for (let i = 2; i < recent.length - 2; i++) {
    if (recent[i].high >= recent[i - 1].high && recent[i].high >= recent[i - 2].high &&
        recent[i].high >= recent[i + 1].high && recent[i].high >= recent[i + 2].high) {
      localMaxima.push(recent[i].high);
    }
  }

  // Filter to only levels ABOVE current price (valid resistance)
  const resistancesAbove = localMaxima.filter(h => h > currentPrice);

  if (resistancesAbove.length > 0) {
    // Return the LOWEST resistance above current price (closest meaningful resistance)
    return Math.round(Math.min(...resistancesAbove) * 1000) / 1000;
  }

  // Fallback: use the highest high in the lookback period
  const highestHigh = Math.max(...recent.map(b => b.high));
  return Math.round(highestHigh * 1000) / 1000;
}

/** Determine trend direction and strength */
function analyzeTrend(closes: number[]): { direction: 'altista' | 'baixista' | 'lateral'; strength: number } {
  if (closes.length < 20) return { direction: 'lateral', strength: 20 };

  const sma20 = calculateSMA(closes, 20);
  const sma50 = calculateSMA(closes, 50);
  const currentPrice = closes[closes.length - 1];

  // Calculate trend strength based on position relative to SMAs
  let bullishSignals = 0;
  let bearishSignals = 0;

  // Price vs SMA20
  if (currentPrice > sma20) bullishSignals++; else bearishSignals++;
  // SMA20 vs SMA50
  if (sma20 > sma50) bullishSignals++; else bearishSignals++;
  // Recent price momentum (last 5 candles)
  const recentCloses = closes.slice(-5);
  if (recentCloses.length >= 2) {
    const momentum = recentCloses[recentCloses.length - 1] - recentCloses[0];
    if (momentum > 0) bullishSignals++; else bearishSignals++;
  }
  // Higher highs/lower highs pattern
  const last10 = closes.slice(-10);
  if (last10.length >= 5) {
    const recentHigh = Math.max(...last10.slice(-5));
    const earlierHigh = Math.max(...last10.slice(0, 5));
    if (recentHigh > earlierHigh) bullishSignals++; else bearishSignals++;
  }

  const strength = Math.min(95, Math.max(10, Math.abs(bullishSignals - bearishSignals) * 25 + 30));

  if (bullishSignals > bearishSignals) {
    return { direction: 'altista', strength };
  } else if (bearishSignals > bullishSignals) {
    return { direction: 'baixista', strength };
  }
  return { direction: 'lateral', strength: Math.min(strength, 35) };
}

/** Calculate volatility level */
function analyzeVolatility(closes: number[], bars: PriceBar[]): 'baixa' | 'média' | 'alta' {
  if (closes.length < 10) return 'média';

  // Calculate average true range percentage
  const recentBars = bars.slice(-14);
  if (recentBars.length < 5) return 'média';

  const avgRange = recentBars.reduce((sum, b) => sum + (b.high - b.low), 0) / recentBars.length;
  const avgPrice = closes[closes.length - 1];
  const rangePercent = (avgRange / avgPrice) * 100;

  if (rangePercent < 1.0) return 'baixa';
  if (rangePercent < 2.5) return 'média';
  return 'alta';
}

/** Calculate EMA history (incremental O(n) instead of O(n²)) */
function calculateEMAHistory(values: number[], period: number): number[] {
  const result: number[] = [];
  if (values.length < period) {
    // Not enough data, return simple average of what we have for each point
    for (let i = 0; i < values.length; i++) {
      result.push(values.slice(0, i + 1).reduce((s, v) => s + v, 0) / (i + 1));
    }
    return result;
  }

  const multiplier = 2 / (period + 1);
  // Seed with SMA of first 'period' values
  let ema = values.slice(0, period).reduce((s, v) => s + v, 0) / period;

  for (let i = 0; i < values.length; i++) {
    if (i < period) {
      // Before we have enough data, use SMA
      result.push(values.slice(0, i + 1).reduce((s, v) => s + v, 0) / (i + 1));
    } else {
      ema = (values[i] - ema) * multiplier + ema;
      result.push(ema);
    }
  }
  return result;
}

/** MACD signal with proper crossover detection — O(n) optimized */
function getMACDSignal(closes: number[]): 'bullish' | 'bearish' | 'neutral' {
  if (closes.length < 26) return 'neutral';

  // Build MACD history incrementally (O(n) instead of O(n²))
  const ema12 = calculateEMAHistory(closes, 12);
  const ema26 = calculateEMAHistory(closes, 26);

  const macdHistory: number[] = [];
  for (let i = 25; i < closes.length; i++) {
    macdHistory.push(ema12[i] - ema26[i]);
  }

  if (macdHistory.length < 2) return 'neutral';

  const currentMACD = macdHistory[macdHistory.length - 1];

  // Calculate signal line (9-period EMA of MACD history) — also O(n)
  if (macdHistory.length >= 9) {
    const signalHistory = calculateEMAHistory(macdHistory, 9);
    const signalLine = signalHistory[signalHistory.length - 1];
    const prevMACD = macdHistory[macdHistory.length - 2];

    // Need previous signal for crossover detection
    if (macdHistory.length >= 10) {
      const prevSignalLine = signalHistory[signalHistory.length - 2];

      // Bullish crossover: MACD crosses above signal line
      if (prevMACD <= prevSignalLine && currentMACD > signalLine) return 'bullish';
      // Bearish crossover: MACD crosses below signal line
      if (prevMACD >= prevSignalLine && currentMACD < signalLine) return 'bearish';
    }

    // No crossover — just position relative to signal
    if (currentMACD > signalLine) return 'bullish';
    if (currentMACD < signalLine) return 'bearish';
  }

  // Fallback: just MACD sign
  if (currentMACD > 0) return 'bullish';
  if (currentMACD < 0) return 'bearish';
  return 'neutral';
}

// ======================== SMC CONCEPTS DETECTION ========================

/** Detect Smart Money Concepts from price data */
function detectSMCConcepts(bars: PriceBar[], currentPrice: number, bias: string): {
  orderBlock: string;
  fairValueGap: string;
  liquidityLevel: string;
  marketStructure: string;
} {
  const recent = bars.slice(-30);
  if (recent.length < 10) {
    return {
      orderBlock: 'Dados insuficientes',
      fairValueGap: 'Não identificado',
      liquidityLevel: 'Neutro',
      marketStructure: 'Indefinida',
    };
  }

  // --- Order Block Detection ---
  // Bullish OB: last bearish candle before a strong bullish move
  // Bearish OB: last bullish candle before a strong bearish move
  let orderBlock = 'Não identificado';
  for (let i = recent.length - 5; i >= 2; i--) {
    const bar = recent[i];
    const nextBars = recent.slice(i + 1, Math.min(i + 4, recent.length));

    if (nextBars.length < 2) continue;

    // Bullish Order Block: bearish candle followed by strong bullish move
    if (bar.close < bar.open && nextBars.every(nb => nb.close > nb.open)) {
      const moveUp = nextBars.reduce((s, nb) => s + (nb.close - nb.open), 0);
      const barSize = Math.abs(bar.open - bar.close);
      if (moveUp > barSize * 2) {
        orderBlock = `Bullish OB em ${formatLevel(bar.high, currentPrice)} — zona de demanda`;
        break;
      }
    }

    // Bearish Order Block: bullish candle followed by strong bearish move
    if (bar.close > bar.open && nextBars.every(nb => nb.close < nb.open)) {
      const moveDown = nextBars.reduce((s, nb) => s + (nb.open - nb.close), 0);
      const barSize = Math.abs(bar.close - bar.open);
      if (moveDown > barSize * 2) {
        orderBlock = `Bearish OB em ${formatLevel(bar.low, currentPrice)} — zona de oferta`;
        break;
      }
    }
  }
  if (orderBlock === 'Não identificado') {
    orderBlock = bias === 'bullish'
      ? `Bullish OB implícito abaixo de ${formatLevel(currentPrice * 0.997, currentPrice)}`
      : bias === 'bearish'
      ? `Bearish OB implícito acima de ${formatLevel(currentPrice * 1.003, currentPrice)}`
      : `Zona de acumulação em ${formatLevel(currentPrice * 0.998, currentPrice)}`;
  }

  // --- Fair Value Gap (FVG) Detection ---
  // Bullish FVG: bar[i].high < bar[i+2].low (gap between wicks)
  // Bearish FVG: bar[i].low > bar[i+2].high
  let fairValueGap = 'Não identificado';
  for (let i = recent.length - 6; i < recent.length - 2; i++) {
    // Bullish FVG
    if (recent[i].high < recent[i + 2].low) {
      const gapSize = ((recent[i + 2].low - recent[i].high) / currentPrice * 100).toFixed(3);
      fairValueGap = `Bullish FVG (${gapSize}%) — gap de desequilíbrio comprador`;
      break;
    }
    // Bearish FVG
    if (recent[i].low > recent[i + 2].high) {
      const gapSize = ((recent[i].low - recent[i + 2].high) / currentPrice * 100).toFixed(3);
      fairValueGap = `Bearish FVG (${gapSize}%) — gap de desequilíbrio vendedor`;
      break;
    }
  }
  if (fairValueGap === 'Não identificado') {
    fairValueGap = 'Sem FVG recente — mercado em equilíbrio';
  }

  // --- Liquidity Level Detection ---
  // Find areas where multiple lows/highs cluster (liquidity pools)
  const lows = recent.map(b => b.low);
  const highs = recent.map(b => b.high);
  let buySideLiquidity = 0;
  let sellSideLiquidity = 0;

  // Buy-side: cluster of similar highs above current price
  for (let i = recent.length - 10; i < recent.length; i++) {
    if (recent[i].high > currentPrice) {
      buySideLiquidity = Math.max(buySideLiquidity, recent[i].high);
    }
  }
  // Sell-side: cluster of similar lows below current price
  for (let i = recent.length - 10; i < recent.length; i++) {
    if (recent[i].low < currentPrice) {
      sellSideLiquidity = sellSideLiquidity === 0 ? recent[i].low : Math.max(sellSideLiquidity, recent[i].low);
    }
  }

  let liquidityLevel: string;
  if (buySideLiquidity > 0 && sellSideLiquidity > 0) {
    liquidityLevel = `Liquidez compradora acima de ${formatLevel(buySideLiquidity, currentPrice)} · vendedora abaixo de ${formatLevel(sellSideLiquidity, currentPrice)}`;
  } else if (buySideLiquidity > 0) {
    liquidityLevel = `Liquidez compradora acima de ${formatLevel(buySideLiquidity, currentPrice)}`;
  } else if (sellSideLiquidity > 0) {
    liquidityLevel = `Liquidez vendedora abaixo de ${formatLevel(sellSideLiquidity, currentPrice)}`;
  } else {
    liquidityLevel = 'Sem pools de liquidez significativos';
  }

  // --- Market Structure (BOS/CHOCH) Detection ---
  // BOS (Break of Structure): continuation — higher high in uptrend, lower low in downtrend
  // CHOCH (Change of Character): reversal — lower high in uptrend, higher low in downtrend
  let marketStructure = 'Lateral — sem estrutura definida';
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
      marketStructure = 'BOS Altista — topos e fundos ascendentes';
    } else if (lastHigh < prevHigh && lastLow < prevLow) {
      marketStructure = 'BOS Baixista — topos e fundos descendentes';
    } else if (lastHigh < prevHigh && lastLow > prevLow) {
      marketStructure = 'CHOCH Baixista — possível reversão de alta para baixa';
    } else if (lastHigh > prevHigh && lastLow < prevLow) {
      marketStructure = 'CHOCH Altista — possível reversão de baixa para alta';
    } else {
      marketStructure = 'Estrutura lateral — consolidação';
    }
  } else if (recentHighs.length >= 2) {
    const lastHigh = recentHighs[recentHighs.length - 1];
    const prevHigh = recentHighs[recentHighs.length - 2];
    marketStructure = lastHigh > prevHigh
      ? 'BOS Altista — topos ascendentes'
      : 'Estrutura enfraquecendo — topos descendentes';
  }

  return { orderBlock, fairValueGap, liquidityLevel, marketStructure };
}

// ======================== PRICE ACTION PATTERN DETECTION ========================

/** Detect candlestick patterns from recent price data */
function detectPriceActionPatterns(bars: PriceBar[], currentPrice: number): string[] {
  const patterns: string[] = [];
  if (bars.length < 5) return ['Dados insuficientes'];

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

  // --- Single Candle Patterns ---

  // Doji: very small body relative to range
  if (totalRange > 0 && bodySize / totalRange < 0.1) {
    patterns.push('Doji — indecisão do mercado');
  }

  // Hammer: small body at top, long lower wick (at least 2x body)
  if (lowerWick > bodySize * 2 && upperWick < bodySize * 0.5 && totalRange > 0) {
    if (isBullish) {
      patterns.push('Martelo (Hammer) — sinal de reversão altista');
    } else {
      patterns.push('Martelo Invertido — possível reversão altista');
    }
  }

  // Shooting Star: small body at bottom, long upper wick
  if (upperWick > bodySize * 2 && lowerWick < bodySize * 0.5 && totalRange > 0) {
    patterns.push('Estrela Cadente (Shooting Star) — sinal de reversão baixista');
  }

  // --- Two Candle Patterns ---

  // Bullish Engulfing: previous bearish, current bullish, current body engulfs previous
  if (prevIsBearish && isBullish && last.close > prev.open && last.open < prev.close) {
    patterns.push('Engolfo de Alta (Bullish Engulfing) — forte sinal comprador');
  }

  // Bearish Engulfing: previous bullish, current bearish, current body engulfs previous
  if (prevIsBullish && isBearish && last.open > prev.close && last.close < prev.open) {
    patterns.push('Engolfo de Baixa (Bearish Engulfing) — forte sinal vendedor');
  }

  // Tweezer Top/Bottom: similar highs or lows on consecutive candles
  if (Math.abs(last.high - prev.high) / currentPrice < 0.001) {
    patterns.push('Tweezer Top — possível resistência dupla');
  }
  if (Math.abs(last.low - prev.low) / currentPrice < 0.001) {
    patterns.push('Tweezer Bottom — possível suporte duplo');
  }

  // --- Three Candle Patterns ---

  if (bars.length >= 3) {
    // Morning Star: bearish → small body → bullish
    const prev2Bearish = prev2.close < prev2.open;
    const prevSmallBody = Math.abs(prev.close - prev.open) < prevBodySize * 0.5;
    if (prev2Bearish && prevSmallBody && isBullish && last.close > (prev2.open + prev2.close) / 2) {
      patterns.push('Estrela da Manhã (Morning Star) — reversão altista de 3 velas');
    }

    // Evening Star: bullish → small body → bearish
    const prev2Bullish = prev2.close > prev2.open;
    if (prev2Bullish && prevSmallBody && isBearish && last.close < (prev2.open + prev2.close) / 2) {
      patterns.push('Estrela da Noite (Evening Star) — reversão baixista de 3 velas');
    }

    // Three White Soldiers: 3 consecutive bullish candles with higher closes
    if (prev2Bullish && prevIsBullish && isBullish &&
        last.close > prev.close && prev.close > prev2.close) {
      patterns.push('Três Soldados Brancos — forte momentum altista');
    }

    // Three Black Crows: 3 consecutive bearish candles with lower closes
    if (prev2.close < prev2.open && prevIsBearish && isBearish &&
        last.close < prev.close && prev.close < prev2.close) {
      patterns.push('Três Corvos Negros — forte momentum baixista');
    }
  }

  // --- Support/Resistance based patterns ---
  const recentLows = bars.slice(-10).map(b => b.low);
  const recentHighs = bars.slice(-10).map(b => b.high);
  const nearSupport = recentLows.some(l => Math.abs(l - last.low) / currentPrice < 0.002);
  const nearResistance = recentHighs.some(h => Math.abs(h - last.high) / currentPrice < 0.002);

  if (nearSupport && isBullish) {
    patterns.push('Rejeição em suporte — preço respeita zona de demanda');
  }
  if (nearResistance && isBearish) {
    patterns.push('Rejeição em resistência — preço respeita zona de oferta');
  }

  // If no patterns found, add a generic one
  if (patterns.length === 0) {
    if (isBullish && bodySize > prevBodySize) {
      patterns.push('Candle de pressão compradora — corpo maior que anterior');
    } else if (isBearish && bodySize > prevBodySize) {
      patterns.push('Candle de pressão vendedora — corpo maior que anterior');
    } else {
      patterns.push('Padrão neutro — sem formação significativa');
    }
  }

  return patterns;
}

/** Format a price level relative to current price for display */
function formatLevel(level: number, currentPrice: number): string {
  // For very small prices (like some cryptos), use more decimals
  if (currentPrice < 1) return level.toFixed(6);
  if (currentPrice < 100) return level.toFixed(4);
  return level.toFixed(2);
}

/** Run full technical analysis on a symbol */
async function runTechnicalAnalysis(symbol: string, name: string, currentPrice: number, rrRatio: number = 2.0, strategy: string = 'hybrid', riskMode: 'conservative' | 'aggressive' = 'conservative'): Promise<{
  strategy: string;
  bias: 'bullish' | 'bearish' | 'neutral';
  confidence: number;
  entryProbability: number;
  successProbability: number;
  direction: 'BUY' | 'SELL' | 'WAIT';
  keyLevels: { support: number; resistance: number; pivot: number };
  tradePoints: {
    buyPoint: number; sellPoint: number;
    stopLossBuy: number; stopLossSell: number;
    takeProfitBuy: number; takeProfitSell: number;
  };
  indicators: {
    rsi: number; macdSignal: 'bullish' | 'bearish' | 'neutral';
    trendStrength: number; volatility: 'low' | 'medium' | 'high';
  };
  riskReward: {
    ratio: string; stopLoss: number; takeProfit: number;
    riskPoints: number; rewardPoints: number;
    riskDisplay?: string; rewardDisplay?: string;
  };
  smcConcepts?: {
    orderBlock: string;
    fairValueGap: string;
    liquidityLevel: string;
    marketStructure: string;
  };
  priceActionPatterns?: string[];
  summary: string;
  recommendation: string;
}> {
  // Fetch historical data
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

  if (bars.length < 15) {
    // Not enough data, return neutral analysis
    return buildFallbackAnalysis(currentPrice, symbol, 'Dados históricos insuficientes para análise técnica detalhada.', rrRatio, strategy, riskMode);
  }

  const closes = bars.map(b => b.close);

  // Calculate all indicators
  const rsi = calculateRSI(closes, 14);
  const sma20 = calculateSMA(closes, 20);
  const sma50 = calculateSMA(closes, 50);
  const { direction: trendDir, strength: trendStrength } = analyzeTrend(closes);
  const volatility = analyzeVolatility(closes, bars);
  const support = findSupport(bars, currentPrice);
  const resistance = findResistance(bars, currentPrice);
  const macdSignal = getMACDSignal(closes);

  // Determine overall bias
  let bias: 'bullish' | 'bearish' | 'neutral' = 'neutral';
  let biasScore = 0;

  // RSI signals (mean-reversion interpretation)
  if (rsi < 30) biasScore += 2; // Oversold = bullish reversal potential
  else if (rsi < 40) biasScore += 1;
  else if (rsi > 70) biasScore -= 2; // Overbought = bearish reversal potential
  else if (rsi > 60) biasScore -= 1;

  // Trend signals
  if (trendDir === 'altista') biasScore += 1;
  else if (trendDir === 'baixista') biasScore -= 1;

  // Price vs SMA20
  if (currentPrice > sma20) biasScore += 0.5;
  else biasScore -= 0.5;

  // MACD signal
  if (macdSignal === 'bullish') biasScore += 1;
  else if (macdSignal === 'bearish') biasScore -= 1;

  if (biasScore >= 2) bias = 'bullish';
  else if (biasScore <= -2) bias = 'bearish';

  // Determine direction
  let direction: 'BUY' | 'SELL' | 'WAIT' = 'WAIT';
  if (bias === 'bullish' && rsi < 65) direction = 'BUY';
  else if (bias === 'bearish' && rsi > 35) direction = 'SELL';

  // Calculate confidence
  const confidence = Math.min(90, Math.max(25, 40 + Math.abs(biasScore) * 12 + (trendStrength - 30) * 0.3));

  // Calculate trade points calibrated per instrument type
  const pivot = Math.round(((support + resistance) / 2) * 1000) / 1000;

  // Use instrument-specific ranges for realistic stops
  const ranges = getStopTPRanges(symbol, currentPrice);

  // Calculate ATR (Average True Range) for dynamic stop sizing within instrument range
  const recentBars = bars.slice(-14);
  const trueRanges: number[] = [];
  for (let i = 1; i < recentBars.length; i++) {
    const tr = Math.max(
      recentBars[i].high - recentBars[i].low,
      Math.abs(recentBars[i].high - recentBars[i - 1].close),
      Math.abs(recentBars[i].low - recentBars[i - 1].close)
    );
    trueRanges.push(tr);
  }
  const atr = trueRanges.length > 0 ? trueRanges.reduce((a, b) => a + b, 0) / trueRanges.length : currentPrice * 0.005;

  // ATR-adjusted stop: use 1.0x ATR (conservative) or 0.5x ATR (aggressive — tighter stops)
  const atrMultiplier = riskMode === 'aggressive' ? 0.5 : 1.0;
  const atrStop = atr * atrMultiplier;
  // For aggressive mode, also reduce the minStop floor (50% of normal) to allow tighter stops
  const effectiveMinStop = riskMode === 'aggressive' ? ranges.minStop * 0.5 : ranges.minStop;
  const effectiveMaxStop = riskMode === 'aggressive' ? ranges.minStop * 2.0 : ranges.maxStop;
  const stopDistance = Math.round(Math.min(Math.max(atrStop, effectiveMinStop), effectiveMaxStop) * 100000) / 100000;
  // Take profit: use user-selected R:R ratio, capped at instrument-specific maxTP
  const tpDistance = Math.round(Math.min(stopDistance * rrRatio, ranges.maxTP) * 100000) / 100000;

  const tradePoints = {
    buyPoint: Math.round((currentPrice * 0.9999) * 100000) / 100000,
    sellPoint: Math.round((currentPrice * 1.0001) * 100000) / 100000,
    stopLossBuy: Math.round((currentPrice - stopDistance) * 100000) / 100000,
    stopLossSell: Math.round((currentPrice + stopDistance) * 100000) / 100000,
    takeProfitBuy: Math.round((currentPrice + tpDistance) * 100000) / 100000,
    takeProfitSell: Math.round((currentPrice - tpDistance) * 100000) / 100000,
  };

  // Volatility mapping
  const volatilityMap: Record<string, 'low' | 'medium' | 'high'> = {
    'baixa': 'low',
    'média': 'medium',
    'alta': 'high',
  };

  // Calculate entry and success probabilities
  const entryProbability = Math.min(85, Math.max(30, confidence - 5 + (rsi > 35 && rsi < 65 ? 5 : -5)));
  const successProbability = Math.min(75, Math.max(35, Math.round(entryProbability * 0.7 + 15 + (trendStrength > 50 ? 5 : 0))));

  // Risk/reward calculation using calibrated function
  const riskReward = calculateRiskReward(tradePoints, currentPrice, symbol);

  // ===== STRATEGY-SPECIFIC ANALYSIS =====

  // Detect SMC Concepts (for smc and hybrid strategies)
  let smcConcepts: undefined | {
    orderBlock: string;
    fairValueGap: string;
    liquidityLevel: string;
    marketStructure: string;
  } = undefined;

  if (strategy === 'smc' || strategy === 'hybrid') {
    smcConcepts = detectSMCConcepts(bars, currentPrice, bias);
  }

  // Detect Price Action Patterns (for price_action and hybrid strategies)
  let priceActionPatterns: string[] | undefined = undefined;

  if (strategy === 'price_action' || strategy === 'hybrid') {
    priceActionPatterns = detectPriceActionPatterns(bars, currentPrice);
  }

  // Generate summary in Portuguese — strategy-aware
  const trendPt = trendDir === 'altista' ? 'de alta' : trendDir === 'baixista' ? 'de baixa' : 'lateral';
  const biasPt = bias === 'bullish' ? 'com viés de compra' : bias === 'bearish' ? 'com viés de venda' : 'neutro';
  const rsiDescription = rsi < 30 ? 'em zona de sobrevenda' : rsi > 70 ? 'em zona de sobrecompra' : 'em região neutra';
  const strategyLabel = strategy === 'smc' ? 'SMC' : strategy === 'price_action' ? 'Price Action' : 'Híbrida';

  let summary = `${name} apresenta tendência ${trendPt} com RSI em ${Math.round(rsi)} (${rsiDescription}). ` +
    `O preço está ${currentPrice > sma20 ? 'acima' : 'abaixo'} da média móvel de 20 períodos, ` +
    `indicando momento ${currentPrice > sma20 ? 'positivo' : 'negativo'}. `;

  // Add strategy-specific insight to summary
  if (strategy === 'smc' && smcConcepts) {
    summary += `Análise ${strategyLabel}: ${smcConcepts.marketStructure}. ${biasPt}.`;
  } else if (strategy === 'price_action' && priceActionPatterns && priceActionPatterns.length > 0) {
    summary += `Análise ${strategyLabel}: ${priceActionPatterns[0]}. ${biasPt}.`;
  } else if (strategy === 'hybrid' && smcConcepts && priceActionPatterns && priceActionPatterns.length > 0) {
    summary += `Análise ${strategyLabel}: ${smcConcepts.marketStructure} + ${priceActionPatterns[0]}. ${biasPt}.`;
  } else {
    summary += `Análise ${biasPt}.`;
  }

  // Generate recommendation in Portuguese — strategy-aware
  let recommendation: string;

  if (direction === 'BUY') {
    recommendation = `Com base na análise ${strategyLabel}, ${name} mostra sinais ${bias === 'bullish' ? 'positivos' : 'moderados'} para entrada. ` +
      `RSI em ${Math.round(rsi)} ${rsi < 40 ? 'indica espaço para valorização' : 'acompanha o momentum atual'}. ` +
      `Suporte em ${support} e resistência em ${resistance}. `;

    if (strategy === 'smc' && smcConcepts) {
      recommendation += `${smcConcepts.orderBlock}. ${smcConcepts.marketStructure}. `;
    } else if (strategy === 'price_action' && priceActionPatterns && priceActionPatterns.length > 0) {
      recommendation += `Padrão identificado: ${priceActionPatterns[0]}. `;
    } else if (strategy === 'hybrid' && smcConcepts && priceActionPatterns && priceActionPatterns.length > 0) {
      recommendation += `${smcConcepts.marketStructure}. ${priceActionPatterns[0]}. `;
    }

    recommendation += `Sugere-se entrada com stop em ${tradePoints.stopLossBuy} e alvo em ${tradePoints.takeProfitBuy}. ` +
      `A volatilidade está ${volatility}, o que ${volatility === 'alta' ? 'requer cautela com o tamanho da posição' : 'favorece operações com menor risco'}.`;
  } else if (direction === 'SELL') {
    recommendation = `${name} apresenta sinais de enfraquecimento com tendência ${trendPt}. ` +
      `RSI em ${Math.round(rsi)} ${rsi > 60 ? 'sugere sobrecompra' : 'mostra perda de momentum'}. ` +
      `A média de 20 períodos atua como resistência dinâmica em ${Math.round(sma20 * 100) / 100}. `;

    if (strategy === 'smc' && smcConcepts) {
      recommendation += `${smcConcepts.orderBlock}. ${smcConcepts.fairValueGap}. `;
    } else if (strategy === 'price_action' && priceActionPatterns && priceActionPatterns.length > 0) {
      recommendation += `Padrão identificado: ${priceActionPatterns[0]}. `;
    } else if (strategy === 'hybrid' && smcConcepts && priceActionPatterns && priceActionPatterns.length > 0) {
      recommendation += `${smcConcepts.marketStructure}. ${priceActionPatterns[0]}. `;
    }

    recommendation += `Para posições vendidas, stop em ${tradePoints.stopLossSell} e alvo em ${tradePoints.takeProfitSell}. ` +
      `Monitore o volume para confirmação do movimento.`;
  } else {
    recommendation = `O cenário técnico de ${name} é indefinido no momento. A tendência está ${trendPt} ` +
      `e o RSI em ${Math.round(rsi)} não apresenta extremos. ` +
      `Aguarde uma definição clara: rompimento de ${resistance} para compra ou perda de ${support} para venda. `;

    if (strategy === 'smc' && smcConcepts) {
      recommendation += `${smcConcepts.liquidityLevel}. `;
    } else if (strategy === 'hybrid' && smcConcepts) {
      recommendation += `${smcConcepts.marketStructure}. `;
    }

    recommendation += `O cruzamento das médias de 20 e 50 períodos pode sinalizar o próximo movimento.`;
  }

  return {
    strategy,  // FIX: Use the selected strategy instead of hardcoded 'technical'
    bias,
    confidence: Math.round(confidence),
    entryProbability: Math.round(entryProbability),
    successProbability: Math.round(successProbability),
    direction,
    keyLevels: {
      support: Math.round(support * 100) / 100,
      resistance: Math.round(resistance * 100) / 100,
      pivot: Math.round(pivot * 100) / 100,
    },
    tradePoints,
    indicators: {
      rsi: Math.round(rsi * 10) / 10,
      macdSignal,
      trendStrength: Math.round(trendStrength),
      volatility: volatilityMap[volatility] || 'medium',
    },
    riskReward,
    smcConcepts,
    priceActionPatterns,
    summary,
    recommendation,
  };
}

/** Build a minimal fallback analysis when data is insufficient */
function buildFallbackAnalysis(currentPrice: number, symbol: string, reason: string, rrRatio: number = 2.0, strategy: string = 'hybrid', riskMode: 'conservative' | 'aggressive' = 'conservative'): Awaited<ReturnType<typeof runTechnicalAnalysis>> {
  const tradePoints = generateSafeTradePoints(currentPrice, symbol, rrRatio, riskMode);
  const riskReward = calculateRiskReward(tradePoints, currentPrice, symbol);
  return {
    strategy,
    bias: 'neutral',
    confidence: 35,
    entryProbability: 40,
    successProbability: 40,
    direction: 'WAIT',
    keyLevels: {
      support: Math.round(currentPrice * 0.98 * 100) / 100,
      resistance: Math.round(currentPrice * 1.02 * 100) / 100,
      pivot: Math.round(currentPrice * 100) / 100,
    },
    tradePoints,
    indicators: {
      rsi: 50,
      macdSignal: 'neutral',
      trendStrength: 25,
      volatility: 'medium',
    },
    riskReward,
    summary: `${reason}. Recomenda-se aguardar mais dados para uma análise conclusiva.`,
    recommendation: 'Dados insuficientes para recomendação precisa. Monitore o ativo e aguarde confirmação de tendência antes de operar.',
  };
}

// ======================== TRADE POINTS VALIDATION ========================

/** Get instrument type from symbol for calibration */
function getInstrumentType(symbol: string): 'forex_jpy' | 'forex_major' | 'forex_exotic' | 'indices' | 'metals' | 'crypto' | 'brazil_stock' | 'japan_stock' | 'us_stock' {
  // Brazilian stocks & ETFs (.SA) — must be before JPY check (no overlap, but safest first)
  if (symbol.includes('.SA')) return 'brazil_stock';
  // JPY forex pairs — but NOT JPYBRL=X (it's an exotic BRL cross priced ~0.03)
  if (symbol.includes('JPY') && !symbol.includes('BRL')) return 'forex_jpy';
  // Exotic forex (BRL, MXN, ZAR, TRY, HKD, SGD, NOK, SEK, CNY, INR) — check BEFORE general =X
  if (symbol.includes('BRL') || symbol.includes('MXN') || symbol.includes('ZAR') || symbol.includes('TRY') || symbol.includes('HKD') || symbol.includes('SGD') || symbol.includes('NOK') || symbol.includes('SEK') || symbol.includes('CNY') || symbol.includes('INR')) return 'forex_exotic';
  // Major forex (remaining =X pairs: EURUSD, GBPUSD, etc.)
  if (symbol.includes('=X')) return 'forex_major';
  // Indices: ^ prefixed, known non-^ indices, .TO/.HK/.AX exchanges
  if (symbol.startsWith('^') || symbol === 'DX-Y.NYB' || symbol === 'FTSEMIB.MI' || symbol === 'J200.L' ||
      /^\d{6}\.(SS|SZ)$/.test(symbol) ||
      symbol.includes('.TO') || symbol.includes('.HK') || symbol.includes('.AX')) return 'indices';
  // Commodity futures (all =F symbols cover GC, SI, CL, BZ, NG, HG, PL, PA, ZW, ZC, ZS, CT, KC, SB, CC)
  if (symbol.endsWith('=F')) return 'metals';
  // Crypto: all crypto symbols contain '-USD' (BTC-USD, UNI7083-USD, PEPE24478-USD, etc.)
  // Do NOT use name-based checks (e.g. includes('ETH')) — causes false positives (ETHA ETF)
  if (symbol.includes('-USD')) return 'crypto';
  // Japanese stocks (.T suffix: Toyota, Sony, SoftBank)
  if (symbol.endsWith('.T')) return 'japan_stock';
  // Default: US stocks & ETFs
  return 'us_stock';
}

/** Get realistic stop/TP ranges per instrument type */
function getStopTPRanges(symbol: string, price: number) {
  const type = getInstrumentType(symbol);

  switch (type) {
    case 'forex_jpy':
      // JPY pairs: 2-digit pricing, stops 15-40 pips, TP up to 120 pips (supports R:R 1:3)
      return { minStop: price * 0.0015, maxStop: price * 0.0040, maxTP: price * 0.0120 };
    case 'forex_major':
      // Major forex: 4-digit pricing, stops 15-40 pips, TP up to 120 pips (supports R:R 1:3)
      return { minStop: price * 0.0015, maxStop: price * 0.0040, maxTP: price * 0.0120 };
    case 'forex_exotic':
      // Exotic forex (BRL, MXN, ZAR): wider stops 0.3%-0.8%, TP up to 2.4% (supports R:R 1:3)
      return { minStop: price * 0.003, maxStop: price * 0.008, maxTP: price * 0.024 };
    case 'indices':
      // Indices: moderate stops 0.3%-0.8%, TP up to 2.4% (supports R:R 1:3)
      return { minStop: price * 0.003, maxStop: price * 0.008, maxTP: price * 0.024 };
    case 'metals':
      // Gold, Silver, Oil: moderate stops 0.3%-0.8%, TP up to 2.4% (supports R:R 1:3)
      return { minStop: price * 0.003, maxStop: price * 0.008, maxTP: price * 0.024 };
    case 'crypto':
      // Crypto: wider stops 0.8%-2.5%, TP up to 7.5% (supports R:R 1:3)
      return { minStop: price * 0.008, maxStop: price * 0.025, maxTP: price * 0.075 };
    case 'brazil_stock':
      // B3 stocks (PETR4, VALE3, etc.): stops 1.0%-2.5%, TP up to 7.5% (supports R:R 1:3)
      return { minStop: price * 0.010, maxStop: price * 0.025, maxTP: price * 0.075 };
    case 'japan_stock':
      // Japanese stocks (Toyota, Sony, etc.): stops 0.5%-2.0%, TP up to 6.0% (supports R:R 1:3)
      return { minStop: price * 0.005, maxStop: price * 0.020, maxTP: price * 0.060 };
    case 'us_stock':
    default:
      // US stocks & ETFs: stops 0.5%-2.0%, TP up to 6.0% (supports R:R 1:3)
      return { minStop: price * 0.005, maxStop: price * 0.020, maxTP: price * 0.060 };
  }
}

/** Calculate risk/reward from validated trade points — ALWAYS call after validation */
function calculateRiskReward(tradePoints: any, price: number, symbol: string) {
  const type = getInstrumentType(symbol);

  // Risk/reward is symmetric (same stopDistance and tpDistance for buy/sell)
  // so we calculate from the buy perspective
  const riskPoints = Math.abs(price - tradePoints.stopLossBuy);
  const rewardPoints = Math.abs(tradePoints.takeProfitBuy - price);
  const rrRatio = riskPoints > 0 ? Math.round((rewardPoints / riskPoints) * 10) / 10 : 2.0;

  // Format risk/reward in meaningful units for display
  let riskDisplay: string;
  let rewardDisplay: string;

  switch (type) {
    case 'forex_jpy':
      riskDisplay = (riskPoints * 100).toFixed(1) + ' pips';
      rewardDisplay = (rewardPoints * 100).toFixed(1) + ' pips';
      break;
    case 'forex_major':
    case 'forex_exotic':
      riskDisplay = (riskPoints * 10000).toFixed(1) + ' pips';
      rewardDisplay = (rewardPoints * 10000).toFixed(1) + ' pips';
      break;
    case 'indices':
      riskDisplay = riskPoints.toFixed(2) + ' pts';
      rewardDisplay = rewardPoints.toFixed(2) + ' pts';
      break;
    case 'metals':
      riskDisplay = riskPoints.toFixed(2) + ' pts';
      rewardDisplay = rewardPoints.toFixed(2) + ' pts';
      break;
    case 'crypto':
      riskDisplay = ((riskPoints / price) * 100).toFixed(2) + '%';
      rewardDisplay = ((rewardPoints / price) * 100).toFixed(2) + '%';
      break;
    case 'brazil_stock':
    case 'japan_stock':
    case 'us_stock':
    default:
      riskDisplay = ((riskPoints / price) * 100).toFixed(2) + '%';
      rewardDisplay = ((rewardPoints / price) * 100).toFixed(2) + '%';
      break;
  }

  return {
    ratio: `1:${rrRatio.toFixed(1)}`,
    stopLoss: tradePoints.stopLossBuy,
    takeProfit: tradePoints.takeProfitBuy,
    riskPoints,
    rewardPoints,
    riskDisplay,
    rewardDisplay,
  };
}

/** Generate safe trade points with proper risk/reward calibrated per instrument */
function generateSafeTradePoints(price: number, symbol: string, rrRatio: number = 2.0, riskMode: 'conservative' | 'aggressive' = 'conservative') {
  const ranges = getStopTPRanges(symbol, price);
  // Conservative: use middle of the range; Aggressive: use lower end (tighter stops)
  const stopDistance = riskMode === 'aggressive'
    ? ranges.minStop * 0.75  // Aggressive: much tighter stop
    : (ranges.minStop + ranges.maxStop) / 2;  // Conservative: balanced stop
  const tpDistance = Math.min(stopDistance * rrRatio, ranges.maxTP);

  return {
    buyPoint: Math.round(price * 0.9999 * 100000) / 100000,
    sellPoint: Math.round(price * 1.0001 * 100000) / 100000,
    stopLossBuy: Math.round((price - stopDistance) * 100000) / 100000,
    stopLossSell: Math.round((price + stopDistance) * 100000) / 100000,
    takeProfitBuy: Math.round((price + tpDistance) * 100000) / 100000,
    takeProfitSell: Math.round((price - tpDistance) * 100000) / 100000,
  };
}

// ======================== MAIN ROUTE HANDLER ========================

// Force dynamic — never cache analysis or credit data
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    // ===== AUTH CHECK =====
    const authUser = await getAuthenticatedUser();

    // Require login — if session is valid, getAuthenticatedUser always returns a user
    // (even with Supabase fallback). null means truly not authenticated.
    if (!authUser) {
      return NextResponse.json(
        { success: false, error: 'Faça login para usar a análise por IA.', needsLogin: true },
        { status: 401 }
      );
    }

    // ===== TRIAL/CREDITS CHECK =====
    // Check trial status first — if user is within 3-day trial, they have unlimited access
    let isTrialActive = false;
    if (!authUser.isPro) {
      const supabaseUser = await fetchUserByEmail(authUser.email);
      const createdAt = supabaseUser?.created_at ? new Date(supabaseUser.created_at) : null;
      if (createdAt && !isNaN(createdAt.getTime())) {
        const now = new Date();
        const trialEnd = new Date(createdAt.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000);
        isTrialActive = now <= trialEnd;
      } else {
        // No created_at found — assume trial is active (optimistic)
        isTrialActive = true;
      }
    }

    // Block only if: not Pro, trial expired, and no credits
    if (!authUser.isPro && !isTrialActive && authUser.credits < COST_ANALYSIS) {
      return NextResponse.json(
        { success: false, error: 'Seu período grátis de 3 dias acabou. Assine para ter acesso ilimitado.', needsSubscription: true, creditsRemaining: authUser.credits },
        { status: 402 }
      );
    }

    // ===== REQUEST PARSING =====
    const body = await request.json();
    const { symbol, name, currentPrice, strategy, riskRewardRatio, riskMode } = body;
    const rrRatio = typeof riskRewardRatio === 'number' && riskRewardRatio >= 0.5 && riskRewardRatio <= 5.0 ? riskRewardRatio : 2.0;
    const selectedRiskMode = riskMode === 'aggressive' ? 'aggressive' : 'conservative';

    if (!symbol || !name) {
      return NextResponse.json(
        { success: false, error: 'Symbol and name are required' },
        { status: 400 }
      );
    }

    const selectedStrategy = strategy || 'hybrid';

    // Check analysis cache first (fast path)
    const cacheKey = `${symbol}:${selectedStrategy}:${rrRatio}:${selectedRiskMode}:${Math.round(currentPrice * 1000)}`;
    const cached = getCachedAnalysis(cacheKey);
    if (cached) {
      // During trial or Pro: no credit deduction needed — unlimited access
      let creditsRemaining = 999;
      if (!authUser.isPro && !isTrialActive) {
        // Only deduct credits if trial has expired
        creditsRemaining = authUser.credits - COST_ANALYSIS;
        const result = await consumeCredits(authUser.id, COST_ANALYSIS);
        if (result >= 0) creditsRemaining = result;
      }
      return NextResponse.json({
        success: true,
        symbol,
        name,
        analysis: cached,
        isTechnicalAnalysis: true,
        creditsRemaining,
        isPro: authUser.isPro,
      });
    }

    // ===== RUN TECHNICAL ANALYSIS =====
    const analysis = await runTechnicalAnalysis(symbol, name, currentPrice, rrRatio, selectedStrategy, selectedRiskMode);

    // Cache the result
    setCachedAnalysis(cacheKey, analysis);

    // Deduct credits AFTER successful analysis
    // During trial or Pro: no credit deduction — unlimited access
    let creditsRemaining: number;
    if (authUser.isPro || isTrialActive) {
      creditsRemaining = 999;
    } else {
      const result = await consumeCredits(authUser.id, COST_ANALYSIS);
      if (result === -1) {
        // Insufficient credits (race condition — credits changed between check and deduction)
        return NextResponse.json(
          { success: false, error: 'Seu período grátis de 3 dias acabou. Assine para ter acesso ilimitado.', needsSubscription: true, creditsRemaining: authUser.credits },
          { status: 402 }
        );
      }
      creditsRemaining = result >= 0 ? result : authUser.credits - COST_ANALYSIS;
    }

    return NextResponse.json({
      success: true,
      symbol,
      name,
      analysis,
      isTechnicalAnalysis: true,
      creditsRemaining,
      isPro: authUser.isPro,
    });
  } catch (error: any) {
    console.error('AI Analysis error:', error);
    return NextResponse.json(
      { success: false, error: error.message, fallback: true },
      { status: 500 }
    );
  }
}
