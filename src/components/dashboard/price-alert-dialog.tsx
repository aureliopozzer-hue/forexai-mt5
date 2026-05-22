'use client';

import { useState, useMemo } from 'react';
import {
  Bell, Plus, Trash2, CheckCircle2, ArrowUpCircle, ArrowDownCircle,
  BellRing, BellOff, AlertTriangle
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { PriceAlert, UsePriceAlertsReturn } from '@/hooks/use-price-alerts';
import { QuoteData, getVal, formatPrice } from './types';

interface PriceAlertDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  instrumentSymbol: string;
  instrumentName: string;
  currentQuote: QuoteData | undefined;
  priceAlerts: UsePriceAlertsReturn;
}

export function PriceAlertDialog({
  open,
  onOpenChange,
  instrumentSymbol,
  instrumentName,
  currentQuote,
  priceAlerts,
}: PriceAlertDialogProps) {
  const [targetPrice, setTargetPrice] = useState<string>('');
  const [direction, setDirection] = useState<'above' | 'below'>('above');

  const currentPrice = getVal(currentQuote?.regularMarketPrice);

  // Pre-fill target price with current price ± pips when current price is available
  const handlePresetPrice = (offset: number) => {
    if (!currentPrice || currentPrice <= 0) return;
    const pip = currentPrice > 100 ? 0.5 : currentPrice > 10 ? 0.1 : currentPrice > 1 ? 0.005 : 0.0001;
    const newPrice = currentPrice + offset * pip;
    setTargetPrice(newPrice > 0 ? newPrice.toString() : '');
  };

  const handleAddAlert = () => {
    const price = parseFloat(targetPrice);
    if (!price || price <= 0) return;
    priceAlerts.addAlert(instrumentSymbol, instrumentName, price, direction);
    setTargetPrice('');
  };

  // Filter alerts for the current instrument
  const instrumentAlerts = useMemo(() => {
    return priceAlerts.alerts.filter(a => a.instrumentSymbol === instrumentSymbol);
  }, [priceAlerts.alerts, instrumentSymbol]);

  const activeAlerts = instrumentAlerts.filter(a => !a.triggered);
  const triggeredAlerts = instrumentAlerts.filter(a => a.triggered);

  // All alerts across all instruments
  const allActiveAlerts = priceAlerts.alerts.filter(a => !a.triggered);
  const allTriggeredAlerts = priceAlerts.alerts.filter(a => a.triggered);

  const notificationGranted = priceAlerts.notificationPermission === 'granted';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg bg-card border-border/50 max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-cyan-400" />
            Alertas de Preço
          </DialogTitle>
          <DialogDescription>
            Receba notificações quando o preço atingir o alvo definido.
          </DialogDescription>
        </DialogHeader>

        {/* Current price display */}
        <div className="flex items-center gap-3 p-3 rounded-lg bg-background/50 border border-border/30">
          <span className="text-sm text-muted-foreground">{instrumentName}</span>
          <Separator orientation="vertical" className="h-5 bg-border/40" />
          <span className="font-mono font-bold text-lg text-cyan-400">
            {currentPrice > 0 ? formatPrice(currentPrice, instrumentSymbol) : '—'}
          </span>
          {currentPrice > 0 && (
            <Badge variant="outline" className="text-[9px] border-emerald-500/30 text-emerald-400">
              Preço Atual
            </Badge>
          )}
        </div>

        {/* Notification permission warning */}
        {!notificationGranted && (
          <div className="flex items-center gap-2 p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20">
            <BellOff className="w-4 h-4 text-amber-400 flex-shrink-0" />
            <span className="text-[11px] text-amber-300 flex-1">
              Notificações do navegador desativadas. Ative para receber alertas push.
            </span>
            <Button
              size="sm"
              variant="outline"
              className="h-6 text-[10px] border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
              onClick={async () => {
                const granted = await priceAlerts.requestNotificationPermission();
                if (!granted) {
                  // Toast will be shown by the hook
                }
              }}
            >
              Ativar
            </Button>
          </div>
        )}

        {/* Create new alert form */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Novo Alerta</span>
            <span className="text-[10px] text-muted-foreground">para {instrumentName}</span>
          </div>

          {/* Direction selector */}
          <div className="flex gap-2">
            <button
              onClick={() => setDirection('above')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg border text-sm font-medium transition-all ${
                direction === 'above'
                  ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-400'
                  : 'border-border/40 bg-card/50 text-muted-foreground hover:border-border/80'
              }`}
            >
              <ArrowUpCircle className="w-4 h-4" />
              Acima de
            </button>
            <button
              onClick={() => setDirection('below')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg border text-sm font-medium transition-all ${
                direction === 'below'
                  ? 'border-red-500/50 bg-red-500/10 text-red-400'
                  : 'border-border/40 bg-card/50 text-muted-foreground hover:border-border/80'
              }`}
            >
              <ArrowDownCircle className="w-4 h-4" />
              Abaixo de
            </button>
          </div>

          {/* Price input + quick presets */}
          <div className="flex gap-2">
            <Input
              type="number"
              step="any"
              placeholder="Preço alvo..."
              value={targetPrice}
              onChange={(e) => setTargetPrice(e.target.value)}
              className="flex-1 font-mono bg-background/50 border-border/40"
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAddAlert();
              }}
            />
            <Button
              onClick={handleAddAlert}
              disabled={!targetPrice || parseFloat(targetPrice) <= 0}
              className="bg-cyan-500/20 border border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/30 hover:text-cyan-300"
            >
              <Plus className="w-4 h-4" />
            </Button>
          </div>

          {/* Quick price presets */}
          {currentPrice > 0 && (
            <div className="flex gap-1.5 flex-wrap">
              <span className="text-[10px] text-muted-foreground self-center mr-1">Atalhos:</span>
              {[-5, -3, -1, 1, 3, 5].map(offset => (
                <button
                  key={offset}
                  onClick={() => handlePresetPrice(offset)}
                  className={`text-[10px] px-2 py-1 sm:py-0.5 rounded border transition-all ${
                    offset > 0
                      ? 'border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10'
                      : 'border-red-500/30 text-red-400 hover:bg-red-500/10'
                  }`}
                >
                  {offset > 0 ? '+' : ''}{offset > 0 ? '+' : '−'}{Math.abs(offset)} pips
                </button>
              ))}
              <button
                onClick={() => setTargetPrice(currentPrice.toString())}
                className="text-[10px] px-2 py-1 sm:py-0.5 rounded border border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/10"
              >
                Preço atual
              </button>
            </div>
          )}
        </div>

        <Separator className="bg-border/30" />

        {/* Active alerts for current instrument */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium flex items-center gap-1.5">
              <BellRing className="w-3.5 h-3.5 text-cyan-400" />
              Alertas Ativos
              {activeAlerts.length > 0 && (
                <Badge variant="outline" className="text-[9px] border-cyan-500/30 text-cyan-400 px-1.5">
                  {activeAlerts.length}
                </Badge>
              )}
            </span>
            {priceAlerts.triggeredCount > 0 && (
              <button
                onClick={priceAlerts.clearTriggered}
                className="text-[10px] text-muted-foreground hover:text-red-400 transition-colors"
              >
                Limpar disparados
              </button>
            )}
          </div>

          {activeAlerts.length === 0 && triggeredAlerts.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground">
              <Bell className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Nenhum alerta para {instrumentName}</p>
              <p className="text-[11px] mt-1">Crie um alerta acima para começar</p>
            </div>
          ) : (
            <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1" style={{ scrollbarWidth: 'thin' }}>
              {activeAlerts.map(alert => (
                <AlertRow key={alert.id} alert={alert} onRemove={priceAlerts.removeAlert} />
              ))}
              {triggeredAlerts.length > 0 && activeAlerts.length > 0 && (
                <div className="pt-1">
                  <span className="text-[10px] text-muted-foreground">Recentemente disparados:</span>
                </div>
              )}
              {triggeredAlerts.map(alert => (
                <AlertRow key={alert.id} alert={alert} onRemove={priceAlerts.removeAlert} />
              ))}
            </div>
          )}
        </div>

        {/* All alerts across instruments (if there are any from other instruments) */}
        {allActiveAlerts.filter(a => a.instrumentSymbol !== instrumentSymbol).length > 0 && (
          <>
            <Separator className="bg-border/30" />
            <div className="space-y-2">
              <span className="text-sm font-medium text-muted-foreground">Outros Alertas Ativos</span>
              <div className="max-h-32 overflow-y-auto space-y-1.5 pr-1" style={{ scrollbarWidth: 'thin' }}>
                {allActiveAlerts
                  .filter(a => a.instrumentSymbol !== instrumentSymbol)
                  .map(alert => (
                    <AlertRow key={alert.id} alert={alert} onRemove={priceAlerts.removeAlert} />
                  ))}
              </div>
            </div>
          </>
        )}

        {/* Summary */}
        {(allActiveAlerts.length > 0 || allTriggeredAlerts.length > 0) && (
          <div className="flex items-center justify-between pt-1 text-[10px] text-muted-foreground">
            <span>{allActiveAlerts.length} ativo{allActiveAlerts.length !== 1 ? 's' : ''} · {allTriggeredAlerts.length} disparado{allTriggeredAlerts.length !== 1 ? 's' : ''}</span>
            {notificationGranted ? (
              <span className="flex items-center gap-1 text-emerald-400">
                <Bell className="w-3 h-3" /> Notificações ativas
              </span>
            ) : (
              <span className="flex items-center gap-1 text-amber-400">
                <AlertTriangle className="w-3 h-3" /> Notificações desativadas
              </span>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function AlertRow({ alert, onRemove }: { alert: PriceAlert; onRemove: (id: string) => void }) {
  const dirLabel = alert.direction === 'above' ? 'Acima de' : 'Abaixo de';
  const DirIcon = alert.direction === 'above' ? ArrowUpCircle : ArrowDownCircle;
  const dirColor = alert.direction === 'above' ? 'text-emerald-400' : 'text-red-400';

  if (alert.triggered) {
    return (
      <div className="flex items-center gap-2 p-2 rounded-lg bg-emerald-500/5 border border-emerald-500/20">
        <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1">
            <span className="text-sm font-medium truncate">{alert.instrumentName}</span>
            <span className="text-[10px] text-emerald-400">✓ Disparado</span>
          </div>
          <span className="text-[11px] text-muted-foreground">
            {dirLabel} {formatPrice(alert.targetPrice, alert.instrumentSymbol)}
          </span>
        </div>
        <button
          onClick={() => onRemove(alert.id)}
          className="p-1 rounded hover:bg-red-500/10 text-muted-foreground hover:text-red-400 transition-colors"
          title="Remover"
        >
          <Trash2 className="w-3 h-3" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 p-2 rounded-lg bg-background/30 border border-border/30">
      <DirIcon className={`w-4 h-4 ${dirColor} flex-shrink-0`} />
      <div className="flex-1 min-w-0">
        <span className="text-sm font-medium truncate block">
          {dirLabel} {formatPrice(alert.targetPrice, alert.instrumentSymbol)}
        </span>
        <span className="text-[10px] text-muted-foreground">
          Criado em {new Date(alert.createdAt).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>
      <button
        onClick={() => onRemove(alert.id)}
        className="p-1 rounded hover:bg-red-500/10 text-muted-foreground hover:text-red-400 transition-colors"
        title="Remover alerta"
      >
        <Trash2 className="w-3 h-3" />
      </button>
    </div>
  );
}
