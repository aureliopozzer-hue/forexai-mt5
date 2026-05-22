export interface Instrument {
  id: string;
  symbol: string;
  name: string;
  flag: string;
  category: MarketCategory;
  sector?: string;
}

export interface QuoteData {
  symbol?: string;
  regularMarketPrice?: number | { raw: number; fmt: string };
  regularMarketChange?: number | { raw: number; fmt: string };
  regularMarketChangePercent?: number | { raw: number; fmt: string };
  regularMarketOpen?: number | { raw: number; fmt: string };
  regularMarketDayHigh?: number | { raw: number; fmt: string };
  regularMarketDayLow?: number | { raw: number; fmt: string };
  regularMarketVolume?: number | { raw: number; fmt: string };
  regularMarketPreviousClose?: number | { raw: number; fmt: string };
  fiftyDayAverage?: number | { raw: number; fmt: string };
  twoHundredDayAverage?: number | { raw: number; fmt: string };
  shortName?: string;
  longName?: string;
  marketState?: string;
  fiftyTwoWeekLow?: number | { raw: number; fmt: string };
  fiftyTwoWeekHigh?: number | { raw: number; fmt: string };
  averageDailyVolume3Month?: number | { raw: number; fmt: string };
}

export type AnalysisStrategy = 'smc' | 'price_action' | 'hybrid';

export const STRATEGY_META: Record<AnalysisStrategy, { label: string; emoji: string; color: string; description: string }> = {
  smc: {
    label: 'SMC',
    emoji: '🏦',
    color: 'violet',
    description: 'Smart Money Concepts — Order Blocks, FVG, Liquidity',
  },
  price_action: {
    label: 'Price Action',
    emoji: '📈',
    color: 'cyan',
    description: 'Padrões de velas, suporte/resistência, tendência',
  },
  hybrid: {
    label: 'Híbrido',
    emoji: '⚡',
    color: 'amber',
    description: 'SMC + Price Action combinados',
  },
};

export interface AIAnalysis {
  strategy: AnalysisStrategy;
  bias: string;
  confidence: number;
  entryProbability: number;
  successProbability: number;
  direction: string;
  keyLevels: {
    support: number;
    resistance: number;
    pivot: number;
  };
  tradePoints: {
    buyPoint: number;
    sellPoint: number;
    stopLossBuy: number;
    stopLossSell: number;
    takeProfitBuy: number;
    takeProfitSell: number;
  };
  indicators: {
    rsi: number;
    macdSignal: string;
    trendStrength: number;
    volatility: string;
  };
  riskReward: {
    ratio: string;
    stopLoss: number;
    takeProfit: number;
    riskPoints: number;
    rewardPoints: number;
    riskDisplay?: string;
    rewardDisplay?: string;
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
}

export interface SparklinePoint {
  date: string;
  close: number;
}

export interface HistoryDataPoint {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface AnalysisHistoryItem {
  id: string;
  timestamp: number;
  instrumentSymbol: string;
  instrumentName: string;
  strategy: AnalysisStrategy;
  direction: string;
  confidence: number;
  successProbability: number;
  analysis: AIAnalysis;
}

export type MarketCategory = 'forex' | 'indices' | 'metals' | 'crypto' | 'brazil' | 'stocks' | 'etfs' | 'favorites';

// Helper to extract number from either flat or nested format
export function getVal(val: number | { raw: number; fmt: string } | string | undefined): number {
  if (val === undefined || val === null) return 0;
  if (typeof val === 'number') return val;
  if (typeof val === 'string') return parseFloat(val) || 0;
  return val.raw;
}

export function fmtVal(val: number | { raw: number; fmt: string } | string | undefined, decimals: number = 4): string {
  if (val === undefined || val === null) return '—';
  if (typeof val === 'number') return val.toFixed(decimals);
  if (typeof val === 'string') {
    const num = parseFloat(val);
    return isNaN(num) ? val : num.toFixed(decimals);
  }
  return val.fmt;
}

export function formatPrice(price: number, symbol: string): string {
  if (!price) return '—';

  // --- Forex: JPY pairs (2 decimals) ---
  // NOTE: JPYBRL=X must be excluded — it's a BRL cross priced ~0.03, needs 4 decimals
  if (symbol.includes('JPY') && !symbol.includes('BRL')) return price.toFixed(2);

  // --- Forex: BRL crosses (4 decimals) ---
  // Both USDBRL=X (contains 'BRL=') and EURBRL=X / GBPBRL=X / JPYBRL=X (contain 'BRL')
  if (symbol.includes('BRL')) return price.toFixed(4);

  // --- Forex: CAD pairs (4 decimals) ---
  if (symbol.includes('CAD=')) return price.toFixed(4);

  // --- Crypto: magnitude-based formatting ---
  // All crypto symbols contain '-USD' (BTC-USD, UNI7083-USD, PEPE24478-USD, etc.)
  // Do NOT use name-based checks (e.g. includes('ETH')) — they cause false positives (ETHA ETF)
  if (symbol.includes('-USD')) {
    if (price >= 10000) return price.toFixed(2);
    if (price >= 100) return price.toFixed(2);
    if (price >= 1) return price.toFixed(4);
    return price.toFixed(6);
  }

  // --- Indices & commodities: 2 decimals ---
  // Indices starting with ^
  if (symbol.startsWith('^')) return price.toFixed(2);
  // Non-^ indices: DX-Y.NYB, FTSEMIB.MI, 000001.SS, 399001.SZ, J200.L, 000300.SS
  if (symbol === 'DX-Y.NYB' || symbol === 'FTSEMIB.MI' || symbol === 'J200.L' ||
      /^\d{6}\.(SS|SZ)$/.test(symbol)) return price.toFixed(2);
  // Commodity futures (all =F symbols: GC, SI, CL, BZ, NG, HG, PL, PA, ZW, ZC, ZS, CT, KC, SB, CC)
  if (symbol.endsWith('=F')) return price.toFixed(2);

  // --- Brazilian stocks & ETFs (.SA): 2 decimals ---
  if (symbol.includes('.SA')) return price.toFixed(2);

  // --- Japanese stocks (.T): 2 decimals ---
  if (symbol.endsWith('.T')) return price.toFixed(2);

  // --- US Stocks & ETFs: always 2 decimals (regardless of price) ---
  // If we reach here and it's not a forex pair (=X), it's a US stock/ETF
  if (!symbol.includes('=X')) return price.toFixed(2);

  // --- Default forex (remaining =X pairs): 4 decimals ---
  return price.toFixed(4);
}

// ===================== EXPANDED INSTRUMENT DATABASE =====================

export const FOREX_PAIRS: Instrument[] = [
  // Majors
  { id: 'eurusd', symbol: 'EURUSD=X', name: 'EUR/USD', flag: '🇪🇺🇺🇸', category: 'forex' },
  { id: 'gbpusd', symbol: 'GBPUSD=X', name: 'GBP/USD', flag: '🇬🇧🇺🇸', category: 'forex' },
  { id: 'usdjpy', symbol: 'USDJPY=X', name: 'USD/JPY', flag: '🇺🇸🇯🇵', category: 'forex' },
  { id: 'usdchf', symbol: 'USDCHF=X', name: 'USD/CHF', flag: '🇺🇸🇨🇭', category: 'forex' },
  { id: 'audusd', symbol: 'AUDUSD=X', name: 'AUD/USD', flag: '🇦🇺🇺🇸', category: 'forex' },
  { id: 'usdcad', symbol: 'USDCAD=X', name: 'USD/CAD', flag: '🇺🇸🇨🇦', category: 'forex' },
  { id: 'nzdusd', symbol: 'NZDUSD=X', name: 'NZD/USD', flag: '🇳🇿🇺🇸', category: 'forex' },
  // Crosses
  { id: 'eurgbp', symbol: 'EURGBP=X', name: 'EUR/GBP', flag: '🇪🇺🇬🇧', category: 'forex' },
  { id: 'eurjpy', symbol: 'EURJPY=X', name: 'EUR/JPY', flag: '🇪🇺🇯🇵', category: 'forex' },
  { id: 'gbpjpy', symbol: 'GBPJPY=X', name: 'GBP/JPY', flag: '🇬🇧🇯🇵', category: 'forex' },
  { id: 'audjpy', symbol: 'AUDJPY=X', name: 'AUD/JPY', flag: '🇦🇺🇯🇵', category: 'forex' },
  { id: 'chfjpy', symbol: 'CHFJPY=X', name: 'CHF/JPY', flag: '🇨🇭🇯🇵', category: 'forex' },
  { id: 'euraud', symbol: 'EURAUD=X', name: 'EUR/AUD', flag: '🇪🇺🇦🇺', category: 'forex' },
  { id: 'eurchf', symbol: 'EURCHF=X', name: 'EUR/CHF', flag: '🇪🇺🇨🇭', category: 'forex' },
  { id: 'gbpaud', symbol: 'GBPAUD=X', name: 'GBP/AUD', flag: '🇬🇧🇦🇺', category: 'forex' },
  { id: 'gbpchf', symbol: 'GBPCHF=X', name: 'GBP/CHF', flag: '🇬🇧🇨🇭', category: 'forex' },
  { id: 'audnzd', symbol: 'AUDNZD=X', name: 'AUD/NZD', flag: '🇦🇺🇳🇿', category: 'forex' },
  { id: 'nzdjpy', symbol: 'NZDJPY=X', name: 'NZD/JPY', flag: '🇳🇿🇯🇵', category: 'forex' },
  { id: 'cadjpy', symbol: 'CADJPY=X', name: 'CAD/JPY', flag: '🇨🇦🇯🇵', category: 'forex' },
  { id: 'audcad', symbol: 'AUDCAD=X', name: 'AUD/CAD', flag: '🇦🇺🇨🇦', category: 'forex' },
  // Exotic
  { id: 'usdbrl', symbol: 'USDBRL=X', name: 'USD/BRL', flag: '🇺🇸🇧🇷', category: 'forex' },
  { id: 'usdmxn', symbol: 'USDMXN=X', name: 'USD/MXN', flag: '🇺🇸🇲🇽', category: 'forex' },
  { id: 'usdzar', symbol: 'USDZAR=X', name: 'USD/ZAR', flag: '🇺🇸🇿🇦', category: 'forex' },
  { id: 'usdsgd', symbol: 'USDSGD=X', name: 'USD/SGD', flag: '🇺🇸🇸🇬', category: 'forex' },
  { id: 'usdhkd', symbol: 'USDHKD=X', name: 'USD/HKD', flag: '🇺🇸🇭🇰', category: 'forex' },
  { id: 'usdtry', symbol: 'USDTRY=X', name: 'USD/TRY', flag: '🇺🇸🇹🇷', category: 'forex' },
  { id: 'usdnok', symbol: 'USDNOK=X', name: 'USD/NOK', flag: '🇺🇸🇳🇴', category: 'forex' },
  { id: 'usdsek', symbol: 'USDSEK=X', name: 'USD/SEK', flag: '🇺🇸🇸🇪', category: 'forex' },
  { id: 'usdcny', symbol: 'USDCNY=X', name: 'USD/CNY', flag: '🇺🇸🇨🇳', category: 'forex' },
  { id: 'usdinr', symbol: 'USDINR=X', name: 'USD/INR', flag: '🇺🇸🇮🇳', category: 'forex' },
  // BRL Crosses (popular in Brazil)
  { id: 'eurlbrl', symbol: 'EURBRL=X', name: 'EUR/BRL', flag: '🇪🇺🇧🇷', category: 'forex' },
  { id: 'gbpbrl', symbol: 'GBPBRL=X', name: 'GBP/BRL', flag: '🇬🇧🇧🇷', category: 'forex' },
  { id: 'jpybrl', symbol: 'JPYBRL=X', name: 'JPY/BRL', flag: '🇯🇵🇧🇷', category: 'forex' },
  // BTC/BRL computed from BTC-USD * USDBRL=X (BTCBRL=X delisted from Yahoo)
];

export const INDICES: Instrument[] = [
  // Americas
  { id: 'sp500', symbol: '^GSPC', name: 'S&P 500', flag: '🇺🇸', category: 'indices' },
  { id: 'dji', symbol: '^DJI', name: 'Dow Jones', flag: '🇺🇸', category: 'indices' },
  { id: 'nasdaq', symbol: '^IXIC', name: 'Nasdaq', flag: '🇺🇸', category: 'indices' },
  { id: 'nasdaq100', symbol: '^NDX', name: 'Nasdaq 100', flag: '🇺🇸', category: 'indices' },
  { id: 'russell', symbol: '^RUT', name: 'Russell 2000', flag: '🇺🇸', category: 'indices' },
  { id: 'sp400', symbol: '^MID', name: 'S&P MidCap 400', flag: '🇺🇸', category: 'indices' },
  { id: 'sp100', symbol: '^OEX', name: 'S&P 100', flag: '🇺🇸', category: 'indices' },
  { id: 'wilshire', symbol: '^W5000', name: 'Wilshire 5000', flag: '🇺🇸', category: 'indices' },
  { id: 'vix', symbol: '^VIX', name: 'VIX', flag: '🇺🇸', category: 'indices' },
  { id: 'dollar', symbol: 'DX-Y.NYB', name: 'Dollar Index', flag: '🇺🇸', category: 'indices' },
  { id: 'us10y', symbol: '^TNX', name: 'US 10Y Bond', flag: '🇺🇸', category: 'indices' },
  { id: 'us30y', symbol: '^TYX', name: 'US 30Y Bond', flag: '🇺🇸', category: 'indices' },
  { id: 'tsx', symbol: '^GSPTSE', name: 'S&P/TSX', flag: '🇨🇦', category: 'indices' },
  { id: 'ipc', symbol: '^MXX', name: 'IPC Mexico', flag: '🇲🇽', category: 'indices' },
  { id: 'ibov', symbol: '^BVSP', name: 'IBOVESPA', flag: '🇧🇷', category: 'indices' },
  { id: 'merval', symbol: '^MERV', name: 'MERVAL', flag: '🇦🇷', category: 'indices' },
  { id: 'ipsa', symbol: '^IPSA', name: 'IPSA', flag: '🇨🇱', category: 'indices' },
  // Europe
  { id: 'ftse', symbol: '^FTSE', name: 'UK100', flag: '🇬🇧', category: 'indices' },
  { id: 'dax', symbol: '^GDAXI', name: 'DAX 40', flag: '🇩🇪', category: 'indices' },
  { id: 'cac40', symbol: '^FCHI', name: 'CAC 40', flag: '🇫🇷', category: 'indices' },
  { id: 'eurostoxx', symbol: '^STOXX50E', name: 'Euro Stoxx 50', flag: '🇪🇺', category: 'indices' },
  { id: 'ibex', symbol: '^IBEX', name: 'IBEX 35', flag: '🇪🇸', category: 'indices' },
  { id: 'ftsemib', symbol: 'FTSEMIB.MI', name: 'FTSE MIB', flag: '🇮🇹', category: 'indices' },
  { id: 'aex', symbol: '^AEX', name: 'AEX', flag: '🇳🇱', category: 'indices' },
  { id: 'smi', symbol: '^SSMI', name: 'SMI', flag: '🇨🇭', category: 'indices' },
  { id: 'omx', symbol: '^OMX', name: 'OMX 30', flag: '🇸🇪', category: 'indices' },
  { id: 'atx', symbol: '^ATX', name: 'ATX', flag: '🇦🇹', category: 'indices' },
  // Asia-Pacific
  { id: 'nikkei', symbol: '^N225', name: 'Nikkei 225', flag: '🇯🇵', category: 'indices' },
  { id: 'topix', symbol: '^TPX', name: 'TOPIX', flag: '🇯🇵', category: 'indices' },
  { id: 'hangseng', symbol: '^HSI', name: 'Hang Seng', flag: '🇭🇰', category: 'indices' },
  { id: 'shanghai', symbol: '000001.SS', name: 'Shanghai Comp', flag: '🇨🇳', category: 'indices' },
  { id: 'shenzhen', symbol: '399001.SZ', name: 'Shenzhen Comp', flag: '🇨🇳', category: 'indices' },
  { id: 'kospi', symbol: '^KS11', name: 'KOSPI', flag: '🇰🇷', category: 'indices' },
  { id: 'taiex', symbol: '^TWII', name: 'TAIEX', flag: '🇹🇼', category: 'indices' },
  { id: 'asx', symbol: '^AXJO', name: 'ASX 200', flag: '🇦🇺', category: 'indices' },
  { id: 'sti', symbol: '^STI', name: 'Straits Times', flag: '🇸🇬', category: 'indices' },
  { id: 'jakarta', symbol: '^JKSE', name: 'IDX Composite', flag: '🇮🇩', category: 'indices' },
  { id: 'nz50', symbol: '^NZ50', name: 'NZX 50', flag: '🇳🇿', category: 'indices' },
  { id: 'nifty', symbol: '^NSEI', name: 'NIFTY 50', flag: '🇮🇳', category: 'indices' },
  { id: 'sensex', symbol: '^BSESN', name: 'SENSEX', flag: '🇮🇳', category: 'indices' },
  { id: 'set', symbol: '^SET.BK', name: 'SET Index', flag: '🇹🇭', category: 'indices' },
  // Middle East & Africa
  { id: 'tadawul', symbol: '^TASI.SR', name: 'Tadawul', flag: '🇸🇦', category: 'indices' },
  { id: 'jse', symbol: 'J200.L', name: 'FTSE/JSE Top 40', flag: '🇿🇦', category: 'indices' },
  // China CSI 300
  { id: 'csi300', symbol: '000300.SS', name: 'CSI 300', flag: '🇨🇳', category: 'indices' },
];

export const METALS: Instrument[] = [
  // Precious Metals
  { id: 'gold', symbol: 'GC=F', name: 'Gold', flag: '🥇', category: 'metals' },
  { id: 'silver', symbol: 'SI=F', name: 'Silver', flag: '🥈', category: 'metals' },
  { id: 'platinum', symbol: 'PL=F', name: 'Platinum', flag: '⬜', category: 'metals' },
  { id: 'palladium', symbol: 'PA=F', name: 'Palladium', flag: '🔲', category: 'metals' },
  // Base Metals
  { id: 'copper', symbol: 'HG=F', name: 'Copper', flag: '🟤', category: 'metals' },
  // Energy
  { id: 'oil', symbol: 'CL=F', name: 'Crude Oil WTI', flag: '🛢️', category: 'metals' },
  { id: 'brent', symbol: 'BZ=F', name: 'UKOIL', flag: '🛢️', category: 'metals' },
  { id: 'natgas', symbol: 'NG=F', name: 'Natural Gas', flag: '🔥', category: 'metals' },
  // Agriculture
  { id: 'wheat', symbol: 'ZW=F', name: 'Wheat', flag: '🌾', category: 'metals' },
  { id: 'corn', symbol: 'ZC=F', name: 'Corn', flag: '🌽', category: 'metals' },
  { id: 'soy', symbol: 'ZS=F', name: 'Soybeans', flag: '🫘', category: 'metals' },
  { id: 'cotton', symbol: 'CT=F', name: 'Cotton', flag: '🧵', category: 'metals' },
  { id: 'coffee', symbol: 'KC=F', name: 'Coffee', flag: '☕', category: 'metals' },
  { id: 'sugar', symbol: 'SB=F', name: 'Sugar', flag: '🍬', category: 'metals' },
  { id: 'cocoa', symbol: 'CC=F', name: 'Cocoa', flag: '🍫', category: 'metals' },
];

export const CRYPTO: Instrument[] = [
  // Top 20
  { id: 'btc', symbol: 'BTC-USD', name: 'Bitcoin', flag: '₿', category: 'crypto' },
  { id: 'eth', symbol: 'ETH-USD', name: 'Ethereum', flag: '⟠', category: 'crypto' },
  { id: 'sol', symbol: 'SOL-USD', name: 'Solana', flag: '◎', category: 'crypto' },
  { id: 'xrp', symbol: 'XRP-USD', name: 'XRP', flag: '✕', category: 'crypto' },
  { id: 'bnb', symbol: 'BNB-USD', name: 'BNB', flag: '🔶', category: 'crypto' },
  { id: 'ada', symbol: 'ADA-USD', name: 'Cardano', flag: '🔵', category: 'crypto' },
  { id: 'doge', symbol: 'DOGE-USD', name: 'Dogecoin', flag: '🐕', category: 'crypto' },
  { id: 'avax', symbol: 'AVAX-USD', name: 'Avalanche', flag: '🔺', category: 'crypto' },
  { id: 'dot', symbol: 'DOT-USD', name: 'Polkadot', flag: '⚪', category: 'crypto' },
  { id: 'link', symbol: 'LINK-USD', name: 'Chainlink', flag: '🔗', category: 'crypto' },
  { id: 'matic', symbol: 'MATIC-USD', name: 'Polygon', flag: '💜', category: 'crypto' },
  { id: 'uni', symbol: 'UNI7083-USD', name: 'Uniswap', flag: '🦄', category: 'crypto' },
  { id: 'atom', symbol: 'ATOM-USD', name: 'Cosmos', flag: '⚛️', category: 'crypto' },
  { id: 'ltc', symbol: 'LTC-USD', name: 'Litecoin', flag: '🪙', category: 'crypto' },
  { id: 'near', symbol: 'NEAR-USD', name: 'NEAR Protocol', flag: '🌐', category: 'crypto' },
  { id: 'apt', symbol: 'ALGO-USD', name: 'Algorand', flag: '🅰️', category: 'crypto' },
  { id: 'arb', symbol: 'ARB11841-USD', name: 'Arbitrum', flag: '🔵', category: 'crypto' },
  { id: 'op', symbol: 'OP-USD', name: 'Optimism', flag: '🔴', category: 'crypto' },
  { id: 'fil', symbol: 'FIL-USD', name: 'Filecoin', flag: '📁', category: 'crypto' },
  { id: 'aave', symbol: 'AAVE-USD', name: 'Aave', flag: '👻', category: 'crypto' },
  { id: 'render', symbol: 'RENDER-USD', name: 'Render', flag: '🎨', category: 'crypto' },
  { id: 'inj', symbol: 'INJ-USD', name: 'Injective', flag: '💉', category: 'crypto' },
  { id: 'sui', symbol: 'SUI20947-USD', name: 'Sui', flag: '💧', category: 'crypto' },
  { id: 'ton', symbol: 'TON11419-USD', name: 'Toncoin', flag: '💎', category: 'crypto' },
  // Meme & Stablecoins (very popular on TradingView Brazil)
  { id: 'pepe', symbol: 'PEPE24478-USD', name: 'Pepe', flag: '🐸', category: 'crypto' },
  { id: 'shib', symbol: 'SHIB-USD', name: 'Shiba Inu', flag: '🐕', category: 'crypto' },
  { id: 'trx', symbol: 'TRX-USD', name: 'TRON', flag: '🔵', category: 'crypto' },
  { id: 'usdt', symbol: 'USDT-USD', name: 'Tether', flag: '💵', category: 'crypto' },
  { id: 'usdc', symbol: 'USDC-USD', name: 'USD Coin', flag: '💰', category: 'crypto' },
];

export const STOCKS: Instrument[] = [
  // Tech Giants (Magnificent 7)
  { id: 'aapl', symbol: 'AAPL', name: 'Apple', flag: '🍎', category: 'stocks', sector: 'Technology' },
  { id: 'msft', symbol: 'MSFT', name: 'Microsoft', flag: '🪟', category: 'stocks', sector: 'Technology' },
  { id: 'googl', symbol: 'GOOGL', name: 'Alphabet', flag: '🔍', category: 'stocks', sector: 'Technology' },
  { id: 'amzn', symbol: 'AMZN', name: 'Amazon', flag: '📦', category: 'stocks', sector: 'Technology' },
  { id: 'nvda', symbol: 'NVDA', name: 'NVIDIA', flag: '🟢', category: 'stocks', sector: 'Technology' },
  { id: 'meta', symbol: 'META', name: 'Meta', flag: '👤', category: 'stocks', sector: 'Technology' },
  { id: 'tsla', symbol: 'TSLA', name: 'Tesla', flag: '⚡', category: 'stocks', sector: 'Automotive' },
  // Finance
  { id: 'jpm', symbol: 'JPM', name: 'JPMorgan', flag: '🏦', category: 'stocks', sector: 'Finance' },
  { id: 'v', symbol: 'V', name: 'Visa', flag: '💳', category: 'stocks', sector: 'Finance' },
  { id: 'ma', symbol: 'MA', name: 'Mastercard', flag: '💳', category: 'stocks', sector: 'Finance' },
  { id: 'gs', symbol: 'GS', name: 'Goldman Sachs', flag: '🏦', category: 'stocks', sector: 'Finance' },
  // Healthcare
  { id: 'jnj', symbol: 'JNJ', name: 'Johnson & Johnson', flag: '💊', category: 'stocks', sector: 'Healthcare' },
  { id: 'unh', symbol: 'UNH', name: 'UnitedHealth', flag: '🏥', category: 'stocks', sector: 'Healthcare' },
  { id: 'pfe', symbol: 'PFE', name: 'Pfizer', flag: '💊', category: 'stocks', sector: 'Healthcare' },
  // Energy
  { id: 'xom', symbol: 'XOM', name: 'ExxonMobil', flag: '🛢️', category: 'stocks', sector: 'Energy' },
  { id: 'cvx', symbol: 'CVX', name: 'Chevron', flag: '⛽', category: 'stocks', sector: 'Energy' },
  // Consumer
  { id: 'wmt', symbol: 'WMT', name: 'Walmart', flag: '🛒', category: 'stocks', sector: 'Consumer' },
  { id: 'nke', symbol: 'NKE', name: 'Nike', flag: '👟', category: 'stocks', sector: 'Consumer' },
  { id: 'mcd', symbol: 'MCD', name: 'McDonald\'s', flag: '🍔', category: 'stocks', sector: 'Consumer' },
  { id: 'sbux', symbol: 'SBUX', name: 'Starbucks', flag: '☕', category: 'stocks', sector: 'Consumer' },
  // Semiconductor
  { id: 'amd', symbol: 'AMD', name: 'AMD', flag: '🔴', category: 'stocks', sector: 'Semiconductor' },
  { id: 'intc', symbol: 'INTC', name: 'Intel', flag: '🔵', category: 'stocks', sector: 'Semiconductor' },
  { id: 'avgo', symbol: 'AVGO', name: 'Broadcom', flag: '🟣', category: 'stocks', sector: 'Semiconductor' },
  { id: 'qcom', symbol: 'QCOM', name: 'Qualcomm', flag: '📡', category: 'stocks', sector: 'Semiconductor' },
  { id: 'mu', symbol: 'MU', name: 'Micron', flag: '💾', category: 'stocks', sector: 'Semiconductor' },
  // Other Major
  { id: 'dis', symbol: 'DIS', name: 'Disney', flag: '🏰', category: 'stocks', sector: 'Entertainment' },
  { id: 'nflx', symbol: 'NFLX', name: 'Netflix', flag: '🎬', category: 'stocks', sector: 'Entertainment' },
  { id: 'crm', symbol: 'CRM', name: 'Salesforce', flag: '☁️', category: 'stocks', sector: 'Technology' },
  { id: 'adbe', symbol: 'ADBE', name: 'Adobe', flag: '🎨', category: 'stocks', sector: 'Technology' },
  { id: 'orcl', symbol: 'ORCL', name: 'Oracle', flag: '🗄️', category: 'stocks', sector: 'Technology' },
  { id: 'ibm', symbol: 'IBM', name: 'IBM', flag: '💻', category: 'stocks', sector: 'Technology' },
  { id: 'pypl', symbol: 'PYPL', name: 'PayPal', flag: '💰', category: 'stocks', sector: 'Finance' },
  { id: 'cost', symbol: 'COST', name: 'Costco', flag: '🏪', category: 'stocks', sector: 'Consumer' },
  { id: 'ba', symbol: 'BA', name: 'Boeing', flag: '✈️', category: 'stocks', sector: 'Industrial' },
  { id: 'cat', symbol: 'CAT', name: 'Caterpillar', flag: '🚜', category: 'stocks', sector: 'Industrial' },
  // Other notable US stocks
  { id: 't', symbol: 'T', name: 'AT&T', flag: '📱', category: 'stocks', sector: 'Telecom' },
  { id: 'vz', symbol: 'VZ', name: 'Verizon', flag: '📱', category: 'stocks', sector: 'Telecom' },
  // Japan Blue Chips
  { id: 'toyota', symbol: '7203.T', name: 'Toyota', flag: '🇯🇵', category: 'stocks', sector: 'Automotive' },
  { id: 'sony', symbol: '6758.T', name: 'Sony', flag: '🇯🇵', category: 'stocks', sector: 'Technology' },
  { id: 'softbank', symbol: '9984.T', name: 'SoftBank', flag: '🇯🇵', category: 'stocks', sector: 'Technology' },
];

export const ETFS: Instrument[] = [
  // Index ETFs
  { id: 'spy', symbol: 'SPY', name: 'SPDR S&P 500', flag: '📊', category: 'etfs', sector: 'Index' },
  { id: 'qqq', symbol: 'QQQ', name: 'Invesco QQQ', flag: '📊', category: 'etfs', sector: 'Index' },
  { id: 'dia', symbol: 'DIA', name: 'SPDR Dow Jones', flag: '📊', category: 'etfs', sector: 'Index' },
  { id: 'iwm', symbol: 'IWM', name: 'iShares Russell 2000', flag: '📊', category: 'etfs', sector: 'Index' },
  // Sector ETFs
  { id: 'xlk', symbol: 'XLK', name: 'Technology Select', flag: '💻', category: 'etfs', sector: 'Technology' },
  { id: 'xlf', symbol: 'XLF', name: 'Financial Select', flag: '🏦', category: 'etfs', sector: 'Finance' },
  { id: 'xle', symbol: 'XLE', name: 'Energy Select', flag: '🛢️', category: 'etfs', sector: 'Energy' },
  { id: 'xlv', symbol: 'XLV', name: 'Health Care Select', flag: '💊', category: 'etfs', sector: 'Healthcare' },
  { id: 'xly', symbol: 'XLY', name: 'Consumer Disc.', flag: '🛍️', category: 'etfs', sector: 'Consumer' },
  { id: 'xlp', symbol: 'XLP', name: 'Consumer Staples', flag: '🛒', category: 'etfs', sector: 'Consumer' },
  { id: 'xli', symbol: 'XLI', name: 'Industrial Select', flag: '🏭', category: 'etfs', sector: 'Industrial' },
  { id: 'xlu', symbol: 'XLU', name: 'Utilities Select', flag: '⚡', category: 'etfs', sector: 'Utilities' },
  { id: 'xlre', symbol: 'XLRE', name: 'Real Estate Select', flag: '🏠', category: 'etfs', sector: 'Real Estate' },
  { id: 'xlb', symbol: 'XLB', name: 'Materials Select', flag: '⛏️', category: 'etfs', sector: 'Materials' },
  { id: 'xlc', symbol: 'XLC', name: 'Communication Select', flag: '📡', category: 'etfs', sector: 'Communication' },
  // Commodity ETFs
  { id: 'gld', symbol: 'GLD', name: 'SPDR Gold', flag: '🥇', category: 'etfs', sector: 'Commodity' },
  { id: 'slv', symbol: 'SLV', name: 'iShares Silver', flag: '🥈', category: 'etfs', sector: 'Commodity' },
  { id: 'uso', symbol: 'USO', name: 'United States Oil', flag: '🛢️', category: 'etfs', sector: 'Commodity' },
  // Bond ETFs
  { id: 'tlt', symbol: 'TLT', name: 'iShares 20+ Yr Treasury', flag: '📜', category: 'etfs', sector: 'Bond' },
  { id: 'ief', symbol: 'IEF', name: 'iShares 7-10 Yr Treasury', flag: '📜', category: 'etfs', sector: 'Bond' },
  { id: 'hyg', symbol: 'HYG', name: 'iShares High Yield', flag: '📜', category: 'etfs', sector: 'Bond' },
  // Crypto ETFs
  { id: 'ibit', symbol: 'IBIT', name: 'iShares Bitcoin ETF', flag: '₿', category: 'etfs', sector: 'Crypto' },
  { id: 'etha', symbol: 'ETHA', name: 'iShares Ethereum ETF', flag: '⟠', category: 'etfs', sector: 'Crypto' },
  // Semiconductor
  { id: 'soxx', symbol: 'SOXX', name: 'iShares Semiconductors', flag: '🔬', category: 'etfs', sector: 'Semiconductor' },
  // International
  { id: 'ewz', symbol: 'EWZ', name: 'iShares Brazil', flag: '🇧🇷', category: 'etfs', sector: 'International' },
  { id: 'fxi', symbol: 'FXI', name: 'iShares China', flag: '🇨🇳', category: 'etfs', sector: 'International' },
  { id: 'ewg', symbol: 'EWG', name: 'iShares Germany', flag: '🇩🇪', category: 'etfs', sector: 'International' },
  { id: 'ewj', symbol: 'EWJ', name: 'iShares Japan', flag: '🇯🇵', category: 'etfs', sector: 'International' },
  { id: 'ewn', symbol: 'EWN', name: 'iShares Netherlands', flag: '🇳🇱', category: 'etfs', sector: 'International' },
  { id: 'ewy', symbol: 'EWY', name: 'iShares South Korea', flag: '🇰🇷', category: 'etfs', sector: 'International' },
  { id: 'ewa', symbol: 'EWA', name: 'iShares Australia', flag: '🇦🇺', category: 'etfs', sector: 'International' },
  { id: 'ewh', symbol: 'EWH', name: 'iShares Hong Kong', flag: '🇭🇰', category: 'etfs', sector: 'International' },
  { id: 'ewt', symbol: 'EWT', name: 'iShares Taiwan', flag: '🇹🇼', category: 'etfs', sector: 'International' },
  { id: 'india', symbol: 'INDA', name: 'iShares India', flag: '🇮🇳', category: 'etfs', sector: 'International' },
  { id: 'ewc', symbol: 'EWC', name: 'iShares Canada', flag: '🇨🇦', category: 'etfs', sector: 'International' },
  { id: 'ewu', symbol: 'EWU', name: 'iShares UK', flag: '🇬🇧', category: 'etfs', sector: 'International' },
  { id: 'ezu', symbol: 'EZU', name: 'iShares Eurozone', flag: '🇪🇺', category: 'etfs', sector: 'International' },
  // Volatility
  { id: 'uvxy', symbol: 'UVXY', name: 'ProShares Ultra VIX', flag: '📊', category: 'etfs', sector: 'Volatility' },
  // Brazilian ETFs (most popular on B3 / TradingView Brazil)
  { id: 'bova11', symbol: 'BOVA11.SA', name: 'iShares Ibovespa', flag: '🇧🇷📊', category: 'etfs', sector: 'Index Brasil' },
  { id: 'ivvb11', symbol: 'IVVB11.SA', name: 'iShares S&P 500', flag: '🇧🇷🇺🇸', category: 'etfs', sector: 'US Brasil' },
  { id: 'smal11', symbol: 'SMAL11.SA', name: 'iShares Small Cap', flag: '🇧🇷📈', category: 'etfs', sector: 'Small Caps' },
  { id: 'divo11', symbol: 'DIVO11.SA', name: 'iShares Dividendos', flag: '🇧🇷💰', category: 'etfs', sector: 'Dividendos' },
  { id: 'hglg11', symbol: 'HGLG11.SA', name: 'iShares FIIs', flag: '🇧🇷🏠', category: 'etfs', sector: 'FIIs' },
  { id: 'matb11', symbol: 'MATB11.SA', name: 'iShares Materiais Básicos', flag: '🇧🇷⛏️', category: 'etfs', sector: 'Materiais' },
  { id: 'bith11', symbol: 'BITH11.SA', name: 'iShares Bitcoin', flag: '🇧🇷₿', category: 'etfs', sector: 'Cripto' },
  { id: 'hash11', symbol: 'HASH11.SA', name: 'HASH11 Crypto', flag: '🇧🇷🔗', category: 'etfs', sector: 'Cripto' },
];

export const BRAZIL: Instrument[] = [
  // Index & Currency
  { id: 'mini-ind', symbol: '^BVSP', name: 'Mini Índice', flag: '📈', category: 'brazil' },
  { id: 'mini-dol', symbol: 'USDBRL=X', name: 'Mini Dólar', flag: '💵', category: 'brazil' },
  { id: 'br-ibov', symbol: '^BVSP', name: 'IBOVESPA', flag: '🇧🇷', category: 'brazil' },
  { id: 'br-usdbrl', symbol: 'USDBRL=X', name: 'USD/BRL', flag: '🇧🇷🇺🇸', category: 'brazil' },
  { id: 'br-btc', symbol: 'BTC-USD', name: 'Bitcoin', flag: '₿', category: 'brazil' },
  // Banks & Finance
  { id: 'b3sa3', symbol: 'B3SA3.SA', name: 'B3', flag: '🏛️', category: 'brazil', sector: 'Bolsa' },
  { id: 'petr4', symbol: 'PETR4.SA', name: 'Petrobras', flag: '🛢️', category: 'brazil', sector: 'Petróleo' },
  { id: 'vale3', symbol: 'VALE3.SA', name: 'Vale', flag: '⛏️', category: 'brazil', sector: 'Mineração' },
  { id: 'itub4', symbol: 'ITUB4.SA', name: 'Itaú Unibanco', flag: '🏦', category: 'brazil', sector: 'Bancos' },
  { id: 'bbdc4', symbol: 'BBDC4.SA', name: 'Bradesco', flag: '🏦', category: 'brazil', sector: 'Bancos' },
  { id: 'bbas3', symbol: 'BBAS3.SA', name: 'Banco do Brasil', flag: '🏦', category: 'brazil', sector: 'Bancos' },
  { id: 'sanb11', symbol: 'SANB11.SA', name: 'Santander', flag: '🏦', category: 'brazil', sector: 'Bancos' },
  { id: 'bpac11', symbol: 'BPAC11.SA', name: 'BTG Pactual', flag: '🏦', category: 'brazil', sector: 'Bancos' },
  { id: 'bbse3', symbol: 'BBSE3.SA', name: 'BB Seguridade', flag: '🛡️', category: 'brazil', sector: 'Seguros' },
  // Energy & Utilities
  { id: 'petr3', symbol: 'PETR3.SA', name: 'Petrobras ON', flag: '🛢️', category: 'brazil', sector: 'Petróleo' },
  { id: 'vbbr3', symbol: 'VBBR3.SA', name: 'Vibra Energia', flag: '⚡', category: 'brazil', sector: 'Energia' },
  { id: 'egie3', symbol: 'EGIE3.SA', name: 'Engie Brasil', flag: '⚡', category: 'brazil', sector: 'Energia' },
  { id: 'taee11', symbol: 'TAEE11.SA', name: 'Taesa', flag: '⚡', category: 'brazil', sector: 'Energia' },
  { id: 'eqtl3', symbol: 'EQTL3.SA', name: 'Equatorial Energia', flag: '⚡', category: 'brazil', sector: 'Energia' },
  { id: 'cmig4', symbol: 'CMIG4.SA', name: 'CEMIG', flag: '⚡', category: 'brazil', sector: 'Energia' },
  { id: 'sbsp3', symbol: 'SBSP3.SA', name: 'CPFL Energia', flag: '⚡', category: 'brazil', sector: 'Energia' },
  // Consumer
  { id: 'abev3', symbol: 'ABEV3.SA', name: 'Ambev', flag: '🍺', category: 'brazil', sector: 'Consumo' },
  { id: 'mglu3', symbol: 'MGLU3.SA', name: 'Magazine Luiza', flag: '🛍️', category: 'brazil', sector: 'Varejo' },
  { id: 'lren3', symbol: 'LREN3.SA', name: 'Lojas Renner', flag: '👗', category: 'brazil', sector: 'Varejo' },
  { id: 'cogn3', symbol: 'COGN3.SA', name: 'Cogna', flag: '📚', category: 'brazil', sector: 'Educação' },
  // Industry & Tech
  { id: 'wege3', symbol: 'WEGE3.SA', name: 'WEG', flag: '⚡', category: 'brazil', sector: 'Indústria' },
  { id: 'suzb3', symbol: 'SUZB3.SA', name: 'Suzano', flag: '🌲', category: 'brazil', sector: 'Papel e Celulose' },
  { id: 'klbn11', symbol: 'KLBN11.SA', name: 'Klabin', flag: '📦', category: 'brazil', sector: 'Papel e Celulose' },
  { id: 'csan3', symbol: 'CSAN3.SA', name: 'Cosan', flag: '⛽', category: 'brazil', sector: 'Energia' },
  { id: 'csna3', symbol: 'CSNA3.SA', name: 'CSN', flag: '🏗️', category: 'brazil', sector: 'Siderurgia' },
  { id: 'ggbr4', symbol: 'GGBR4.SA', name: 'Gerdau', flag: '🏗️', category: 'brazil', sector: 'Siderurgia' },
  { id: 'totvs3', symbol: 'TOTS3.SA', name: 'TOTVS', flag: '💻', category: 'brazil', sector: 'Tecnologia' },
  { id: 'eztc3', symbol: 'EZTC3.SA', name: 'Eztec', flag: '🏗️', category: 'brazil', sector: 'Construção' },
  { id: 'rail3', symbol: 'RAIL3.SA', name: 'Rumo', flag: '🚂', category: 'brazil', sector: 'Logística' },
  // Real Estate & Finance
  { id: 'rent3', symbol: 'RENT3.SA', name: 'Localiza', flag: '🚗', category: 'brazil', sector: 'Locação' },
  { id: 'irbr3', symbol: 'IRBR3.SA', name: 'IRB Brasil', flag: '🏦', category: 'brazil', sector: 'Seguros' },
  { id: 'ptbl3', symbol: 'PTBL3.SA', name: 'Porto Seguro', flag: '🛡️', category: 'brazil', sector: 'Seguros' },
  // Health
  { id: 'radl3', symbol: 'RADL3.SA', name: 'Raia Drogasil', flag: '💊', category: 'brazil', sector: 'Saúde' },
  { id: 'flry3', symbol: 'FLRY3.SA', name: 'Fleury', flag: '🏥', category: 'brazil', sector: 'Saúde' },
  { id: 'hype3', symbol: 'HYPE3.SA', name: 'Hypera', flag: '💊', category: 'brazil', sector: 'Saúde' },
  // Food & Agri
  { id: 'ugpa3', symbol: 'UGPA3.SA', name: 'Ultrapar', flag: '🛢️', category: 'brazil', sector: 'Petroquímica' },
  { id: 'beef3', symbol: 'BEEF3.SA', name: 'Minerva', flag: '🍗', category: 'brazil', sector: 'Alimentos' },
  { id: 'slce3', symbol: 'SLCE3.SA', name: 'SLC Agrícola', flag: '🌾', category: 'brazil', sector: 'Agronegócio' },
  { id: 'smto3', symbol: 'SMTO3.SA', name: 'São Martinho', flag: '甘蔗', category: 'brazil', sector: 'Açúcar' },
  // Airlines & Transport
  { id: 'movi3', symbol: 'MOVI3.SA', name: 'Movida', flag: '🚗', category: 'brazil', sector: 'Transporte' },
  { id: 'jhsf3', symbol: 'JHSF3.SA', name: 'JHSF', flag: '🏢', category: 'brazil', sector: 'Imobiliário' },
];

// All instruments flat array for global search
export const ALL_INSTRUMENTS: Instrument[] = [
  ...FOREX_PAIRS,
  ...INDICES,
  ...METALS,
  ...CRYPTO,
  ...STOCKS,
  ...ETFS,
  ...BRAZIL,
];

export function getInstruments(category: MarketCategory, favoriteSymbols?: Set<string>): Instrument[] {
  switch (category) {
    case 'favorites':
      if (!favoriteSymbols || favoriteSymbols.size === 0) return [];
      return ALL_INSTRUMENTS.filter(inst => favoriteSymbols.has(inst.symbol));
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

// Category metadata for UI — each with a unique color and glow effect
export const CATEGORY_META: Record<MarketCategory, { label: string; emoji: string; color: string; glowFrom: string; glowTo: string }> = {
  favorites: { label: 'Favoritos', emoji: '⭐', color: 'amber', glowFrom: '#f59e0b', glowTo: '#fbbf24' },
  forex: { label: 'Forex', emoji: '💱', color: 'cyan', glowFrom: '#06b6d4', glowTo: '#22d3ee' },
  indices: { label: 'Índices', emoji: '📊', color: 'violet', glowFrom: '#8b5cf6', glowTo: '#a78bfa' },
  metals: { label: 'Commodities', emoji: '🥇', color: 'orange', glowFrom: '#f97316', glowTo: '#fb923c' },
  crypto: { label: 'Cripto', emoji: '₿', color: 'yellow', glowFrom: '#eab308', glowTo: '#facc15' },
  stocks: { label: 'Ações US', emoji: '📈', color: 'emerald', glowFrom: '#10b981', glowTo: '#34d399' },
  etfs: { label: 'ETFs', emoji: '📋', color: 'rose', glowFrom: '#f43f5e', glowTo: '#fb7185' },
  brazil: { label: 'Brasil', emoji: '🇧🇷', color: 'lime', glowFrom: '#84cc16', glowTo: '#a3e635' },
};
