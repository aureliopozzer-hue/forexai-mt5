'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Newspaper, ExternalLink, Clock, TrendingUp, TrendingDown, Minus, Filter, RefreshCw, Brain, Loader2 } from 'lucide-react';

interface NewsItem {
  title?: string;
  title_pt?: string;
  link?: string;
  publisher?: string;
  publishTime?: number | string;
  type?: string;
  sentiment?: 'positivo' | 'negativo' | 'neutro';
  thumbnail?: {
    resolutions?: Array<{ url: string; width: number; height: number; tag?: string }>;
  };
}

interface SentimentData {
  sentiment: 'bullish' | 'bearish' | 'neutral';
  confidence: number;
  summary: string;
  keyFactors: string[];
  source: 'llm' | 'keyword';
}

interface NewsFeedProps {
  symbol?: string;
  instrumentName?: string;
  onSentimentChange?: (sentiment: SentimentData | null) => void;
}

type SentimentFilter = 'todos' | 'positivo' | 'negativo' | 'neutro';

function formatNewsDate(timestamp: number | string | undefined): string {
  if (!timestamp) return '';
  try {
    const date = typeof timestamp === 'number'
      ? (timestamp > 1e12 ? new Date(timestamp) : new Date(timestamp * 1000))
      : new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Agora';
    if (diffMins < 60) return `${diffMins}min atrás`;
    if (diffHours < 24) return `${diffHours}h atrás`;
    if (diffDays < 7) return `${diffDays}d atrás`;
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
  } catch {
    return '';
  }
}

function SentimentBadge({ sentiment }: { sentiment: string }) {
  if (sentiment === 'positivo') {
    return (
      <Badge variant="outline" className="text-[8px] py-0 px-1 border-emerald-500/30 text-emerald-400 bg-emerald-500/5">
        <TrendingUp className="w-2 h-2 mr-0.5" /> Positivo
      </Badge>
    );
  }
  if (sentiment === 'negativo') {
    return (
      <Badge variant="outline" className="text-[8px] py-0 px-1 border-red-500/30 text-red-400 bg-red-500/5">
        <TrendingDown className="w-2 h-2 mr-0.5" /> Negativo
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="text-[8px] py-0 px-1 border-amber-500/30 text-amber-400 bg-amber-500/5">
      <Minus className="w-2 h-2 mr-0.5" /> Neutro
    </Badge>
  );
}

// =================== SENTIMENT INDICATOR COMPONENT ===================

function SentimentIndicator({
  sentiment,
  analyzing,
  onAnalyze,
  instrumentName,
}: {
  sentiment: SentimentData | null;
  analyzing: boolean;
  onAnalyze: () => void;
  instrumentName?: string;
}) {
  const getSentimentConfig = (s: 'bullish' | 'bearish' | 'neutral') => {
    switch (s) {
      case 'bullish':
        return {
          emoji: '🟢',
          label: 'Altista',
          color: 'text-emerald-400',
          bgColor: 'bg-emerald-500/10',
          borderColor: 'border-emerald-500/20',
          icon: <TrendingUp className="w-3 h-3" />,
        };
      case 'bearish':
        return {
          emoji: '🔴',
          label: 'Baixista',
          color: 'text-red-400',
          bgColor: 'bg-red-500/10',
          borderColor: 'border-red-500/20',
          icon: <TrendingDown className="w-3 h-3" />,
        };
      case 'neutral':
      default:
        return {
          emoji: '🟡',
          label: 'Neutro',
          color: 'text-amber-400',
          bgColor: 'bg-amber-500/10',
          borderColor: 'border-amber-500/20',
          icon: <Minus className="w-3 h-3" />,
        };
    }
  };

  // No sentiment data yet
  if (!sentiment && !analyzing) {
    return (
      <div className="flex items-center justify-between gap-2 mt-2 p-2 rounded-lg bg-secondary/20 border border-border/20">
        <div className="flex items-center gap-1.5">
          <Brain className="w-3.5 h-3.5 text-violet-400" />
          <span className="text-[10px] text-muted-foreground">Sentimento de mercado</span>
        </div>
        <Button
          size="sm"
          variant="ghost"
          onClick={onAnalyze}
          className="h-6 px-2 text-[9px] text-violet-400 hover:text-violet-300 hover:bg-violet-500/10"
        >
          <Brain className="w-3 h-3 mr-1" />
          Analisar Sentimento
        </Button>
      </div>
    );
  }

  // Analyzing state
  if (analyzing) {
    return (
      <div className="flex items-center justify-center gap-2 mt-2 p-3 rounded-lg bg-violet-500/5 border border-violet-500/15">
        <Loader2 className="w-4 h-4 text-violet-400 animate-spin" />
        <span className="text-[10px] text-violet-300 font-medium">Analisando sentimento com IA...</span>
      </div>
    );
  }

  // Show sentiment result
  if (!sentiment) return null;

  const config = getSentimentConfig(sentiment.sentiment);

  return (
    <div className={`mt-2 p-2.5 rounded-lg ${config.bgColor} border ${config.borderColor}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-sm">{config.emoji}</span>
          <div>
            <div className="flex items-center gap-1.5">
              <span className={`text-[11px] font-bold ${config.color} flex items-center gap-1`}>
                {config.icon}
                {config.label}
              </span>
              <Badge variant="outline" className="text-[8px] py-0 px-1 border-border/30 text-muted-foreground">
                {sentiment.confidence}%
              </Badge>
              {sentiment.source === 'llm' && (
                <Badge variant="outline" className="text-[7px] py-0 px-1 border-violet-500/30 text-violet-400 bg-violet-500/5">
                  IA
                </Badge>
              )}
            </div>
            <p className="text-[9px] text-muted-foreground mt-0.5 leading-tight line-clamp-2">
              {sentiment.summary}
            </p>
          </div>
        </div>
        <Button
          size="sm"
          variant="ghost"
          onClick={onAnalyze}
          className="h-6 px-1.5 text-[9px] text-muted-foreground hover:text-violet-400 hover:bg-violet-500/10 shrink-0"
          title="Reanalisar sentimento"
        >
          <RefreshCw className="w-3 h-3" />
        </Button>
      </div>
      {sentiment.keyFactors.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1.5">
          {sentiment.keyFactors.slice(0, 3).map((factor, i) => (
            <span key={i} className="text-[8px] px-1.5 py-0.5 rounded bg-secondary/40 text-muted-foreground">
              {factor}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// =================== MAIN NEWS FEED COMPONENT ===================

export function NewsFeed({ symbol, instrumentName, onSentimentChange }: NewsFeedProps) {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [sentimentFilter, setSentimentFilter] = useState<SentimentFilter>('todos');
  const [sentiment, setSentiment] = useState<SentimentData | null>(null);
  const [sentimentLoading, setSentimentLoading] = useState(false);

  const fetchNews = useCallback(async (signal?: AbortSignal, attempt = 0) => {
    let success = false;
    setLoading(true);
    try {
      const url = symbol
        ? `/api/market/news?ticker=${encodeURIComponent(symbol)}`
        : '/api/market/news';
      const res = await fetch(url, { signal });
      const json = await res.json();

      if (json.success && json.data?.body) {
        const body = json.data.body;
        if (Array.isArray(body)) {
          setNews(body.slice(0, 12));
        }
      }
      success = true;
    } catch (err: any) {
      // Don't log if the request was aborted (component unmounted or symbol changed)
      if (err?.name === 'AbortError') return;
      // Retry up to 2 times for transient network errors
      if (attempt < 2) {
        setTimeout(() => fetchNews(signal, attempt + 1), 1000 * (attempt + 1));
        return;
      }
      // Only log on final attempt
      console.error('Failed to fetch news after retries:', err);
    } finally {
      if (success || attempt >= 2) setLoading(false);
    }
  }, [symbol]);

  // Analyze sentiment using the AI endpoint
  const analyzeSentiment = useCallback(async () => {
    if (news.length === 0) return;

    setSentimentLoading(true);
    try {
      const headlines = news
        .map(item => item.title_pt || item.title || '')
        .filter(title => title.length > 0);

      if (headlines.length === 0) {
        setSentimentLoading(false);
        return;
      }

      const instrumentLabel = instrumentName || symbol || 'Mercado';

      const res = await fetch('/api/market/sentiment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instrument: instrumentLabel,
          headlines,
        }),
      });

      const json = await res.json();

      if (json.success && json.sentiment) {
        setSentiment(json.sentiment);
        onSentimentChange?.(json.sentiment);
      }
    } catch (err) {
      console.error('Failed to analyze sentiment:', err);
    } finally {
      setSentimentLoading(false);
    }
  }, [news, instrumentName, symbol, onSentimentChange]);

  // Auto-analyze sentiment when news loads (with debounce)
  useEffect(() => {
    if (news.length > 0 && !sentiment && !sentimentLoading) {
      // Small delay to avoid calling on every news refresh
      const timer = setTimeout(() => {
        analyzeSentiment();
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [news.length, sentiment, sentimentLoading, analyzeSentiment]);

  useEffect(() => {
    const abortController = new AbortController();
    fetchNews(abortController.signal);
    const interval = setInterval(() => fetchNews(abortController.signal), 120000);
    return () => {
      abortController.abort();
      clearInterval(interval);
    };
  }, [fetchNews]);

  // Reset sentiment when symbol changes
  useEffect(() => {
    setSentiment(null);
    onSentimentChange?.(null);
  }, [symbol, onSentimentChange]);

  // Filter news by sentiment
  const filteredNews = sentimentFilter === 'todos'
    ? news
    : news.filter(item => item.sentiment === sentimentFilter);

  // Sentiment counts
  const sentimentCounts = {
    positivo: news.filter(n => n.sentiment === 'positivo').length,
    negativo: news.filter(n => n.sentiment === 'negativo').length,
    neutro: news.filter(n => n.sentiment === 'neutro').length,
  };

  return (
    <Card className="border-border/40 bg-card/80 backdrop-blur-sm h-full">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <Newspaper className="w-4 h-4 text-cyan-400" />
            Notícias do Mercado
          </CardTitle>
          <button
            onClick={fetchNews}
            className="p-1 rounded-md text-muted-foreground hover:text-cyan-400 hover:bg-secondary/50 transition-colors disabled:opacity-50"
            disabled={loading}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
        {/* Sentiment indicator */}
        <SentimentIndicator
          sentiment={sentiment}
          analyzing={sentimentLoading}
          onAnalyze={analyzeSentiment}
          instrumentName={instrumentName}
        />
        {/* Sentiment filter tabs */}
        <div className="flex items-center gap-1 mt-2">
          <Filter className="w-3 h-3 text-muted-foreground mr-1" />
          {[
            { key: 'todos' as SentimentFilter, label: 'Todos', count: news.length },
            { key: 'positivo' as SentimentFilter, label: '🟢 Alta', count: sentimentCounts.positivo },
            { key: 'negativo' as SentimentFilter, label: '🔴 Baixa', count: sentimentCounts.negativo },
            { key: 'neutro' as SentimentFilter, label: '🟡 Neutro', count: sentimentCounts.neutro },
          ].map(filter => (
            <Button
              key={filter.key}
              variant="ghost"
              size="sm"
              className={`h-6 px-2 text-[9px] ${
                sentimentFilter === filter.key
                  ? 'bg-secondary/80 text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              onClick={() => setSentimentFilter(filter.key)}
            >
              {filter.label} ({filter.count})
            </Button>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[220px] sm:h-[280px]">
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5, 6].map(i => (
                <div key={i} className="space-y-1.5">
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-3/4" />
                  <Skeleton className="h-2 w-1/3" />
                </div>
              ))}
            </div>
          ) : filteredNews.length > 0 ? (
            <div className="space-y-2 pr-1">
              {filteredNews.map((item, index) => (
                <a
                  key={item.link || item.title || index}
                  href={item.link || '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block group"
                >
                  <div className={`p-2.5 rounded-lg hover:bg-secondary/30 transition-colors border border-transparent hover:border-border/30 ${
                    item.sentiment === 'positivo' ? 'hover:border-emerald-500/20' :
                    item.sentiment === 'negativo' ? 'hover:border-red-500/20' : ''
                  }`}>
                    <h4 className="text-xs font-medium leading-snug group-hover:text-cyan-400 transition-colors line-clamp-2 mb-1.5">
                      {item.title_pt || item.title || 'Sem título'}
                    </h4>
                    <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground flex-wrap">
                      {item.sentiment && (
                        <SentimentBadge sentiment={item.sentiment} />
                      )}
                      {item.publisher && (
                        <Badge variant="outline" className="text-[8px] py-0 px-1.5 border-border/30">
                          {item.publisher}
                        </Badge>
                      )}
                      <span className="flex items-center gap-0.5 ml-auto">
                        <Clock className="w-2.5 h-2.5" />
                        {formatNewsDate(item.publishTime)}
                      </span>
                      <ExternalLink className="w-2.5 h-2.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </div>
                </a>
              ))}
            </div>
          ) : (
            <div className="flex items-center justify-center h-32 text-muted-foreground">
              <div className="text-center">
                <Newspaper className="w-6 h-6 mx-auto mb-2 opacity-30" />
                <p className="text-xs">Nenhuma notícia disponível</p>
                {sentimentFilter !== 'todos' && (
                  <Button
                    variant="link"
                    className="text-[10px] text-cyan-400 p-0 h-auto mt-1"
                    onClick={() => setSentimentFilter('todos')}
                  >
                    Limpar filtro
                  </Button>
                )}
              </div>
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
