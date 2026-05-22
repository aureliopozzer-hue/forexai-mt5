'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Brain, Zap, RefreshCw, Target, Activity, Shield,
  ArrowUpRight, ArrowDownRight, Minus, AlertTriangle,
  TrendingUp, TrendingDown, Crosshair, DollarSign,
  Trophy, CheckCircle2, XCircle, Layers,
  GitCompare, History, Clock, Star, ChevronDown, ChevronUp,
  Volume2, VolumeX, Loader2, Copy, Share2, Image as ImageIcon
} from 'lucide-react';
import { toast } from 'sonner';
import { Instrument, AIAnalysis, QuoteData, getVal, formatPrice, AnalysisStrategy, STRATEGY_META, AnalysisHistoryItem } from './types';
import { SignalServiceCard } from './signal-service-card';

interface SentimentData {
  sentiment: 'bullish' | 'bearish' | 'neutral';
  confidence: number;
  summary: string;
  keyFactors: string[];
  source: 'llm' | 'keyword';
}

interface AIAnalysisPanelProps {
  instrument: Instrument | null;
  analysis: AIAnalysis | null;
  analyzing: boolean;
  quote: QuoteData | undefined;
  onAnalyze: (instrument: Instrument, strategy: AnalysisStrategy) => void;
  error: string | null;
  strategy: AnalysisStrategy;
  onStrategyChange: (strategy: AnalysisStrategy) => void;
  comparisonResults: Record<AnalysisStrategy, AIAnalysis | null>;
  comparing: boolean;
  onCompareAll: (instrument: Instrument) => void;
  analysisHistory: AnalysisHistoryItem[];
  onLoadHistory: (item: AnalysisHistoryItem) => void;
  viewMode: 'single' | 'comparison';
  onViewModeChange: (mode: 'single' | 'comparison') => void;
  riskRewardRatio: number;
  onRiskRewardChange: (ratio: number) => void;
  riskMode: 'conservative' | 'aggressive';
  onRiskModeChange: (mode: 'conservative' | 'aggressive') => void;
  sentiment?: SentimentData | null;
}

function ProbabilityGauge({ value, size = 140, label = 'Prob. Entrada' }: { value: number; size?: number; label?: string }) {
  const radius = (size - 20) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;

  const getColor = (val: number) => {
    if (val >= 70) return '#10b981';
    if (val >= 50) return '#22d3ee';
    if (val >= 35) return '#f59e0b';
    return '#ef4444';
  };

  const getLabel = (val: number) => {
    if (val >= 70) return 'Alta';
    if (val >= 50) return 'Boa';
    if (val >= 35) return 'Média';
    return 'Baixa';
  };

  const color = getColor(value);

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#1e293b" strokeWidth="10" />
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#1e293b" strokeWidth="10"
          strokeDasharray={`${circumference * 0.35} ${circumference * 0.65}`} opacity={0.3} />
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={color} strokeWidth="10"
          strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round"
          className="gauge-animate" style={{ filter: `drop-shadow(0 0 8px ${color}50)` }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-bold tabular-nums" style={{ color }}>{value}%</span>
        <span className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">{label}</span>
        <Badge className="mt-1 text-[9px] px-1.5 py-0"
          style={{ backgroundColor: `${color}20`, color, borderColor: `${color}40` }}>
          {getLabel(value)}
        </Badge>
      </div>
    </div>
  );
}

function SuccessProbabilityRing({ value }: { value: number }) {
  const size = 110;
  const strokeWidth = 8;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;

  const getColor = (val: number) => {
    if (val >= 75) return '#10b981';
    if (val >= 60) return '#22d3ee';
    if (val >= 45) return '#f59e0b';
    return '#ef4444';
  };

  const getVerdict = (val: number) => {
    if (val >= 75) return 'Operação Favorável';
    if (val >= 60) return 'Boa Oportunidade';
    if (val >= 45) return 'Cautela Recomendada';
    return 'Alto Risco';
  };

  const color = getColor(value);

  return (
    <div className="bg-gradient-to-br from-violet-500/5 via-cyan-500/5 to-emerald-500/5 rounded-xl p-4 border border-violet-500/15">
      <div className="flex items-center gap-1.5 mb-3">
        <Trophy className="w-4 h-4 text-amber-400" />
        <span className="text-xs font-bold uppercase tracking-wider">Probabilidade de Acerto</span>
      </div>
      <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
        <div className="relative" style={{ width: size, height: size }}>
          <svg width={size} height={size} className="-rotate-90">
            <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#1e293b" strokeWidth={strokeWidth} />
            <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={color} strokeWidth={strokeWidth}
              strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round"
              className="gauge-animate" style={{ filter: `drop-shadow(0 0 10px ${color}60)` }} />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-black tabular-nums" style={{ color }}>{value}%</span>
            <span className="text-[9px] text-muted-foreground uppercase">Acerto</span>
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-1.5">
            <span className="text-lg">{value >= 75 ? '🟢' : value >= 60 ? '🔵' : value >= 45 ? '🟡' : '🔴'}</span>
            <div>
              <p className="text-xs font-bold" style={{ color }}>{getVerdict(value)}</p>
              <p className="text-[9px] text-muted-foreground">da operação</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {value >= 60 ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <XCircle className="w-4 h-4 text-red-400" />}
            <span className="text-[10px] text-muted-foreground">
              {value >= 60 ? 'Risk/Reward favorável' : 'Risk/Reward desfavorável'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// Comparison Table Component
function ComparisonTable({ results, instrumentSymbol }: { results: Record<AnalysisStrategy, AIAnalysis | null>; instrumentSymbol: string }) {
  const strategies: AnalysisStrategy[] = ['smc', 'price_action', 'hybrid'];

  // Find best success probability
  let bestProb = 0;
  let bestStrategy: AnalysisStrategy | null = null;
  for (const s of strategies) {
    if (results[s] && (results[s]?.successProbability || 0) > bestProb) {
      bestProb = results[s]?.successProbability || 0;
      bestStrategy = s;
    }
  }

  const getDirectionLabel = (dir: string) => {
    if (dir === 'BUY') return 'COMPRA';
    if (dir === 'SELL') return 'VENDA';
    return 'ESPERAR';
  };

  const getDirectionColor = (dir: string) => {
    if (dir === 'BUY') return 'text-emerald-400';
    if (dir === 'SELL') return 'text-red-400';
    return 'text-amber-400';
  };

  const getKeyConcept = (a: AIAnalysis): string => {
    if (a.strategy === 'smc' && a.smcConcepts) {
      return `${a.smcConcepts.orderBlock?.substring(0, 15) || 'OB'}`;
    }
    if (a.strategy === 'price_action' && a.priceActionPatterns && a.priceActionPatterns.length > 0) {
      return a.priceActionPatterns[0]?.substring(0, 15) || 'Pattern';
    }
    if (a.strategy === 'hybrid') {
      const parts: string[] = [];
      if (a.smcConcepts) parts.push(a.smcConcepts.orderBlock?.substring(0, 8) || 'OB');
      if (a.priceActionPatterns && a.priceActionPatterns.length > 0) parts.push(a.priceActionPatterns[0]?.substring(0, 8) || 'PA');
      return parts.join('+') || 'Híbrido';
    }
    return '—';
  };

  const getEntry = (a: AIAnalysis): string => {
    return a.direction === 'BUY' ? formatPrice(a.tradePoints.buyPoint, instrumentSymbol) :
           a.direction === 'SELL' ? formatPrice(a.tradePoints.sellPoint, instrumentSymbol) : '—';
  };

  const getStop = (a: AIAnalysis): string => {
    return a.direction === 'BUY' ? formatPrice(a.tradePoints.stopLossBuy, instrumentSymbol) :
           a.direction === 'SELL' ? formatPrice(a.tradePoints.stopLossSell, instrumentSymbol) : '—';
  };

  const getGain = (a: AIAnalysis): string => {
    return a.direction === 'BUY' ? formatPrice(a.tradePoints.takeProfitBuy, instrumentSymbol) :
           a.direction === 'SELL' ? formatPrice(a.tradePoints.takeProfitSell, instrumentSymbol) : '—';
  };

  const rows = [
    { label: 'Direção', get: (a: AIAnalysis) => getDirectionLabel(a.direction), isText: true, colorFn: (a: AIAnalysis) => getDirectionColor(a.direction) },
    { label: 'Confiança', get: (a: AIAnalysis) => `${a.confidence}%`, isText: false },
    { label: 'Entrada', get: (a: AIAnalysis) => getEntry(a), isText: false },
    { label: 'Stop', get: (a: AIAnalysis) => getStop(a), isText: false },
    { label: 'Gain', get: (a: AIAnalysis) => getGain(a), isText: false },
    { label: 'R:R', get: (a: AIAnalysis) => a.riskReward.ratio, isText: false },
    { label: 'Prob.Acerto', get: (a: AIAnalysis) => `${a.successProbability}%`, isText: false },
    { label: 'Conceito', get: (a: AIAnalysis) => getKeyConcept(a), isText: true },
  ];

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[10px]">
        <thead>
          <tr className="border-b border-border/30">
            <th className="text-left py-2 px-2 text-muted-foreground font-semibold w-24"></th>
            {strategies.map(s => {
              const meta = STRATEGY_META[s];
              const isBest = s === bestStrategy;
              return (
                <th key={s} className={`text-center py-2 px-1.5 font-bold ${isBest ? 'text-amber-400' : ''}`}>
                  <div className="flex flex-col items-center gap-0.5">
                    <span className="text-sm">{meta.emoji}</span>
                    <span>{meta.label}</span>
                    {isBest && <Star className="w-3 h-3 text-amber-400" />}
                  </div>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className={`${i < rows.length - 1 ? 'border-b border-border/20' : ''} ${row.label === 'Prob.Acerto' ? 'bg-amber-500/5' : ''}`}>
              <td className="py-1.5 px-2 text-muted-foreground font-medium">{row.label}</td>
              {strategies.map(s => {
                const a = results[s];
                if (!a) return <td key={s} className="text-center py-1.5 px-1.5 text-muted-foreground/40">—</td>;
                const value = row.get(a);
                const isBestCell = row.label === 'Prob.Acerto' && s === bestStrategy;
                return (
                  <td key={s} className={`text-center py-1.5 px-1.5 font-mono font-semibold ${isBestCell ? 'text-amber-400' : row.colorFn ? row.colorFn(a) : ''}`}>
                    {value}
                    {isBestCell && ' ★'}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Helper: expand price numbers for natural speech in Portuguese
function expandNumberForSpeech(numStr: string): string {
  const cleaned = numStr.replace(/[^0-9.,\-]/g, '');
  const parts = cleaned.split(',');
  if (parts.length === 2) {
    const integerPart = parts[0].replace(/\./g, '');
    const decimalPart = parts[1];
    if (integerPart && decimalPart) {
      return `${integerPart} vírgula ${decimalPart}`;
    }
  }
  return cleaned.replace(/\./g, ' ');
}

// Build a natural Brazilian Portuguese narration text from the analysis data
function buildNarrationText(analysis: AIAnalysis, instrument: Instrument | null): string {
  const name = instrument?.name || 'ativo';
  const strategy = STRATEGY_META[analysis.strategy]?.label || 'Híbrida';
  const bias = analysis.bias === 'bullish' ? 'altista' : analysis.bias === 'bearish' ? 'baixista' : 'neutro';
  const confidence = analysis.confidence;
  const entryProb = analysis.entryProbability;
  const successProb = analysis.successProbability;
  const rr = analysis.riskReward.ratio;

  const parts: string[] = [];
  parts.push(`Análise ${strategy} para ${name}.`);
  parts.push(`A tendência atual é ${bias}, com ${confidence}% de confiança.`);
  parts.push(`Probabilidade de entrada: ${entryProb}%.`);
  parts.push(`Probabilidade de acerto da operação: ${successProb}%.`);

  if (analysis.direction !== 'WAIT') {
    const symbol = instrument?.symbol || '';
    const isBuy = analysis.direction === 'BUY';
    const entry = isBuy
      ? formatPrice(analysis.tradePoints.buyPoint, symbol)
      : formatPrice(analysis.tradePoints.sellPoint, symbol);
    const stop = isBuy
      ? formatPrice(analysis.tradePoints.stopLossBuy, symbol)
      : formatPrice(analysis.tradePoints.stopLossSell, symbol);
    const gain = isBuy
      ? formatPrice(analysis.tradePoints.takeProfitBuy, symbol)
      : formatPrice(analysis.tradePoints.takeProfitSell, symbol);

    const dirWord = isBuy ? 'compra' : 'venda';
    parts.push(`Recomendação de ${dirWord}.`);
    parts.push(`Ponto de entrada em ${expandNumberForSpeech(entry)}.`);
    parts.push(`Stop loss em ${expandNumberForSpeech(stop)}.`);
    parts.push(`Alvo de ganho em ${expandNumberForSpeech(gain)}.`);
    parts.push(`Relação risco-retorno de ${rr}.`);

    if (successProb >= 70) {
      parts.push('Operação com alta probabilidade de acerto. Sinal favorável.');
    } else if (successProb >= 50) {
      parts.push('Operação com probabilidade moderada. Atenção aos sinais.');
    } else {
      parts.push('Probabilidade baixa. Recomenda-se cautela antes de operar.');
    }
  } else {
    parts.push('Recomendação: aguardar. Não entrar na operação neste momento.');
  }

  // Add recommendation (truncated for comfortable listening)
  if (analysis.recommendation) {
    const rec = analysis.recommendation.length > 250
      ? analysis.recommendation.substring(0, 247) + '...'
      : analysis.recommendation;
    parts.push(rec);
  }

  return parts.join(' ');
}

// TTS uses browser native SpeechSynthesis API — instant Portuguese voice (pt-BR)
// No server-side TTS: the z-ai-web-dev-sdk only has Chinese voices, not Portuguese

export function AIAnalysisPanel({
  instrument, analysis, analyzing, quote, onAnalyze, error, strategy, onStrategyChange,
  comparisonResults, comparing, onCompareAll, analysisHistory, onLoadHistory,
  viewMode, onViewModeChange, riskRewardRatio, onRiskRewardChange, riskMode, onRiskModeChange, sentiment
}: AIAnalysisPanelProps) {
  const rrPresets = [1.0, 1.5, 2.0, 2.5, 3.0];
  const [historyOpen, setHistoryOpen] = useState(false);
  const [ttsLoading, setTtsLoading] = useState(false);
  const [ttsPlaying, setTtsPlaying] = useState(false);
  const [ttsSpeed, setTtsSpeed] = useState(1.0);
  const [ttsError, setTtsError] = useState<string | null>(null);
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoiceName, setSelectedVoiceName] = useState<string>('');
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  // Load browser voices on mount
  useEffect(() => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;

    const loadVoices = () => {
      const allVoices = window.speechSynthesis.getVoices();
      // Filter for Portuguese voices (pt-BR, pt-PT, or any pt-*)
      const ptVoices = allVoices.filter(v =>
        v.lang.startsWith('pt') ||
        v.name.toLowerCase().includes('portuguese') ||
        v.name.toLowerCase().includes('brasil') ||
        v.name.toLowerCase().includes('brazil')
      );
      // If no Portuguese voices, include all voices
      const voices = ptVoices.length > 0 ? ptVoices : allVoices;
      setAvailableVoices(voices);
      // Auto-select best Portuguese voice (prefer pt-BR)
      if (ptVoices.length > 0) {
        const best = ptVoices.find(v => v.lang === 'pt-BR') || ptVoices[0];
        setSelectedVoiceName(best.name);
      } else if (voices.length > 0) {
        setSelectedVoiceName(voices[0].name);
      }
    };

    loadVoices();
    window.speechSynthesis.addEventListener('voiceschanged', loadVoices);
    return () => {
      window.speechSynthesis.removeEventListener('voiceschanged', loadVoices);
    };
  }, []);

  // Stop all TTS playback
  const stopAllTTS = useCallback(() => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    utteranceRef.current = null;
    setTtsPlaying(false);
    setTtsLoading(false);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopAllTTS();
    };
  }, [stopAllTTS]);

  // TTS: play narration using browser native SpeechSynthesis (Portuguese)
  const handlePlayNarration = useCallback(async () => {
    if (!analysis || !instrument) return;

    // If currently playing, stop
    if (ttsPlaying) {
      stopAllTTS();
      return;
    }

    // If loading, cancel
    if (ttsLoading) {
      stopAllTTS();
      return;
    }

    const narrationText = buildNarrationText(analysis, instrument);
    if (!narrationText || narrationText.trim().length === 0) return;

    try {
      setTtsLoading(true);
      setTtsError(null);

      if (!window.speechSynthesis) {
        throw new Error('Seu navegador não suporta síntese de voz.');
      }

      // Wait for voices to load if needed
      if (availableVoices.length === 0) {
        await new Promise<void>((resolve) => {
          const onVoicesChanged = () => {
            window.speechSynthesis.removeEventListener('voiceschanged', onVoicesChanged);
            resolve();
          };
          window.speechSynthesis.addEventListener('voiceschanged', onVoicesChanged);
          setTimeout(resolve, 3000);
        });
      }

      const utterance = new SpeechSynthesisUtterance(narrationText);
      // Force Portuguese language
      utterance.lang = 'pt-BR';

      // Set selected voice
      const voice = availableVoices.find(v => v.name === selectedVoiceName);
      if (voice) {
        utterance.voice = voice;
        // Also set lang from the voice to ensure correct pronunciation
        utterance.lang = voice.lang;
      }

      utterance.rate = Math.max(0.5, Math.min(2.0, ttsSpeed));
      utterance.pitch = 1.0;
      utterance.volume = 1.0;

      utterance.onstart = () => {
        setTtsLoading(false);
        setTtsPlaying(true);
      };

      utterance.onend = () => {
        setTtsPlaying(false);
        utteranceRef.current = null;
      };

      utterance.onerror = (e) => {
        if (e.error === 'canceled') return;
        console.warn('[TTS] Error:', e.error);
        setTtsError('Erro na reprodução. Tente novamente.');
        setTtsPlaying(false);
        setTtsLoading(false);
        utteranceRef.current = null;
      };

      utteranceRef.current = utterance;
      window.speechSynthesis.speak(utterance);

      // Safety: if speech doesn't start within 3s, reset
      setTimeout(() => {
        if (ttsLoading) {
          setTtsLoading(false);
          setTtsError('Voz não disponível. Tente novamente.');
        }
      }, 3000);

    } catch (err: any) {
      console.warn('[TTS] Error:', err?.message || err);
      setTtsError(err?.message || 'Erro ao gerar áudio. Tente novamente.');
      setTtsLoading(false);
      setTtsPlaying(false);
    }
  }, [analysis, instrument, ttsPlaying, ttsLoading, ttsSpeed, availableVoices, selectedVoiceName, stopAllTTS]);

  // --- Share Analysis Feature ---

  // Build the formatted share text for clipboard / Web Share API
  const buildShareText = useCallback((a: AIAnalysis, inst: Instrument): string => {
    const symbol = inst.symbol || '';
    const strategyLabel = STRATEGY_META[a.strategy]?.label || 'Híbrido';
    const dir = a.direction === 'BUY' ? 'COMPRA' : a.direction === 'SELL' ? 'VENDA' : 'ESPERAR';
    const entry = a.direction === 'BUY'
      ? formatPrice(a.tradePoints.buyPoint, symbol)
      : a.direction === 'SELL'
        ? formatPrice(a.tradePoints.sellPoint, symbol)
        : '—';
    const stop = a.direction === 'BUY'
      ? formatPrice(a.tradePoints.stopLossBuy, symbol)
      : a.direction === 'SELL'
        ? formatPrice(a.tradePoints.stopLossSell, symbol)
        : '—';
    const gain = a.direction === 'BUY'
      ? formatPrice(a.tradePoints.takeProfitBuy, symbol)
      : a.direction === 'SELL'
        ? formatPrice(a.tradePoints.takeProfitSell, symbol)
        : '—';
    const rr = a.riskReward?.ratio || '—';
    const confidence = a.confidence;
    const successProb = a.successProbability || 0;

    return [
      `📊 ForexAI Pro - Análise ${strategyLabel}`,
      `💱 ${inst.name}`,
      `📈 ${dir} — ${confidence}% confiança`,
      `🎯 Entrada: ${entry} | 🛑 Stop: ${stop} | ✅ Gain: ${gain}`,
      `⚖️ R:R ${rr} | 🎯 Acerto: ${successProb}%`,
      `🔗 forexaiproelite.vercel.app`,
    ].join('\n');
  }, []);

  // Share via Web Share API (mobile) or clipboard fallback
  const handleShare = useCallback(() => {
    if (!analysis || !instrument) return;

    const text = buildShareText(analysis, instrument);
    const dir = analysis.direction === 'BUY' ? 'COMPRA' : analysis.direction === 'SELL' ? 'VENDA' : 'ESPERAR';
    const strategyLabel = STRATEGY_META[analysis.strategy]?.label || 'Híbrido';

    // Try Web Share API first (available on mobile and some desktop browsers)
    if (typeof navigator !== 'undefined' && navigator.share) {
      navigator.share({
        title: `ForexAI Pro - ${instrument.name}`,
        text: text,
      }).then(() => {
        toast.success('Compartilhado!', { description: `${instrument.name} — ${dir}` });
      }).catch((err) => {
        // User cancelled share — don't show error
        if (err.name === 'AbortError') return;
        // Fallback to clipboard
        navigator.clipboard.writeText(text).then(() => {
          toast.success('Link copiado!', { description: 'Análise copiada para a área de transferência.' });
        }).catch(() => {
          toast.error('Erro ao compartilhar');
        });
      });
    } else {
      // Fallback: copy to clipboard
      navigator.clipboard.writeText(text).then(() => {
        toast.success('Link copiado!', { description: 'Análise copiada para a área de transferência.' });
      }).catch(() => {
        toast.error('Erro ao copiar', { description: 'Não foi possível copiar para a área de transferência.' });
      });
    }
  }, [analysis, instrument, buildShareText]);

  // Generate a shareable image using HTML Canvas
  const handleGenerateImage = useCallback(() => {
    if (!analysis || !instrument) return;

    const a = analysis;
    const inst = instrument;
    const symbol = inst.symbol || '';
    const strategyLabel = STRATEGY_META[a.strategy]?.label || 'Híbrido';
    const dir = a.direction === 'BUY' ? 'COMPRA' : a.direction === 'SELL' ? 'VENDA' : 'ESPERAR';
    const entry = a.direction === 'BUY'
      ? formatPrice(a.tradePoints.buyPoint, symbol)
      : a.direction === 'SELL'
        ? formatPrice(a.tradePoints.sellPoint, symbol)
        : '—';
    const stop = a.direction === 'BUY'
      ? formatPrice(a.tradePoints.stopLossBuy, symbol)
      : a.direction === 'SELL'
        ? formatPrice(a.tradePoints.stopLossSell, symbol)
        : '—';
    const gain = a.direction === 'BUY'
      ? formatPrice(a.tradePoints.takeProfitBuy, symbol)
      : a.direction === 'SELL'
        ? formatPrice(a.tradePoints.takeProfitSell, symbol)
        : '—';
    const rr = a.riskReward?.ratio || '—';
    const confidence = a.confidence;
    const successProb = a.successProbability || 0;

    // Canvas dimensions
    const w = 600;
    const h = 520;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Background: dark navy gradient
    const bgGrad = ctx.createLinearGradient(0, 0, w, h);
    bgGrad.addColorStop(0, '#0f172a');
    bgGrad.addColorStop(0.5, '#1e1b4b');
    bgGrad.addColorStop(1, '#0f172a');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, w, h);

    // Decorative accent line at top
    const accentGrad = ctx.createLinearGradient(0, 0, w, 0);
    accentGrad.addColorStop(0, '#06b6d4');
    accentGrad.addColorStop(0.5, '#8b5cf6');
    accentGrad.addColorStop(1, '#06b6d4');
    ctx.fillStyle = accentGrad;
    ctx.fillRect(0, 0, w, 3);

    // Watermark / Brand
    ctx.fillStyle = '#06b6d4';
    ctx.font = 'bold 22px system-ui, sans-serif';
    ctx.fillText('ForexAI', 32, 48);
    ctx.fillStyle = '#e2e8f0';
    ctx.font = 'bold 22px system-ui, sans-serif';
    ctx.fillText(' Pro', 148, 48);

    // Strategy badge
    const strategyColor = a.strategy === 'smc' ? '#8b5cf6' : a.strategy === 'price_action' ? '#06b6d4' : '#f59e0b';
    ctx.fillStyle = strategyColor;
    ctx.font = '13px system-ui, sans-serif';
    ctx.fillText(`Estratégia: ${strategyLabel}`, 32, 78);

    // Separator line
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.2)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(32, 95);
    ctx.lineTo(w - 32, 95);
    ctx.stroke();

    // Instrument name
    ctx.fillStyle = '#f1f5f9';
    ctx.font = 'bold 28px system-ui, sans-serif';
    ctx.fillText(inst.name, 32, 135);

    // Direction
    const dirColor = a.direction === 'BUY' ? '#10b981' : a.direction === 'SELL' ? '#ef4444' : '#f59e0b';
    const dirArrow = a.direction === 'BUY' ? '↗' : a.direction === 'SELL' ? '↘' : '—';
    ctx.fillStyle = dirColor;
    ctx.font = 'bold 36px system-ui, sans-serif';
    ctx.fillText(`${dirArrow} ${dir}`, 32, 185);

    // Confidence
    ctx.fillStyle = '#06b6d4';
    ctx.font = 'bold 20px system-ui, sans-serif';
    ctx.fillText(`${confidence}% confiança`, 32, 220);

    // Trade points box
    ctx.fillStyle = 'rgba(30, 41, 59, 0.6)';
    roundRect(ctx, 24, 240, w - 48, 100, 12);
    ctx.fill();
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.15)';
    ctx.lineWidth = 1;
    roundRect(ctx, 24, 240, w - 48, 100, 12);
    ctx.stroke();

    // Entry / Stop / Gain
    const colW = (w - 48) / 3;
    ctx.textAlign = 'center';
    // Entry
    ctx.fillStyle = '#94a3b8';
    ctx.font = '12px system-ui, sans-serif';
    ctx.fillText('🎯 ENTRADA', 24 + colW * 0.5, 270);
    ctx.fillStyle = '#06b6d4';
    ctx.font = 'bold 20px system-ui, sans-serif';
    ctx.fillText(entry, 24 + colW * 0.5, 300);
    // Stop
    ctx.fillStyle = '#94a3b8';
    ctx.font = '12px system-ui, sans-serif';
    ctx.fillText('🛑 STOP', 24 + colW * 1.5, 270);
    ctx.fillStyle = '#ef4444';
    ctx.font = 'bold 20px system-ui, sans-serif';
    ctx.fillText(stop, 24 + colW * 1.5, 300);
    // Gain
    ctx.fillStyle = '#94a3b8';
    ctx.font = '12px system-ui, sans-serif';
    ctx.fillText('✅ GAIN', 24 + colW * 2.5, 270);
    ctx.fillStyle = '#10b981';
    ctx.font = 'bold 20px system-ui, sans-serif';
    ctx.fillText(gain, 24 + colW * 2.5, 300);

    ctx.textAlign = 'left';

    // Risk/Reward + Success Probability
    ctx.fillStyle = 'rgba(30, 41, 59, 0.6)';
    roundRect(ctx, 24, 360, (w - 48) / 2 - 8, 60, 10);
    ctx.fill();
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.15)';
    ctx.lineWidth = 1;
    roundRect(ctx, 24, 360, (w - 48) / 2 - 8, 60, 10);
    ctx.stroke();

    ctx.fillStyle = 'rgba(30, 41, 59, 0.6)';
    roundRect(ctx, 24 + (w - 48) / 2 + 8, 360, (w - 48) / 2 - 8, 60, 10);
    ctx.fill();
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.15)';
    ctx.lineWidth = 1;
    roundRect(ctx, 24 + (w - 48) / 2 + 8, 360, (w - 48) / 2 - 8, 60, 10);
    ctx.stroke();

    // R:R
    ctx.fillStyle = '#94a3b8';
    ctx.font = '11px system-ui, sans-serif';
    ctx.fillText('⚖️ Risco/Retorno', 40, 385);
    ctx.fillStyle = '#f59e0b';
    ctx.font = 'bold 22px system-ui, sans-serif';
    ctx.fillText(`1:${rr}`, 40, 412);

    // Success prob
    const halfX = 24 + (w - 48) / 2 + 8;
    ctx.fillStyle = '#94a3b8';
    ctx.font = '11px system-ui, sans-serif';
    ctx.fillText('🎯 Prob. Acerto', halfX + 16, 385);
    ctx.fillStyle = successProb >= 60 ? '#10b981' : '#f59e0b';
    ctx.font = 'bold 22px system-ui, sans-serif';
    ctx.fillText(`${successProb}%`, halfX + 16, 412);

    // Separator
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.2)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(32, 440);
    ctx.lineTo(w - 32, 440);
    ctx.stroke();

    // Footer: brand + date
    ctx.fillStyle = '#64748b';
    ctx.font = '12px system-ui, sans-serif';
    const now = new Date();
    const dateStr = now.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    ctx.fillText(`🔗 forexaiproelite.vercel.app  •  ${dateStr}`, 32, 470);

    // Watermark bottom
    ctx.fillStyle = 'rgba(6, 182, 212, 0.08)';
    ctx.font = 'bold 64px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('ForexAI Pro', w / 2, h - 30);
    ctx.textAlign = 'left';

    // Download
    const link = document.createElement('a');
    link.download = `forexai-${inst.name.replace(/[^a-zA-Z0-9]/g, '')}-${dir.toLowerCase()}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();

    toast.success('Imagem gerada! 🖼️', { description: `${inst.name} — ${dir}` });
  }, [analysis, instrument]);

  // Helper: draw rounded rectangle on Canvas
  function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  const hasTradePoints = analysis?.tradePoints && (
    analysis.tradePoints.buyPoint > 0 || analysis.tradePoints.sellPoint > 0
  );

  const strategies: AnalysisStrategy[] = ['smc', 'price_action', 'hybrid'];

  // Filter history for current instrument
  const instrumentHistory = (analysisHistory || []).filter(
    h => h.instrumentSymbol === instrument?.symbol
  ).slice(0, 10);

  const hasComparisonResults = Object.values(comparisonResults).some(v => v !== null);

  return (
    <Card className="border-border/40 bg-card/80 backdrop-blur-sm">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <Brain className="w-4 h-4 text-violet-400" />
            Análise IA
            {sentiment && (
              <Badge
                variant="outline"
                className={`text-[8px] py-0 px-1.5 ml-1 ${
                  sentiment.sentiment === 'bullish'
                    ? 'border-emerald-500/30 text-emerald-400 bg-emerald-500/10'
                    : sentiment.sentiment === 'bearish'
                      ? 'border-red-500/30 text-red-400 bg-red-500/10'
                      : 'border-amber-500/30 text-amber-400 bg-amber-500/10'
                }`}
                title={sentiment.summary}
              >
                {sentiment.sentiment === 'bullish' ? '🟢' : sentiment.sentiment === 'bearish' ? '🔴' : '🟡'}
                {' '}{sentiment.sentiment === 'bullish' ? 'Altista' : sentiment.sentiment === 'bearish' ? 'Baixista' : 'Neutro'}
                {' '}{sentiment.confidence}%
              </Badge>
            )}
          </CardTitle>
          <div className="flex items-center gap-1.5">
            {/* View Mode Toggle */}
            <div className="flex items-center bg-secondary/50 rounded-md p-0.5">
              <button
                onClick={() => onViewModeChange('single')}
                className={`px-2 py-1 rounded text-[9px] font-semibold transition-all ${
                  viewMode === 'single' ? 'bg-cyan-500/20 text-cyan-400' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Individual
              </button>
              <button
                onClick={() => onViewModeChange('comparison')}
                className={`px-2 py-1 rounded text-[9px] font-semibold transition-all flex items-center gap-1 ${
                  viewMode === 'comparison' ? 'bg-amber-500/20 text-amber-400' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <GitCompare className="w-3 h-3" />
                Comparar
              </button>
            </div>

            {viewMode === 'single' ? (
              <Button
                size="sm"
                onClick={() => instrument && onAnalyze(instrument, strategy)}
                disabled={analyzing || !instrument}
                className="bg-gradient-to-r from-cyan-500 to-violet-500 hover:from-cyan-600 hover:to-violet-600 text-white text-xs h-7 px-3"
              >
                {analyzing ? <RefreshCw className="w-3 h-3 animate-spin mr-1" /> : <Zap className="w-3 h-3 mr-1" />}
                {analyzing ? 'Analisando...' : 'Analisar'}
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={() => instrument && onCompareAll(instrument)}
                disabled={comparing || !instrument}
                className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white text-xs h-7 px-3"
              >
                {comparing ? <RefreshCw className="w-3 h-3 animate-spin mr-1" /> : <GitCompare className="w-3 h-3 mr-1" />}
                {comparing ? 'Comparando...' : 'Comparar Todas'}
              </Button>
            )}
          </div>
        </div>

        {/* R:R Ratio Selector - visible in both modes */}
        <div className="mt-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Shield className="w-3 h-3 text-muted-foreground" />
              <span className="text-[10px] text-muted-foreground font-medium">Risco/Retorno</span>
            </div>
            <div className="flex gap-1">
              {rrPresets.map((ratio) => (
                <button
                  key={ratio}
                  onClick={() => onRiskRewardChange(ratio)}
                  className={`px-2 py-1 rounded text-[10px] font-mono font-semibold transition-all border ${
                    riskRewardRatio === ratio
                      ? 'bg-amber-400/15 text-amber-400 border-amber-400/30'
                      : 'text-muted-foreground border-border/30 hover:bg-secondary/50 hover:text-foreground'
                  }`}
                >
                  1:{ratio % 1 === 0 ? ratio.toFixed(0) : ratio.toFixed(1)}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ═══ Risk Mode Toggle: Conservative vs Aggressive ═══ */}
        <div className="mt-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Activity className="w-3 h-3 text-muted-foreground" />
              <span className="text-[10px] text-muted-foreground font-medium">Modo de Risco</span>
            </div>
            <div className="flex gap-1">
              <button
                onClick={() => onRiskModeChange('conservative')}
                className={`px-2.5 py-1 rounded text-[10px] font-semibold transition-all border ${
                  riskMode === 'conservative'
                    ? 'bg-emerald-400/15 text-emerald-400 border-emerald-400/30'
                    : 'text-muted-foreground border-border/30 hover:bg-secondary/50 hover:text-foreground'
                }`}
              >
                🛡️ Conservador
              </button>
              <button
                onClick={() => onRiskModeChange('aggressive')}
                className={`px-2.5 py-1 rounded text-[10px] font-semibold transition-all border ${
                  riskMode === 'aggressive'
                    ? 'bg-orange-400/15 text-orange-400 border-orange-400/30'
                    : 'text-muted-foreground border-border/30 hover:bg-secondary/50 hover:text-foreground'
                }`}
              >
                🔥 Agressivo
              </button>
            </div>
          </div>
          <p className="text-[8px] text-muted-foreground/60 mt-1 text-center">
            {riskMode === 'conservative'
              ? 'ATR 1.0x — StopLoss padrão, mais seguro para iniciantes'
              : 'ATR 0.5x — StopLoss 50% menor, para quem não gosta de stop longo'}
          </p>
        </div>

        {/* Strategy Selector - only show in single mode */}
        {viewMode === 'single' && (
          <div className="mt-2">
            <div className="flex items-center gap-1.5 mb-1.5">
              <Layers className="w-3 h-3 text-muted-foreground" />
              <span className="text-[10px] text-muted-foreground font-medium">Estratégia</span>
            </div>
            <div className="grid grid-cols-3 gap-2 sm:gap-1">
              {strategies.map((s) => {
                const meta = STRATEGY_META[s];
                return (
                  <button
                    key={s}
                    onClick={() => onStrategyChange(s)}
                    className={`relative flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-lg text-[10px] font-semibold transition-all border ${
                      strategy === s
                        ? s === 'smc' ? 'bg-violet-600 text-white border-violet-400 shadow-lg shadow-violet-500/40' :
                          s === 'price_action' ? 'bg-cyan-600 text-white border-cyan-400 shadow-lg shadow-cyan-500/40' :
                          'bg-amber-600 text-white border-amber-400 shadow-lg shadow-amber-500/40'
                        : s === 'smc' ? 'bg-violet-500/10 text-violet-300 border-violet-500/30 hover:bg-violet-500/25' :
                          s === 'price_action' ? 'bg-cyan-500/10 text-cyan-300 border-cyan-500/30 hover:bg-cyan-500/25' :
                          'bg-amber-500/10 text-amber-300 border-amber-500/30 hover:bg-amber-500/25'
                    }`}
                  >
                    <span className="text-sm">{meta.emoji}</span>
                    <span>{meta.label}</span>
                    {strategy === s && (
                      <motion.div
                        layoutId="strategy-indicator"
                        className={`absolute inset-0 rounded-lg ${
                          s === 'smc' ? 'bg-violet-500/5' :
                          s === 'price_action' ? 'bg-cyan-500/5' : 'bg-amber-500/5'
                        }`}
                        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                      />
                    )}
                  </button>
                );
              })}
            </div>
            <p className="text-[8px] text-muted-foreground/60 mt-1 text-center">
              {STRATEGY_META[strategy]?.description || 'Análise de mercado'}
            </p>
          </div>
        )}

        {/* Comparison mode info */}
        {viewMode === 'comparison' && (
          <div className="mt-2 bg-amber-500/5 rounded-lg p-2.5 border border-amber-500/15">
            <p className="text-[10px] text-amber-400 font-semibold flex items-center gap-1.5">
              <GitCompare className="w-3 h-3" />
              Modo Comparação
            </p>
            <p className="text-[9px] text-muted-foreground mt-1">
              Executa as 3 estratégias (SMC, Price Action e Híbrido) simultaneamente e compara os resultados.
            </p>
          </div>
        )}
      </CardHeader>
      <CardContent>
        {/* COMPARISON MODE */}
        {viewMode === 'comparison' ? (
          comparing ? (
            <div className="flex flex-col items-center justify-center py-8 space-y-4">
              <div className="relative">
                <GitCompare className="w-16 h-16 text-amber-400/50" />
                <div className="absolute inset-0 animate-ping">
                  <GitCompare className="w-16 h-16 text-amber-400/20" />
                </div>
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-amber-400">Comparando 3 estratégias</p>
                <p className="text-xs text-muted-foreground mt-1">
                  SMC · Price Action · Híbrido
                </p>
              </div>
              <div className="flex gap-1.5">
                {[0, 1, 2, 3, 4].map(i => (
                  <motion.div
                    key={i}
                    className="w-1.5 h-1.5 rounded-full bg-amber-400"
                    animate={{ scale: [1, 2, 1], opacity: [0.3, 1, 0.3] }}
                    transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.15 }}
                  />
                ))}
              </div>
              {/* Show which strategies have completed */}
              <div className="flex gap-2 mt-2">
                {strategies.map(s => {
                  const done = comparisonResults[s] !== null;
                  const meta = STRATEGY_META[s];
                  return (
                    <div key={s} className={`flex items-center gap-1 text-[9px] px-2 py-1 rounded-md border transition-all ${
                      done ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-secondary/30 border-border/20 text-muted-foreground'
                    }`}>
                      {done ? <CheckCircle2 className="w-3 h-3" /> : <RefreshCw className="w-3 h-3 animate-spin" />}
                      {meta.emoji} {meta.label}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : hasComparisonResults ? (
            <ScrollArea className="h-[540px]">
              <div className="space-y-4 pr-2">
                {/* Comparison Table */}
                <div className="bg-gradient-to-br from-amber-500/5 via-orange-500/5 to-amber-500/5 rounded-xl p-3 border border-amber-500/15">
                  <p className="text-xs font-bold mb-3 flex items-center gap-1.5">
                    <GitCompare className="w-3.5 h-3.5 text-amber-400" />
                    Comparação de Estratégias
                  </p>
                  <ComparisonTable results={comparisonResults} instrumentSymbol={instrument?.symbol || ''} />
                </div>

                {/* Best strategy recommendation */}
                {(() => {
                  let best: AnalysisStrategy | null = null;
                  let bestProb = 0;
                  for (const s of strategies) {
                    if (comparisonResults[s] && (comparisonResults[s]?.successProbability || 0) > bestProb) {
                      bestProb = comparisonResults[s]?.successProbability || 0;
                      best = s;
                    }
                  }
                  if (!best || !comparisonResults[best]) return null;
                  const bestAnalysis = comparisonResults[best]!;
                  const meta = STRATEGY_META[best];
                  return (
                    <div className="bg-gradient-to-br from-amber-500/10 to-emerald-500/10 rounded-xl p-3 border border-amber-500/20">
                      <p className="text-xs font-bold mb-2 flex items-center gap-1.5">
                        <Trophy className="w-3.5 h-3.5 text-amber-400" />
                        Melhor Estratégia
                      </p>
                      <div className="flex items-center gap-2 mb-2">
                        <Badge className={`text-[10px] font-bold px-2.5 py-1 ${
                          best === 'smc' ? 'bg-violet-500/20 text-violet-400 border-violet-500/30' :
                          best === 'price_action' ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30' :
                          'bg-amber-500/20 text-amber-400 border-amber-500/30'
                        }`}>
                          {meta.emoji} {meta.label}
                        </Badge>
                        <Badge className="text-[10px] font-bold px-2.5 py-1 bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                          {bestProb}% acerto
                        </Badge>
                        <Badge className={`text-[10px] font-bold px-2.5 py-1 ${
                          bestAnalysis.direction === 'BUY' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' :
                          bestAnalysis.direction === 'SELL' ? 'bg-red-500/20 text-red-400 border-red-500/30' :
                          'bg-amber-500/20 text-amber-400 border-amber-500/30'
                        }`}>
                          {bestAnalysis.direction === 'BUY' ? '↗ COMPRA' : bestAnalysis.direction === 'SELL' ? '↘ VENDA' : '— ESPERAR'}
                        </Badge>
                      </div>
                      <p className="text-[10px] text-muted-foreground leading-relaxed">{bestAnalysis.recommendation}</p>
                    </div>
                  );
                })()}

                {/* Signal Service for best strategy in comparison mode */}
                {(() => {
                  let best: AnalysisStrategy | null = null;
                  let bestProb = 0;
                  for (const s of strategies) {
                    if (comparisonResults[s] && (comparisonResults[s]?.successProbability || 0) > bestProb) {
                      bestProb = comparisonResults[s]?.successProbability || 0;
                      best = s;
                    }
                  }
                  if (!best || !comparisonResults[best] || comparisonResults[best]!.direction === 'WAIT') return null;
                  return (
                    <SignalServiceCard
                      instrument={instrument}
                      analysis={comparisonResults[best]!}
                      analysisHistory={analysisHistory}
                      quote={quote}
                    />
                  );
                })()}

                {/* Agreement indicator */}
                {(() => {
                  const dirs = strategies.map(s => comparisonResults[s]?.direction).filter(Boolean);
                  const allAgree = dirs.length === 3 && dirs.every(d => d === dirs[0]);
                  const twoAgree = dirs.length === 3 && !allAgree && new Set(dirs).size <= 2;
                  return (
                    <div className={`rounded-lg p-3 border ${
                      allAgree ? 'bg-emerald-500/5 border-emerald-500/15' :
                      twoAgree ? 'bg-amber-500/5 border-amber-500/15' :
                      'bg-red-500/5 border-red-500/15'
                    }`}>
                      <p className="text-xs font-bold flex items-center gap-1.5">
                        {allAgree ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> :
                         twoAgree ? <AlertTriangle className="w-3.5 h-3.5 text-amber-400" /> :
                         <XCircle className="w-3.5 h-3.5 text-red-400" />}
                        Convergência
                      </p>
                      <p className={`text-[10px] mt-1 ${
                        allAgree ? 'text-emerald-400' : twoAgree ? 'text-amber-400' : 'text-red-400'
                      }`}>
                        {allAgree ? '✅ Todas as estratégias concordam na direção!' :
                         twoAgree ? '⚠️ 2 de 3 estratégias concordam na direção' :
                         '❌ Estratégias divergem — cautela extrema'}
                      </p>
                    </div>
                  );
                })()}

                {/* Disclaimer */}
                <div className="flex items-start gap-1.5 text-[9px] text-muted-foreground/50 pt-1">
                  <AlertTriangle className="w-3 h-3 flex-shrink-0 mt-0.5" />
                  <span>
                    Esta análise é gerada por IA e não constitui aconselhamento financeiro.
                    Sempre faça sua própria pesquisa antes de investir.
                  </span>
                </div>
              </div>
            </ScrollArea>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-amber-500/10 to-orange-500/10 flex items-center justify-center mb-4 border border-border/30">
                <GitCompare className="w-10 h-10 text-amber-400/40" />
              </div>
              <p className="text-sm font-medium text-foreground/80 mb-1">Comparação de Estratégias</p>
              <p className="text-xs text-muted-foreground/60 max-w-[200px]">
                Clique em &quot;Comparar Todas&quot; para executar SMC, Price Action e Híbrido simultaneamente
              </p>
            </div>
          )
        ) : (
          /* SINGLE ANALYSIS MODE — original content */
          analyzing ? (
            <div className="flex flex-col items-center justify-center py-8 space-y-4">
              <div className="relative">
                <Brain className="w-16 h-16 text-violet-400/50" />
                <div className="absolute inset-0 animate-ping">
                  <Brain className="w-16 h-16 text-violet-400/20" />
                </div>
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-violet-400">IA analisando mercado</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Estratégia: {STRATEGY_META[strategy]?.emoji || '📊'} {STRATEGY_META[strategy]?.label || 'Híbrido'}
                </p>
              </div>
              <div className="flex gap-1.5">
                {[0, 1, 2, 3, 4].map(i => (
                  <motion.div
                    key={i}
                    className="w-1.5 h-1.5 rounded-full bg-cyan-400"
                    animate={{ scale: [1, 2, 1], opacity: [0.3, 1, 0.3] }}
                    transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.15 }}
                  />
                ))}
              </div>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <div className="w-16 h-16 rounded-2xl bg-red-500/10 flex items-center justify-center mb-3 border border-red-500/20">
                <AlertTriangle className="w-8 h-8 text-red-400" />
              </div>
              <p className="text-sm font-medium text-red-400 mb-1">Erro na Análise</p>
              <p className="text-xs text-muted-foreground max-w-[220px] mb-4">{error}</p>
              <Button size="sm"
                onClick={() => instrument && onAnalyze(instrument, strategy)}
                className="bg-gradient-to-r from-cyan-500 to-violet-500 hover:from-cyan-600 hover:to-violet-600 text-white text-xs h-7 px-4"
              >
                <RefreshCw className="w-3 h-3 mr-1" />
                Tentar Novamente
              </Button>
            </div>
          ) : analysis ? (
            <ScrollArea className="h-[540px]">
              <div className="space-y-4 pr-2">
                {/* Strategy Badge + Risk Mode Badge */}
                <div className="flex items-center justify-center gap-2">
                  <Badge className={`text-[10px] font-bold px-3 py-1 ${
                    analysis.strategy === 'smc' ? 'bg-violet-500/20 text-violet-400 border-violet-500/30' :
                    analysis.strategy === 'price_action' ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30' :
                    'bg-amber-500/20 text-amber-400 border-amber-500/30'
                  }`}>
                    {STRATEGY_META[analysis.strategy]?.emoji || '📊'} {STRATEGY_META[analysis.strategy]?.label || 'Híbrido'}
                  </Badge>
                  <Badge className={`text-[10px] font-bold px-3 py-1 ${
                    riskMode === 'aggressive'
                      ? 'bg-orange-500/20 text-orange-400 border-orange-500/30'
                      : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                  }`}>
                    {riskMode === 'aggressive' ? '🔥 Agressivo' : '🛡️ Conservador'}
                  </Badge>
                </div>

                {/* Aggressive Mode Warning */}
                {riskMode === 'aggressive' && (
                  <div className="bg-orange-500/5 rounded-lg p-2.5 border border-orange-500/15">
                    <p className="text-[9px] text-orange-400 font-bold flex items-center gap-1">
                      🔥 Modo Agressivo Ativo
                    </p>
                    <p className="text-[8px] text-muted-foreground/70 mt-0.5">
                      StopLoss 50% menor (ATR 0.5x). Maior risco de ser stopado por ruído de mercado, mas risco por trade é menor. Use com cautela.
                    </p>
                  </div>
                )}

                {/* SMC Concepts — only for SMC or Hybrid */}
                {(analysis.strategy === 'smc' || analysis.strategy === 'hybrid') && analysis.smcConcepts && (
                  <div className="bg-violet-500/5 rounded-lg p-3 border border-violet-500/15">
                    <p className="text-xs font-semibold mb-2 flex items-center gap-1.5">
                      <span className="text-sm">🏦</span> Conceitos SMC
                    </p>
                    <div className="space-y-1.5">
                      {[
                        { label: 'Order Block', value: analysis.smcConcepts.orderBlock },
                        { label: 'Fair Value Gap', value: analysis.smcConcepts.fairValueGap },
                        { label: 'Liquidez', value: analysis.smcConcepts.liquidityLevel },
                        { label: 'Estrutura', value: analysis.smcConcepts.marketStructure },
                      ].map((item, i) => (
                        <div key={i} className="text-[10px]">
                          <span className="text-muted-foreground font-medium">{item.label}</span>
                          <p className="text-violet-400 font-medium leading-relaxed mt-0.5">{item.value}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Price Action Patterns — only for PA or Hybrid */}
                {(analysis.strategy === 'price_action' || analysis.strategy === 'hybrid') && analysis.priceActionPatterns && analysis.priceActionPatterns.length > 0 && (
                  <div className="bg-cyan-500/5 rounded-lg p-3 border border-cyan-500/15">
                    <p className="text-xs font-semibold mb-2 flex items-center gap-1.5">
                      <span className="text-sm">📈</span> Padrões Price Action
                    </p>
                    <div className="space-y-1">
                      {analysis.priceActionPatterns.map((pattern, i) => (
                        <div key={i} className="flex items-start gap-1.5 text-[10px]">
                          <span className="text-cyan-400 mt-0.5 flex-shrink-0">•</span>
                          <span className="text-cyan-300 leading-relaxed">{pattern}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Success Probability */}
                <SuccessProbabilityRing value={analysis.successProbability || 50} />

                {/* Dual Probability Gauges */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col items-center">
                    <ProbabilityGauge value={analysis.entryProbability} size={100} label="Entrada" />
                  </div>
                  <div className="flex flex-col items-center">
                    <ProbabilityGauge value={analysis.confidence} size={100} label="Confiança" />
                  </div>
                </div>

                {/* Direction Badge */}
                <div className="flex justify-center items-center gap-2">
                  <motion.div initial={{ scale: 0.8 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 300 }}>
                    <Badge className={`text-base font-bold px-6 py-2 ${
                      analysis.direction === 'BUY' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' :
                      analysis.direction === 'SELL' ? 'bg-red-500/20 text-red-400 border-red-500/30' :
                      'bg-amber-500/20 text-amber-400 border-amber-500/30'
                    }`}>
                      {analysis.direction === 'BUY' && <ArrowUpRight className="w-5 h-5 mr-1.5" />}
                      {analysis.direction === 'SELL' && <ArrowDownRight className="w-5 h-5 mr-1.5" />}
                      {analysis.direction === 'WAIT' && <Minus className="w-5 h-5 mr-1.5" />}
                      {analysis.direction === 'BUY' ? 'COMPRA' : analysis.direction === 'SELL' ? 'VENDA' : 'ESPERAR'}
                    </Badge>
                  </motion.div>
                  {/* Copy Trade Button */}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      if (!analysis || !instrument) return;
                      const text = buildShareText(analysis, instrument);
                      navigator.clipboard.writeText(text).then(() => {
                        toast.success('Trade copiado! 📋', { description: `${instrument.name}` });
                      }).catch(() => {
                        toast.error('Erro ao copiar', { description: 'Não foi possível copiar para a área de transferência.' });
                      });
                    }}
                    className="h-7 px-2.5 text-[10px] border-border/40 hover:border-cyan-500/40 hover:text-cyan-400 hover:bg-cyan-500/5 transition-all"
                    title="Copiar trade"
                  >
                    <Copy className="w-3 h-3 mr-1" />
                    Copiar
                  </Button>
                  {/* Share Button */}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleShare()}
                    className="h-7 px-2.5 text-[10px] border-border/40 hover:border-violet-500/40 hover:text-violet-400 hover:bg-violet-500/5 transition-all"
                    title="Compartilhar análise"
                  >
                    <Share2 className="w-3 h-3 mr-1" />
                    Compartilhar
                  </Button>
                  {/* Generate Image Button */}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleGenerateImage()}
                    className="h-7 px-2.5 text-[10px] border-border/40 hover:border-amber-500/40 hover:text-amber-400 hover:bg-amber-500/5 transition-all"
                    title="Gerar imagem da análise"
                  >
                    <ImageIcon className="w-3 h-3 mr-1" />
                    Imagem
                  </Button>
                </div>

                {/* Bias & Confidence */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-secondary/40 rounded-lg p-2.5 text-center border border-border/30">
                    <p className="text-[9px] text-muted-foreground uppercase tracking-wider mb-1">Tendência</p>
                    <div className="flex items-center justify-center gap-1">
                      {analysis.bias === 'bullish' ? <TrendingUp className="w-3.5 h-3.5 text-emerald-400" /> :
                       analysis.bias === 'bearish' ? <TrendingDown className="w-3.5 h-3.5 text-red-400" /> :
                       <Minus className="w-3.5 h-3.5 text-amber-400" />}
                      <span className={`text-xs font-bold ${
                        analysis.bias === 'bullish' ? 'text-emerald-400' :
                        analysis.bias === 'bearish' ? 'text-red-400' : 'text-amber-400'
                      }`}>
                        {analysis.bias === 'bullish' ? 'Alta' : analysis.bias === 'bearish' ? 'Baixa' : 'Neutro'}
                      </span>
                    </div>
                  </div>
                  <div className="bg-secondary/40 rounded-lg p-2.5 text-center border border-border/30">
                    <p className="text-[9px] text-muted-foreground uppercase tracking-wider mb-1">Confiança</p>
                    <span className="text-xs font-bold text-cyan-400">{analysis.confidence}%</span>
                    <Progress value={analysis.confidence} className="h-1 mt-1" />
                  </div>
                </div>

                <Separator className="bg-border/30" />

                {/* Trade Points */}
                {hasTradePoints && (
                  <>
                    <div>
                      <p className="text-xs font-semibold mb-2.5 flex items-center gap-1.5">
                        <Crosshair className="w-3.5 h-3.5 text-cyan-400" /> Pontos de Entrada
                      </p>
                      
                      <div className="bg-emerald-500/5 rounded-lg p-3 border border-emerald-500/15 mb-2">
                        <div className="flex items-center gap-1.5 mb-2">
                          <ArrowUpRight className="w-3.5 h-3.5 text-emerald-400" />
                          <span className="text-xs font-bold text-emerald-400">COMPRA</span>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          <div className="text-center">
                            <p className="text-[8px] text-muted-foreground uppercase mb-0.5">Entrada</p>
                            <p className="font-mono text-[11px] sm:text-xs font-bold text-emerald-400">
                              {formatPrice(analysis.tradePoints.buyPoint, instrument?.symbol || '')}
                            </p>
                          </div>
                          <div className="text-center">
                            <p className="text-[8px] text-red-400 uppercase mb-0.5">Stop</p>
                            <p className="font-mono text-xs font-bold text-red-400">
                              {formatPrice(analysis.tradePoints.stopLossBuy, instrument?.symbol || '')}
                            </p>
                          </div>
                          <div className="text-center">
                            <p className="text-[8px] text-cyan-400 uppercase mb-0.5">Gain</p>
                            <p className="font-mono text-xs font-bold text-cyan-400">
                              {formatPrice(analysis.tradePoints.takeProfitBuy, instrument?.symbol || '')}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="bg-red-500/5 rounded-lg p-3 border border-red-500/15">
                        <div className="flex items-center gap-1.5 mb-2">
                          <ArrowDownRight className="w-3.5 h-3.5 text-red-400" />
                          <span className="text-xs font-bold text-red-400">VENDA</span>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          <div className="text-center">
                            <p className="text-[8px] text-muted-foreground uppercase mb-0.5">Entrada</p>
                            <p className="font-mono text-[11px] sm:text-xs font-bold text-red-400">
                              {formatPrice(analysis.tradePoints.sellPoint, instrument?.symbol || '')}
                            </p>
                          </div>
                          <div className="text-center">
                            <p className="text-[8px] text-red-400 uppercase mb-0.5">Stop</p>
                            <p className="font-mono text-xs font-bold text-red-400">
                              {formatPrice(analysis.tradePoints.stopLossSell, instrument?.symbol || '')}
                            </p>
                          </div>
                          <div className="text-center">
                            <p className="text-[8px] text-cyan-400 uppercase mb-0.5">Gain</p>
                            <p className="font-mono text-xs font-bold text-cyan-400">
                              {formatPrice(analysis.tradePoints.takeProfitSell, instrument?.symbol || '')}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>

                    <Separator className="bg-border/30" />
                  </>
                )}

                {/* Signal Service Card — Copy/MT5/CSV */}
                <SignalServiceCard
                  instrument={instrument}
                  analysis={analysis}
                  analysisHistory={analysisHistory}
                  quote={quote}
                />

                {/* Risk/Reward */}
                {analysis.riskReward && (
                <div>
                  <p className="text-xs font-semibold mb-2.5 flex items-center gap-1.5">
                    <Shield className="w-3.5 h-3.5 text-amber-400" /> Risco / Retorno
                  </p>
                  <div className="bg-secondary/30 rounded-lg p-3 space-y-2.5 border border-border/20">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Razão R:R</span>
                      <div className="flex items-center gap-1.5">
                        <DollarSign className="w-3 h-3 text-amber-400" />
                        <span className="font-mono text-lg font-bold text-amber-400">{analysis.riskReward?.ratio || '—'}</span>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="bg-red-500/5 rounded-lg p-2 border border-red-500/10 text-center">
                        <p className="text-[8px] text-muted-foreground uppercase mb-0.5">Risco</p>
                        <p className="font-mono text-sm font-bold text-red-400">
                          {analysis.riskReward?.riskDisplay || (analysis.riskReward?.riskPoints ? analysis.riskReward.riskPoints.toFixed(2) : '—')}
                        </p>
                      </div>
                      <div className="bg-emerald-500/5 rounded-lg p-2 border border-emerald-500/10 text-center">
                        <p className="text-[8px] text-muted-foreground uppercase mb-0.5">Retorno</p>
                        <p className="font-mono text-sm font-bold text-emerald-400">
                          {analysis.riskReward?.rewardDisplay || (analysis.riskReward?.rewardPoints ? analysis.riskReward.rewardPoints.toFixed(2) : '—')}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
                )}

                <Separator className="bg-border/30" />

                {/* Key Levels */}
                {analysis.keyLevels && (
                <div>
                  <p className="text-xs font-semibold mb-2.5 flex items-center gap-1.5">
                    <Target className="w-3.5 h-3.5 text-cyan-400" /> Níveis-Chave
                  </p>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center bg-red-500/5 rounded-lg px-3 py-2 border border-red-500/10">
                      <span className="text-xs text-red-400 font-medium">Resistência</span>
                      <span className="font-mono text-sm font-semibold">{formatPrice(analysis.keyLevels?.resistance || 0, instrument?.symbol || '')}</span>
                    </div>
                    <div className="flex justify-between items-center bg-amber-500/5 rounded-lg px-3 py-2 border border-amber-500/10">
                      <span className="text-xs text-amber-400 font-medium">Pivô</span>
                      <span className="font-mono text-sm font-semibold">{formatPrice(analysis.keyLevels?.pivot || 0, instrument?.symbol || '')}</span>
                    </div>
                    <div className="flex justify-between items-center bg-emerald-500/5 rounded-lg px-3 py-2 border border-emerald-500/10">
                      <span className="text-xs text-emerald-400 font-medium">Suporte</span>
                      <span className="font-mono text-sm font-semibold">{formatPrice(analysis.keyLevels?.support || 0, instrument?.symbol || '')}</span>
                    </div>
                  </div>
                </div>
                )}

                <Separator className="bg-border/30" />

                {/* Indicators */}
                {analysis.indicators && (
                <div>
                  <p className="text-xs font-semibold mb-2.5 flex items-center gap-1.5">
                    <Activity className="w-3.5 h-3.5 text-violet-400" /> Indicadores
                  </p>
                  <div className="space-y-3">
                    <div>
                      <div className="flex justify-between text-[11px] mb-1">
                        <span className="text-muted-foreground">RSI (14)</span>
                        <span className={`font-mono font-semibold ${
                          analysis.indicators.rsi > 70 ? 'text-red-400' :
                          analysis.indicators.rsi < 30 ? 'text-emerald-400' : 'text-foreground'
                        }`}>
                          {(analysis.indicators.rsi ?? 0).toFixed(1)}
                        </span>
                      </div>
                      <div className="relative h-2 bg-secondary/50 rounded-full overflow-hidden">
                        <div className="absolute inset-y-0 left-0 rounded-full transition-all duration-500"
                          style={{
                            width: `${analysis.indicators.rsi ?? 0}%`,
                            backgroundColor: (analysis.indicators.rsi ?? 0) > 70 ? '#ef4444' : (analysis.indicators.rsi ?? 0) < 30 ? '#10b981' : '#22d3ee',
                          }}
                        />
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-[11px] mb-1">
                        <span className="text-muted-foreground">Força da Tendência</span>
                        <span className="font-mono font-semibold">{analysis.indicators.trendStrength ?? 0}%</span>
                      </div>
                      <Progress value={analysis.indicators.trendStrength ?? 0} className="h-2" />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="bg-secondary/30 rounded-lg p-2 border border-border/20">
                        <p className="text-[9px] text-muted-foreground uppercase mb-1">MACD</p>
                        <Badge variant="outline" className={`text-[10px] py-0 ${
                          analysis.indicators.macdSignal === 'bullish' ? 'border-emerald-500/30 text-emerald-400' :
                          analysis.indicators.macdSignal === 'bearish' ? 'border-red-500/30 text-red-400' :
                          'border-amber-500/30 text-amber-400'
                        }`}>
                          {analysis.indicators.macdSignal === 'bullish' ? '↑ Alta' : analysis.indicators.macdSignal === 'bearish' ? '↓ Baixa' : '— Neutro'}
                        </Badge>
                      </div>
                      <div className="bg-secondary/30 rounded-lg p-2 border border-border/20">
                        <p className="text-[9px] text-muted-foreground uppercase mb-1">Volatilidade</p>
                        <Badge variant="outline" className={`text-[10px] py-0 ${
                          analysis.indicators.volatility === 'high' ? 'border-red-500/30 text-red-400' :
                          analysis.indicators.volatility === 'medium' ? 'border-amber-500/30 text-amber-400' :
                          'border-emerald-500/30 text-emerald-400'
                        }`}>
                          {analysis.indicators.volatility === 'high' ? '⚡ Alta' : analysis.indicators.volatility === 'medium' ? '📊 Média' : '📉 Baixa'}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </div>
                )}

                <Separator className="bg-border/30" />

                {/* Summary */}
                <div>
                  <p className="text-xs font-semibold mb-1.5">Resumo</p>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">{analysis.summary}</p>
                </div>

                {/* AI Recommendation */}
                <div className="bg-gradient-to-br from-cyan-500/5 via-violet-500/5 to-cyan-500/5 rounded-lg p-3.5 border border-cyan-500/15">
                  <p className="text-xs font-semibold mb-1.5 flex items-center gap-1.5">
                    <Brain className="w-3.5 h-3.5 text-violet-400" /> Recomendação IA
                  </p>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">{analysis.recommendation}</p>
                </div>

                {/* TTS Narration — Browser native SpeechSynthesis (Portuguese pt-BR) */}
                <div className="space-y-2">
                  <button
                    onClick={handlePlayNarration}
                    disabled={!analysis}
                    className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-lg border transition-all text-xs font-semibold ${
                      ttsPlaying
                        ? 'bg-violet-500/15 text-violet-400 border-violet-500/30 hover:bg-red-500/15 hover:text-red-400 hover:border-red-500/30'
                        : ttsLoading
                          ? 'bg-violet-500/10 text-violet-400 border-violet-500/20 cursor-wait'
                          : 'bg-gradient-to-r from-violet-500/10 to-cyan-500/10 text-violet-400 border-violet-500/20 hover:from-violet-500/20 hover:to-cyan-500/20'
                    }`}
                  >
                    {ttsLoading ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        Iniciando voz...
                      </>
                    ) : ttsPlaying ? (
                      <>
                        <VolumeX className="w-3.5 h-3.5" />
                        Parar narração
                      </>
                    ) : (
                      <>
                        <Volume2 className="w-3.5 h-3.5" />
                        Ouvir análise em português
                      </>
                    )}
                  </button>
                  {/* TTS Error message */}
                  {ttsError && (
                    <p className="text-[9px] text-red-400 text-center">{ttsError}</p>
                  )}
                  {/* Voice selector — browser voices filtered for Portuguese */}
                  {availableVoices.length > 1 && (
                    <div className="flex items-center gap-2 px-1">
                      <span className="text-[9px] text-muted-foreground whitespace-nowrap">Voz</span>
                      <select
                        value={selectedVoiceName}
                        onChange={(e) => setSelectedVoiceName(e.target.value)}
                        className="flex-1 bg-secondary/50 border border-border/30 rounded text-[9px] text-foreground px-2 py-1 max-h-8 overflow-hidden"
                      >
                        {availableVoices.map((v) => (
                          <option key={v.name} value={v.name}>
                            {v.name.substring(0, 30)} ({v.lang})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                  {/* Speed control */}
                  <div className="flex items-center gap-2 px-1">
                    <span className="text-[9px] text-muted-foreground whitespace-nowrap">Velocidade</span>
                    <input
                      type="range"
                      min="0.5"
                      max="2.0"
                      step="0.1"
                      value={ttsSpeed}
                      onChange={(e) => setTtsSpeed(parseFloat(e.target.value))}
                      className="flex-1 h-1 accent-violet-400 cursor-pointer"
                    />
                    <span className="text-[9px] text-muted-foreground font-mono w-6 text-right">{ttsSpeed.toFixed(1)}x</span>
                  </div>
                  {/* Info */}
                  <p className="text-[8px] text-muted-foreground/50 text-center">
                    🇧🇷 Voz em português — navegador {availableVoices.length > 0 ? `(${availableVoices.length} ${availableVoices.length === 1 ? 'voz' : 'vozes'})` : ''}
                  </p>
                </div>

                {/* Disclaimer */}
                <div className="flex items-start gap-1.5 text-[9px] text-muted-foreground/50 pt-1">
                  <AlertTriangle className="w-3 h-3 flex-shrink-0 mt-0.5" />
                  <span>
                    Esta análise é gerada por IA e não constitui aconselhamento financeiro.
                    Sempre faça sua própria pesquisa antes de investir.
                  </span>
                </div>
              </div>
            </ScrollArea>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-cyan-500/10 to-violet-500/10 flex items-center justify-center mb-4 border border-border/30">
                <Brain className="w-10 h-10 text-violet-400/40" />
              </div>
              <p className="text-sm font-medium text-foreground/80 mb-1">Análise IA Pronta</p>
              <p className="text-xs text-muted-foreground/60 max-w-[200px]">
                Selecione a estratégia e clique em &quot;Analisar&quot; para obter pontos de entrada, stop e gain
              </p>
            </div>
          )
        )}

        {/* Analysis History — always visible at bottom */}
        {instrumentHistory.length > 0 && (
          <div className="mt-3 border-t border-border/30 pt-3">
            <button
              onClick={() => setHistoryOpen(!historyOpen)}
              className="flex items-center gap-1.5 w-full text-left text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
            >
              <History className="w-3 h-3" />
              <span>Histórico</span>
              <Badge variant="outline" className="text-[8px] px-1.5 py-0 ml-1">
                {instrumentHistory.length}
              </Badge>
              <div className="flex-1" />
              {historyOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>

            {historyOpen && (
              <ScrollArea className="max-h-48 mt-2">
                <div className="space-y-1.5 pr-1">
                  {instrumentHistory.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => onLoadHistory(item)}
                      className="w-full text-left bg-secondary/30 hover:bg-secondary/50 rounded-lg p-2 border border-border/20 transition-colors"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-1.5">
                          <Badge className={`text-[8px] px-1.5 py-0 ${
                            item.strategy === 'smc' ? 'bg-violet-500/20 text-violet-400 border-violet-500/30' :
                            item.strategy === 'price_action' ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30' :
                            'bg-amber-500/20 text-amber-400 border-amber-500/30'
                          }`}>
                            {STRATEGY_META[item.strategy]?.emoji || '📊'} {STRATEGY_META[item.strategy]?.label || 'Híbrido'}
                          </Badge>
                          <Badge className={`text-[8px] px-1.5 py-0 ${
                            item.direction === 'BUY' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' :
                            item.direction === 'SELL' ? 'bg-red-500/20 text-red-400 border-red-500/30' :
                            'bg-amber-500/20 text-amber-400 border-amber-500/30'
                          }`}>
                            {item.direction === 'BUY' ? '↗' : item.direction === 'SELL' ? '↘' : '—'}
                            {item.direction === 'BUY' ? 'COMPRA' : item.direction === 'SELL' ? 'VENDA' : 'ESPERAR'}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-1 text-[8px] text-muted-foreground">
                          <Clock className="w-2.5 h-2.5" />
                          {new Date(item.timestamp).toLocaleString('pt-BR', {
                            day: '2-digit', month: '2-digit',
                            hour: '2-digit', minute: '2-digit'
                          })}
                        </div>
                      </div>
                      <div className="flex items-center gap-3 text-[9px]">
                        <span className="text-muted-foreground">
                          Confiança: <span className="text-cyan-400 font-semibold">{item.confidence}%</span>
                        </span>
                        <span className="text-muted-foreground">
                          Acerto: <span className={`font-semibold ${
                            item.successProbability >= 60 ? 'text-emerald-400' : item.successProbability >= 40 ? 'text-amber-400' : 'text-red-400'
                          }`}>{item.successProbability}%</span>
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
