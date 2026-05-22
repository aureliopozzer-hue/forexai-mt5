'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, TrendingUp, TrendingDown, Zap, ChevronRight, RefreshCw, X
} from 'lucide-react';
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

interface PatternScannerHeaderProps {
  instruments: Instrument[];
  category: MarketCategory;
  onAnalyzeInstrument: (instrument: Instrument) => void;
  allInstruments: Instrument[];
}

// ======================== PATTERN ICONS ========================

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

// ======================== MAIN COMPONENT ========================

export function PatternScannerHeader({ instruments, category, onAnalyzeInstrument, allInstruments }: PatternScannerHeaderProps) {
  const [patterns, setPatterns] = useState<ScannedPattern[]>([]);
  const [scanning, setScanning] = useState(false);
  const [hasScanned, setHasScanned] = useState(false);
  const [isExpanded, setIsExpanded] = useState(true);
  const abortRef = useRef<AbortController | null>(null);
  const autoRefreshRef = useRef<NodeJS.Timeout | null>(null);
  const hasInitRef = useRef(false);

  // Auto-scan on mount
  const runScan = useCallback(async () => {
    const scanInstruments = allInstruments;
    if (scanInstruments.length === 0) return;

    if (abortRef.current) {
      abortRef.current.abort();
    }
    const controller = new AbortController();
    abortRef.current = controller;

    setScanning(true);

    try {
      const symbols = scanInstruments.map(i => i.symbol);
      const res = await fetch('/api/ai/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          instruments: symbols,
          strategy: 'hybrid',
        }),
      });

      if (controller.signal.aborted) return;

      const json = await res.json();

      if (json.success && json.patterns) {
        // Filter for high-confidence bullish patterns only (best opportunities for beginners)
        const topPatterns = json.patterns
          .filter((p: ScannedPattern) => p.confidence >= 55 && p.direction !== 'neutral')
          .sort((a: ScannedPattern, b: ScannedPattern) => b.confidence - a.confidence)
          .slice(0, 8);
        setPatterns(topPatterns);
        setHasScanned(true);
      }
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      console.error('Header pattern scan failed:', err);
    } finally {
      if (abortRef.current === controller) {
        setScanning(false);
        abortRef.current = null;
      }
    }
  }, [allInstruments]);

  // Auto-scan on mount and refresh every 5 minutes
  useEffect(() => {
    if (hasInitRef.current) return;
    hasInitRef.current = true;
    // Delay initial scan slightly to let quotes load first
    const initTimer = setTimeout(() => {
      runScan();
    }, 3000);

    // Auto-refresh every 5 minutes
    autoRefreshRef.current = setInterval(runScan, 5 * 60 * 1000);

    return () => {
      clearTimeout(initTimer);
      if (autoRefreshRef.current) clearInterval(autoRefreshRef.current);
      if (abortRef.current) abortRef.current.abort();
    };
  }, [runScan]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortRef.current) abortRef.current.abort();
    };
  }, []);

  // Handle click to analyze
  const handlePatternClick = (pattern: ScannedPattern) => {
    const instrument = allInstruments.find(i => i.symbol === pattern.instrumentSymbol);
    if (instrument) {
      onAnalyzeInstrument(instrument);
    }
  };

  const bullishPatterns = patterns.filter(p => p.direction === 'bullish');
  const bearishPatterns = patterns.filter(p => p.direction === 'bearish');

  // Don't render until we have patterns or scanning
  if (!scanning && patterns.length === 0 && !hasScanned) return null;

  return (
    <div className="border-b border-border/30 bg-gradient-to-r from-card/60 via-card/40 to-card/60 backdrop-blur-sm">
      <div className="max-w-[1800px] mx-auto px-4 py-2">
        <div className="flex items-center gap-2">
          {/* Scanner Label */}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-1.5 shrink-0 group"
          >
            <div className="relative">
              <Zap className={`w-4 h-4 ${scanning ? 'text-cyan-400 animate-pulse' : 'text-violet-400'}`} />
              {/* Blinking dot */}
              {!scanning && patterns.length > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-emerald-400 rounded-full animate-ping" />
              )}
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-violet-400 group-hover:text-violet-300 transition-colors">
              Scanner
            </span>
            <span className="text-[9px] text-muted-foreground hidden sm:inline">
              {patterns.length > 0 ? `${patterns.length} padrões` : scanning ? 'buscando...' : ''}
            </span>
          </button>

          {/* Refresh button */}
          <button
            onClick={runScan}
            disabled={scanning}
            className="shrink-0 p-1 rounded-md hover:bg-secondary/50 transition-colors"
            title="Atualizar scanner"
          >
            <RefreshCw className={`w-3 h-3 text-muted-foreground ${scanning ? 'animate-spin' : 'hover:text-cyan-400'}`} />
          </button>

          {/* Divider */}
          <div className="w-px h-5 bg-border/30 shrink-0" />

          {/* Pattern Buttons - Scrolling area */}
          <AnimatePresence>
            {isExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="flex-1 overflow-hidden"
              >
                <div className="flex items-center gap-2 overflow-x-auto pb-0.5 custom-scrollbar-x">
                  {scanning && patterns.length === 0 && (
                    <div className="flex items-center gap-2 px-3 py-1.5">
                      <div className="flex items-center gap-1">
                        <div className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                        <div className="w-1.5 h-1.5 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                        <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                      <span className="text-[10px] text-muted-foreground">Escaneando padrões...</span>
                    </div>
                  )}

                  {/* Bullish Section */}
                  {bullishPatterns.length > 0 && (
                    <>
                      <span className="text-[9px] font-bold text-emerald-400 uppercase tracking-wider shrink-0 flex items-center gap-0.5">
                        <TrendingUp className="w-3 h-3" /> Compra
                      </span>
                      {bullishPatterns.map((pattern, idx) => (
                        <PatternButton
                          key={`bull-${pattern.instrumentSymbol}-${idx}`}
                          pattern={pattern}
                          onClick={() => handlePatternClick(pattern)}
                          delay={idx * 100}
                        />
                      ))}
                    </>
                  )}

                  {/* Bearish Section */}
                  {bearishPatterns.length > 0 && (
                    <>
                      {bullishPatterns.length > 0 && (
                        <div className="w-px h-6 bg-border/30 shrink-0" />
                      )}
                      <span className="text-[9px] font-bold text-red-400 uppercase tracking-wider shrink-0 flex items-center gap-0.5">
                        <TrendingDown className="w-3 h-3" /> Venda
                      </span>
                      {bearishPatterns.map((pattern, idx) => (
                        <PatternButton
                          key={`bear-${pattern.instrumentSymbol}-${idx}`}
                          pattern={pattern}
                          onClick={() => handlePatternClick(pattern)}
                          delay={(bullishPatterns.length + idx) * 100}
                        />
                      ))}
                    </>
                  )}

                  {patterns.length === 0 && !scanning && hasScanned && (
                    <span className="text-[10px] text-muted-foreground/60">Nenhum padrão forte detectado</span>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Collapse/expand button */}
          {patterns.length > 0 && (
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="shrink-0 p-1 rounded-md hover:bg-secondary/50 transition-colors"
              title={isExpanded ? 'Ocultar' : 'Mostrar'}
            >
              <X className={`w-3 h-3 text-muted-foreground ${!isExpanded ? 'hidden' : ''}`} />
              {!isExpanded && (
                <span className="flex items-center gap-1 text-[9px] text-muted-foreground">
                  <ChevronRight className="w-3 h-3" />
                  {patterns.length}
                </span>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ======================== PATTERN BUTTON (BLINKING) ========================

interface PatternButtonProps {
  pattern: ScannedPattern;
  onClick: () => void;
  delay: number;
}

function PatternButton({ pattern, onClick, delay }: PatternButtonProps) {
  const isBullish = pattern.direction === 'bullish';
  const isHighConfidence = pattern.confidence >= 70;

  // Get instrument short name
  const shortName = pattern.instrumentName.length > 12
    ? pattern.instrumentName.substring(0, 12) + '…'
    : pattern.instrumentName;

  const symbolClean = pattern.instrumentSymbol.replace('=X', '').replace('-USD', '');

  return (
    <motion.button
      initial={{ opacity: 0, scale: 0.8, x: 20 }}
      animate={{ opacity: 1, scale: 1, x: 0 }}
      transition={{ duration: 0.4, delay: Math.min(delay / 1000, 0.8), ease: 'easeOut' }}
      onClick={onClick}
      className={`
        relative shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg 
        border transition-all duration-200 cursor-pointer group
        ${isBullish
          ? 'bg-emerald-500/8 border-emerald-500/25 hover:bg-emerald-500/15 hover:border-emerald-500/40 hover:shadow-lg hover:shadow-emerald-500/10'
          : 'bg-red-500/8 border-red-500/25 hover:bg-red-500/15 hover:border-red-500/40 hover:shadow-lg hover:shadow-red-500/10'
        }
        ${isHighConfidence ? 'animate-subtle-pulse' : ''}
      `}
      title={`${pattern.description}\nClique para análise completa com IA`}
    >
      {/* Blinking indicator for high confidence */}
      {isHighConfidence && (
        <span className={`absolute -top-1 -right-1 w-2 h-2 rounded-full animate-ping ${
          isBullish ? 'bg-emerald-400' : 'bg-red-400'
        }`} />
      )}

      {/* Glow effect for high confidence */}
      {isHighConfidence && (
        <span className={`absolute inset-0 rounded-lg animate-glow-pulse ${
          isBullish ? 'shadow-[0_0_8px_rgba(16,185,129,0.3)]' : 'shadow-[0_0_8px_rgba(239,68,68,0.3)]'
        }`} />
      )}

      {/* Pattern emoji */}
      <span className="text-xs">{getPatternIcon(pattern.patternType)}</span>

      {/* Instrument info */}
      <div className="flex flex-col items-start leading-tight">
        <span className="text-[10px] font-bold text-foreground group-hover:text-white transition-colors">
          {shortName}
        </span>
        <span className="text-[8px] text-muted-foreground">
          {symbolClean}
        </span>
      </div>

      {/* Direction + Confidence badge */}
      <div className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[9px] font-bold ${
        isBullish
          ? 'bg-emerald-500/15 text-emerald-400'
          : 'bg-red-500/15 text-red-400'
      }`}>
        {isBullish ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
        {pattern.confidence}%
      </div>

      {/* Pattern type */}
      <span className="text-[8px] text-muted-foreground/70 hidden lg:inline">
        {pattern.patternType}
      </span>
    </motion.button>
  );
}
