'use client';

import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BarChart3 } from 'lucide-react';
import { Instrument, QuoteData, getVal, MarketCategory } from './types';

interface MarketHeatmapProps {
  instruments: Instrument[];
  quotes: Record<string, QuoteData>;
  category: MarketCategory;
}

export function MarketHeatmap({ instruments, quotes, category }: MarketHeatmapProps) {
  const getCategoryLabel = () => {
    switch (category) {
      case 'forex': return 'Forex';
      case 'indices': return 'Índices';
      case 'metals': return 'Commodities';
      case 'crypto': return 'Cripto';
      case 'stocks': return 'Ações US';
      case 'etfs': return 'ETFs';
      case 'brazil': return 'Brasil';
    }
  };

  // Build heatmap data with change percentages and sizes
  const heatmapData = instruments.map(inst => {
    const quote = quotes[inst.symbol];
    const changePct = getVal(quote?.regularMarketChangePercent);
    const price = getVal(quote?.regularMarketPrice);
    const volume = getVal(quote?.regularMarketVolume);
    return {
      ...inst,
      changePct,
      price,
      volume,
      // Size based on volume or market cap (use volume as proxy)
      size: Math.max(1, Math.min(5, Math.log10(Math.max(volume, 1)) - 2)),
    };
  }).sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct));

  const getColor = (changePct: number): string => {
    if (changePct > 2) return 'bg-emerald-500/60 border-emerald-500/40';
    if (changePct > 1) return 'bg-emerald-500/40 border-emerald-500/30';
    if (changePct > 0) return 'bg-emerald-500/20 border-emerald-500/20';
    if (changePct > -1) return 'bg-red-500/20 border-red-500/20';
    if (changePct > -2) return 'bg-red-500/40 border-red-500/30';
    return 'bg-red-500/60 border-red-500/40';
  };

  const getTextColor = (changePct: number): string => {
    if (changePct >= 0) return 'text-emerald-300';
    return 'text-red-300';
  };

  return (
    <Card className="border-border/40 bg-card/80 backdrop-blur-sm h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-amber-400" />
          Mapa de Calor — {getCategoryLabel()}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-1.5 overflow-x-auto">
          {heatmapData.map((item, index) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.05, type: 'spring', stiffness: 200 }}
              className={`rounded-lg border cursor-pointer transition-all duration-200 hover:scale-105 hover:z-10 ${getColor(item.changePct)}`}
              style={{
                minWidth: `max(50px, ${40 + item.size * 12}px)`,
                minHeight: '44px',
                padding: '6px 8px',
              }}
              title={`${item.name}: ${item.changePct >= 0 ? '+' : ''}${item.changePct.toFixed(2)}%`}
            >
              <div className="flex flex-col items-center justify-center h-full">
                <span className="text-[10px] font-semibold text-foreground/90 truncate max-w-full">
                  {item.name}
                </span>
                <span className={`text-[10px] font-mono font-bold ${getTextColor(item.changePct)}`}>
                  {item.changePct >= 0 ? '+' : ''}{item.changePct.toFixed(2)}%
                </span>
              </div>
            </motion.div>
          ))}
        </div>
        
        {/* Legend */}
        <div className="flex items-center justify-center gap-2 mt-3 pt-2 border-t border-border/20">
          <div className="flex items-center gap-1">
            <div className="w-3 h-2 rounded-sm bg-red-500/60" />
            <span className="text-[8px] text-muted-foreground">&lt;-2%</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-2 rounded-sm bg-red-500/30" />
            <span className="text-[8px] text-muted-foreground">-1%</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-2 rounded-sm bg-red-500/15" />
            <span className="text-[8px] text-muted-foreground">0%</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-2 rounded-sm bg-emerald-500/15" />
            <span className="text-[8px] text-muted-foreground">0%</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-2 rounded-sm bg-emerald-500/30" />
            <span className="text-[8px] text-muted-foreground">+1%</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-2 rounded-sm bg-emerald-500/60" />
            <span className="text-[8px] text-muted-foreground">&gt;+2%</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
