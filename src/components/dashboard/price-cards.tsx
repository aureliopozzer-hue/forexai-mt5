'use client';

import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, Star } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Instrument, QuoteData, SparklinePoint, getVal, formatPrice } from './types';

interface PriceCardsProps {
  instruments: Instrument[];
  quotes: Record<string, QuoteData>;
  selectedSymbol: string | null;
  onSelect: (instrument: Instrument) => void;
  favorites: Set<string>;
  onToggleFavorite: (symbol: string) => void;
  sparklineData?: Record<string, SparklinePoint[]>;
}

function MiniChart({ data, positive }: { data: number[]; positive: boolean }) {
  if (data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const width = 72;
  const height = 28;

  const points = data.map((val, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((val - min) / range) * (height - 4) - 2;
    return `${x},${y}`;
  }).join(' ');

  const gradId = `grad-${positive ? 'g' : 'r'}-${Math.random().toString(36).slice(2, 6)}`;

  return (
    <svg width={width} height={height} className="flex-shrink-0">
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={positive ? '#10b981' : '#ef4444'} stopOpacity={0.3} />
          <stop offset="100%" stopColor={positive ? '#10b981' : '#ef4444'} stopOpacity={0} />
        </linearGradient>
      </defs>
      <polygon
        points={`0,${height} ${points} ${width},${height}`}
        fill={`url(#${gradId})`}
      />
      <polyline
        points={points}
        fill="none"
        stroke={positive ? '#10b981' : '#ef4444'}
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function PriceCards({ instruments, quotes, selectedSymbol, onSelect, favorites, onToggleFavorite, sparklineData }: PriceCardsProps) {
  // Get sparkline close values for an instrument, or fall back to simulated data
  const getMiniData = (instrument: Instrument, quote: QuoteData): number[] => {
    // Use real sparkline data if available
    if (sparklineData && sparklineData[instrument.symbol] && sparklineData[instrument.symbol].length >= 2) {
      const realData = sparklineData[instrument.symbol].map(p => p.close);
      // Check if data has meaningful variation (not all same value)
      const min = Math.min(...realData);
      const max = Math.max(...realData);
      if (max > min) {
        return realData;
      }
      // If all values are the same, fall through to simulated data
    }

    // Fallback: generate simulated data from current price
    const base = getVal(quote.regularMarketPrice);
    if (!base) return [];
    const changePct = getVal(quote.regularMarketChangePercent) || 0;
    const volatility = Math.abs(changePct) / 100 || 0.002;
    const isPositive = changePct >= 0;
    const data: number[] = [];
    // Create a trend-following sparkline
    const startPrice = base / (1 + changePct / 100);
    for (let i = 0; i < 24; i++) {
      const progress = i / 23;
      const trend = startPrice + (base - startPrice) * progress;
      const noise = (Math.random() - 0.5) * base * volatility;
      data.push(trend + noise);
    }
    data.push(base);
    return data;
  };

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
      {instruments.map((instrument, index) => {
        const quote = quotes[instrument.symbol];
        const changeNum = getVal(quote?.regularMarketChange);
        const isPositive = changeNum >= 0;
        const changePct = getVal(quote?.regularMarketChangePercent);
        const isSelected = selectedSymbol === instrument.symbol;
        const isFav = favorites.has(instrument.symbol);

        return (
          <motion.div
            key={instrument.id}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: index * 0.03 }}
          >
            <Card
              className={`cursor-pointer transition-all duration-200 group relative ${
                isSelected
                  ? 'border-cyan-500/50 bg-cyan-500/5 animate-selected-glow'
                  : 'border-border/40 bg-card/80 hover:border-border/80 hover:bg-card'
              }`}
              onClick={() => onSelect(instrument)}
            >
              <CardContent className="p-3">
                {/* Favorite button */}
                <button
                  className={`absolute top-1.5 right-1.5 p-1.5 -m-1 opacity-0 group-hover:opacity-100 transition-opacity ${
                    isFav ? 'opacity-100 !text-amber-400' : 'text-muted-foreground'
                  }`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleFavorite(instrument.symbol);
                  }}
                >
                  <Star className={`w-3 h-3 ${isFav ? 'fill-amber-400 text-amber-400' : ''}`} />
                </button>

                <div className="flex items-center gap-1.5 mb-1.5">
                  <span className="text-sm">{instrument.flag}</span>
                  <span className="font-semibold text-sm truncate">{instrument.name}</span>
                </div>

                <div className="flex items-end justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-mono font-bold text-base leading-tight">
                      {formatPrice(getVal(quote?.regularMarketPrice), instrument.symbol)}
                    </div>
                    <div className={`text-[11px] font-medium flex items-center gap-0.5 ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
                      {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                      {isPositive ? '+' : ''}{changePct.toFixed(2)}%
                    </div>
                  </div>
                  {quote && (
                    <MiniChart
                      data={getMiniData(instrument, quote)}
                      positive={isPositive}
                    />
                  )}
                </div>

                {/* Market state indicator */}
                {(() => {
                  const raw = quote?.marketState || '';
                  // Normalize corrupted Yahoo values like "POSTPOST", "REGULARREGULAR", etc.
                  const ms = raw.replace(/^(REGULAR|CLOSED|PRE|POST|PREPRE|POSTPOST)(REGULAR|CLOSED|PRE|POST)$/, '$1');
                  const isOpen = ms === 'REGULAR';
                  const isClosed = ms === 'CLOSED';
                  const isPre = ms === 'PRE' || ms === 'PREPRE';
                  const isPost = ms === 'POST' || ms === 'POSTPOST';
                  if (!ms || !isOpen && !isClosed && !isPre && !isPost) return null;
                  return (
                    <div className="mt-1.5 flex items-center gap-1">
                      <div className={`w-1.5 h-1.5 rounded-full ${
                        isOpen ? 'bg-emerald-400 pulse-glow' :
                        isClosed ? 'bg-muted-foreground/40' :
                        'bg-amber-400'
                      }`} />
                      <span className="text-[9px] text-muted-foreground uppercase tracking-wider">
                        {isOpen ? 'Aberto' :
                         isClosed ? 'Fechado' :
                         isPre ? 'Pré-Mercado' :
                         isPost ? 'Pós-Mercado' :
                         ms}
                      </span>
                    </div>
                  );
                })()}
              </CardContent>
            </Card>
          </motion.div>
        );
      })}
    </div>
  );
}
