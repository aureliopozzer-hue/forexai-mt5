'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Clock, Plus, Trash2, Play, Pause, Calendar, Zap, AlertTriangle,
  Timer, ChevronRight
} from 'lucide-react';
import { toast } from 'sonner';
import {
  ScheduledAnalysis,
  DAY_LABELS,
  DAY_FULL_LABELS,
  getNextRunTime,
  formatCountdown,
} from '@/hooks/use-scheduled-analysis';
import {
  Instrument, AnalysisStrategy, STRATEGY_META, MarketCategory, CATEGORY_META, getInstruments,
} from './types';

interface ScheduledAnalysisDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  schedules: ScheduledAnalysis[];
  onAddSchedule: (schedule: Omit<ScheduledAnalysis, 'id' | 'enabled' | 'lastRun' | 'createdAt'>) => ScheduledAnalysis | null;
  onRemoveSchedule: (id: string) => void;
  onUpdateSchedule: (id: string, updates: Partial<ScheduledAnalysis>) => void;
  onToggleSchedule: (id: string) => void;
  onClearAll: () => void;
  canAddMore: boolean;
  getNextRun: (id: string) => Date | null;
  currentCategory: MarketCategory;
  credits: number;
  isSubscribed: boolean;
}

// Preset configurations
const PRESETS = [
  { label: 'Diário 9h', time: '09:00', days: [1, 2, 3, 4, 5] },
  { label: 'Diário 15h', time: '15:00', days: [1, 2, 3, 4, 5] },
  { label: 'Seg-Sex 9h', time: '09:00', days: [1, 2, 3, 4, 5] },
  { label: 'Diário 8h', time: '08:00', days: [0, 1, 2, 3, 4, 5, 6] },
  { label: 'Diário 17h', time: '17:00', days: [1, 2, 3, 4, 5] },
];

export function ScheduledAnalysisDialog({
  open,
  onOpenChange,
  schedules,
  onAddSchedule,
  onRemoveSchedule,
  onUpdateSchedule,
  onToggleSchedule,
  onClearAll,
  canAddMore,
  getNextRun,
  currentCategory,
  credits,
  isSubscribed,
}: ScheduledAnalysisDialogProps) {
  // Form state
  const [selectedSymbol, setSelectedSymbol] = useState<string>('');
  const [selectedStrategy, setSelectedStrategy] = useState<AnalysisStrategy>('hybrid');
  const [selectedTime, setSelectedTime] = useState<string>('09:00');
  const [selectedDays, setSelectedDays] = useState<number[]>([1, 2, 3, 4, 5]);

  // Live countdown update
  const [now, setNow] = useState<Date>(new Date());
  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(interval);
  }, []);

  // Get instruments for current category
  const instruments = useMemo(() => {
    return getInstruments(currentCategory);
  }, [currentCategory]);

  // Find the selected instrument object
  const selectedInstrument = useMemo(() => {
    return instruments.find(i => i.symbol === selectedSymbol) || null;
  }, [instruments, selectedSymbol]);

  // Auto-select first instrument when category changes or dialog opens
  useEffect(() => {
    if (open && instruments.length > 0 && !instruments.find(i => i.symbol === selectedSymbol)) {
      setSelectedSymbol(instruments[0].symbol);
    }
  }, [open, instruments, selectedSymbol]);

  // Day toggle
  const toggleDay = useCallback((day: number) => {
    setSelectedDays(prev =>
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
    );
  }, []);

  // Select all weekdays
  const selectWeekdays = useCallback(() => {
    setSelectedDays([1, 2, 3, 4, 5]);
  }, []);

  // Select all days
  const selectAllDays = useCallback(() => {
    setSelectedDays([0, 1, 2, 3, 4, 5, 6]);
  }, []);

  // Clear all days
  const clearDays = useCallback(() => {
    setSelectedDays([]);
  }, []);

  // Add a schedule from the form
  const handleAddSchedule = useCallback(() => {
    if (!selectedSymbol || !selectedInstrument) {
      toast.error('Selecione um instrumento', { description: 'Escolha o ativo para análise.' });
      return;
    }
    if (selectedDays.length === 0) {
      toast.error('Selecione pelo menos um dia', { description: 'Escolha os dias da semana.' });
      return;
    }
    if (!selectedTime || !/^\d{2}:\d{2}$/.test(selectedTime)) {
      toast.error('Horário inválido', { description: 'Use o formato HH:MM (24h).' });
      return;
    }
    const [h, m] = selectedTime.split(':').map(Number);
    if (h < 0 || h > 23 || m < 0 || m > 59) {
      toast.error('Horário inválido', { description: 'Hora: 0-23, Minuto: 0-59.' });
      return;
    }

    const result = onAddSchedule({
      instrumentSymbol: selectedSymbol,
      instrumentName: selectedInstrument.name,
      strategy: selectedStrategy,
      time: selectedTime,
      days: [...selectedDays].sort(),
    });

    if (result) {
      toast.success('Agendamento criado!', {
        description: `${selectedInstrument.name} · ${selectedTime} · ${selectedDays.map(d => DAY_LABELS[d]).join(', ')}`
      });
      // Reset form
      setSelectedTime('09:00');
    } else {
      toast.error('Limite atingido', { description: `Máximo de ${10} agendamentos.` });
    }
  }, [selectedSymbol, selectedInstrument, selectedStrategy, selectedTime, selectedDays, onAddSchedule]);

  // Apply a preset
  const applyPreset = useCallback((preset: typeof PRESETS[number]) => {
    setSelectedTime(preset.time);
    setSelectedDays([...preset.days]);
  }, []);

  // Format last run time
  const formatLastRun = (lastRun?: string): string => {
    if (!lastRun) return 'Nunca';
    try {
      const date = new Date(lastRun);
      return date.toLocaleDateString('pt-BR', {
        day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
      });
    } catch {
      return '—';
    }
  };

  // Credits warning
  const lowCredits = !isSubscribed && credits < 5;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-hidden flex flex-col bg-card border-border/50">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Clock className="w-5 h-5 text-cyan-400" />
            Análises Agendadas
          </DialogTitle>
          <DialogDescription className="text-[11px] text-muted-foreground">
            Programe análises automáticas nos horários desejados. Cada análise consome 5 créditos.
          </DialogDescription>
        </DialogHeader>

        {lowCredits && (
          <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 rounded-lg p-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            <span className="text-[10px] text-amber-400">
              Créditos baixos ({credits} restantes). As análises agendadas podem falhar.
            </span>
          </div>
        )}

        {/* Create Form */}
        {canAddMore ? (
          <div className="space-y-3 p-3 rounded-lg bg-secondary/30 border border-border/30">
            <div className="flex items-center gap-1.5 mb-1">
              <Plus className="w-3.5 h-3.5 text-cyan-400" />
              <span className="text-xs font-semibold">Novo Agendamento</span>
            </div>

            {/* Presets */}
            <div className="flex flex-wrap gap-1.5">
              {PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  onClick={() => applyPreset(preset)}
                  className="px-2 py-1 rounded-md text-[9px] font-semibold bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 hover:bg-cyan-500/20 transition-all"
                >
                  {preset.label}
                </button>
              ))}
            </div>

            {/* Instrument + Strategy */}
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-[9px] text-muted-foreground font-medium">Instrumento</label>
                <Select value={selectedSymbol} onValueChange={setSelectedSymbol}>
                  <SelectTrigger className="h-8 text-[11px] w-full">
                    <SelectValue placeholder="Selecionar..." />
                  </SelectTrigger>
                  <SelectContent>
                    <ScrollArea className="max-h-48">
                      {instruments.map((inst) => (
                        <SelectItem key={inst.symbol} value={inst.symbol} className="text-[11px]">
                          {inst.flag} {inst.name}
                        </SelectItem>
                      ))}
                    </ScrollArea>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <label className="text-[9px] text-muted-foreground font-medium">Estratégia</label>
                <Select value={selectedStrategy} onValueChange={(v) => setSelectedStrategy(v as AnalysisStrategy)}>
                  <SelectTrigger className="h-8 text-[11px] w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(['smc', 'price_action', 'hybrid'] as AnalysisStrategy[]).map((s) => {
                      const meta = STRATEGY_META[s];
                      return (
                        <SelectItem key={s} value={s} className="text-[11px]">
                          {meta.emoji} {meta.label}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Time */}
            <div className="space-y-1">
              <label className="text-[9px] text-muted-foreground font-medium">Horário (24h)</label>
              <Input
                type="time"
                value={selectedTime}
                onChange={(e) => setSelectedTime(e.target.value)}
                className="h-8 text-[11px] w-32"
              />
            </div>

            {/* Days of Week */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-[9px] text-muted-foreground font-medium">Dias da Semana</label>
                <div className="flex gap-1.5">
                  <button onClick={selectWeekdays} className="text-[8px] text-cyan-400 hover:text-cyan-300">Seg-Sex</button>
                  <button onClick={selectAllDays} className="text-[8px] text-cyan-400 hover:text-cyan-300">Todos</button>
                  <button onClick={clearDays} className="text-[8px] text-muted-foreground hover:text-foreground">Limpar</button>
                </div>
              </div>
              <div className="flex gap-1.5">
                {[1, 2, 3, 4, 5, 6, 0].map((day) => (
                  <button
                    key={day}
                    onClick={() => toggleDay(day)}
                    className={`w-9 h-8 rounded-md text-[10px] font-semibold transition-all border ${
                      selectedDays.includes(day)
                        ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30'
                        : 'bg-secondary/50 text-muted-foreground border-border/30 hover:border-border/50'
                    }`}
                    title={DAY_FULL_LABELS[day]}
                  >
                    {DAY_LABELS[day]}
                  </button>
                ))}
              </div>
            </div>

            {/* Add Button */}
            <Button
              onClick={handleAddSchedule}
              disabled={!selectedSymbol || selectedDays.length === 0}
              className="w-full bg-gradient-to-r from-cyan-500 to-violet-500 hover:from-cyan-600 hover:to-violet-600 text-white text-xs h-8"
            >
              <Plus className="w-3.5 h-3.5 mr-1" />
              Agendar Análise
            </Button>
          </div>
        ) : (
          <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-center">
            <p className="text-[11px] text-amber-400 font-semibold">Limite de 10 agendamentos atingido</p>
            <p className="text-[9px] text-muted-foreground mt-1">Remova um agendamento para adicionar outro.</p>
          </div>
        )}

        <Separator className="bg-border/30" />

        {/* Existing Schedules */}
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-violet-400" />
            Agendamentos ({schedules.length})
          </span>
          {schedules.length > 0 && (
            <button
              onClick={onClearAll}
              className="text-[9px] text-red-400 hover:text-red-300 font-medium"
            >
              Limpar Todos
            </button>
          )}
        </div>

        <ScrollArea className="flex-1 max-h-64">
          {schedules.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <Clock className="w-10 h-10 mb-2 opacity-30" />
              <p className="text-xs font-medium">Nenhum agendamento</p>
              <p className="text-[10px] mt-1">Crie um agendamento acima para análise automática.</p>
            </div>
          ) : (
            <div className="space-y-2 pr-1">
              {schedules.map((schedule) => {
                const nextRun = getNextRun(schedule.id);
                const countdown = formatCountdown(nextRun);
                const strategyMeta = STRATEGY_META[schedule.strategy];
                const instrument = instruments.find(i => i.symbol === schedule.instrumentSymbol);

                return (
                  <motion.div
                    key={schedule.id}
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`p-3 rounded-lg border transition-all ${
                      schedule.enabled
                        ? 'bg-card border-border/40'
                        : 'bg-secondary/20 border-border/20 opacity-60'
                    }`}
                  >
                    {/* Top row: instrument + strategy + toggle */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold">{instrument?.flag || '💱'}</span>
                        <div>
                          <p className="text-[11px] font-semibold leading-tight">{schedule.instrumentName}</p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <Badge
                              variant="outline"
                              className={`text-[8px] px-1 py-0 ${
                                schedule.strategy === 'smc' ? 'border-violet-500/30 text-violet-400' :
                                schedule.strategy === 'price_action' ? 'border-cyan-500/30 text-cyan-400' :
                                'border-amber-500/30 text-amber-400'
                              }`}
                            >
                              {strategyMeta.emoji} {strategyMeta.label}
                            </Badge>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={schedule.enabled}
                          onCheckedChange={() => onToggleSchedule(schedule.id)}
                        />
                        <button
                          onClick={() => onRemoveSchedule(schedule.id)}
                          className="p-1 rounded-md hover:bg-red-500/10 text-muted-foreground hover:text-red-400 transition-all"
                          title="Remover"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Schedule details */}
                    <div className="mt-2 flex items-center gap-3 text-[10px] text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        <span className="font-mono font-semibold text-foreground">{schedule.time}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        <span>{schedule.days.sort().map(d => DAY_LABELS[d]).join(', ')}</span>
                      </div>
                    </div>

                    {/* Countdown + last run */}
                    <div className="mt-1.5 flex items-center justify-between">
                      {schedule.enabled && nextRun ? (
                        <div className="flex items-center gap-1.5">
                          <Timer className="w-3 h-3 text-cyan-400" />
                          <span className="text-[10px] font-semibold text-cyan-400">
                            Próxima: {countdown}
                          </span>
                        </div>
                      ) : schedule.enabled ? (
                        <span className="text-[10px] text-amber-400">Sem próxima execução</span>
                      ) : (
                        <span className="text-[10px] text-muted-foreground">Pausado</span>
                      )}
                      {schedule.lastRun && (
                        <span className="text-[9px] text-muted-foreground">
                          Última: {formatLastRun(schedule.lastRun)}
                        </span>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </ScrollArea>

        {/* Footer info */}
        <div className="flex items-center justify-between pt-2 border-t border-border/20">
          <div className="flex items-center gap-1.5 text-[9px] text-muted-foreground">
            <Zap className="w-3 h-3" />
            <span>Cada análise consome 5 créditos</span>
          </div>
          <div className="flex items-center gap-1.5 text-[9px] text-muted-foreground">
            <Clock className="w-3 h-3" />
            <span>Verificação a cada 30s</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
