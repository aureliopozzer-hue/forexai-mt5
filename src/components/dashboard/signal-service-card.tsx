'use client';

import { useCallback, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  Copy, ExternalLink, ArrowUpRight, ArrowDownRight,
  Crosshair, Shield, Zap, Clock, Bell, FileSpreadsheet,
  CheckCircle2, AlertTriangle, Send, Search, Globe, Building2,
  TrendingUp, Users, Gamepad2, Star, Rocket, MousePointerClick, Check, Info,
  Eye, EyeOff, LineChart
} from 'lucide-react';
import { toast } from 'sonner';
import { Instrument, AIAnalysis, formatPrice, getVal, STRATEGY_META, AnalysisHistoryItem, QuoteData } from './types';

interface SignalServiceCardProps {
  instrument: Instrument | null;
  analysis: AIAnalysis | null;
  analysisHistory: AnalysisHistoryItem[];
  quote?: QuoteData;
}

// ─── Order Type Helpers (beginner-friendly) ──────────────────────
// Determines the MT5 order type for each price level so beginners
// know exactly what to select in the platform.

type OrderType = 'BUY STOP' | 'BUY LIMIT' | 'BUY STOP LIMIT' | 'BUY (Mercado)' | 'SELL STOP' | 'SELL LIMIT' | 'SELL STOP LIMIT' | 'SELL (Mercado)';

// Entry order type depends on direction and relation to current price
function getEntryOrderType(isBuy: boolean, entry: number, currentPrice: number | undefined): OrderType {
  if (!currentPrice || currentPrice <= 0) {
    // No live price — default to pending
    return isBuy ? 'BUY LIMIT' : 'SELL LIMIT';
  }
  const diff = entry - currentPrice;
  const threshold = currentPrice * 0.0005; // 0.05% tolerance for "at market"
  if (Math.abs(diff) <= threshold) {
    return isBuy ? 'BUY (Mercado)' : 'SELL (Mercado)';
  }
  if (isBuy) {
    // BUY signal: entry above current = breakout → BUY STOP; entry below = pullback → BUY LIMIT
    return diff > 0 ? 'BUY STOP' : 'BUY LIMIT';
  }
  // SELL signal: entry below current = breakdown → SELL STOP; entry above = pullback → SELL LIMIT
  return diff < 0 ? 'SELL STOP' : 'SELL LIMIT';
}

// SL order type for the position (closes the trade)
function getStopLossOrderType(isBuy: boolean): OrderType {
  // SL closes a BUY with SELL STOP, closes a SELL with BUY STOP
  return isBuy ? 'SELL STOP' : 'BUY STOP';
}

// TP order type for the position (closes the trade)
function getTakeProfitOrderType(isBuy: boolean): OrderType {
  // TP closes a BUY with SELL LIMIT, closes a SELL with BUY LIMIT
  return isBuy ? 'SELL LIMIT' : 'BUY LIMIT';
}

// Full recommended order type (combines entry + SL + TP into one order)
function getFullOrderType(isBuy: boolean, entry: number, currentPrice: number | undefined): OrderType {
  // In MT5, a "Stop Limit" order combines stop + limit for better fill control
  // BUY STOP LIMIT: Buy stop triggers, then becomes a buy limit
  // SELL STOP LIMIT: Sell stop triggers, then becomes a sell limit
  if (!currentPrice || currentPrice <= 0) {
    return isBuy ? 'BUY LIMIT' : 'SELL LIMIT';
  }
  const diff = entry - currentPrice;
  const threshold = currentPrice * 0.0005;
  if (Math.abs(diff) <= threshold) {
    return isBuy ? 'BUY (Mercado)' : 'SELL (Mercado)';
  }
  // For breakout entries (stop orders), recommend STOP LIMIT for better price control
  if (isBuy && diff > 0) return 'BUY STOP LIMIT';
  if (!isBuy && diff < 0) return 'SELL STOP LIMIT';
  // For pullback entries (limit orders)
  return isBuy ? 'BUY LIMIT' : 'SELL LIMIT';
}

// ─── Broker Database ────────────────────────────────────────────────
// Each broker has their OWN MT5 Web Terminal on their own domain.
// The generic web.metatrader.app/terminal only shows MetaQuotes-Demo.
// Source: https://www.metatrader5.com/en/trading-platform/web-trading/how-to-connect

type BrokerCategory = 'prop_firm' | 'popular' | 'demo';

interface BrokerInfo {
  id: string;
  name: string;
  server: string;
  url: string;
  category: BrokerCategory;
  emoji: string;
  popular?: boolean;
}

const BROKERS: BrokerInfo[] = [
  // ── Prop Firms ──
  { id: 'ftmo', name: 'FTMO', server: 'FTMO-Server', url: 'https://mt5.ftmo.com', category: 'prop_firm', emoji: '🏆', popular: true },
  { id: 'ftmo-demo', name: 'FTMO (Demo)', server: 'FTMO-Demo', url: 'https://mt5demowebterminal.ftmo.com/terminal', category: 'prop_firm', emoji: '🏗️' },
  { id: 'fundednext', name: 'FundedNext', server: 'FundedNext-Live', url: 'https://webterminal.fundednext.com/terminal', category: 'prop_firm', emoji: '🚀', popular: true },
  { id: 'fundednext-demo', name: 'FundedNext (Demo)', server: 'FundedNext-Demo', url: 'https://webterminal.fundednext.com/terminal', category: 'prop_firm', emoji: '🧪' },
  { id: 'the5ers', name: 'The5ers', server: 'The5ers-Server', url: 'https://web.5ers.com/terminal', category: 'prop_firm', emoji: '5️⃣', popular: true },
  { id: 'fundingpips', name: 'FundingPips', server: 'FundingPips-Live', url: 'https://mt5.fundingpips.com/terminal', category: 'prop_firm', emoji: '💰', popular: true },
  { id: 'fxify', name: 'FXIFY', server: 'FXIFY-Server', url: 'https://mt5.fxify.com/terminal', category: 'prop_firm', emoji: '📊', popular: true },
  { id: 'alpha-capital', name: 'Alpha Capital', server: 'ACG-MT5', url: 'https://mt5.alphacapitalgroup.uk/terminal', category: 'prop_firm', emoji: '🔺' },
  { id: 'city-traders', name: 'City Traders Imperium', server: 'CTI-Server', url: 'https://mt5.citytradersimperium.com/terminal', category: 'prop_firm', emoji: '🏙️' },
  { id: 'blue-guardian', name: 'Blue Guardian', server: 'BlueGuardian-MT5', url: 'https://mt5.blueguardian.com/terminal', category: 'prop_firm', emoji: '🛡️' },
  { id: 'maven-trading', name: 'Maven Trading', server: 'Maven-MT5', url: 'https://mt5.maventrading.com/terminal', category: 'prop_firm', emoji: '📦' },
  { id: 'goat-funded', name: 'Goat Funded Trader', server: 'GoatFunded-Server', url: 'https://webtrading.goatfundedtrader.com/terminal', category: 'prop_firm', emoji: '🐐' },
  { id: 'funded-elite', name: 'Funded Elite', server: 'FundedElite-Server', url: 'https://mt5.funded-elite.com/terminal', category: 'prop_firm', emoji: '👑' },
  { id: 'fundedtradingplus', name: 'FundedTradingPlus', server: 'FTP-MT5', url: 'https://mt5.fundedtradingplus.com/terminal', category: 'prop_firm', emoji: '➕' },
  { id: 'audacity-capital', name: 'Audacity Capital', server: 'Audacity-MT5', url: 'https://mt5.audacity.capital/terminal', category: 'prop_firm', emoji: '🎵' },
  { id: 'funderpro', name: 'FunderPro', server: 'FunderPro-Server', url: 'https://mt5.funderpro.com/terminal', category: 'prop_firm', emoji: '🔧' },
  { id: 'thinkcapital', name: 'ThinkCapital', server: 'ThinkCapital-MT5', url: 'https://mt5.thinkmarkets.com/terminal', category: 'prop_firm', emoji: '💡' },
  { id: 'blueberry-funded', name: 'Blueberry Funded', server: 'BlueberryFunded-MT5', url: 'https://mt5.blueberryfunded.com/terminal', category: 'prop_firm', emoji: '🫐' },
  // ── Popular Brokers ──
  { id: 'ic-markets', name: 'IC Markets', server: 'ICMarkets-MT5', url: 'https://webtrader.icmarkets.com', category: 'popular', emoji: '🌊', popular: true },
  { id: 'pepperstone', name: 'Pepperstone', server: 'Pepperstone-MT5', url: 'https://mt5.pepperstone.com', category: 'popular', emoji: '🌶️', popular: true },
  { id: 'xm', name: 'XM', server: 'XMGlobal-MT5', url: 'https://mt5.xm.com', category: 'popular', emoji: '📈' },
  { id: 'exness', name: 'Exness', server: 'Exness-MT5', url: 'https://www.exness.com/metatrader-webterminal', category: 'popular', emoji: '🔄' },
  { id: 'roboforex', name: 'RoboForex', server: 'RoboForex-MT5', url: 'https://mt5.roboforex.com', category: 'popular', emoji: '🤖' },
  { id: 'fxpro', name: 'FxPro', server: 'FxPro-MT5', url: 'https://mt5webtrader.fxpro.com', category: 'popular', emoji: '⭐' },
  { id: 'avatrade', name: 'AvaTrade', server: 'AvaTrade-MT5', url: 'https://mt5web-real.avatrade.com/terminal', category: 'popular', emoji: '🅰️' },
  { id: 'fbs', name: 'FBS', server: 'FBS-Real-MT5', url: 'https://fbs.com/trading/metatrader-5/mt5-web', category: 'popular', emoji: '🏈' },
  { id: 'tickmill', name: 'Tickmill', server: 'Tickmill-MT5', url: 'https://www.tickmill.com/trading-platforms/metatrader-web-trader', category: 'popular', emoji: '✅' },
  { id: 'octafx', name: 'OctaFX', server: 'OctaFX-MT5', url: 'https://www.octabroker.com/downloads/mt5', category: 'popular', emoji: '🐙' },
  { id: 'alpari', name: 'Alpari', server: 'Alpari-MT5', url: 'https://metatraderweb.app/trade?startup_version=5', category: 'popular', emoji: '🏔️' },
  // ── Demo ──
  { id: 'metaquotes-demo', name: 'MetaQuotes Demo', server: 'MetaQuotes-Demo', url: 'https://web.metatrader.app/terminal?lang=pt', category: 'demo', emoji: '🎮' },
];

const CATEGORY_META: Record<BrokerCategory, { label: string; icon: React.ComponentType<{ className?: string }>; desc: string }> = {
  prop_firm: { label: 'Prop Firms', icon: TrendingUp, desc: 'Contas financiadas' },
  popular: { label: 'Brokers Populares', icon: Building2, desc: 'Brokers regulados' },
  demo: { label: 'Conta Demo', icon: Gamepad2, desc: 'Prática sem risco' },
};

// Build MT5-friendly signal text for clipboard
function buildSignalText(a: AIAnalysis, inst: Instrument, entryOrderType: string, slOrderType: string, tpOrderType: string): string {
  const symbol = inst.symbol || '';
  const strategyLabel = STRATEGY_META[a.strategy]?.label || 'Híbrido';
  const dir = a.direction === 'BUY' ? 'COMPRA' : a.direction === 'SELL' ? 'VENDA' : 'ESPERAR';
  const isBuy = a.direction === 'BUY';

  const entry = isBuy ? formatPrice(a.tradePoints.buyPoint, symbol) : formatPrice(a.tradePoints.sellPoint, symbol);
  const stop = isBuy ? formatPrice(a.tradePoints.stopLossBuy, symbol) : formatPrice(a.tradePoints.stopLossSell, symbol);
  const gain = isBuy ? formatPrice(a.tradePoints.takeProfitBuy, symbol) : formatPrice(a.tradePoints.takeProfitSell, symbol);
  const rr = a.riskReward?.ratio || '—';
  const confidence = a.confidence;
  const successProb = a.successProbability || 0;

  const now = new Date();
  const dateStr = now.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const timeStr = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  return [
    `━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `📡 SINAL ForexAI Pro`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `💱 Ativo: ${inst.name} (${symbol})`,
    `📊 Estratégia: ${strategyLabel}`,
    `📅 Data: ${dateStr} ${timeStr}`,
    ``,
    `📈 Direção: ${dir}`,
    `🎯 Entrada: ${entry} (${entryOrderType})`,
    `🛑 Stop Loss: ${stop} (${slOrderType})`,
    `✅ Take Profit: ${gain} (${tpOrderType})`,
    `⚖️ Risco/Retorno: 1:${rr}`,
    `💪 Confiança: ${confidence}%`,
    `🎯 Prob. Acerto: ${successProb}%`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `📋 No MT5: Nova Ordem → ${entryOrderType}`,
    `🔗 forexaiproelite.vercel.app`,
  ].join('\n');
}

// Build compact signal text for quick copy (MT5-style)
function buildCompactSignal(a: AIAnalysis, inst: Instrument, entryOrderType: string): string {
  const symbol = inst.symbol || '';
  const isBuy = a.direction === 'BUY';
  const entry = isBuy ? formatPrice(a.tradePoints.buyPoint, symbol) : formatPrice(a.tradePoints.sellPoint, symbol);
  const stop = isBuy ? formatPrice(a.tradePoints.stopLossBuy, symbol) : formatPrice(a.tradePoints.stopLossSell, symbol);
  const gain = isBuy ? formatPrice(a.tradePoints.takeProfitBuy, symbol) : formatPrice(a.tradePoints.takeProfitSell, symbol);
  const dir = isBuy ? 'BUY' : 'SELL';

  return `${inst.name} ${entryOrderType} @ ${entry} | SL: ${stop} | TP: ${gain} | R:R 1:${a.riskReward?.ratio || '—'}`;
}

// Export signals as CSV for MT5 import
function exportSignalsCSV(history: AnalysisHistoryItem[]) {
  if (history.length === 0) {
    toast.error('Nenhum sinal para exportar', { description: 'Faça pelo menos uma análise primeiro.' });
    return;
  }

  const headers = ['Data/Hora', 'Ativo', 'Estratégia', 'Direção', 'Tipo Ordem', 'Entrada', 'Stop Loss', 'Take Profit', 'R:R', 'Confiança', 'Prob. Acerto'];

  const rows = history.map(item => {
    const a = item.analysis;
    const isBuy = a.direction === 'BUY';
    const entry = isBuy ? a.tradePoints.buyPoint : a.tradePoints.sellPoint;
    const stop = isBuy ? a.tradePoints.stopLossBuy : a.tradePoints.stopLossSell;
    const gain = isBuy ? a.tradePoints.takeProfitBuy : a.tradePoints.takeProfitSell;
    const date = new Date(item.timestamp).toLocaleString('pt-BR');
    const dir = a.direction === 'BUY' ? 'BUY' : a.direction === 'SELL' ? 'SELL' : 'WAIT';
    const strategyLabel = STRATEGY_META[a.strategy]?.label || 'Híbrido';
    const entryOrderType = isBuy ? 'BUY LIMIT' : 'SELL LIMIT';

    return [date, item.instrumentName, strategyLabel, dir, entryOrderType, entry, stop, gain, a.riskReward?.ratio || '', item.confidence, item.successProbability];
  });

  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
  ].join('\n');

  const bom = '\uFEFF';
  const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `forexai-sinais-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);

  toast.success('CSV exportado! 📊', { description: `${history.length} sinais salvos em formato CSV.` });
}

// Signal strength classifier
function getSignalStrength(prob: number) {
  if (prob >= 75) return { label: 'FORTE', color: 'text-emerald-400', bg: 'bg-emerald-500/15', border: 'border-emerald-500/30', icon: CheckCircle2 };
  if (prob >= 55) return { label: 'MODERADO', color: 'text-cyan-400', bg: 'bg-cyan-500/15', border: 'border-cyan-500/30', icon: Zap };
  if (prob >= 40) return { label: 'FRACO', color: 'text-amber-400', bg: 'bg-amber-500/15', border: 'border-amber-500/30', icon: AlertTriangle };
  return { label: 'MUITO FRACO', color: 'text-red-400', bg: 'bg-red-500/15', border: 'border-red-500/30', icon: AlertTriangle };
}

export function SignalServiceCard({ instrument, analysis, analysisHistory, quote }: SignalServiceCardProps) {
  const [brokerDialogOpen, setBrokerDialogOpen] = useState(false);
  const [brokerSearch, setBrokerSearch] = useState('');
  const [showTradeConfirm, setShowTradeConfirm] = useState(false);
  const [lastBroker, setLastBroker] = useState<BrokerInfo | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Helper to copy individual field value
  const copyField = useCallback((label: string, value: string) => {
    navigator.clipboard.writeText(value).then(() => {
      setCopiedField(label);
      toast.success(`${label} copiado!`, { description: value, duration: 1500 });
      setTimeout(() => setCopiedField(null), 1500);
    }).catch(() => {
      toast.error('Erro ao copiar');
    });
  }, []);

  // All hooks must be called before any early return
  // Pre-compute order types using useMemo for stable references
  const _isBuy = analysis?.direction === 'BUY';
  const _entry = _isBuy ? analysis?.tradePoints.buyPoint : analysis?.tradePoints.sellPoint;
  const _currentPrice = getVal(quote?.regularMarketPrice);
  const _entryOrderType = useMemo(() => getEntryOrderType(_isBuy, _entry ?? 0, _currentPrice), [_isBuy, _entry, _currentPrice]);
  const _slOrderType = useMemo(() => getStopLossOrderType(_isBuy), [_isBuy]);
  const _tpOrderType = useMemo(() => getTakeProfitOrderType(_isBuy), [_isBuy]);
  const _fullOrderType = useMemo(() => getFullOrderType(_isBuy, _entry ?? 0, _currentPrice), [_isBuy, _entry, _currentPrice]);

  const handleCopySignal = useCallback(() => {
    if (!analysis || !instrument) return;
    const text = buildSignalText(analysis, instrument, _entryOrderType, _slOrderType, _tpOrderType);
    navigator.clipboard.writeText(text).then(() => {
      toast.success('Sinal copiado! 📋', { description: 'Cole no MT5 ou envie para seu broker.' });
    }).catch(() => {
      toast.error('Erro ao copiar', { description: 'Não foi possível copiar para a área de transferência.' });
    });
  }, [analysis, instrument, _entryOrderType, _slOrderType, _tpOrderType]);

  const handleCopyCompact = useCallback(() => {
    if (!analysis || !instrument) return;
    const text = buildCompactSignal(analysis, instrument, _entryOrderType);
    navigator.clipboard.writeText(text).then(() => {
      toast.success('Sinal compacto copiado! 📋', { description: text });
    }).catch(() => {
      toast.error('Erro ao copiar');
    });
  }, [analysis, instrument, _entryOrderType]);

  // ONE-CLICK TRADE: Copy signal + Open MT5 Web Terminal simultaneously
  const handleOneClickTrade = useCallback((broker: BrokerInfo) => {
    if (!analysis || !instrument) return;
    const text = buildSignalText(analysis, instrument, _entryOrderType, _slOrderType, _tpOrderType);
    // Copy signal to clipboard
    navigator.clipboard.writeText(text).then(() => {
      // Open MT5 Web Terminal
      window.open(broker.url, '_blank', 'noopener,noreferrer');
      setLastBroker(broker);
      setShowTradeConfirm(true);
      setBrokerDialogOpen(false);
      setBrokerSearch('');
      toast.success('🚀 Sinal copiado + MT5 aberto!', {
        description: `Cole no MT5: ${analysis.direction === 'BUY' ? 'BUY' : 'SELL'} ${instrument.name}`,
        duration: 4000,
      });
    }).catch(() => {
      // Still open MT5 even if copy fails
      window.open(broker.url, '_blank', 'noopener,noreferrer');
      setLastBroker(broker);
      setShowTradeConfirm(true);
      setBrokerDialogOpen(false);
      toast.info('MT5 aberto!', { description: 'Copie os valores manualmente do card.' });
    });
  }, [analysis, instrument, _entryOrderType, _slOrderType, _tpOrderType]);

  const handleOpenBrokerTerminal = useCallback((broker: BrokerInfo) => {
    window.open(broker.url, '_blank', 'noopener,noreferrer');
    setBrokerDialogOpen(false);
    setBrokerSearch('');
    toast.info(`${broker.name} aberto`, {
      description: `Servidor: ${broker.server} — Faça login com suas credenciais.`,
      duration: 5000,
    });
  }, []);

  const handleExportCSV = useCallback(() => {
    exportSignalsCSV(analysisHistory);
  }, [analysisHistory]);

  // Early return after all hooks
  if (!analysis || !instrument || analysis.direction === 'WAIT') {
    return null;
  }

  // Derived values (after early return)
  const isBuy = analysis.direction === 'BUY';
  const symbol = instrument.symbol || '';
  const entry = isBuy ? analysis.tradePoints.buyPoint : analysis.tradePoints.sellPoint;
  const stop = isBuy ? analysis.tradePoints.stopLossBuy : analysis.tradePoints.stopLossSell;
  const gain = isBuy ? analysis.tradePoints.takeProfitBuy : analysis.tradePoints.takeProfitSell;

  const strength = getSignalStrength(analysis.successProbability || 0);
  const StrengthIcon = strength.icon;

  // Use the pre-computed order types from above (same values, just computed before early return for hooks)
  const entryOrderType = _entryOrderType;
  const slOrderType = _slOrderType;
  const tpOrderType = _tpOrderType;
  const fullOrderType = _fullOrderType;

  // Risk in pips/points
  const riskPoints = Math.abs(entry - stop);
  const rewardPoints = Math.abs(gain - entry);
  const isJPY = symbol.includes('JPY');
  const pipMultiplier = isJPY ? 100 : 10000;
  const riskPips = (riskPoints * pipMultiplier).toFixed(1);
  const rewardPips = (rewardPoints * pipMultiplier).toFixed(1);

  // Filter brokers by search
  const filteredBrokers = brokerSearch.trim()
    ? BROKERS.filter(b =>
        b.name.toLowerCase().includes(brokerSearch.toLowerCase()) ||
        b.server.toLowerCase().includes(brokerSearch.toLowerCase())
      )
    : BROKERS;

  // Group brokers by category
  const groupedBrokers = (['prop_firm', 'popular', 'demo'] as BrokerCategory[]).map(cat => ({
    ...CATEGORY_META[cat],
    brokers: filteredBrokers.filter(b => b.category === cat),
  })).filter(g => g.brokers.length > 0);

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
      >
        <Card className={`border-2 overflow-hidden ${
          isBuy ? 'border-emerald-500/40 bg-gradient-to-br from-emerald-500/5 via-card to-emerald-500/10' :
          'border-red-500/40 bg-gradient-to-br from-red-500/5 via-card to-red-500/10'
        }`}>
          {/* Signal Header */}
          <div className={`px-4 py-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 ${
            isBuy ? 'bg-gradient-to-r from-emerald-500/15 to-emerald-500/5' : 'bg-gradient-to-r from-red-500/15 to-red-500/5'
          }`}>
            <div className="flex items-center gap-2">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                isBuy ? 'bg-emerald-500/20' : 'bg-red-500/20'
              }`}>
                {isBuy ? <ArrowUpRight className="w-6 h-6 text-emerald-400" /> : <ArrowDownRight className="w-6 h-6 text-red-400" />}
              </div>
              <div>
                <p className="text-sm font-bold text-foreground">
                  Sinal de {isBuy ? 'COMPRA' : 'VENDA'}
                </p>
                <p className={`text-[11px] font-black uppercase tracking-wider ${isBuy ? 'text-emerald-400' : 'text-red-400'}`}>
                  {fullOrderType}
                </p>
                <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {new Date().toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge className={`text-[9px] font-bold px-2 py-1 ${strength.bg} ${strength.color} ${strength.border}`}>
                <StrengthIcon className="w-3 h-3 mr-1" />
                {strength.label}
              </Badge>
              <Badge className={`text-[9px] font-bold px-2 py-1 ${
                analysis.strategy === 'smc' ? 'bg-violet-500/20 text-violet-400 border-violet-500/30' :
                analysis.strategy === 'price_action' ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30' :
                'bg-amber-500/20 text-amber-400 border-amber-500/30'
              }`}>
                {STRATEGY_META[analysis.strategy]?.emoji || '📊'} {STRATEGY_META[analysis.strategy]?.label || 'Híbrido'}
              </Badge>
            </div>
          </div>

          <CardContent className="p-4 space-y-3">
            {/* ═══ ORDER TYPE BANNER — Big and Clear for Beginners ═══ */}
            <div className={`rounded-xl p-3 text-center border-2 ${
              isBuy
                ? 'bg-emerald-500/10 border-emerald-500/40'
                : 'bg-red-500/10 border-red-500/40'
            }`}>
              <p className="text-[9px] text-muted-foreground font-semibold uppercase tracking-wider mb-1">Tipo de Ordem no MT5</p>
              <p className={`text-base font-black uppercase tracking-wider ${
                fullOrderType.includes('BUY') ? 'text-emerald-400' : 'text-red-400'
              }`}>
                {fullOrderType}
              </p>
              <p className="text-[8px] text-muted-foreground/60 mt-0.5">
                {fullOrderType === 'BUY STOP LIMIT' && 'Preço sobe até a entrada → vira Buy Limit → Executa com SL e TP'}
                {fullOrderType === 'SELL STOP LIMIT' && 'Preço desce até a entrada → vira Sell Limit → Executa com SL e TP'}
                {fullOrderType === 'BUY STOP' && 'Preço sobe até a entrada → Executa compra com SL e TP'}
                {fullOrderType === 'SELL STOP' && 'Preço desce até a entrada → Executa venda com SL e TP'}
                {fullOrderType === 'BUY LIMIT' && 'Preço desce até a entrada → Executa compra com SL e TP'}
                {fullOrderType === 'SELL LIMIT' && 'Preço sobe até a entrada → Executa venda com SL e TP'}
                {fullOrderType === 'BUY (Mercado)' && 'Executa compra imediata ao preço atual com SL e TP'}
                {fullOrderType === 'SELL (Mercado)' && 'Executa venda imediata ao preço atual com SL e TP'}
              </p>
            </div>

            {/* Signal Values — Entry / SL / TP with Order Types */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3">
              {/* Entry */}
              <div className={`rounded-xl p-3 text-center border ${
                isBuy ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-red-500/5 border-red-500/20'
              }`}>
                <div className="flex items-center justify-center gap-1 mb-1">
                  <Crosshair className={`w-3.5 h-3.5 ${isBuy ? 'text-emerald-400' : 'text-red-400'}`} />
                  <span className="text-[9px] text-muted-foreground font-semibold uppercase">Entrada</span>
                </div>
                <p className={`font-mono text-lg font-bold ${isBuy ? 'text-emerald-400' : 'text-red-400'}`}>
                  {formatPrice(entry, symbol)}
                </p>
                <div className={`mt-1.5 text-[9px] font-bold uppercase tracking-wider px-2 py-1 rounded-md inline-block ${
                  entryOrderType.includes('BUY')
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : 'bg-red-500/20 text-red-400 border border-red-500/30'
                }`}>
                  {entryOrderType}
                </div>
              </div>
              {/* Stop Loss */}
              <div className="rounded-xl p-3 text-center border bg-red-500/5 border-red-500/20">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <Shield className="w-3.5 h-3.5 text-red-400" />
                  <span className="text-[9px] text-red-400 font-semibold uppercase">Stop Loss</span>
                </div>
                <p className="font-mono text-lg font-bold text-red-400">
                  {formatPrice(stop, symbol)}
                </p>
                <div className="mt-1.5 text-[9px] font-bold uppercase tracking-wider px-2 py-1 rounded-md inline-block bg-red-500/20 text-red-400 border border-red-500/30">
                  {slOrderType}
                </div>
              </div>
              {/* Take Profit */}
              <div className="rounded-xl p-3 text-center border bg-cyan-500/5 border-cyan-500/20">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <Zap className="w-3.5 h-3.5 text-cyan-400" />
                  <span className="text-[9px] text-cyan-400 font-semibold uppercase">Take Profit</span>
                </div>
                <p className="font-mono text-lg font-bold text-cyan-400">
                  {formatPrice(gain, symbol)}
                </p>
                <div className="mt-1.5 text-[9px] font-bold uppercase tracking-wider px-2 py-1 rounded-md inline-block bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
                  {tpOrderType}
                </div>
              </div>
            </div>

            {/* Beginner Tip: How to place the order */}
            <div className="bg-secondary/20 rounded-lg p-2.5 border border-border/15">
              <p className="text-[9px] text-amber-400 font-bold mb-1 flex items-center gap-1">
                <Info className="w-3 h-3" />
                Como colocar no MT5
              </p>
              <div className="text-[9px] text-muted-foreground/80 space-y-0.5">
                <p>1. No MT5, clique <strong className="text-foreground">Nova Ordem</strong></p>
                <p>2. Tipo: selecione <strong className="text-foreground">{fullOrderType}</strong></p>
                <p>3. Preço: <strong className="text-foreground">{formatPrice(entry, symbol)}</strong> | SL: <strong className="text-red-400">{formatPrice(stop, symbol)}</strong> | TP: <strong className="text-cyan-400">{formatPrice(gain, symbol)}</strong></p>
                <p>4. Clique <strong className="text-foreground">{isBuy ? 'Buy' : 'Sell'}</strong> para confirmar</p>
              </div>
            </div>

            {/* ─── MT5 SL/TP Lines Tip ─── */}
            <div className="bg-amber-500/5 rounded-lg p-2.5 border border-amber-500/15">
              <p className="text-[9px] text-amber-400 font-bold mb-1 flex items-center gap-1">
                <Eye className="w-3 h-3" />
                Linhas de SL/TP não aparecem no gráfico?
              </p>
              <div className="text-[9px] text-muted-foreground/80 space-y-0.5">
                <p><strong className="text-amber-300">Ordem pendente</strong> (Buy Limit, Sell Stop, etc.): as linhas <strong className="text-foreground">NÃO aparecem</strong> no gráfico do MT5 Web — isso é normal!</p>
                <p><strong className="text-emerald-300">Ordem executada</strong> (posição aberta): as linhas <strong className="text-foreground">aparecem automaticamente</strong> como tracejados vermelho (SL) e verde (TP)</p>
                <p className="text-amber-400/70 mt-0.5">Para ativar: clique direito no gráfico → <strong className="text-foreground">Propriedades</strong> → aba <strong className="text-foreground">Mostrar</strong> → marque <strong className="text-foreground">"Mostrar níveis de negociação"</strong></p>
              </div>
            </div>

            {/* Risk/Reward Bar */}
            <div className="bg-secondary/30 rounded-lg p-3 border border-border/20">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] text-muted-foreground font-semibold">Risco / Retorno</span>
                <span className="text-sm font-bold text-amber-400 font-mono">1:{analysis.riskReward?.ratio || '—'}</span>
              </div>
              <div className="relative h-3 bg-secondary/50 rounded-full overflow-hidden">
                <div
                  className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-red-500 to-red-400"
                  style={{ width: `${Math.min(50, 50)}%` }}
                />
                <div
                  className={`absolute inset-y-0 rounded-full ${
                    isBuy ? 'bg-gradient-to-r from-emerald-500 to-emerald-400' : 'bg-gradient-to-r from-red-500 to-red-400'
                  }`}
                  style={{ left: '50%', width: `${Math.min(50, (rewardPoints / (riskPoints + rewardPoints)) * 100)}%` }}
                />
              </div>
              <div className="flex items-center justify-between mt-1.5">
                <span className="text-[9px] text-red-400 font-mono">Risco: {riskPips} pips</span>
                <span className="text-[9px] text-emerald-400 font-mono">Retorno: {rewardPips} pips</span>
              </div>
            </div>

            {/* Confidence & Probability Row */}
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-secondary/30 rounded-lg p-2 text-center border border-border/20">
                <p className="text-[8px] text-muted-foreground uppercase mb-0.5">Confiança</p>
                <p className="text-base font-bold text-cyan-400 font-mono">{analysis.confidence}%</p>
              </div>
              <div className="bg-secondary/30 rounded-lg p-2 text-center border border-border/20">
                <p className="text-[8px] text-muted-foreground uppercase mb-0.5">Prob. Acerto</p>
                <p className={`text-base font-bold font-mono ${
                  (analysis.successProbability || 0) >= 60 ? 'text-emerald-400' :
                  (analysis.successProbability || 0) >= 40 ? 'text-amber-400' : 'text-red-400'
                }`}>
                  {analysis.successProbability || 0}%
                </p>
              </div>
            </div>

            <Separator className="bg-border/30" />

            {/* ─── ONE-CLICK TRADE ─── */}
            <div className="space-y-2">
              <p className="text-[10px] text-muted-foreground font-semibold flex items-center gap-1.5">
                <Rocket className="w-3 h-3" />
                Executar Trade Rápido
              </p>

              {/* PRIMARY: One-Click Trade Button */}
              <Button
                onClick={() => { setBrokerDialogOpen(true); setBrokerSearch(''); }}
                className={`w-full h-12 text-sm font-bold transition-all animate-pulse ${
                  isBuy
                    ? 'bg-gradient-to-r from-emerald-600 via-emerald-500 to-cyan-500 hover:from-emerald-700 hover:via-emerald-600 hover:to-cyan-600 text-white shadow-lg shadow-emerald-500/30'
                    : 'bg-gradient-to-r from-red-600 via-red-500 to-orange-500 hover:from-red-700 hover:via-red-600 hover:to-orange-600 text-white shadow-lg shadow-red-500/30'
                }`}
              >
                <MousePointerClick className="w-5 h-5 mr-2" />
                Abrir no MT5 — {isBuy ? 'COMPRA' : 'VENDA'} {instrument.name}
              </Button>

              {/* Secondary: Copy Signal */}
              <Button
                onClick={handleCopySignal}
                variant="outline"
                className={`w-full h-9 text-xs font-semibold transition-all ${
                  isBuy
                    ? 'border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10'
                    : 'border-red-500/40 text-red-400 hover:bg-red-500/10'
                }`}
              >
                <Copy className="w-3.5 h-3.5 mr-2" />
                Copiar Sinal Completo
              </Button>

              {/* Tertiary Actions Row */}
              <div className="grid grid-cols-3 gap-2">
                {/* Compact Copy */}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleCopyCompact}
                  className="h-8 text-[10px] border-border/40 hover:border-cyan-500/40 hover:text-cyan-400 hover:bg-cyan-500/5 transition-all"
                  title="Copiar sinal compacto (formato rápido)"
                >
                  <Copy className="w-3 h-3 mr-1" />
                  Rápido
                </Button>

                {/* MT5 Web — Opens Broker Selector */}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => { setBrokerDialogOpen(true); setBrokerSearch(''); }}
                  className="h-8 text-[10px] border-border/40 hover:border-violet-500/40 hover:text-violet-400 hover:bg-violet-500/5 transition-all"
                  title="Escolha seu broker para abrir o MT5 Web Terminal"
                >
                  <Globe className="w-3 h-3 mr-1" />
                  MT5 Web
                </Button>

                {/* CSV Export */}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleExportCSV}
                  className="h-8 text-[10px] border-border/40 hover:border-amber-500/40 hover:text-amber-400 hover:bg-amber-500/5 transition-all"
                  title="Exportar sinais em CSV para MT5"
                >
                  <FileSpreadsheet className="w-3 h-3 mr-1" />
                  CSV
                </Button>
              </div>
            </div>

            {/* How to use guide */}
            <div className="bg-secondary/20 rounded-lg p-3 border border-border/15">
              <p className="text-[9px] text-muted-foreground font-semibold mb-1.5 flex items-center gap-1">
                <Bell className="w-3 h-3" />
                Como usar o Trade Rápido
              </p>
              <ol className="text-[9px] text-muted-foreground/70 space-y-1 list-decimal list-inside">
                <li>Clique em <strong className="text-foreground">Abrir no MT5</strong> e escolha seu broker</li>
                <li>O sinal é copiado automaticamente + MT5 Web abre</li>
                <li>No MT5: <strong className="text-foreground">Nova Ordem</strong> → cole os valores do card flutuante</li>
                <li>Clique <strong className="text-foreground">Buy/Sell</strong> no MT5 para confirmar a entrada</li>
                <li>Após executada, as linhas de SL/TP <strong className="text-emerald-400">aparecem no gráfico</strong> automaticamente</li>
              </ol>
            </div>

            {/* Disclaimer */}
            <div className="flex items-start gap-1.5 text-[8px] text-muted-foreground/40 pt-0.5">
              <AlertTriangle className="w-2.5 h-2.5 flex-shrink-0 mt-0.5" />
              <span>
                Sinal gerado por IA. Não constitui aconselhamento financeiro.
                Sempre valide antes de executar. Trading envolve risco de perda.
              </span>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* ─── Broker Selector Dialog (with One-Click Trade) ─── */}
      <Dialog open={brokerDialogOpen} onOpenChange={setBrokerDialogOpen}>
        <DialogContent className="sm:max-w-md p-0 gap-0 overflow-hidden">
          <DialogHeader className="p-4 pb-0">
            <DialogTitle className="flex items-center gap-2 text-base">
              <Rocket className="w-5 h-5 text-violet-400" />
              Executar Trade — {isBuy ? 'COMPRA' : 'VENDA'} {instrument.name}
            </DialogTitle>
            <DialogDescription className="text-[11px]">
              Escolha seu broker. O sinal será copiado + MT5 Web abrirá automaticamente.
            </DialogDescription>
          </DialogHeader>

          {/* Trade Summary in Dialog */}
          <div className={`mx-4 mt-2 p-2.5 rounded-lg border ${
            isBuy ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-red-500/5 border-red-500/20'
          }`}>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <p className="text-[8px] text-muted-foreground uppercase">Entrada</p>
                <p className={`text-xs font-mono font-bold ${isBuy ? 'text-emerald-400' : 'text-red-400'}`}>{formatPrice(entry, symbol)}</p>
                <p className={`text-[7px] font-bold uppercase tracking-wider mt-0.5 ${
                  entryOrderType.includes('BUY') ? 'text-emerald-400' : 'text-red-400'
                }`}>{entryOrderType}</p>
              </div>
              <div>
                <p className="text-[8px] text-red-400 uppercase">Stop</p>
                <p className="text-xs font-mono font-bold text-red-400">{formatPrice(stop, symbol)}</p>
                <p className="text-[7px] font-bold uppercase tracking-wider text-red-400 mt-0.5">{slOrderType}</p>
              </div>
              <div>
                <p className="text-[8px] text-cyan-400 uppercase">Gain</p>
                <p className="text-xs font-mono font-bold text-cyan-400">{formatPrice(gain, symbol)}</p>
                <p className="text-[7px] font-bold uppercase tracking-wider text-cyan-400 mt-0.5">{tpOrderType}</p>
              </div>
            </div>
          </div>

          {/* Search */}
          <div className="px-4 pt-3 pb-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                placeholder="Buscar broker ou servidor..."
                value={brokerSearch}
                onChange={(e) => setBrokerSearch(e.target.value)}
                className="pl-8 h-8 text-xs bg-secondary/50 border-border/30 focus:border-violet-500/40"
              />
            </div>
          </div>

          {/* Broker List */}
          <div className="max-h-72 overflow-y-auto px-2 pb-2 custom-scrollbar">
            <AnimatePresence mode="wait">
              {groupedBrokers.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                  <Users className="w-8 h-8 mb-2 opacity-40" />
                  <p className="text-xs">Nenhum broker encontrado</p>
                  <p className="text-[10px] opacity-60">Tente outro termo de busca</p>
                </div>
              ) : (
                groupedBrokers.map((group) => {
                  const GroupIcon = group.icon;
                  return (
                    <div key={group.label} className="mb-2">
                      <div className="flex items-center gap-1.5 px-2 py-1.5">
                        <GroupIcon className="w-3.5 h-3.5 text-muted-foreground" />
                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{group.label}</span>
                        <span className="text-[9px] text-muted-foreground/50">— {group.desc}</span>
                      </div>
                      <div className="space-y-0.5">
                        {group.brokers.map((broker) => (
                          <button
                            key={broker.id}
                            onClick={() => handleOneClickTrade(broker)}
                            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors group text-left ${
                              broker.popular
                                ? 'hover:bg-emerald-500/10 border border-emerald-500/10'
                                : 'hover:bg-violet-500/10'
                            }`}
                          >
                            <span className="text-lg flex-shrink-0">{broker.emoji}</span>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs font-semibold text-foreground group-hover:text-emerald-400 transition-colors">
                                  {broker.name}
                                </span>
                                {broker.popular && (
                                  <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                                )}
                              </div>
                              <p className="text-[9px] text-muted-foreground/60 truncate">
                                {broker.server}
                              </p>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <MousePointerClick className="w-4 h-4 text-emerald-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })
              )}
            </AnimatePresence>
          </div>

          {/* Footer info */}
          <div className="border-t border-border/20 px-4 py-2.5 bg-secondary/20">
            <p className="text-[9px] text-muted-foreground/50 flex items-center gap-1">
              <Rocket className="w-2.5 h-2.5" />
              Clique no broker para copiar o sinal + abrir o MT5 automaticamente.
              Seu broker não está na lista? Abra o MT5 Desktop e adicione o servidor manualmente.
            </p>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── Floating Trade Confirmation Card ─── */}
      <AnimatePresence>
        {showTradeConfirm && analysis && instrument && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 50, scale: 0.9 }}
            transition={{ type: 'spring', damping: 20, stiffness: 300 }}
            className="fixed bottom-4 right-4 z-[90] max-w-xs"
          >
            <div className={`rounded-2xl border-2 shadow-2xl overflow-hidden ${
              isBuy
                ? 'border-emerald-500/50 bg-gradient-to-br from-emerald-950/95 via-[#0f172a]/95 to-[#0f172a]/95 backdrop-blur-xl'
                : 'border-red-500/50 bg-gradient-to-br from-red-950/95 via-[#0f172a]/95 to-[#0f172a]/95 backdrop-blur-xl'
            }`}>
              {/* Header */}
              <div className={`px-3 py-2 flex items-center justify-between ${
                isBuy ? 'bg-emerald-500/15' : 'bg-red-500/15'
              }`}>
                <div className="flex items-center gap-2">
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                    isBuy ? 'bg-emerald-500/20' : 'bg-red-500/20'
                  }`}>
                    {isBuy ? <ArrowUpRight className="w-4 h-4 text-emerald-400" /> : <ArrowDownRight className="w-4 h-4 text-red-400" />}
                  </div>
                  <div>
                    <p className="text-[11px] font-bold text-foreground">{isBuy ? 'COMPRA' : 'VENDA'} {instrument.name}</p>
                    <p className="text-[8px] text-muted-foreground">{lastBroker?.name || 'MT5'}</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowTradeConfirm(false)}
                  className="text-muted-foreground hover:text-foreground text-xs p-1"
                >
                  ✕
                </button>
              </div>

              {/* Trade Values - Click to Copy */}
              <div className="p-3 space-y-2">
                <p className="text-[8px] text-muted-foreground font-semibold uppercase tracking-wider">Clique para copiar cada valor</p>

                {/* Entry */}
                <button
                  onClick={() => copyField('Entrada', formatPrice(entry, symbol))}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg border transition-all ${
                    copiedField === 'Entrada'
                      ? 'bg-emerald-500/20 border-emerald-500/40'
                      : isBuy
                        ? 'bg-emerald-500/5 border-emerald-500/20 hover:bg-emerald-500/15'
                        : 'bg-red-500/5 border-red-500/20 hover:bg-red-500/15'
                  }`}
                >
                  <span className="flex items-center gap-1.5">
                    <span className="text-[9px] text-muted-foreground uppercase">🎯 Entrada</span>
                    <span className={`text-[7px] font-bold uppercase tracking-wider px-1 py-0.5 rounded ${
                      entryOrderType.includes('BUY')
                        ? 'bg-emerald-500/15 text-emerald-400'
                        : 'bg-red-500/15 text-red-400'
                    }`}>{entryOrderType}</span>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className={`font-mono text-sm font-bold ${isBuy ? 'text-emerald-400' : 'text-red-400'}`}>
                      {formatPrice(entry, symbol)}
                    </span>
                    {copiedField === 'Entrada' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3 text-muted-foreground/40" />}
                  </span>
                </button>

                {/* Stop Loss */}
                <button
                  onClick={() => copyField('Stop Loss', formatPrice(stop, symbol))}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg border transition-all ${
                    copiedField === 'Stop Loss'
                      ? 'bg-emerald-500/20 border-emerald-500/40'
                      : 'bg-red-500/5 border-red-500/20 hover:bg-red-500/15'
                  }`}
                >
                  <span className="flex items-center gap-1.5">
                    <span className="text-[9px] text-red-400 uppercase">🛑 Stop Loss</span>
                    <span className="text-[7px] font-bold uppercase tracking-wider px-1 py-0.5 rounded bg-red-500/15 text-red-400">{slOrderType}</span>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="font-mono text-sm font-bold text-red-400">{formatPrice(stop, symbol)}</span>
                    {copiedField === 'Stop Loss' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3 text-muted-foreground/40" />}
                  </span>
                </button>

                {/* Take Profit */}
                <button
                  onClick={() => copyField('Take Profit', formatPrice(gain, symbol))}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg border transition-all ${
                    copiedField === 'Take Profit'
                      ? 'bg-emerald-500/20 border-emerald-500/40'
                      : 'bg-cyan-500/5 border-cyan-500/20 hover:bg-cyan-500/15'
                  }`}
                >
                  <span className="flex items-center gap-1.5">
                    <span className="text-[9px] text-cyan-400 uppercase">✅ Take Profit</span>
                    <span className="text-[7px] font-bold uppercase tracking-wider px-1 py-0.5 rounded bg-cyan-500/15 text-cyan-400">{tpOrderType}</span>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="font-mono text-sm font-bold text-cyan-400">{formatPrice(gain, symbol)}</span>
                    {copiedField === 'Take Profit' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3 text-muted-foreground/40" />}
                  </span>
                </button>

                {/* R:R Badge */}
                <div className="flex items-center justify-between px-1 pt-1">
                  <span className="text-[9px] text-muted-foreground">R:R 1:{analysis.riskReward?.ratio || '—'}</span>
                  <span className="text-[9px] text-muted-foreground">Confiança: {analysis.confidence}%</span>
                </div>
              </div>

              {/* Footer instructions */}
              <div className={`px-3 py-2 border-t ${isBuy ? 'border-emerald-500/15 bg-emerald-500/5' : 'border-red-500/15 bg-red-500/5'}`}>
                <p className="text-[8px] text-muted-foreground/60">
                  No MT5: <strong className="text-foreground">Nova Ordem</strong> → Tipo: <strong className="text-foreground">{entryOrderType}</strong> → Cole os valores → Clique <strong className="text-foreground">{isBuy ? 'Buy' : 'Sell'}</strong>
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
