'use client';

import { useState, useCallback, useEffect, useRef, Fragment } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, RefreshCw, TrendingUp, TrendingDown, Minus,
  ArrowUpDown, ChevronUp, ChevronDown, Zap, Filter
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatPrice } from '@/components/dashboard/types';
import type { Instrument, MarketCategory } from '@/components/dashboard/types';

// ======================== TYPES ========================

interface ScannedPattern {
  instrumentSymbol: string;
  instrumentName: string;
  patternType: string;
  direction: 'bullish' | 'bearish' | 'neutral';
  confidence: number;
  priceLevel: number;
  description: string;
  category: string;
}

type SortField = 'instrument' | 'pattern' | 'direction' | 'confidence' | 'priceLevel';
type SortOrder = 'asc' | 'desc';

interface PatternScannerProps {
  instruments: Instrument[];
  category: MarketCategory;
  onAnalyzeInstrument: (instrument: Instrument) => void;
  allInstruments: Instrument[];
}

// ======================== PATTERN ICONS & COLORS ========================

const PATTERN_ICONS: Record<string, string> = {
  'Order Block': '🧱',
  'FVG': '📐',
  'BOS': '📈',
  'CHOCH': '🔄',
  'Doji': '✝️',
  'Hammer': '🔨',
  'Shooting Star': '⭐',
  'Engulfing': '🔄',
  'Morning Star': '🌅',
  'Evening Star': '🌆',
  '3 Soldiers': '🎖️',
  '3 Crows': '🐦',
  'Tweezer': '✌️',
  'RSI Oversold': '📉',
  'RSI Overbought': '📊',
};

function getPatternIcon(type: string): string {
  return PATTERN_ICONS[type] || '🔍';
}

function getDirectionIcon(direction: string): React.ReactNode {
  if (direction === 'bullish') return <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />;
  if (direction === 'bearish') return <TrendingDown className="w-3.5 h-3.5 text-red-400" />;
  return <Minus className="w-3.5 h-3.5 text-amber-400" />;
}

function getDirectionLabel(direction: string): string {
  if (direction === 'bullish') return 'Altista';
  if (direction === 'bearish') return 'Baixista';
  return 'Neutro';
}

function getDirectionColor(direction: string): string {
  if (direction === 'bullish') return 'text-emerald-400';
  if (direction === 'bearish') return 'text-red-400';
  return 'text-amber-400';
}

function getDirectionBg(direction: string): string {
  if (direction === 'bullish') return 'bg-emerald-500/10 border-emerald-500/20';
  if (direction === 'bearish') return 'bg-red-500/10 border-red-500/20';
  return 'bg-amber-500/10 border-amber-500/20';
}

function getConfidenceColor(confidence: number): string {
  if (confidence >= 75) return 'text-emerald-400';
  if (confidence >= 60) return 'text-cyan-400';
  if (confidence >= 45) return 'text-amber-400';
  return 'text-muted-foreground';
}

// ======================== MAIN COMPONENT ========================

export function PatternScanner({ instruments, category, onAnalyzeInstrument, allInstruments }: PatternScannerProps) {
  const [patterns, setPatterns] = useState<ScannedPattern[]>([]);
  const [scanning, setScanning] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [sortField, setSortField] = useState<SortField>('confidence');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [strategy, setStrategy] = useState<'smc' | 'price_action' | 'hybrid'>('hybrid');
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [scanScope, setScanScope] = useState<'category' | 'all_forex' | 'all'>('category');
  const [filterDirection, setFilterDirection] = useState<'all' | 'bullish' | 'bearish'>('all');
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const autoRefreshRef = useRef<NodeJS.Timeout | null>(null);

  // Get instruments to scan based on scope
  const getScanInstruments = useCallback((): Instrument[] => {
    switch (scanScope) {
      case 'category':
        return instruments;
      case 'all_forex': {
        const forex = allInstruments.filter(i => i.category === 'forex');
        return forex;
      }
      case 'all':
        return allInstruments;
      default:
        return instruments;
    }
  }, [scanScope, instruments, allInstruments]);

  // Run scan
  const runScan = useCallback(async () => {
    const scanInstruments = getScanInstruments();
    if (scanInstruments.length === 0) return;

    // Cancel previous scan
    if (abortRef.current) {
      abortRef.current.abort();
    }
    const controller = new AbortController();
    abortRef.current = controller;

    setScanning(true);
    setError(null);
    setProgress({ current: 0, total: scanInstruments.length });
    setPatterns([]);

    try {
      const symbols = scanInstruments.map(i => i.symbol);
      const res = await fetch('/api/ai/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          instruments: symbols,
          strategy,
        }),
      });

      if (controller.signal.aborted) return;

      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        throw new Error(errData?.error || `Erro HTTP ${res.status}`);
      }

      const json = await res.json();

      if (json.success && json.patterns) {
        setPatterns(json.patterns);
        setProgress({ current: scanInstruments.length, total: scanInstruments.length });
      } else if (json.error) {
        setError(json.error);
      }
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      setError('Erro ao conectar com o scanner. Tente novamente.');
      console.error('Pattern scan failed:', err);
    } finally {
      if (abortRef.current === controller) {
        setScanning(false);
        abortRef.current = null;
      }
    }
  }, [getScanInstruments, strategy]);

  // Auto-refresh every 5 minutes
  useEffect(() => {
    if (autoRefreshRef.current) {
      clearInterval(autoRefreshRef.current);
      autoRefreshRef.current = null;
    }

    if (autoRefresh) {
      autoRefreshRef.current = setInterval(runScan, 5 * 60 * 1000);
    }

    return () => {
      if (autoRefreshRef.current) {
        clearInterval(autoRefreshRef.current);
      }
    };
  }, [autoRefresh, runScan]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortRef.current) abortRef.current.abort();
    };
  }, []);

  // Simulate progress during scanning
  useEffect(() => {
    if (!scanning) return;
    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev.current >= prev.total) return prev;
        return { ...prev, current: Math.min(prev.current + 1, prev.total) };
      });
    }, 800);
    return () => clearInterval(interval);
  }, [scanning]);

  // Sort patterns
  const sortedPatterns = [...patterns].sort((a, b) => {
    let comparison = 0;
    switch (sortField) {
      case 'instrument':
        comparison = a.instrumentName.localeCompare(b.instrumentName);
        break;
      case 'pattern':
        comparison = a.patternType.localeCompare(b.patternType);
        break;
      case 'direction':
        comparison = a.direction.localeCompare(b.direction);
        break;
      case 'confidence':
        comparison = a.confidence - b.confidence;
        break;
      case 'priceLevel':
        comparison = a.priceLevel - b.priceLevel;
        break;
    }
    return sortOrder === 'asc' ? comparison : -comparison;
  });

  // Filter patterns
  const filteredPatterns = filterDirection === 'all'
    ? sortedPatterns
    : sortedPatterns.filter(p => p.direction === filterDirection);

  // Handle sort
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder(field === 'confidence' ? 'desc' : 'asc');
    }
  };

  // Handle click to analyze
  const handlePatternClick = (pattern: ScannedPattern) => {
    const instrument = allInstruments.find(i => i.symbol === pattern.instrumentSymbol);
    if (instrument) {
      onAnalyzeInstrument(instrument);
    }
  };

  // Sort indicator
  const SortIndicator = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="w-3 h-3 text-muted-foreground/40" />;
    return sortOrder === 'asc'
      ? <ChevronUp className="w-3 h-3 text-cyan-400" />
      : <ChevronDown className="w-3 h-3 text-cyan-400" />;
  };

  const bullishCount = patterns.filter(p => p.direction === 'bullish').length;
  const bearishCount = patterns.filter(p => p.direction === 'bearish').length;

  return (
    <div className="space-y-4">
      {/* Header: Scan button + Strategy + Scope */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Scan Button */}
          <Button
            onClick={runScan}
            disabled={scanning}
            className="bg-gradient-to-r from-cyan-500 to-violet-500 hover:from-cyan-600 hover:to-violet-600 text-white text-xs h-8 px-3 gap-1.5 shadow-lg shadow-cyan-500/20"
          >
            {scanning ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                Escaneando {progress.current}/{progress.total}...
              </>
            ) : (
              <>
                <Search className="w-3.5 h-3.5" />
                Escanear Padrões
              </>
            )}
          </Button>

          {/* Strategy selector */}
          <div className="flex items-center gap-1 bg-secondary/30 rounded-md border border-border/30 p-0.5">
            {(['smc', 'price_action', 'hybrid'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setStrategy(s)}
                className={`px-2 py-1 rounded text-[10px] font-medium transition-all ${
                  strategy === s
                    ? s === 'smc'
                      ? 'bg-violet-500/20 text-violet-400 border border-violet-500/30'
                      : s === 'price_action'
                      ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                      : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {s === 'smc' ? '🏦 SMC' : s === 'price_action' ? '📈 PA' : '⚡ Híbrido'}
              </button>
            ))}
          </div>

          {/* Scope selector */}
          <div className="flex items-center gap-1 bg-secondary/30 rounded-md border border-border/30 p-0.5">
            {([
              { value: 'category', label: 'Categoria' },
              { value: 'all_forex', label: '💱 Forex' },
              { value: 'all', label: '🌍 Todos' },
            ] as const).map((opt) => (
              <button
                key={opt.value}
                onClick={() => setScanScope(opt.value)}
                className={`px-2 py-1 rounded text-[10px] font-medium transition-all ${
                  scanScope === opt.value
                    ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Auto-refresh toggle */}
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium border transition-all ${
              autoRefresh
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                : 'bg-secondary/30 border-border/30 text-muted-foreground hover:text-foreground'
            }`}
            title={autoRefresh ? 'Auto-refresh ativo (5 min)' : 'Ativar auto-refresh (5 min)'}
          >
            <RefreshCw className={`w-3 h-3 ${autoRefresh ? 'animate-spin' : ''}`} style={{ animationDuration: autoRefresh ? '3s' : undefined }} />
            Auto
          </button>
        </div>

        {/* Progress bar */}
        {scanning && (
          <div className="relative h-1.5 bg-secondary/30 rounded-full overflow-hidden">
            <motion.div
              className="absolute inset-y-0 left-0 bg-gradient-to-r from-cyan-500 to-violet-500 rounded-full"
              initial={{ width: '0%' }}
              animate={{ width: `${(progress.current / progress.total) * 100}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
        )}
      </div>

      {/* Results Summary */}
      {patterns.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="outline" className="border-cyan-500/30 text-cyan-400 text-[9px] px-1.5">
            <Search className="w-2.5 h-2.5 mr-0.5" />
            {patterns.length} padrões encontrados
          </Badge>
          {bullishCount > 0 && (
            <Badge variant="outline" className="border-emerald-500/30 text-emerald-400 text-[9px] px-1.5">
              <TrendingUp className="w-2.5 h-2.5 mr-0.5" />
              {bullishCount} altistas
            </Badge>
          )}
          {bearishCount > 0 && (
            <Badge variant="outline" className="border-red-500/30 text-red-400 text-[9px] px-1.5">
              <TrendingDown className="w-2.5 h-2.5 mr-0.5" />
              {bearishCount} baixistas
            </Badge>
          )}

          {/* Direction filter */}
          <div className="flex items-center gap-1 ml-auto">
            <Filter className="w-3 h-3 text-muted-foreground" />
            {(['all', 'bullish', 'bearish'] as const).map((dir) => (
              <button
                key={dir}
                onClick={() => setFilterDirection(dir)}
                className={`px-1.5 py-0.5 rounded text-[9px] font-medium transition-all ${
                  filterDirection === dir
                    ? dir === 'bullish'
                      ? 'bg-emerald-500/20 text-emerald-400'
                      : dir === 'bearish'
                      ? 'bg-red-500/20 text-red-400'
                      : 'bg-cyan-500/20 text-cyan-400'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {dir === 'all' ? 'Todos' : dir === 'bullish' ? 'Altista' : 'Baixista'}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-center">
          <p className="text-xs text-red-400">{error}</p>
          <button
            onClick={runScan}
            className="mt-2 text-[10px] text-red-300 hover:text-red-200 underline"
          >
            Tentar novamente
          </button>
        </div>
      )}

      {/* Empty state */}
      {!scanning && !error && patterns.length === 0 && (
        <div className="text-center py-8">
          <Search className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">
            Clique em &quot;Escanear Padrões&quot; para detectar padrões SMC e Price Action
          </p>
          <p className="text-[10px] text-muted-foreground/60 mt-1">
            Grátis · Sem consumo de créditos · Resultados em cache por 5 min
          </p>
        </div>
      )}

      {/* Results Table */}
      {filteredPatterns.length > 0 && (
        <div className="border border-border/30 rounded-lg overflow-hidden">
          {/* Table Header — hidden on mobile */}
          <div className="hidden md:grid grid-cols-[1fr_100px_80px_70px_90px] gap-2 bg-secondary/20 px-3 py-2 text-[9px] font-semibold text-muted-foreground uppercase tracking-wide">
            <button onClick={() => handleSort('instrument')} className="flex items-center gap-1 text-left hover:text-foreground transition-colors">
              Instrumento <SortIndicator field="instrument" />
            </button>
            <button onClick={() => handleSort('pattern')} className="flex items-center gap-1 text-left hover:text-foreground transition-colors">
              Padrão <SortIndicator field="pattern" />
            </button>
            <button onClick={() => handleSort('direction')} className="flex items-center gap-1 text-left hover:text-foreground transition-colors">
              Direção <SortIndicator field="direction" />
            </button>
            <button onClick={() => handleSort('confidence')} className="flex items-center gap-1 text-left hover:text-foreground transition-colors">
              Confiança <SortIndicator field="confidence" />
            </button>
            <button onClick={() => handleSort('priceLevel')} className="flex items-center gap-1 text-right hover:text-foreground transition-colors">
              Nível <SortIndicator field="priceLevel" />
            </button>
          </div>

          {/* Table Body */}
          <div className="max-h-80 overflow-y-auto custom-scrollbar divide-y divide-border/15">
            <AnimatePresence>
              {filteredPatterns.map((pattern, idx) => (
                <Fragment key={`${pattern.instrumentSymbol}-${pattern.patternType}-${idx}`}>
                <motion.button
                  key={`${pattern.instrumentSymbol}-${pattern.patternType}-${idx}-desktop`}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2, delay: Math.min(idx * 0.03, 0.3) }}
                  onClick={() => handlePatternClick(pattern)}
                  className={`grid grid-cols-[1fr_100px_80px_70px_90px] gap-2 px-3 py-2.5 text-xs transition-all hover:bg-secondary/30 w-full text-left hidden md:grid ${
                    pattern.direction === 'bullish'
                      ? 'hover:border-l-2 hover:border-l-emerald-500/50'
                      : pattern.direction === 'bearish'
                      ? 'hover:border-l-2 hover:border-l-red-500/50'
                      : 'hover:border-l-2 hover:border-l-amber-500/50'
                  }`}
                  title={`Clique para analisar ${pattern.instrumentName} com IA`}
                >
                  {/* Instrument */}
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="font-medium text-foreground truncate">
                      {pattern.instrumentName}
                    </span>
                    <span className="text-[9px] text-muted-foreground/60 shrink-0">
                      {pattern.instrumentSymbol.replace('=X', '').replace('-USD', '')}
                    </span>
                  </div>

                  {/* Pattern */}
                  <div className="flex items-center gap-1">
                    <span className="text-sm">{getPatternIcon(pattern.patternType)}</span>
                    <span className="text-[10px] font-medium text-foreground truncate">
                      {pattern.patternType}
                    </span>
                  </div>

                  {/* Direction */}
                  <div className="flex items-center gap-1">
                    {getDirectionIcon(pattern.direction)}
                    <span className={`text-[10px] font-medium ${getDirectionColor(pattern.direction)}`}>
                      {getDirectionLabel(pattern.direction)}
                    </span>
                  </div>

                  {/* Confidence */}
                  <div className="flex items-center">
                    <div className="flex items-center gap-1">
                      <div className="w-8 h-1.5 bg-secondary/40 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            pattern.confidence >= 75
                              ? 'bg-emerald-400'
                              : pattern.confidence >= 60
                              ? 'bg-cyan-400'
                              : pattern.confidence >= 45
                              ? 'bg-amber-400'
                              : 'bg-muted-foreground/40'
                          }`}
                          style={{ width: `${pattern.confidence}%` }}
                        />
                      </div>
                      <span className={`text-[10px] font-semibold ${getConfidenceColor(pattern.confidence)}`}>
                        {pattern.confidence}%
                      </span>
                    </div>
                  </div>

                  {/* Price Level */}
                  <div className="text-right">
                    <span className="text-[10px] font-mono text-muted-foreground">
                      {formatPrice(pattern.priceLevel, pattern.instrumentSymbol)}
                    </span>
                  </div>
                </motion.button>

                {/* Mobile card layout */}
                <motion.button
                  key={`${pattern.instrumentSymbol}-${pattern.patternType}-${idx}-mobile`}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2, delay: Math.min(idx * 0.03, 0.3) }}
                  onClick={() => handlePatternClick(pattern)}
                  className={`flex md:hidden px-3 py-2.5 text-xs transition-all hover:bg-secondary/30 w-full text-left border-l-2 ${
                    pattern.direction === 'bullish'
                      ? 'border-l-emerald-500/50'
                      : pattern.direction === 'bearish'
                      ? 'border-l-red-500/50'
                      : 'border-l-amber-500/50'
                  }`}
                  title={`Clique para analisar ${pattern.instrumentName} com IA`}
                >
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-foreground truncate">{pattern.instrumentName}</span>
                      <span className="text-sm">{getPatternIcon(pattern.patternType)}</span>
                      <span className="text-[10px] font-medium text-foreground truncate">{pattern.patternType}</span>
                    </div>
                    <div className="flex items-center gap-3 text-[10px]">
                      <span className="flex items-center gap-1">
                        {getDirectionIcon(pattern.direction)}
                        <span className={getDirectionColor(pattern.direction)}>{getDirectionLabel(pattern.direction)}</span>
                      </span>
                      <span className={`font-semibold ${getConfidenceColor(pattern.confidence)}`}>{pattern.confidence}%</span>
                      <span className="font-mono text-muted-foreground">{formatPrice(pattern.priceLevel, pattern.instrumentSymbol)}</span>
                    </div>
                  </div>
                </motion.button>
                </Fragment>
              ))}
            </AnimatePresence>
          </div>
        </div>
      )}

      {/* No filtered results */}
      {!scanning && patterns.length > 0 && filteredPatterns.length === 0 && (
        <div className="text-center py-6">
          <p className="text-xs text-muted-foreground">
            Nenhum padrão {filterDirection === 'bullish' ? 'altista' : 'baixista'} encontrado.
          </p>
          <button
            onClick={() => setFilterDirection('all')}
            className="mt-1 text-[10px] text-cyan-400 hover:text-cyan-300 underline"
          >
            Mostrar todos
          </button>
        </div>
      )}

      {/* Pattern description on hover hint */}
      {filteredPatterns.length > 0 && (
        <div className="flex items-center justify-between">
          <p className="text-[9px] text-muted-foreground/60">
            💡 Clique em qualquer padrão para análise completa com IA (consome 5 créditos)
          </p>
          <p className="text-[9px] text-muted-foreground/40">
            {getScanInstruments().length} instrumentos · {strategy === 'smc' ? 'SMC' : strategy === 'price_action' ? 'Price Action' : 'Híbrido'}
          </p>
        </div>
      )}
    </div>
  );
}
