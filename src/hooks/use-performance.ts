'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { AnalysisStrategy } from '@/components/dashboard/types';

// ===================== Types =====================

export interface TradeResult {
  id: string;
  instrumentSymbol: string;
  instrumentName: string;
  strategy: AnalysisStrategy;
  direction: 'BUY' | 'SELL' | 'WAIT';
  entryPrice: number;
  stopLoss: number;
  takeProfit: number;
  confidence: number;
  successProbability: number;
  timestamp: string; // ISO date when analysis was made
  // User marks the result later:
  result?: 'hit' | 'miss' | 'breakeven' | null; // null/undefined = pending
  resultPrice?: number; // actual price at outcome
  resultDate?: string; // when user marked the result
}

export interface StrategyStat {
  total: number;
  hits: number;
  hitRate: number;
}

export interface WeeklyPerformance {
  week: string;
  hitRate: number;
  total: number;
}

export interface PerformanceStats {
  totalTrades: number;
  pendingTrades: number;
  hitTrades: number;
  missTrades: number;
  breakevenTrades: number;
  hitRate: number; // percentage
  avgConfidence: number;
  bestStrategy: AnalysisStrategy | null;
  strategyStats: Record<AnalysisStrategy, StrategyStat>;
  recentResults: TradeResult[]; // last 20
  weeklyPerformance: WeeklyPerformance[]; // last 8 weeks
}

// ===================== Constants =====================

const STORAGE_KEY = 'forexAI-performance-trades';
const MAX_TRADES = 200;

// ===================== Helpers =====================

function loadTrades(): TradeResult[] {
  if (typeof window === 'undefined') return [];
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {
    // Corrupted data — reset
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
  }
  return [];
}

function saveTrades(trades: TradeResult[]) {
  if (typeof window === 'undefined') return;
  try {
    // Auto-prune: keep max MAX_TRADES, remove oldest first
    const trimmed = trades.length > MAX_TRADES
      ? trades.slice(0, MAX_TRADES)
      : trades;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch {}
}

function getWeekKey(dateStr: string): string {
  const d = new Date(dateStr);
  // Get the ISO week number
  const startOfYear = new Date(d.getFullYear(), 0, 1);
  const pastDaysOfYear = (d.getTime() - startOfYear.getTime()) / 86400000;
  const weekNum = Math.ceil((pastDaysOfYear + startOfYear.getDay() + 1) / 7);
  return `${d.getFullYear()}-S${String(weekNum).padStart(2, '0')}`;
}

function getWeekLabel(weekKey: string): string {
  const parts = weekKey.split('-S');
  if (parts.length !== 2) return weekKey;
  return `S${parts[1]}`;
}

function computeStats(trades: TradeResult[]): PerformanceStats {
  const totalTrades = trades.length;
  const pendingTrades = trades.filter(t => !t.result).length;
  const hitTrades = trades.filter(t => t.result === 'hit').length;
  const missTrades = trades.filter(t => t.result === 'miss').length;
  const breakevenTrades = trades.filter(t => t.result === 'breakeven').length;

  const resolvedTrades = hitTrades + missTrades + breakevenTrades;
  const hitRate = resolvedTrades > 0 ? Math.round((hitTrades / resolvedTrades) * 100) : 0;

  const avgConfidence = totalTrades > 0
    ? Math.round(trades.reduce((sum, t) => sum + t.confidence, 0) / totalTrades)
    : 0;

  // Strategy stats
  const strategies: AnalysisStrategy[] = ['smc', 'price_action', 'hybrid'];
  const strategyStats = Object.fromEntries(
    strategies.map((s): [AnalysisStrategy, StrategyStat] => {
      const stTrades = trades.filter(t => t.strategy === s);
      const stResolved = stTrades.filter(t => t.result === 'hit' || t.result === 'miss' || t.result === 'breakeven');
      const stHits = stTrades.filter(t => t.result === 'hit').length;
      return [s, {
        total: stTrades.length,
        hits: stHits,
        hitRate: stResolved.length > 0 ? Math.round((stHits / stResolved.length) * 100) : 0,
      }];
    })
  ) as Record<AnalysisStrategy, StrategyStat>;

  // Best strategy (at least 3 resolved trades required)
  let bestStrategy: AnalysisStrategy | null = null;
  let bestRate = -1;
  for (const s of strategies) {
    const st = strategyStats[s];
    const stResolved = st.total - trades.filter(t => t.strategy === s && !t.result).length;
    if (stResolved >= 3 && st.hitRate > bestRate) {
      bestRate = st.hitRate;
      bestStrategy = s;
    }
  }

  // Recent results (last 20)
  const recentResults = trades.slice(0, 20);

  // Weekly performance (last 8 weeks)
  const now = new Date();
  const eightWeeksAgo = new Date(now.getTime() - 8 * 7 * 86400000);

  const resolvedTradesList = trades.filter(t => t.result && new Date(t.timestamp) >= eightWeeksAgo);
  const weekMap = new Map<string, { hits: number; total: number }>();

  for (const t of resolvedTradesList) {
    const wk = getWeekKey(t.timestamp);
    const existing = weekMap.get(wk) || { hits: 0, total: 0 };
    existing.total++;
    if (t.result === 'hit') existing.hits++;
    weekMap.set(wk, existing);
  }

  // Build last 8 weeks array
  const weeklyPerformance: WeeklyPerformance[] = [];
  for (let i = 7; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 7 * 86400000);
    const wk = getWeekKey(d.toISOString());
    const data = weekMap.get(wk);
    weeklyPerformance.push({
      week: getWeekLabel(wk),
      hitRate: data && data.total > 0 ? Math.round((data.hits / data.total) * 100) : 0,
      total: data?.total || 0,
    });
  }

  return {
    totalTrades,
    pendingTrades,
    hitTrades,
    missTrades,
    breakevenTrades,
    hitRate,
    avgConfidence,
    bestStrategy,
    strategyStats,
    recentResults,
    weeklyPerformance,
  };
}

// ===================== Hook =====================

export function usePerformance() {
  const [trades, setTrades] = useState<TradeResult[]>([]);

  // Load from localStorage after mount
  useEffect(() => {
    setTrades(loadTrades());
  }, []);

  // Computed stats
  const stats = useMemo(() => computeStats(trades), [trades]);

  // Add a new trade from an analysis result
  const addTrade = useCallback((trade: Omit<TradeResult, 'id' | 'result'>) => {
    const newTrade: TradeResult = {
      ...trade,
      id: `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      result: null, // pending
    };
    setTrades(prev => {
      const updated = [newTrade, ...prev].slice(0, MAX_TRADES);
      saveTrades(updated);
      return updated;
    });
    return newTrade.id;
  }, []);

  // Mark a trade result
  const markResult = useCallback((tradeId: string, result: 'hit' | 'miss' | 'breakeven', resultPrice?: number) => {
    setTrades(prev => {
      const updated = prev.map(t =>
        t.id === tradeId
          ? { ...t, result, resultPrice, resultDate: new Date().toISOString() }
          : t
      );
      saveTrades(updated);
      return updated;
    });
  }, []);

  // Remove a trade
  const removeTrade = useCallback((tradeId: string) => {
    setTrades(prev => {
      const updated = prev.filter(t => t.id !== tradeId);
      saveTrades(updated);
      return updated;
    });
  }, []);

  // Clear all trades
  const clearAllTrades = useCallback(() => {
    setTrades([]);
    saveTrades([]);
  }, []);

  // Get pending trades count
  const pendingCount = trades.filter(t => !t.result).length;

  return {
    trades,
    stats,
    addTrade,
    markResult,
    removeTrade,
    clearAllTrades,
    pendingCount,
  };
}
