'use client';

import { useEffect, useRef, useState } from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { QuoteData, Instrument, getVal, formatPrice, FOREX_PAIRS, INDICES, METALS, CRYPTO, STOCKS, ETFS, BRAZIL } from './types';

interface MarketTickerProps {
  quotes: Record<string, QuoteData>;
}

const ALL_INSTRUMENTS: Instrument[] = [...FOREX_PAIRS, ...INDICES, ...METALS, ...CRYPTO, ...STOCKS, ...ETFS, ...BRAZIL];

// Deduplicate by symbol (keep first occurrence to avoid duplicates like ^BVSP appearing 3x)
const UNIQUE_INSTRUMENTS = ALL_INSTRUMENTS.filter((inst, index, self) =>
  self.findIndex(i => i.symbol === inst.symbol) === index
);

// Show a subset for the ticker (top instruments)
const TICKER_INSTRUMENTS = UNIQUE_INSTRUMENTS.slice(0, 60);

export function MarketTicker({ quotes }: MarketTickerProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    let animId: number;
    let pos = 0;
    const speed = 0.5;

    const animate = () => {
      if (!isPaused) {
        pos -= speed;
        if (Math.abs(pos) >= el.scrollWidth / 2) {
          pos = 0;
        }
        el.style.transform = `translateX(${pos}px)`;
      }
      animId = requestAnimationFrame(animate);
    };

    animId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animId);
  }, [isPaused]);

  const tickerItems = TICKER_INSTRUMENTS.map((inst, i) => {
    const quote = quotes[inst.symbol];
    const changeNum = getVal(quote?.regularMarketChange);
    const isPositive = changeNum >= 0;
    const price = getVal(quote?.regularMarketPrice);
    const changePct = getVal(quote?.regularMarketChangePercent);

    return (
      <div
        key={`${inst.id}-${i}`}
        className="flex items-center gap-2 px-4 py-1.5 whitespace-nowrap border-r border-border/30 last:border-r-0"
      >
        <span className="text-xs">{inst.flag}</span>
        <span className="text-xs font-medium text-foreground/80">{inst.name}</span>
        <span className="text-xs font-mono font-semibold">{formatPrice(price, inst.symbol)}</span>
        <span className={`text-[10px] font-medium flex items-center gap-0.5 ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
          {isPositive ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
          {isPositive ? '+' : ''}{changePct.toFixed(2)}%
        </span>
      </div>
    );
  });

  return (
    <div
      className="bg-card/60 border-b border-border/30 overflow-hidden backdrop-blur-sm"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onTouchStart={() => setIsPaused(true)}
      onTouchEnd={() => setIsPaused(false)}
    >
      <div className="flex items-center">
        <div className="flex-shrink-0 px-3 py-1.5 bg-cyan-500/10 border-r border-border/30 hidden sm:block">
          <span className="text-[10px] font-bold text-cyan-400 uppercase tracking-wider">Mercado ao Vivo</span>
        </div>
        <div className="overflow-hidden flex-1">
          <div ref={scrollRef} className="flex">
            {tickerItems}
            {tickerItems}
          </div>
        </div>
      </div>
    </div>
  );
}
