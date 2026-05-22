'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, Cell, CartesianGrid
} from 'recharts';
import {
  Target, TrendingUp, TrendingDown, Minus, Clock, CheckCircle2,
  XCircle, MinusCircle, Trash2, BarChart3, Activity, Shield,
  Trophy, AlertTriangle
} from 'lucide-react';
import { toast } from 'sonner';
import { AnalysisStrategy, STRATEGY_META, formatPrice } from './types';
import { TradeResult, PerformanceStats } from '@/hooks/use-performance';

interface PerformanceDashboardProps {
  stats: PerformanceStats;
  trades: TradeResult[];
  onMarkResult: (tradeId: string, result: 'hit' | 'miss' | 'breakeven', resultPrice?: number) => void;
  onRemoveTrade: (tradeId: string) => void;
  onClearAll: () => void;
}

// ===================== Hit Rate Ring =====================

function HitRateRing({ hitRate, size = 160 }: { hitRate: number; size?: number }) {
  const strokeWidth = 12;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (hitRate / 100) * circumference;

  const getColor = (rate: number) => {
    if (rate >= 65) return '#10b981'; // emerald
    if (rate >= 45) return '#22d3ee'; // cyan
    if (rate >= 25) return '#f59e0b'; // amber
    return '#ef4444'; // red
  };

  const getLabel = (rate: number) => {
    if (rate >= 65) return 'Excelente';
    if (rate >= 45) return 'Bom';
    if (rate >= 25) return 'Moderado';
    return 'Baixo';
  };

  const color = getColor(hitRate);

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#1e293b" strokeWidth={strokeWidth} />
        <circle
          cx={size / 2} cy={size / 2} r={radius} fill="none"
          stroke={color} strokeWidth={strokeWidth}
          strokeDasharray={circumference} strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-1000 ease-out"
          style={{ filter: `drop-shadow(0 0 12px ${color}60)` }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-4xl font-black tabular-nums" style={{ color }}>{hitRate}%</span>
        <span className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">Taxa de Acerto</span>
        <Badge className="mt-1.5 text-[9px] px-2 py-0.5"
          style={{ backgroundColor: `${color}20`, color, borderColor: `${color}40` }}>
          {getLabel(hitRate)}
        </Badge>
      </div>
    </div>
  );
}

// ===================== Stats Card =====================

function StatCard({ icon: Icon, label, value, color, subtext }: {
  icon: React.ElementType;
  label: string;
  value: number | string;
  color: string;
  subtext?: string;
}) {
  return (
    <Card className="border-border/30 bg-card/60 backdrop-blur-sm">
      <CardContent className="p-4">
        <div className="flex items-center gap-1.5 mb-2">
          <Icon className={`w-4 h-4 text-${color}-400`} />
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</span>
        </div>
        <p className={`text-2xl font-bold tabular-nums text-${color}-400`}>{value}</p>
        {subtext && <p className="text-[9px] text-muted-foreground mt-0.5">{subtext}</p>}
      </CardContent>
    </Card>
  );
}

// ===================== Strategy Comparison Bar Chart =====================

function StrategyComparison({ strategyStats }: { strategyStats: PerformanceStats['strategyStats'] }) {
  const strategies: AnalysisStrategy[] = ['smc', 'price_action', 'hybrid'];
  const data = strategies.map(s => ({
    name: STRATEGY_META[s].label,
    hitRate: strategyStats[s].hitRate,
    total: strategyStats[s].total,
    fill: s === 'smc' ? '#8b5cf6' : s === 'price_action' ? '#06b6d4' : '#f59e0b',
  }));

  return (
    <div className="h-48">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} barSize={48}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
          <XAxis
            dataKey="name"
            tick={{ fill: '#94a3b8', fontSize: 11 }}
            axisLine={{ stroke: '#334155' }}
            tickLine={false}
          />
          <YAxis
            domain={[0, 100]}
            tick={{ fill: '#94a3b8', fontSize: 10 }}
            axisLine={{ stroke: '#334155' }}
            tickLine={false}
            tickFormatter={(v: number) => `${v}%`}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#1e293b',
              border: '1px solid #334155',
              borderRadius: '8px',
              fontSize: '12px',
            }}
            formatter={(value: number, _name: string, props: any) => [
              `${value}% (${props?.payload?.total ?? 0} trades)`,
              'Taxa de Acerto',
            ]}
          />
          <Bar dataKey="hitRate" radius={[6, 6, 0, 0]}>
            {data.map((entry, index) => (
              <Cell key={index} fill={entry.fill} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ===================== Weekly Performance Line Chart =====================

function WeeklyPerformanceChart({ weeklyData }: { weeklyData: PerformanceStats['weeklyPerformance'] }) {
  return (
    <div className="h-48">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={weeklyData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
          <XAxis
            dataKey="week"
            tick={{ fill: '#94a3b8', fontSize: 10 }}
            axisLine={{ stroke: '#334155' }}
            tickLine={false}
          />
          <YAxis
            domain={[0, 100]}
            tick={{ fill: '#94a3b8', fontSize: 10 }}
            axisLine={{ stroke: '#334155' }}
            tickLine={false}
            tickFormatter={(v: number) => `${v}%`}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#1e293b',
              border: '1px solid #334155',
              borderRadius: '8px',
              fontSize: '12px',
            }}
            formatter={(value: number, _name: string, props: any) => [
              `${value}% (${props?.payload?.total ?? 0} trades)`,
              'Acerto Semanal',
            ]}
          />
          <Line
            type="monotone"
            dataKey="hitRate"
            stroke="#06b6d4"
            strokeWidth={2.5}
            dot={{ fill: '#06b6d4', r: 4, strokeWidth: 0 }}
            activeDot={{ fill: '#22d3ee', r: 6, strokeWidth: 2, stroke: '#06b6d4' }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// ===================== Mark Result Dialog =====================

function MarkResultDialog({ trade, open, onOpenChange, onMark, onRemove }: {
  trade: TradeResult | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onMark: (tradeId: string, result: 'hit' | 'miss' | 'breakeven') => void;
  onRemove: (tradeId: string) => void;
}) {
  if (!trade) return null;

  const directionLabel = trade.direction === 'BUY' ? 'COMPRA' : trade.direction === 'SELL' ? 'VENDA' : 'ESPERAR';
  const directionColor = trade.direction === 'BUY' ? 'text-emerald-400' : trade.direction === 'SELL' ? 'text-red-400' : 'text-amber-400';
  const strategyLabel = STRATEGY_META[trade.strategy]?.label || 'Híbrido';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-card border-border/50">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Target className="w-5 h-5 text-cyan-400" />
            Marcar Resultado
          </DialogTitle>
          <DialogDescription className="text-xs">
            Informe se a análise foi um acerto, erro ou empate.
          </DialogDescription>
        </DialogHeader>

        {/* Trade details */}
        <div className="bg-secondary/20 rounded-lg p-3 border border-border/20 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold">{trade.instrumentName}</span>
            <span className={`text-sm font-bold ${directionColor}`}>{directionLabel}</span>
          </div>
          <div className="grid grid-cols-3 gap-2 text-[10px]">
            <div>
              <span className="text-muted-foreground">Entrada</span>
              <p className="font-mono font-semibold text-cyan-400">{formatPrice(trade.entryPrice, trade.instrumentSymbol)}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Stop</span>
              <p className="font-mono font-semibold text-red-400">{formatPrice(trade.stopLoss, trade.instrumentSymbol)}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Alvo</span>
              <p className="font-mono font-semibold text-emerald-400">{formatPrice(trade.takeProfit, trade.instrumentSymbol)}</p>
            </div>
          </div>
          <div className="flex items-center justify-between text-[9px] text-muted-foreground">
            <span>Estratégia: {strategyLabel}</span>
            <span>Confiança: {trade.confidence}% · Acerto: {trade.successProbability}%</span>
          </div>
          {trade.result && (
            <div className="text-[9px] text-muted-foreground pt-1 border-t border-border/20">
              Resultado atual: <span className="font-semibold text-foreground">
                {trade.result === 'hit' ? '✅ Acerto' : trade.result === 'miss' ? '❌ Erro' : '➖ Empate'}
              </span>
              {trade.resultDate && ` · ${new Date(trade.resultDate).toLocaleDateString('pt-BR')}`}
            </div>
          )}
        </div>

        {/* Mark result buttons */}
        <div className="grid grid-cols-3 gap-2">
          <Button
            onClick={() => {
              onMark(trade.id, 'hit');
              toast.success('✅ Acerto registrado!', { description: trade.instrumentName });
              onOpenChange(false);
            }}
            className="bg-emerald-600 hover:bg-emerald-700 text-white h-12 flex-col gap-1"
          >
            <CheckCircle2 className="w-5 h-5" />
            <span className="text-[10px] font-semibold">Acerto</span>
          </Button>
          <Button
            onClick={() => {
              onMark(trade.id, 'miss');
              toast.error('❌ Erro registrado', { description: trade.instrumentName });
              onOpenChange(false);
            }}
            className="bg-red-600 hover:bg-red-700 text-white h-12 flex-col gap-1"
          >
            <XCircle className="w-5 h-5" />
            <span className="text-[10px] font-semibold">Erro</span>
          </Button>
          <Button
            onClick={() => {
              onMark(trade.id, 'breakeven');
              toast.info('➖ Empate registrado', { description: trade.instrumentName });
              onOpenChange(false);
            }}
            className="bg-amber-600 hover:bg-amber-700 text-white h-12 flex-col gap-1"
          >
            <MinusCircle className="w-5 h-5" />
            <span className="text-[10px] font-semibold">Empate</span>
          </Button>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between pt-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              onRemove(trade.id);
              toast.info('Trade removido', { description: trade.instrumentName });
              onOpenChange(false);
            }}
            className="text-red-400 hover:text-red-300 hover:bg-red-500/10 text-xs"
          >
            <Trash2 className="w-3 h-3 mr-1" />
            Remover Trade
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="text-muted-foreground text-xs"
          >
            Cancelar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ===================== Recent Trades Table =====================

function RecentTradesTable({ trades, onTradeClick }: {
  trades: TradeResult[];
  onTradeClick: (trade: TradeResult) => void;
}) {
  if (trades.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
        <BarChart3 className="w-10 h-10 mb-2 opacity-30" />
        <p className="text-sm">Nenhum trade registrado</p>
        <p className="text-[10px]">Analise um ativo para começar a rastrear</p>
      </div>
    );
  }

  return (
    <ScrollArea className="max-h-80">
      <div className="space-y-1.5 pr-2">
        {trades.map(trade => {
          const directionLabel = trade.direction === 'BUY' ? 'COMPRA' : trade.direction === 'SELL' ? 'VENDA' : 'ESPERAR';
          const directionColor = trade.direction === 'BUY' ? 'text-emerald-400' : trade.direction === 'SELL' ? 'text-red-400' : 'text-amber-400';

          const resultBadge = trade.result === 'hit'
            ? <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 text-[9px] px-1.5 py-0">✅ Acerto</Badge>
            : trade.result === 'miss'
              ? <Badge className="bg-red-500/15 text-red-400 border-red-500/30 text-[9px] px-1.5 py-0">❌ Erro</Badge>
              : trade.result === 'breakeven'
                ? <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/30 text-[9px] px-1.5 py-0">➖ Empate</Badge>
                : <Badge className="bg-secondary/50 text-muted-foreground border-border/30 text-[9px] px-1.5 py-0">⏳ Pendente</Badge>;

          const strategyLabel = STRATEGY_META[trade.strategy]?.label || 'Híbrido';
          const strategyColor = trade.strategy === 'smc' ? 'text-violet-400' : trade.strategy === 'price_action' ? 'text-cyan-400' : 'text-amber-400';

          return (
            <button
              key={trade.id}
              onClick={() => onTradeClick(trade)}
              className="w-full text-left flex items-center gap-3 p-2.5 rounded-lg border border-border/20 bg-card/40 hover:bg-card/70 hover:border-border/40 transition-all group"
            >
              {/* Direction indicator */}
              <div className={`flex items-center justify-center w-8 h-8 rounded-md ${
                trade.direction === 'BUY' ? 'bg-emerald-500/10' :
                trade.direction === 'SELL' ? 'bg-red-500/10' : 'bg-amber-500/10'
              }`}>
                {trade.direction === 'BUY' ? <TrendingUp className="w-4 h-4 text-emerald-400" /> :
                 trade.direction === 'SELL' ? <TrendingDown className="w-4 h-4 text-red-400" /> :
                 <Minus className="w-4 h-4 text-amber-400" />}
              </div>

              {/* Trade info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold truncate">{trade.instrumentName}</span>
                  <span className={`text-[10px] font-bold ${directionColor}`}>{directionLabel}</span>
                </div>
                <div className="flex items-center gap-2 text-[9px] text-muted-foreground mt-0.5">
                  <span className={strategyColor}>{strategyLabel}</span>
                  <span>·</span>
                  <span>Conf: {trade.confidence}%</span>
                  <span>·</span>
                  <span>{new Date(trade.timestamp).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                </div>
              </div>

              {/* Result badge */}
              <div className="flex-shrink-0">
                {resultBadge}
              </div>
            </button>
          );
        })}
      </div>
    </ScrollArea>
  );
}

// ===================== Main Performance Dashboard =====================

export function PerformanceDashboard({
  stats, trades, onMarkResult, onRemoveTrade, onClearAll
}: PerformanceDashboardProps) {
  const [selectedTrade, setSelectedTrade] = useState<TradeResult | null>(null);
  const [markDialogOpen, setMarkDialogOpen] = useState(false);

  const handleTradeClick = (trade: TradeResult) => {
    setSelectedTrade(trade);
    setMarkDialogOpen(true);
  };

  return (
    <div className="space-y-4">
      {/* Header Section: Hit Rate Ring + Stats Cards */}
      <div className="flex flex-col sm:flex-row items-center gap-6">
        {/* Hit Rate Ring */}
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 20 }}
          className="flex-shrink-0"
        >
          <HitRateRing hitRate={stats.hitRate} />
        </motion.div>

        {/* Stats Grid */}
        <div className="flex-1 w-full grid grid-cols-2 gap-3">
          <StatCard
            icon={BarChart3}
            label="Total de Trades"
            value={stats.totalTrades}
            color="cyan"
            subtext={`${stats.pendingTrades} pendentes`}
          />
          <StatCard
            icon={CheckCircle2}
            label="Acertos"
            value={stats.hitTrades}
            color="emerald"
            subtext={stats.totalTrades > 0 ? `${Math.round((stats.hitTrades / stats.totalTrades) * 100)}% do total` : undefined}
          />
          <StatCard
            icon={XCircle}
            label="Erros"
            value={stats.missTrades}
            color="red"
            subtext={stats.totalTrades > 0 ? `${Math.round((stats.missTrades / stats.totalTrades) * 100)}% do total` : undefined}
          />
          <StatCard
            icon={MinusCircle}
            label="Empates"
            value={stats.breakevenTrades}
            color="amber"
            subtext={stats.totalTrades > 0 ? `${Math.round((stats.breakevenTrades / stats.totalTrades) * 100)}% do total` : undefined}
          />
        </div>
      </div>

      {/* Confidence + Best Strategy */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="border-border/30 bg-card/60 backdrop-blur-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-1.5 mb-2">
              <Activity className="w-4 h-4 text-cyan-400" />
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Confiança Média</span>
            </div>
            <p className="text-2xl font-bold tabular-nums text-cyan-400">{stats.avgConfidence}%</p>
            <Progress value={stats.avgConfidence} className="mt-2 h-1.5 bg-secondary/50" />
          </CardContent>
        </Card>
        <Card className="border-border/30 bg-card/60 backdrop-blur-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-1.5 mb-2">
              <Trophy className="w-4 h-4 text-amber-400" />
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Melhor Estratégia</span>
            </div>
            {stats.bestStrategy ? (
              <div className="flex items-center gap-2">
                <span className="text-xl">{STRATEGY_META[stats.bestStrategy].emoji}</span>
                <div>
                  <p className="text-lg font-bold text-amber-400">{STRATEGY_META[stats.bestStrategy].label}</p>
                  <p className="text-[9px] text-muted-foreground">
                    {stats.strategyStats[stats.bestStrategy].hitRate}% acerto · {stats.strategyStats[stats.bestStrategy].total} trades
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">Mínimo 3 trades resolvidos</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Strategy Comparison */}
        <Card className="border-border/30 bg-card/60 backdrop-blur-sm">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-xs flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-violet-400" />
              Comparação de Estratégias
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <StrategyComparison strategyStats={stats.strategyStats} />
          </CardContent>
        </Card>

        {/* Weekly Performance */}
        <Card className="border-border/30 bg-card/60 backdrop-blur-sm">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-xs flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-cyan-400" />
              Desempenho Semanal
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <WeeklyPerformanceChart weeklyData={stats.weeklyPerformance} />
          </CardContent>
        </Card>
      </div>

      {/* Recent Trades */}
      <Card className="border-border/30 bg-card/60 backdrop-blur-sm">
        <CardHeader className="pb-2 pt-4 px-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-xs flex items-center gap-1.5">
              <Target className="w-3.5 h-3.5 text-cyan-400" />
              Trades Recentes
              {stats.pendingTrades > 0 && (
                <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/30 text-[9px] px-1.5 py-0 ml-1">
                  {stats.pendingTrades} pendente{stats.pendingTrades !== 1 ? 's' : ''}
                </Badge>
              )}
            </CardTitle>
            {trades.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  if (confirm('Limpar todo o histórico de performance? Esta ação não pode ser desfeita.')) {
                    onClearAll();
                    toast.info('Histórico de performance limpo');
                  }
                }}
                className="text-red-400 hover:text-red-300 hover:bg-red-500/10 h-6 text-[9px] px-2"
              >
                <Trash2 className="w-3 h-3 mr-1" />
                Limpar
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <RecentTradesTable trades={stats.recentResults} onTradeClick={handleTradeClick} />
        </CardContent>
      </Card>

      {/* Mark Result Dialog */}
      <MarkResultDialog
        trade={selectedTrade}
        open={markDialogOpen}
        onOpenChange={setMarkDialogOpen}
        onMark={onMarkResult}
        onRemove={onRemoveTrade}
      />
    </div>
  );
}
