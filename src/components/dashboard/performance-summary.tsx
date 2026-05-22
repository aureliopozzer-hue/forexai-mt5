'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { TrendingUp, TrendingDown, Percent, Activity } from 'lucide-react';
import { Instrument, QuoteData, getVal, MarketCategory } from './types';

interface PerformanceSummaryProps {
  instruments: Instrument[];
  quotes: Record<string, QuoteData>;
  category: MarketCategory;
}

export function PerformanceSummary({ instruments, quotes, category }: PerformanceSummaryProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Calculate performance metrics
  const instrumentsWithData = instruments.map(inst => {
    const quote = quotes[inst.symbol];
    const changePct = getVal(quote?.regularMarketChangePercent);
    const change = getVal(quote?.regularMarketChange);
    const price = getVal(quote?.regularMarketPrice);
    return { ...inst, changePct, change, price };
  });

  const positiveCount = instrumentsWithData.filter(i => i.changePct >= 0).length;
  const negativeCount = instrumentsWithData.length - positiveCount;

  const avgChange = instrumentsWithData.length > 0
    ? instrumentsWithData.reduce((sum, i) => sum + i.changePct, 0) / instrumentsWithData.length
    : 0;

  const sorted = [...instrumentsWithData].sort((a, b) => a.changePct - b.changePct);
  const bestPerformer = [...sorted].reverse()[0];
  const worstPerformer = sorted[0];
  const isSamePerformer = bestPerformer && worstPerformer && bestPerformer.id === worstPerformer.id;

  const isPositive = avgChange >= 0;
  const hasData = instrumentsWithData.some(i => i.changePct !== 0);

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {/* Average Change */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0 }}
      >
        <Card className="border-border/30 bg-card/60 backdrop-blur-sm">
          <CardContent className="p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <Percent className="w-3 h-3 text-cyan-400" />
              <span className="text-[9px] text-muted-foreground uppercase tracking-wider">Média</span>
            </div>
            <div className="flex items-center gap-1.5">
              {mounted && hasData ? (
                isPositive ? (
                  <TrendingUp className="w-4 h-4 text-emerald-400" />
                ) : (
                  <TrendingDown className="w-4 h-4 text-red-400" />
                )
              ) : (
                <TrendingUp className="w-4 h-4 text-cyan-400" />
              )}
              <span className={`text-lg font-bold font-mono ${mounted && hasData ? (isPositive ? 'text-emerald-400' : 'text-red-400') : 'text-cyan-400'}`}>
                {mounted && hasData && isPositive ? '+' : ''}{avgChange.toFixed(2)}%
              </span>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Best Performer */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <Card className="border-emerald-500/20 bg-emerald-500/5 backdrop-blur-sm">
          <CardContent className="p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <TrendingUp className="w-3 h-3 text-emerald-400" />
              <span className="text-[9px] text-muted-foreground uppercase tracking-wider">Melhor</span>
            </div>
            {mounted && bestPerformer ? (
              <>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-semibold truncate">{bestPerformer.flag} {bestPerformer.name}</span>
                </div>
                <span className="text-sm font-bold font-mono text-emerald-400">
                  {bestPerformer.changePct >= 0 ? '+' : ''}{bestPerformer.changePct.toFixed(2)}%
                </span>
              </>
            ) : (
              <div className="flex items-center justify-center h-8">
                <span className="text-xs text-muted-foreground">—</span>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Worst Performer */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <Card className={mounted && !isSamePerformer ? "border-red-500/20 bg-red-500/5 backdrop-blur-sm" : "border-border/30 bg-card/60 backdrop-blur-sm"}>
          <CardContent className="p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <TrendingDown className={mounted && !isSamePerformer ? "w-3 h-3 text-red-400" : "w-3 h-3 text-muted-foreground"} />
              <span className="text-[9px] text-muted-foreground uppercase tracking-wider">Pior</span>
            </div>
            {mounted && worstPerformer && !isSamePerformer ? (
              <>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-semibold truncate">{worstPerformer.flag} {worstPerformer.name}</span>
                </div>
                <span className="text-sm font-bold font-mono text-red-400">
                  {worstPerformer.changePct.toFixed(2)}%
                </span>
              </>
            ) : (
              <div className="flex items-center justify-center h-8">
                <span className="text-xs text-muted-foreground">—</span>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Sentiment */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <Card className="border-border/30 bg-card/60 backdrop-blur-sm">
          <CardContent className="p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <Activity className="w-3 h-3 text-violet-400" />
              <span className="text-[9px] text-muted-foreground uppercase tracking-wider">Sentimento</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-emerald-400 font-mono text-sm font-bold">{positiveCount}</span>
              <div className="flex-1 h-2 bg-secondary/50 rounded-full overflow-hidden flex">
                <div
                  className="bg-emerald-500/60 rounded-l-full transition-all"
                  style={{ width: `${instruments.length > 0 ? (positiveCount / instruments.length) * 100 : 50}%` }}
                />
                <div
                  className="bg-red-500/60 rounded-r-full transition-all"
                  style={{ width: `${instruments.length > 0 ? (negativeCount / instruments.length) * 100 : 50}%` }}
                />
              </div>
              <span className="text-red-400 font-mono text-sm font-bold">{negativeCount}</span>
            </div>
            <div className="flex justify-between text-[8px] text-muted-foreground mt-0.5">
              <span>Alta</span>
              <span>Baixa</span>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
