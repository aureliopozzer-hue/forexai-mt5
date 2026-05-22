'use client';

import { useMemo } from 'react';
import { useGamification, GamificationData, Badge } from './use-gamification';
import { usePerformance, PerformanceStats, TradeResult } from './use-performance';
import { QuoteData, getVal, ALL_INSTRUMENTS } from '@/components/dashboard/types';

// ===================== Types =====================

export interface WeeklyReport {
  period: {
    start: string;
    end: string;
  };
  performance: {
    totalAnalyses: number;
    hitRate: number;
    bestStrategy: string;
    totalHits: number;
    totalMisses: number;
  };
  topInstruments: {
    symbol: string;
    name: string;
    count: number;
  }[];
  badges: {
    name: string;
    emoji: string;
  }[];
  streak: number;
  longestStreak: number;
  marketHighlights: {
    symbol: string;
    name: string;
    change: number;
    direction: 'up' | 'down';
  }[];
  generatedAt: string;
}

// ===================== Helpers =====================

function getWeekRange(): { start: string; end: string } {
  const now = new Date();
  const end = new Date(now);
  // End of current week (Sunday)
  const dayOfWeek = end.getDay();
  const daysToSunday = dayOfWeek === 0 ? 0 : 7 - dayOfWeek;
  end.setDate(end.getDate() + daysToSunday);

  // Start of current week (Monday, 7 days ago)
  const start = new Date(end);
  start.setDate(start.getDate() - 6);

  const fmt = (d: Date) => d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  return { start: fmt(start), end: fmt(end) };
}

function getTradesThisWeek(trades: TradeResult[]): TradeResult[] {
  const now = new Date();
  const startOfWeek = new Date(now);
  const dayOfWeek = startOfWeek.getDay();
  // Monday of this week
  const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  startOfWeek.setDate(startOfWeek.getDate() - diff);
  startOfWeek.setHours(0, 0, 0, 0);

  return trades.filter(t => new Date(t.timestamp) >= startOfWeek);
}

function getTopInstrumentsFromTrades(trades: TradeResult[]): { symbol: string; name: string; count: number }[] {
  const map = new Map<string, { name: string; count: number }>();
  for (const t of trades) {
    const existing = map.get(t.instrumentSymbol);
    if (existing) {
      existing.count++;
    } else {
      map.set(t.instrumentSymbol, { name: t.instrumentName, count: 1 });
    }
  }
  return Array.from(map.entries())
    .map(([symbol, data]) => ({ symbol, ...data }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
}

function getEarnedBadgesThisWeek(badges: Badge[]): { name: string; emoji: string }[] {
  const now = new Date();
  const startOfWeek = new Date(now);
  const dayOfWeek = startOfWeek.getDay();
  const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  startOfWeek.setDate(startOfWeek.getDate() - diff);
  startOfWeek.setHours(0, 0, 0, 0);

  return badges
    .filter(b => b.earned && b.earnedAt && new Date(b.earnedAt) >= startOfWeek)
    .map(b => ({ name: b.name, emoji: b.emoji }));
}

function getMarketHighlights(
  allQuotes: Record<string, QuoteData>
): { symbol: string; name: string; change: number; direction: 'up' | 'down' }[] {
  const highlights: { symbol: string; name: string; change: number; direction: 'up' | 'down' }[] = [];

  for (const [symbol, quote] of Object.entries(allQuotes)) {
    const changePct = getVal(quote.regularMarketChangePercent);
    if (Math.abs(changePct) >= 1.5) {
      const instrument = ALL_INSTRUMENTS.find(i => i.symbol === symbol);
      highlights.push({
        symbol,
        name: instrument?.name || quote.shortName || symbol,
        change: changePct,
        direction: changePct >= 0 ? 'up' : 'down',
      });
    }
  }

  return highlights
    .sort((a, b) => Math.abs(b.change) - Math.abs(a.change))
    .slice(0, 5);
}

function getBestStrategyLabel(stats: PerformanceStats): string {
  if (!stats.bestStrategy) return '—';
  const labels: Record<string, string> = {
    smc: 'SMC',
    price_action: 'Price Action',
    hybrid: 'Híbrido',
  };
  return labels[stats.bestStrategy] || stats.bestStrategy;
}

// ===================== Report Text Builder =====================

export function buildReportText(report: WeeklyReport): string {
  const lines: string[] = [
    `📊 ForexAI Pro — Relatório Semanal`,
    `📅 ${report.period.start} a ${report.period.end}`,
    ``,
    `🎯 Performance:`,
    `  • Análises: ${report.performance.totalAnalyses}`,
    `  • Taxa de Acerto: ${report.performance.hitRate}%`,
    `  • Acertos: ${report.performance.totalHits} | Erros: ${report.performance.totalMisses}`,
    `  • Melhor Estratégia: ${report.performance.bestStrategy}`,
    ``,
    `💱 Instrumentos Mais Analisados:`,
  ];

  report.topInstruments.forEach((inst, i) => {
    lines.push(`  ${i + 1}. ${inst.name} (${inst.count}x)`);
  });

  if (report.marketHighlights.length > 0) {
    lines.push('', `🔥 Destaques de Mercado:`);
    report.marketHighlights.forEach(h => {
      lines.push(`  ${h.direction === 'up' ? '📈' : '📉'} ${h.name}: ${h.change >= 0 ? '+' : ''}${h.change.toFixed(2)}%`);
    });
  }

  if (report.badges.length > 0) {
    lines.push('', `🏆 Conquistas da Semana:`);
    report.badges.forEach(b => {
      lines.push(`  ${b.emoji} ${b.name}`);
    });
  }

  lines.push('', `🔥 Sequência: ${report.streak} dias (recorde: ${report.longestStreak} dias)`);
  lines.push('', `🔗 forexaiproelite.vercel.app`);
  lines.push(`Gerado em: ${report.generatedAt}`);

  return lines.join('\n');
}

// ===================== Hook =====================

export function useWeeklyReport(
  gamificationData: GamificationData,
  performanceStats: PerformanceStats,
  allTrades: TradeResult[],
  allQuotes: Record<string, QuoteData>,
  isSubscribed: boolean = false,
) {
  const report = useMemo<WeeklyReport>(() => {
    const weekTrades = getTradesThisWeek(allTrades);
    const resolvedWeekTrades = weekTrades.filter(t => t.result === 'hit' || t.result === 'miss' || t.result === 'breakeven');
    const weekHits = weekTrades.filter(t => t.result === 'hit').length;
    const weekMisses = weekTrades.filter(t => t.result === 'miss').length;
    const weekHitRate = resolvedWeekTrades.length > 0
      ? Math.round((weekHits / resolvedWeekTrades.length) * 100)
      : 0;

    const topInstruments = getTopInstrumentsFromTrades(weekTrades);
    const weekBadges = getEarnedBadgesThisWeek(gamificationData.badges);
    const marketHighlights = getMarketHighlights(allQuotes);

    return {
      period: getWeekRange(),
      performance: {
        totalAnalyses: weekTrades.length,
        hitRate: weekHitRate,
        bestStrategy: getBestStrategyLabel(performanceStats),
        totalHits: weekHits,
        totalMisses: weekMisses,
      },
      topInstruments,
      badges: weekBadges,
      streak: gamificationData.streak,
      longestStreak: gamificationData.longestStreak,
      marketHighlights,
      generatedAt: new Date().toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }),
    };
  }, [allTrades, gamificationData, performanceStats, allQuotes]);

  const hasData = report.performance.totalAnalyses > 0 || gamificationData.totalAnalyses > 0;

  return { report, hasData, buildReportText: () => buildReportText(report) };
}
