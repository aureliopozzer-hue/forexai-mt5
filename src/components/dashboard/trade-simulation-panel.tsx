'use client';

import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  DollarSign, Target, TrendingUp, TrendingDown, Shield,
  AlertTriangle, ChevronDown, ChevronUp, Calculator, Coins,
  Info
} from 'lucide-react';
import { AIAnalysis, Instrument, formatPrice, getVal, QuoteData } from './types';

interface TradeSimulationPanelProps {
  analysis: AIAnalysis | null;
  instrument: Instrument | null;
  quote: QuoteData | undefined;
  allQuotes: Record<string, QuoteData>;
}

const CAPITAL_PRESETS = [100, 250, 500, 1000, 2500, 5000, 10000, 25000];

// ===================== CONTRACT SPECIFICATIONS DATABASE =====================
// Real-world values for accurate position sizing

interface ForexPairSpec {
  base: string;
  quote: string;
  pipSize: number;       // 0.0001 for most pairs, 0.01 for JPY pairs
  lotSize: number;       // Standard lot = 100,000 units
  quoteToUSDSymbol: string | null; // Symbol to convert quote currency to USD (null if quote is USD)
}

// Parse a forex symbol like EURUSD=X into base/quote currencies
function parseForexPair(symbol: string): ForexPairSpec | null {
  const clean = symbol.replace('=X', '');
  // JPY pairs - check for JPY as quote
  const jpyAsQuote = ['USDJPY','EURJPY','GBPJPY','AUDJPY','NZDJPY','CADJPY','CHFJPY'];
  const jpyAsBase = ['JPYBRL']; // rare
  if (jpyAsQuote.includes(clean)) {
    const base = clean.replace('JPY', '');
    return { base, quote: 'JPY', pipSize: 0.01, lotSize: 100000, quoteToUSDSymbol: 'USDJPY=X' };
  }
  if (jpyAsBase.includes(clean)) {
    return { base: 'JPY', quote: clean.replace('JPY', ''), pipSize: 0.01, lotSize: 100000, quoteToUSDSymbol: null };
  }
  // Standard 4-decimal pairs
  if (clean.length === 6) {
    const base = clean.substring(0, 3);
    const quote = clean.substring(3, 6);
    // Map quote currency to its USD conversion pair
    let quoteToUSDSymbol: string | null = null;
    if (quote === 'USD') {
      quoteToUSDSymbol = null; // Already in USD
    } else if (quote === 'EUR') {
      quoteToUSDSymbol = 'EURUSD=X';
    } else if (quote === 'GBP') {
      quoteToUSDSymbol = 'GBPUSD=X';
    } else if (quote === 'AUD') {
      quoteToUSDSymbol = 'AUDUSD=X';
    } else if (quote === 'NZD') {
      quoteToUSDSymbol = 'NZDUSD=X';
    } else if (quote === 'CAD') {
      quoteToUSDSymbol = 'USDCAD=X'; // Inverted - need to divide
    } else if (quote === 'CHF') {
      quoteToUSDSymbol = 'USDCHF=X'; // Inverted - need to divide
    } else if (quote === 'SGD') {
      quoteToUSDSymbol = 'USDSGD=X'; // Inverted
    } else if (quote === 'HKD') {
      quoteToUSDSymbol = 'USDHKD=X'; // Inverted
    } else if (quote === 'MXN') {
      quoteToUSDSymbol = 'USDMXN=X'; // Inverted
    } else if (quote === 'ZAR') {
      quoteToUSDSymbol = 'USDZAR=X'; // Inverted
    } else if (quote === 'TRY') {
      quoteToUSDSymbol = 'USDTRY=X'; // Inverted
    } else if (quote === 'NOK') {
      quoteToUSDSymbol = 'USDNOK=X'; // Inverted
    } else if (quote === 'SEK') {
      quoteToUSDSymbol = 'USDSEK=X'; // Inverted
    } else if (quote === 'CNY') {
      quoteToUSDSymbol = 'USDCNY=X'; // Inverted
    } else if (quote === 'INR') {
      quoteToUSDSymbol = 'USDINR=X'; // Inverted
    } else if (quote === 'BRL') {
      quoteToUSDSymbol = 'USDBRL=X'; // Inverted
    }
    return { base, quote, pipSize: 0.0001, lotSize: 100000, quoteToUSDSymbol };
  }
  return null;
}

// Get conversion rate from quote currency to USD using live market data
function getQuoteToUSDRate(spec: ForexPairSpec, allQuotes: Record<string, QuoteData>): number {
  if (spec.quote === 'USD') return 1;

  if (!spec.quoteToUSDSymbol) return 1; // Fallback

  const rate = getVal(allQuotes[spec.quoteToUSDSymbol]?.regularMarketPrice);
  if (!rate || rate <= 0) return 1; // Fallback if no data

  // For pairs where USD is the base (USDCAD, USDCHF, etc.), we need 1/rate
  if (spec.quoteToUSDSymbol.startsWith('USD')) {
    return 1 / rate;
  }
  // For pairs where USD is the quote (EURUSD, GBPUSD, etc.), rate is direct
  return rate;
}

// Commodity contract specifications
interface CommoditySpec {
  name: string;
  contractSize: number;   // Units per contract
  tickSize: number;       // Minimum price movement
  tickValue: number;      // $ value per tick
  pointValue: number;     // $ value per 1 unit price movement
}

function getCommoditySpec(symbol: string): CommoditySpec | null {
  // ═══ COMEX/CME Official Specs ═══
  // Gold: 100 troy oz, tick 0.10 = $10, point = $100
  if (symbol === 'GC=F') return { name: 'Gold', contractSize: 100, tickSize: 0.10, tickValue: 10, pointValue: 100 };
  // Silver: 5,000 troy oz, tick 0.005 = $25, point = $5,000
  if (symbol === 'SI=F') return { name: 'Silver', contractSize: 5000, tickSize: 0.005, tickValue: 25, pointValue: 5000 };
  // Platinum: 50 troy oz, tick 0.10 = $5, point = $50
  if (symbol === 'PL=F') return { name: 'Platinum', contractSize: 50, tickSize: 0.10, tickValue: 5, pointValue: 50 };
  // Palladium: 100 troy oz, tick 0.05 = $5, point = $100
  if (symbol === 'PA=F') return { name: 'Palladium', contractSize: 100, tickSize: 0.05, tickValue: 5, pointValue: 100 };
  // Copper: 25,000 lbs, tick 0.0005 = $12.50, point = $25,000
  if (symbol === 'HG=F') return { name: 'Copper', contractSize: 25000, tickSize: 0.0005, tickValue: 12.50, pointValue: 25000 };
  // ═══ NYMEX/CME Energy — Prop Firm CFD Specs (FTMO) ═══
  // USOIL CFD (FTMO): contract size = 10, $10 per $1 move per lot
  if (symbol === 'CL=F') return { name: 'USOIL', contractSize: 10, tickSize: 0.01, tickValue: 0.10, pointValue: 10 };
  // UKOIL CFD (FTMO): contract size = 10, $10 per $1 move per lot
  if (symbol === 'BZ=F') return { name: 'UKOIL', contractSize: 10, tickSize: 0.01, tickValue: 0.10, pointValue: 10 };
  // NATGAS CFD: contract size ≈ 1000, $10 per $0.01 move per lot
  if (symbol === 'NG=F') return { name: 'NATGAS', contractSize: 1000, tickSize: 0.001, tickValue: 1, pointValue: 1000 };
  // ═══ CBOT/CME Agriculture — CFD Specs ═══
  // Estes ativos raramente estão disponíveis em prop firms
  // Valores baseados em CFD padrão de corretoras
  if (symbol === 'ZW=F') return { name: 'Wheat', contractSize: 50, tickSize: 0.01, tickValue: 0.50, pointValue: 50 };
  if (symbol === 'ZC=F') return { name: 'Corn', contractSize: 50, tickSize: 0.01, tickValue: 0.50, pointValue: 50 };
  if (symbol === 'ZS=F') return { name: 'Soybeans', contractSize: 50, tickSize: 0.01, tickValue: 0.50, pointValue: 50 };
  // ═══ ICE Futures CFD ═══
  if (symbol === 'CT=F') return { name: 'Cotton', contractSize: 50, tickSize: 0.01, tickValue: 0.50, pointValue: 50 };
  if (symbol === 'KC=F') return { name: 'Coffee', contractSize: 10, tickSize: 0.01, tickValue: 0.10, pointValue: 10 };
  if (symbol === 'SB=F') return { name: 'Sugar #11', contractSize: 112, tickSize: 0.01, tickValue: 1.12, pointValue: 112 };
  if (symbol === 'CC=F') return { name: 'Cocoa', contractSize: 1, tickSize: 1, tickValue: 1, pointValue: 1 };
  return null;
}

// Index specifications (CFD-style, per point value)
interface IndexSpec {
  name: string;
  currency: string;
  pointValue: number;     // $ per 1 point movement per contract
  contractSize: number;   // For CFD: 1 = 1 unit per point
}

function getIndexSpec(symbol: string): IndexSpec | null {
  // ═══ Prop Firm CFD Specifications (FTMO Standard) ═══
  // Em prop firms CFD, 1 lote = 1 contrato CFD com pointValue específico
  // IMPORTANTE: Valores baseados em FTMO (padrão mais popular e conservador)
  // Verifique sempre as especificações na plataforma MT4/MT5 do seu broker

  // ═══ Índices EUA — FTMO CFD: $1/pto/lote ═══
  // S&P 500 (US500.cash): contract size = 1, $1/point per lot
  if (symbol === '^GSPC' || symbol === 'SPY') return { name: 'S&P 500', currency: 'USD', pointValue: 1, contractSize: 1 };
  // Dow Jones (US30.cash): contract size = 1, $1/point per lot
  if (symbol === '^DJI' || symbol === 'DIA') return { name: 'Dow Jones', currency: 'USD', pointValue: 1, contractSize: 1 };
  // Nasdaq 100 (US100.cash): contract size = 1, $1/point per lot
  if (symbol === '^IXIC' || symbol === 'QQQ') return { name: 'Nasdaq', currency: 'USD', pointValue: 1, contractSize: 1 };
  if (symbol === '^NDX') return { name: 'Nasdaq 100', currency: 'USD', pointValue: 1, contractSize: 1 };
  // Russell 2000 (US2000.cash): contract size = 1, $1/point per lot
  if (symbol === '^RUT' || symbol === 'IWM') return { name: 'Russell 2000', currency: 'USD', pointValue: 1, contractSize: 1 };

  // ═══ Volatilidade & Dólar ═══
  // VIX CFD: $1/point per lot
  if (symbol === '^VIX') return { name: 'VIX', currency: 'USD', pointValue: 1, contractSize: 1 };
  // Dollar Index CFD: $1/point per lot
  if (symbol === 'DX-Y.NYB') return { name: 'Dollar Index', currency: 'USD', pointValue: 1, contractSize: 1 };

  // ═══ Treasury Yields ═══
  // US 10Y/30Y Yield CFD: $1/point per lot
  if (symbol === '^TNX') return { name: 'US 10Y Yield', currency: 'USD', pointValue: 1, contractSize: 1 };
  if (symbol === '^TYX') return { name: 'US 30Y Yield', currency: 'USD', pointValue: 1, contractSize: 1 };

  // ═══ Índices Europa — FTMO CFD ═══
  // FTSE 100 (UK100.cash): £1/point per lot
  if (symbol === '^FTSE') return { name: 'FTSE 100', currency: 'GBP', pointValue: 1, contractSize: 1 };
  // DAX 40 (GER40.cash): €1/point per lot
  if (symbol === '^GDAXI') return { name: 'DAX 40', currency: 'EUR', pointValue: 1, contractSize: 1 };
  // CAC 40 (FRA40.cash): €1/point per lot
  if (symbol === '^FCHI') return { name: 'CAC 40', currency: 'EUR', pointValue: 1, contractSize: 1 };
  // Euro Stoxx 50 (EUSTX50.cash): €1/point per lot
  if (symbol === '^STOXX50E') return { name: 'Euro Stoxx 50', currency: 'EUR', pointValue: 1, contractSize: 1 };
  // IBEX 35 (ESP35.cash): €1/point per lot
  if (symbol === '^IBEX') return { name: 'IBEX 35', currency: 'EUR', pointValue: 1, contractSize: 1 };
  // FTSE MIB (ITA40.cash): €1/point per lot
  if (symbol === 'FTSEMIB.MI') return { name: 'FTSE MIB', currency: 'EUR', pointValue: 1, contractSize: 1 };

  // ═══ Índices Ásia-Pacífico — FTMO CFD ═══
  // Nikkei 225 (JP225.cash): contract size = 10, ¥10/point per lot
  if (symbol === '^N225') return { name: 'Nikkei 225', currency: 'JPY', pointValue: 10, contractSize: 10 };
  // Hang Seng (HK50.cash): HK$1/point per lot
  if (symbol === '^HSI') return { name: 'Hang Seng', currency: 'HKD', pointValue: 1, contractSize: 1 };
  // KOSPI: ₩100/point per lot
  if (symbol === '^KS11') return { name: 'KOSPI', currency: 'KRW', pointValue: 100, contractSize: 1 };
  // ASX 200 (AUS200.cash): A$1/point per lot
  if (symbol === '^AXJO') return { name: 'ASX 200', currency: 'AUD', pointValue: 1, contractSize: 1 };

  // ═══ B3 Brasil ═══
  // Mini IBOVESPA (WIN): R$0.20/point/contrato — padrão B3
  if (symbol === '^BVSP') return { name: 'IBOVESPA', currency: 'BRL', pointValue: 0.20, contractSize: 1 };

  // ═══ Américas Outros ═══
  // IPC Mexico: MX$1/point per lot
  if (symbol === '^MXX') return { name: 'IPC Mexico', currency: 'MXN', pointValue: 1, contractSize: 1 };
  // S&P/TSX: C$1/point per lot
  if (symbol === '^GSPTSE') return { name: 'S&P/TSX', currency: 'CAD', pointValue: 1, contractSize: 1 };
  return null;
}

// Determine the asset type for calculation logic
type AssetType = 'forex' | 'stock_us' | 'stock_br' | 'crypto' | 'commodity' | 'index' | 'etf_us' | 'etf_br';

function getAssetType(instrument: Instrument): AssetType {
  if (instrument.category === 'forex') return 'forex';
  if (instrument.category === 'crypto') return 'crypto';
  if (instrument.category === 'metals') return 'commodity';
  if (instrument.category === 'brazil') return 'stock_br';
  if (instrument.category === 'indices') return 'index';
  if (instrument.category === 'etfs') {
    if (instrument.symbol.endsWith('.SA')) return 'etf_br';
    return 'etf_us';
  }
  if (instrument.category === 'stocks') {
    if (instrument.symbol.endsWith('.SA') || instrument.symbol.endsWith('.T')) return 'stock_br';
    return 'stock_us';
  }
  return 'stock_us';
}

// Get currency for non-USD instruments
function getInstrumentCurrency(instrument: Instrument): string {
  const type = getAssetType(instrument);
  if (type === 'forex') {
    const spec = parseForexPair(instrument.symbol);
    return spec?.quote || 'USD';
  }
  if (type === 'stock_br' || type === 'etf_br') return 'BRL';
  if (type === 'index') {
    const spec = getIndexSpec(instrument.symbol);
    return spec?.currency || 'USD';
  }
  // Japanese stocks
  if (instrument.symbol.endsWith('.T')) return 'JPY';
  return 'USD';
}

// Convert an amount from a given currency to USD using live quotes
function convertToUSD(amount: number, currency: string, allQuotes: Record<string, QuoteData>): number {
  if (currency === 'USD') return amount;

  // Direct pairs where quote is USD
  const directPairs: Record<string, string> = {
    'EUR': 'EURUSD=X', 'GBP': 'GBPUSD=X', 'AUD': 'AUDUSD=X',
    'NZD': 'NZDUSD=X',
  };
  if (directPairs[currency]) {
    const rate = getVal(allQuotes[directPairs[currency]]?.regularMarketPrice);
    if (rate > 0) return amount * rate;
  }

  // Inverted pairs where USD is base
  const invertedPairs: Record<string, string> = {
    'JPY': 'USDJPY=X', 'CHF': 'USDCHF=X', 'CAD': 'USDCAD=X',
    'BRL': 'USDBRL=X', 'MXN': 'USDMXN=X', 'ZAR': 'USDZAR=X',
    'SGD': 'USDSGD=X', 'HKD': 'USDHKD=X', 'TRY': 'USDTRY=X',
    'NOK': 'USDNOK=X', 'SEK': 'USDSEK=X', 'CNY': 'USDCNY=X',
    'INR': 'USDINR=X', 'KRW': 'USDKRW=X',
  };
  if (invertedPairs[currency]) {
    const rate = getVal(allQuotes[invertedPairs[currency]]?.regularMarketPrice);
    if (rate > 0) return amount / rate;
  }

  return amount; // Fallback: assume USD
}

// ===================== SIMULATION CALCULATION =====================

interface SimulationResult {
  direction: string;
  isBuy: boolean;
  entry: number;
  stopLoss: number;
  takeProfit: number;
  riskDistance: number;      // Distance in price units
  rewardDistance: number;
  riskPips: number;          // Risk in pips (forex only)
  rewardPips: number;        // Reward in pips (forex only)
  pipValuePerLot: number;    // $ value per pip per standard lot (forex)
  pipValuePerMiniLot: number; // $ value per pip per mini lot (0.1)
  pipValuePerMicroLot: number; // $ value per pip per micro lot (0.01)
  riskAmountUSD: number;     // $ amount to risk
  positionSize: number;      // In units (shares, contracts, etc.)
  lots: number;              // In standard lots (forex)
  microLots: number;         // In micro lots (0.01)
  potentialLossUSD: number;  // Max loss in $
  potentialGainUSD: number;  // Max gain in $
  rrRatio: number;           // Risk:Reward ratio
  riskPercentOfCapital: number;
  gainPercentOfCapital: number;
  assetType: AssetType;
  assetLabel: string;        // Display label for position unit
  positionDisplay: string;   // Formatted position size
  currency: string;          // Instrument's native currency
  contractInfo: string;      // Human-readable contract info
}

function calculateSimulation(
  analysis: AIAnalysis,
  instrument: Instrument,
  capital: number,
  riskPercent: number,
  allQuotes: Record<string, QuoteData>,
): SimulationResult | null {
  const symbol = instrument.symbol;
  const isBuy = analysis.direction === 'BUY';
  const entry = isBuy ? analysis.tradePoints.buyPoint : analysis.tradePoints.sellPoint;
  const stopLoss = isBuy ? analysis.tradePoints.stopLossBuy : analysis.tradePoints.stopLossSell;
  const takeProfit = isBuy ? analysis.tradePoints.takeProfitBuy : analysis.tradePoints.takeProfitSell;

  if (!entry || !stopLoss || !takeProfit || entry <= 0) return null;

  const riskDistance = Math.abs(entry - stopLoss);
  const rewardDistance = Math.abs(takeProfit - entry);
  if (riskDistance === 0) return null;

  const riskAmountUSD = capital * (riskPercent / 100);
  const assetType = getAssetType(instrument);
  const currency = getInstrumentCurrency(instrument);

  // ============ FOREX ============
  if (assetType === 'forex') {
    const pairSpec = parseForexPair(symbol);
    if (!pairSpec) return null;

    const quoteToUSD = getQuoteToUSDRate(pairSpec, allQuotes);

    // Pip value per standard lot in USD
    // For 100,000 units, 1 pip = pipSize * lotSize in quote currency
    // In USD: pipValueUSD = pipSize * lotSize * quoteToUSD
    const pipValuePerLot = pairSpec.pipSize * pairSpec.lotSize * quoteToUSD;
    const pipValuePerMiniLot = pipValuePerLot / 10;
    const pipValuePerMicroLot = pipValuePerLot / 100;

    // Risk in pips
    const riskPips = riskDistance / pairSpec.pipSize;
    const rewardPips = rewardDistance / pairSpec.pipSize;

    // Position sizing in lots
    // riskAmountUSD = lots * riskPips * pipValuePerLot
    // lots = riskAmountUSD / (riskPips * pipValuePerLot)
    const lots = riskAmountUSD / (riskPips * pipValuePerLot);
    const microLots = lots * 100;

    // Actual $ values
    const potentialLossUSD = lots * riskPips * pipValuePerLot;
    const potentialGainUSD = lots * rewardPips * pipValuePerLot;

    // Position display — formato de lotes (0.01, 0.10, 0.50, 1.00)
    const positionDisplay = `${lots.toFixed(2)} lotes`;

    const rrRatio = rewardPips / riskPips;

    return {
      direction: analysis.direction,
      isBuy,
      entry,
      stopLoss,
      takeProfit,
      riskDistance,
      rewardDistance,
      riskPips: Math.round(riskPips * 10) / 10,
      rewardPips: Math.round(rewardPips * 10) / 10,
      pipValuePerLot: parseFloat(pipValuePerLot.toFixed(2)),
      pipValuePerMiniLot: parseFloat(pipValuePerMiniLot.toFixed(2)),
      pipValuePerMicroLot: parseFloat(pipValuePerMicroLot.toFixed(2)),
      riskAmountUSD,
      positionSize: lots * pairSpec.lotSize,
      lots,
      microLots,
      potentialLossUSD,
      potentialGainUSD,
      rrRatio,
      riskPercentOfCapital: (potentialLossUSD / capital) * 100,
      gainPercentOfCapital: (potentialGainUSD / capital) * 100,
      assetType,
      assetLabel: 'Lotes',
      positionDisplay,
      currency,
      contractInfo: `1 lote = 100.000 un. | Pip = $${pipValuePerLot.toFixed(2)}`,
    };
  }

  // ============ COMMODITIES ============
  if (assetType === 'commodity') {
    const spec = getCommoditySpec(symbol);

    // Prop Firm CFD: risk per lot = riskDistance * pointValue
    if (spec) {
      const riskPerLot = riskDistance * spec.pointValue;
      const rewardPerLot = rewardDistance * spec.pointValue;
      const lots = riskAmountUSD / riskPerLot;
      const potentialLossUSD = lots * riskPerLot;
      const potentialGainUSD = lots * rewardPerLot;
      const rrRatio = rewardDistance / riskDistance;

      return {
        direction: analysis.direction, isBuy, entry, stopLoss, takeProfit,
        riskDistance, rewardDistance,
        riskPips: riskDistance / spec.tickSize,
        rewardPips: rewardDistance / spec.tickSize,
        pipValuePerLot: spec.pointValue,
        pipValuePerMiniLot: spec.pointValue / 10,
        pipValuePerMicroLot: spec.pointValue / 100,
        riskAmountUSD,
        positionSize: lots,
        lots,
        microLots: lots * 100,
        potentialLossUSD,
        potentialGainUSD,
        rrRatio,
        riskPercentOfCapital: (potentialLossUSD / capital) * 100,
        gainPercentOfCapital: (potentialGainUSD / capital) * 100,
        assetType,
        assetLabel: 'Lotes',
        positionDisplay: `${lots.toFixed(2)} lotes`,
        currency: 'USD',
        contractInfo: `${spec.name} CFD | 1 lote = ${spec.contractSize.toLocaleString()} un. | 1 pto = $${spec.pointValue.toLocaleString()}`,
      };
    }

    // Fallback for unknown commodities - treat as CFD (1 unit per $1)
    const riskPerUnit = riskDistance;
    const numUnits = riskAmountUSD / riskPerUnit;
    const potentialLossUSD = numUnits * riskDistance;
    const potentialGainUSD = numUnits * rewardDistance;
    const rrRatio = rewardDistance / riskDistance;

    return {
      direction: analysis.direction, isBuy, entry, stopLoss, takeProfit,
      riskDistance, rewardDistance,
      riskPips: 0, rewardPips: 0,
      pipValuePerLot: 0, pipValuePerMiniLot: 0, pipValuePerMicroLot: 0,
      riskAmountUSD,
      positionSize: numUnits,
      lots: numUnits, microLots: numUnits * 100,
      potentialLossUSD, potentialGainUSD, rrRatio,
      riskPercentOfCapital: (potentialLossUSD / capital) * 100,
      gainPercentOfCapital: (potentialGainUSD / capital) * 100,
      assetType,
      assetLabel: 'Lotes',
      positionDisplay: `${numUnits.toFixed(2)} lotes`,
      currency: 'USD',
      contractInfo: 'CFD',
    };
  }

  // ============ INDICES ============
  if (assetType === 'index') {
    const spec = getIndexSpec(symbol);

    if (spec) {
      // Risk per lot in native currency
      const riskPerLotNative = riskDistance * spec.pointValue;
      const rewardPerLotNative = rewardDistance * spec.pointValue;

      // Convert risk to USD
      const riskPerLotUSD = convertToUSD(riskPerLotNative, spec.currency, allQuotes);
      const rewardPerLotUSD = convertToUSD(rewardPerLotNative, spec.currency, allQuotes);

      const lots = riskAmountUSD / riskPerLotUSD;
      const potentialLossUSD = lots * riskPerLotUSD;
      const potentialGainUSD = lots * rewardPerLotUSD;
      const rrRatio = rewardDistance / riskDistance;

      const curLabel = spec.currency !== 'USD' ? ` (${spec.currency})` : '';
      const curSymbol = spec.currency === 'BRL' ? 'R$' : spec.currency === 'EUR' ? '€' : spec.currency === 'GBP' ? '£' : spec.currency === 'JPY' ? '¥' : spec.currency === 'HKD' ? 'HK$' : spec.currency === 'KRW' ? '₩' : spec.currency === 'AUD' ? 'A$' : spec.currency === 'CAD' ? 'C$' : spec.currency === 'MXN' ? 'MX$' : '$';

      return {
        direction: analysis.direction, isBuy, entry, stopLoss, takeProfit,
        riskDistance, rewardDistance,
        riskPips: 0, rewardPips: 0,
        pipValuePerLot: spec.pointValue,
        pipValuePerMiniLot: spec.pointValue / 10,
        pipValuePerMicroLot: spec.pointValue / 100,
        riskAmountUSD,
        positionSize: lots,
        lots,
        microLots: lots * 100,
        potentialLossUSD, potentialGainUSD, rrRatio,
        riskPercentOfCapital: (potentialLossUSD / capital) * 100,
        gainPercentOfCapital: (potentialGainUSD / capital) * 100,
        assetType,
        assetLabel: 'Lotes',
        positionDisplay: `${lots.toFixed(2)} lotes`,
        currency: spec.currency,
        contractInfo: `${spec.name} CFD${curLabel} | ${curSymbol}${spec.pointValue}/pto/lote`,
      };
    }

    // Fallback for unknown indices - CFD
    const numUnits = riskAmountUSD / riskDistance;
    const potentialLossUSD = numUnits * riskDistance;
    const potentialGainUSD = numUnits * rewardDistance;
    const rrRatio = rewardDistance / riskDistance;

    return {
      direction: analysis.direction, isBuy, entry, stopLoss, takeProfit,
      riskDistance, rewardDistance,
      riskPips: 0, rewardPips: 0,
      pipValuePerLot: 0, pipValuePerMiniLot: 0, pipValuePerMicroLot: 0,
      riskAmountUSD,
      positionSize: numUnits,
      lots: numUnits, microLots: numUnits * 100,
      potentialLossUSD, potentialGainUSD, rrRatio,
      riskPercentOfCapital: (potentialLossUSD / capital) * 100,
      gainPercentOfCapital: (potentialGainUSD / capital) * 100,
      assetType,
      assetLabel: 'Lotes',
      positionDisplay: `${numUnits.toFixed(2)} lotes`,
      currency: 'USD',
      contractInfo: 'CFD',
    };
  }

  // ============ STOCKS / ETFs / CRYPTO ============
  // Em prop firms CFD: 1 lote = 1 ação (stocks/ETFs) ou 1 unidade (crypto)
  // MT4/MT5 padrão: Stock CFD = 1 share per lot

  // Risk per lot (= per share/unit) in native currency
  const riskPerLot = riskDistance;
  const rewardPerLot = rewardDistance;

  // Number of lots (= shares for stocks, units for crypto)
  let lots = riskAmountUSD / riskPerLot;

  // For non-USD instruments, convert to native currency
  let potentialLossNative = lots * riskPerLot;
  let potentialGainNative = lots * rewardPerLot;

  // Convert to USD if not already
  const potentialLossUSD = convertToUSD(potentialLossNative, currency, allQuotes);
  const potentialGainUSD = convertToUSD(potentialGainNative, currency, allQuotes);

  // Recalculate lots based on actual USD risk for non-USD instruments
  if (currency !== 'USD') {
    const nativeRiskAmount = riskAmountUSD * (currency === 'BRL'
      ? getVal(allQuotes['USDBRL=X']?.regularMarketPrice) || 5.5
      : convertToUSD(1, currency, allQuotes) > 0
        ? 1 / convertToUSD(1, currency, allQuotes)
        : 1);
    lots = nativeRiskAmount / riskPerLot;
    potentialLossNative = lots * riskPerLot;
    potentialGainNative = lots * rewardPerLot;
  }

  const rrRatio = rewardDistance / riskDistance;

  // Todos os ativos usam formato de lotes
  const curLabel = currency !== 'USD' ? ` (${currency})` : '';

  return {
    direction: analysis.direction, isBuy, entry, stopLoss, takeProfit,
    riskDistance, rewardDistance,
    riskPips: 0, rewardPips: 0,
    pipValuePerLot: 0, pipValuePerMiniLot: 0, pipValuePerMicroLot: 0,
    riskAmountUSD,
    positionSize: lots,
    lots, microLots: lots * 100,
    potentialLossUSD, potentialGainUSD, rrRatio,
    riskPercentOfCapital: (potentialLossUSD / capital) * 100,
    gainPercentOfCapital: (potentialGainUSD / capital) * 100,
    assetType,
    assetLabel: 'Lotes',
    positionDisplay: `${lots.toFixed(2)} lotes`,
    currency,
    contractInfo: `1 lote = 1 ${assetType === 'crypto' ? 'unid.' : 'ação'} CFD = ${currency === 'BRL' ? 'R$' : '$'}${entry.toFixed(2)}${curLabel}`,
  };
}

// ===================== COMPONENT =====================

export function TradeSimulationPanel({ analysis, instrument, quote, allQuotes }: TradeSimulationPanelProps) {
  const [capital, setCapital] = useState<number>(1000);
  const [customCapital, setCustomCapital] = useState<string>('1000');
  const [isCustom, setIsCustom] = useState(false);
  const [isExpanded, setIsExpanded] = useState(true);
  const [riskPercent, setRiskPercent] = useState(2);
  const [customRisk, setCustomRisk] = useState<string>('2');
  const [isCustomRisk, setIsCustomRisk] = useState(false);

  // Persist capital to localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem('forexAI-sim-capital');
      if (stored) {
        const val = parseFloat(stored);
        if (!isNaN(val) && val > 0) {
          setCapital(val);
          setCustomCapital(val.toString());
        }
      }
    } catch {}
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('forexAI-sim-capital', capital.toString());
    } catch {}
  }, [capital]);

  // Calculate simulation values using real contract specs
  const simulation = useMemo(() => {
    if (!analysis || !instrument || analysis.direction === 'WAIT') return null;
    return calculateSimulation(analysis, instrument, capital, riskPercent, allQuotes);
  }, [analysis, instrument, capital, riskPercent, allQuotes]);

  // Order type info for beginners
  const currentPrice = getVal(quote?.regularMarketPrice);
  const isBuy = analysis?.direction === 'BUY';
  const entryPrice = simulation?.entry;
  const entryOrderType = (() => {
    if (!entryPrice || !currentPrice || currentPrice <= 0) return isBuy ? 'BUY LIMIT' : 'SELL LIMIT';
    const diff = entryPrice - currentPrice;
    const threshold = currentPrice * 0.0005;
    if (Math.abs(diff) <= threshold) return isBuy ? 'BUY (Mercado)' : 'SELL (Mercado)';
    if (isBuy) return diff > 0 ? 'BUY STOP' : 'BUY LIMIT';
    return diff < 0 ? 'SELL STOP' : 'SELL LIMIT';
  })();
  const fullOrderType = (() => {
    if (!entryPrice || !currentPrice || currentPrice <= 0) return isBuy ? 'BUY LIMIT' : 'SELL LIMIT';
    const diff = entryPrice - currentPrice;
    const threshold = currentPrice * 0.0005;
    if (Math.abs(diff) <= threshold) return isBuy ? 'BUY (Mercado)' : 'SELL (Mercado)';
    if (isBuy && diff > 0) return 'BUY STOP LIMIT';
    if (!isBuy && diff < 0) return 'SELL STOP LIMIT';
    return isBuy ? 'BUY LIMIT' : 'SELL LIMIT';
  })();
  const slOrderType = isBuy ? 'SELL STOP' : 'BUY STOP';
  const tpOrderType = isBuy ? 'SELL LIMIT' : 'BUY LIMIT';

  // No analysis or WAIT direction
  if (!analysis || !instrument) return null;

  if (analysis.direction === 'WAIT') {
    return (
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-xl border border-amber-500/20 bg-gradient-to-r from-amber-500/5 via-amber-500/10 to-amber-500/5 p-3"
      >
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-400" />
          <span className="text-xs font-semibold text-amber-400">Aguardar</span>
          <span className="text-[10px] text-muted-foreground">— A IA recomenda não operar neste momento</span>
        </div>
      </motion.div>
    );
  }

  if (!simulation) return null;

  const symbol = instrument.symbol;
  const isBRL = simulation.currency === 'BRL';

  // Format currency values
  const fmtUSD = (val: number) => {
    if (isBRL && simulation.assetType !== 'forex') {
      return `R$${val.toFixed(2)}`;
    }
    return `$${val.toFixed(2)}`;
  };
  const fmtUSDShort = (val: number) => {
    if (Math.abs(val) >= 1000) return `$${(val / 1000).toFixed(1)}k`;
    return `$${val.toFixed(0)}`;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="rounded-xl border border-cyan-500/20 bg-gradient-to-r from-cyan-500/5 via-violet-500/5 to-emerald-500/5 overflow-hidden"
      style={{
        boxShadow: simulation.isBuy
          ? '0 0 20px rgba(16, 185, 129, 0.08), 0 0 40px rgba(16, 185, 129, 0.04)'
          : '0 0 20px rgba(239, 68, 68, 0.08), 0 0 40px rgba(239, 68, 68, 0.04)',
      }}
    >
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-3 hover:bg-white/[0.02] transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <div className={`p-1.5 rounded-lg ${
            simulation.isBuy ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'
          }`}>
            <Calculator className="w-3.5 h-3.5" />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-foreground">
              Simulador de Trade
            </span>
            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md ${
              simulation.isBuy
                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                : 'bg-red-500/15 text-red-400 border border-red-500/30'
            }`}>
              {simulation.isBuy ? 'COMPRA' : 'VENDA'}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {!isExpanded && (
            <div className="flex items-center gap-3 sm:gap-4 text-[9px] sm:text-[10px] flex-wrap">
              <div className="flex items-center gap-1">
                <span className="text-red-400">Risk</span>
                <span className="font-mono font-bold text-red-400">{fmtUSD(simulation.potentialLossUSD)}</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-emerald-400">Gain</span>
                <span className="font-mono font-bold text-emerald-400">{fmtUSD(simulation.potentialGainUSD)}</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-amber-400">R:R</span>
                <span className="font-mono font-bold text-amber-400">1:{simulation.rrRatio.toFixed(1)}</span>
              </div>
            </div>
          )}
          {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
        </div>
      </button>

      {/* Expandable content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3 space-y-3">
              {/* Capital Input Row */}
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-1.5">
                  <DollarSign className="w-3.5 h-3.5 text-cyan-400" />
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase">Capital (USD)</span>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {CAPITAL_PRESETS.slice(0, 6).map((preset) => (
                    <button
                      key={preset}
                      onClick={() => { setCapital(preset); setCustomCapital(preset.toString()); setIsCustom(false); }}
                      className={`px-2 py-1.5 sm:py-1 rounded-md text-[10px] font-mono font-semibold transition-all border ${
                        !isCustom && capital === preset
                          ? 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30'
                          : 'text-muted-foreground border-border/30 hover:bg-secondary/50 hover:text-foreground'
                      }`}
                    >
                      ${preset >= 1000 ? `${(preset / 1000).toFixed(preset % 1000 !== 0 ? 1 : 0)}k` : preset}
                    </button>
                  ))}
                  <div className="relative">
                    <DollarSign className="absolute left-1.5 top-1/2 -translate-y-1/2 w-2.5 h-2.5 text-muted-foreground/50" />
                    <input
                      type="number"
                      value={customCapital}
                      onChange={(e) => {
                        const val = e.target.value;
                        setCustomCapital(val);
                        setIsCustom(true);
                        const num = parseFloat(val);
                        if (!isNaN(num) && num > 0) setCapital(num);
                      }}
                      placeholder="Outro..."
                      className={`w-24 pl-5 pr-2 py-1 rounded-md text-[10px] font-mono font-semibold bg-secondary/30 border transition-all outline-none ${
                        isCustom ? 'text-cyan-400 border-cyan-500/30 focus:border-cyan-400' : 'text-muted-foreground border-border/30 focus:border-border'
                      }`}
                    />
                  </div>
                </div>
              </div>

              {/* Risk % selector with manual input */}
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5 text-amber-400" />
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase">Risco</span>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {[0.5, 1, 2, 3, 5].map((pct) => (
                    <button
                      key={pct}
                      onClick={() => { setRiskPercent(pct); setCustomRisk(pct.toString()); setIsCustomRisk(false); }}
                      className={`px-2 py-1.5 sm:py-1 rounded-md text-[10px] font-mono font-semibold transition-all border ${
                        !isCustomRisk && riskPercent === pct
                          ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                          : 'text-muted-foreground border-border/30 hover:bg-secondary/50 hover:text-foreground'
                      }`}
                    >
                      {pct}%
                    </button>
                  ))}
                  <div className="relative">
                    <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[9px] text-muted-foreground/50">%</span>
                    <input
                      type="number"
                      value={customRisk}
                      onChange={(e) => {
                        const val = e.target.value;
                        setCustomRisk(val);
                        setIsCustomRisk(true);
                        const num = parseFloat(val);
                        if (!isNaN(num) && num > 0 && num <= 100) setRiskPercent(num);
                      }}
                      placeholder="Outro..."
                      min="0.1"
                      max="100"
                      step="0.1"
                      className={`w-20 pl-2 pr-4 py-1 rounded-md text-[10px] font-mono font-semibold bg-secondary/30 border transition-all outline-none ${
                        isCustomRisk ? 'text-amber-400 border-amber-500/30 focus:border-amber-400' : 'text-muted-foreground border-border/30 focus:border-border'
                      }`}
                    />
                  </div>
                </div>
              </div>

              {/* Order Type Banner */}
              <div className={`rounded-lg p-2 text-center border-2 ${
                simulation.isBuy
                  ? 'bg-emerald-500/10 border-emerald-500/30'
                  : 'bg-red-500/10 border-red-500/30'
              }`}>
                <p className="text-[8px] text-muted-foreground font-semibold uppercase tracking-wider">Tipo de Ordem</p>
                <p className={`text-sm font-black uppercase tracking-wider ${
                  fullOrderType.includes('BUY') ? 'text-emerald-400' : 'text-red-400'
                }`}>
                  {fullOrderType}
                </p>
              </div>

              {/* Trade Values Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {/* Entry Price */}
                <div className="relative rounded-lg bg-secondary/20 border border-border/20 p-2.5 overflow-hidden">
                  <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-cyan-400/60 to-transparent" />
                  <div className="flex items-center gap-1 mb-1">
                    <Target className="w-3 h-3 text-cyan-400" />
                    <span className="text-[9px] font-semibold text-muted-foreground uppercase">Entrada</span>
                  </div>
                  <span className="text-sm font-mono font-bold text-cyan-400">
                    {formatPrice(simulation.entry, symbol)}
                  </span>
                  <div className="mt-1 text-[7px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md inline-block bg-cyan-500/15 text-cyan-400 border border-cyan-500/25">
                    {entryOrderType}
                  </div>
                </div>

                {/* Stop Loss */}
                <div className="relative rounded-lg bg-secondary/20 border border-border/20 p-2.5 overflow-hidden">
                  <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-red-400/60 to-transparent"
                    style={{ boxShadow: '0 0 8px rgba(239, 68, 68, 0.3)' }}
                  />
                  <div className="flex items-center gap-1 mb-1">
                    <TrendingDown className="w-3 h-3 text-red-400" />
                    <span className="text-[9px] font-semibold text-muted-foreground uppercase">Stop Loss</span>
                  </div>
                  <span className="text-sm font-mono font-bold text-red-400">
                    {formatPrice(simulation.stopLoss, symbol)}
                  </span>
                  <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                    <div className="text-[7px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md inline-block bg-red-500/15 text-red-400 border border-red-500/25">
                      {slOrderType}
                    </div>
                    <span className="text-[9px] font-mono text-red-400/80">
                      −{fmtUSD(simulation.potentialLossUSD)}
                      {simulation.riskPips > 0 && <span className="ml-0.5">({simulation.riskPips} pips)</span>}
                    </span>
                  </div>
                </div>

                {/* Take Profit */}
                <div className="relative rounded-lg bg-secondary/20 border border-border/20 p-2.5 overflow-hidden">
                  <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-emerald-400/60 to-transparent"
                    style={{ boxShadow: '0 0 8px rgba(16, 185, 129, 0.3)' }}
                  />
                  <div className="flex items-center gap-1 mb-1">
                    <TrendingUp className="w-3 h-3 text-emerald-400" />
                    <span className="text-[9px] font-semibold text-muted-foreground uppercase">Take Profit</span>
                  </div>
                  <span className="text-sm font-mono font-bold text-emerald-400">
                    {formatPrice(simulation.takeProfit, symbol)}
                  </span>
                  <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                    <div className="text-[7px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md inline-block bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">
                      {tpOrderType}
                    </div>
                    <span className="text-[9px] font-mono text-emerald-400/80">
                      +{fmtUSD(simulation.potentialGainUSD)}
                      {simulation.rewardPips > 0 && <span className="ml-0.5">({simulation.rewardPips} pips)</span>}
                    </span>
                  </div>
                </div>

                {/* Risk:Reward */}
                <div className="relative rounded-lg bg-secondary/20 border border-border/20 p-2.5 overflow-hidden">
                  <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-amber-400/60 to-transparent"
                    style={{ boxShadow: '0 0 8px rgba(245, 158, 11, 0.3)' }}
                  />
                  <div className="flex items-center gap-1 mb-1">
                    <Coins className="w-3 h-3 text-amber-400" />
                    <span className="text-[9px] font-semibold text-muted-foreground uppercase">Risco/Retorno</span>
                  </div>
                  <span className="text-sm font-mono font-bold text-amber-400">
                    1:{simulation.rrRatio.toFixed(1)}
                  </span>
                  <div className="mt-1 text-[9px] font-mono text-amber-400/80">
                    {simulation.rrRatio >= 2 ? 'Favorável' : simulation.rrRatio >= 1.5 ? 'Moderado' : 'Desfavorável'}
                  </div>
                </div>
              </div>

              {/* Detailed Results Bar */}
              <div className={`grid grid-cols-2 sm:grid-cols-3 ${simulation.assetType === 'forex' ? 'md:grid-cols-7' : 'md:grid-cols-6'} gap-2`}>
                <div className="text-center p-2 rounded-lg bg-red-500/5 border border-red-500/10">
                  <div className="text-[8px] text-red-400/60 uppercase font-semibold">Risco USD</div>
                  <div className="text-xs font-mono font-bold text-red-400 mt-0.5">
                    {fmtUSD(simulation.potentialLossUSD)}
                  </div>
                </div>
                <div className="text-center p-2 rounded-lg bg-emerald-500/5 border border-emerald-500/10">
                  <div className="text-[8px] text-emerald-400/60 uppercase font-semibold">Retorno USD</div>
                  <div className="text-xs font-mono font-bold text-emerald-400 mt-0.5">
                    {fmtUSD(simulation.potentialGainUSD)}
                  </div>
                </div>
                <div className="text-center p-2 rounded-lg bg-cyan-500/5 border border-cyan-500/10">
                  <div className="text-[8px] text-cyan-400/60 uppercase font-semibold">Líquido USD</div>
                  <div className={`text-xs font-mono font-bold mt-0.5 ${
                    simulation.potentialGainUSD - simulation.potentialLossUSD > 0 ? 'text-emerald-400' : 'text-red-400'
                  }`}>
                    {(simulation.potentialGainUSD - simulation.potentialLossUSD) > 0 ? '+' : ''}
                    {fmtUSD(simulation.potentialGainUSD - simulation.potentialLossUSD)}
                  </div>
                </div>
                <div className="text-center p-2 rounded-lg bg-red-500/5 border border-red-500/10">
                  <div className="text-[8px] text-red-400/60 uppercase font-semibold">Risco %</div>
                  <div className="text-xs font-mono font-bold text-red-400 mt-0.5">
                    {simulation.riskPercentOfCapital.toFixed(1)}%
                  </div>
                </div>
                <div className="text-center p-2 rounded-lg bg-emerald-500/5 border border-emerald-500/10">
                  <div className="text-[8px] text-emerald-400/60 uppercase font-semibold">Retorno %</div>
                  <div className="text-xs font-mono font-bold text-emerald-400 mt-0.5">
                    {simulation.gainPercentOfCapital.toFixed(1)}%
                  </div>
                </div>
                <div className="text-center p-2 rounded-lg bg-violet-500/5 border border-violet-500/10">
                  <div className="text-[8px] text-violet-400/60 uppercase font-semibold">{simulation.assetLabel}</div>
                  <div className="text-xs font-mono font-bold text-violet-400 mt-0.5">
                    {simulation.positionDisplay}
                  </div>
                </div>
                {/* Forex-specific: Pip Value */}
                {simulation.assetType === 'forex' && simulation.pipValuePerLot > 0 && (
                  <div className="text-center p-2 rounded-lg bg-cyan-500/5 border border-cyan-500/10">
                    <div className="text-[8px] text-cyan-400/60 uppercase font-semibold">Pip Value/Lot</div>
                    <div className="text-xs font-mono font-bold text-cyan-400 mt-0.5">
                      ${simulation.pipValuePerLot.toFixed(2)}
                    </div>
                  </div>
                )}
              </div>

              {/* Contract info banner */}
              {simulation.contractInfo && (
                <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-secondary/20 border border-border/15">
                  <Info className="w-3 h-3 text-cyan-400/60 shrink-0" />
                  <span className="text-[9px] text-muted-foreground">{simulation.contractInfo}</span>
                </div>
              )}

              {/* Visual Risk/Reward Bar */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[9px]">
                  <span className="text-red-400 font-semibold">Stop Loss</span>
                  <span className="text-foreground font-semibold">Entrada</span>
                  <span className="text-emerald-400 font-semibold">Take Profit</span>
                </div>
                <div className="relative h-6 rounded-full overflow-hidden bg-secondary/30">
                  <div
                    className="absolute left-0 top-0 h-full bg-gradient-to-r from-red-500/30 to-red-500/10"
                    style={{ width: `${Math.min(100 / (1 + simulation.rrRatio), 50)}%`, boxShadow: 'inset 0 0 10px rgba(239, 68, 68, 0.2)' }}
                  />
                  <div
                    className="absolute right-0 top-0 h-full bg-gradient-to-l from-emerald-500/30 to-emerald-500/10"
                    style={{ width: `${Math.min((100 * simulation.rrRatio) / (1 + simulation.rrRatio), 80)}%`, boxShadow: 'inset 0 0 10px rgba(16, 185, 129, 0.2)' }}
                  />
                  <div
                    className="absolute top-0 h-full w-[2px] bg-cyan-400"
                    style={{ left: `${100 / (1 + simulation.rrRatio)}%`, boxShadow: '0 0 6px rgba(6, 182, 212, 0.6)' }}
                  />
                  <div className="absolute inset-0 flex items-center justify-between px-3">
                    <span className="text-[8px] font-mono font-bold text-red-300 drop-shadow-md">
                      −{fmtUSDShort(simulation.potentialLossUSD)}
                    </span>
                    <span className="text-[8px] font-mono font-bold text-emerald-300 drop-shadow-md">
                      +{fmtUSDShort(simulation.potentialGainUSD)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Warning for high risk */}
              {riskPercent > 3 && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex items-start gap-2 p-2 rounded-lg bg-red-500/5 border border-red-500/15"
                >
                  <AlertTriangle className="w-3.5 h-3.5 text-red-400 mt-0.5 shrink-0" />
                  <div>
                    <span className="text-[10px] font-semibold text-red-400">Alto Risco!</span>
                    <span className="text-[9px] text-muted-foreground ml-1">
                      Arriscar mais de 3% do capital por operação é considerado gerenciamento de risco agressivo. Recomenda-se 1-2%.
                    </span>
                  </div>
                </motion.div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
