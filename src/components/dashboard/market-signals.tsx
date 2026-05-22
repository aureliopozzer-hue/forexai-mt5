'use client';

import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ChevronUp, ChevronDown, Gauge } from 'lucide-react';
import { Instrument, QuoteData, getVal, formatPrice, MarketCategory } from './types';

interface MarketSignalsProps {
  instruments: Instrument[];
  quotes: Record<string, QuoteData>;
  category: MarketCategory;
}

export function MarketSignals({ instruments, quotes, category }: MarketSignalsProps) {
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

  // Calculate market sentiment
  const positiveCount = instruments.filter(inst => getVal(quotes[inst.symbol]?.regularMarketChange) >= 0).length;
  const negativeCount = instruments.length - positiveCount;
  const sentiment = positiveCount > negativeCount ? 'bullish' : positiveCount < negativeCount ? 'bearish' : 'neutral';
  const sentimentScore = instruments.length > 0 ? Math.round((positiveCount / instruments.length) * 100) : 50;

  return (
    <Card className="border-border/40 bg-card/80 backdrop-blur-sm h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Gauge className="w-4 h-4 text-emerald-400" />
          Sinais — {getCategoryLabel()}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Market Sentiment Bar */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Sentimento do Mercado</span>
            <Badge variant="outline" className={`text-[10px] py-0 ${
              sentiment === 'bullish' ? 'border-emerald-500/30 text-emerald-400' :
              sentiment === 'bearish' ? 'border-red-500/30 text-red-400' :
              'border-amber-500/30 text-amber-400'
            }`}>
              {sentiment === 'bullish' ? '📈 Alta' : sentiment === 'bearish' ? '📉 Baixa' : '➡️ Neutro'}
            </Badge>
          </div>
          <div className="h-3 bg-secondary/50 rounded-full overflow-hidden flex">
            <div
              className="bg-emerald-500/60 transition-all duration-500 rounded-l-full"
              style={{ width: `${sentimentScore}%` }}
            />
            <div
              className="bg-red-500/60 transition-all duration-500 rounded-r-full"
              style={{ width: `${100 - sentimentScore}%` }}
            />
          </div>
          <div className="flex justify-between text-[9px] text-muted-foreground mt-0.5">
            <span>{positiveCount} alta</span>
            <span>{negativeCount} baixa</span>
          </div>
        </div>

        {/* Instruments List */}
        <ScrollArea className="h-[200px] sm:h-[240px]">
          <div className="space-y-2.5 pr-1">
            {instruments.map((instrument, index) => {
              const quote = quotes[instrument.symbol];
              const changeNum = getVal(quote?.regularMarketChange);
              const isPositive = changeNum >= 0;
              const changePct = Math.abs(getVal(quote?.regularMarketChangePercent));
              const price = getVal(quote?.regularMarketPrice);

              return (
                <motion.div
                  key={instrument.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-secondary/30 transition-colors"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${isPositive ? 'bg-emerald-400' : 'bg-red-400'}`} />
                    <span className="text-xs font-medium truncate">{instrument.flag} {instrument.name}</span>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="font-mono text-xs font-semibold">{formatPrice(price, instrument.symbol)}</span>
                    <div className={`flex items-center gap-0.5 text-[10px] font-medium ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
                      {isPositive ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                      {changePct.toFixed(2)}%
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
