'use client';

import { useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  Mail, Copy, Image as ImageIcon, TrendingUp, TrendingDown,
  Target, Flame, Award, BarChart3, Zap, Crown
} from 'lucide-react';
import { toast } from 'sonner';
import { WeeklyReport, buildReportText } from '@/hooks/use-weekly-report';

interface WeeklyReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  report: WeeklyReport;
  isPro: boolean;
}

// ===================== Hit Rate Ring =====================

function HitRateRing({ value, size = 100 }: { value: number; size?: number }) {
  const strokeWidth = 8;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;

  const getColor = (val: number) => {
    if (val >= 65) return '#10b981';
    if (val >= 45) return '#22d3ee';
    if (val >= 25) return '#f59e0b';
    return '#ef4444';
  };

  const color = getColor(value);

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#1e293b" strokeWidth={strokeWidth} />
        <circle
          cx={size / 2} cy={size / 2} r={radius} fill="none"
          stroke={color} strokeWidth={strokeWidth}
          strokeDasharray={circumference} strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ filter: `drop-shadow(0 0 6px ${color}50)` }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold tabular-nums" style={{ color }}>{value}%</span>
        <span className="text-[9px] text-muted-foreground uppercase tracking-wider">Acerto</span>
      </div>
    </div>
  );
}

// ===================== Stat Card =====================

function StatCard({ icon: Icon, label, value, color, subtext }: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  color: string;
  subtext?: string;
}) {
  return (
    <div className="bg-secondary/30 rounded-lg p-3 text-center border border-border/20">
      <Icon className={`w-4 h-4 mx-auto mb-1`} style={{ color }} />
      <p className="text-lg font-bold tabular-nums" style={{ color }}>{value}</p>
      <p className="text-[9px] text-muted-foreground uppercase">{label}</p>
      {subtext && <p className="text-[8px] text-muted-foreground mt-0.5">{subtext}</p>}
    </div>
  );
}

// ===================== Canvas Image Generator =====================

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

function generateReportImage(report: WeeklyReport, isPro: boolean) {
  const w = 600;
  const h = isPro ? 820 : 700;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // Background gradient
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
  ctx.fillRect(0, 0, w, 4);

  // Watermark
  ctx.fillStyle = 'rgba(6, 182, 212, 0.06)';
  ctx.font = 'bold 80px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('ForexAI Pro', w / 2, h - 40);
  ctx.textAlign = 'left';

  // Brand
  ctx.fillStyle = '#06b6d4';
  ctx.font = 'bold 24px system-ui, sans-serif';
  ctx.fillText('ForexAI', 32, 48);
  ctx.fillStyle = '#e2e8f0';
  ctx.font = 'bold 24px system-ui, sans-serif';
  ctx.fillText(' Pro', 152, 48);

  // Title
  ctx.fillStyle = '#f1f5f9';
  ctx.font = 'bold 20px system-ui, sans-serif';
  ctx.fillText('📧 Relatório Semanal', 32, 82);

  // Date range
  ctx.fillStyle = '#94a3b8';
  ctx.font = '13px system-ui, sans-serif';
  ctx.fillText(`${report.period.start} — ${report.period.end}`, 32, 104);

  // Pro badge
  if (isPro) {
    ctx.fillStyle = '#10b981';
    ctx.font = 'bold 12px system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('👑 PRO', w - 32, 48);
    ctx.textAlign = 'left';
  }

  // Separator
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.2)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(32, 120);
  ctx.lineTo(w - 32, 120);
  ctx.stroke();

  // ===== Performance Section =====
  ctx.fillStyle = '#22d3ee';
  ctx.font = 'bold 14px system-ui, sans-serif';
  ctx.fillText('🎯 Performance da Semana', 32, 148);

  // Performance box
  ctx.fillStyle = 'rgba(30, 41, 59, 0.6)';
  roundRect(ctx, 24, 160, w - 48, 90, 12);
  ctx.fill();
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.15)';
  ctx.lineWidth = 1;
  roundRect(ctx, 24, 160, w - 48, 90, 12);
  ctx.stroke();

  // Hit rate
  const hitRateColor = report.performance.hitRate >= 65 ? '#10b981' : report.performance.hitRate >= 45 ? '#22d3ee' : '#f59e0b';
  ctx.fillStyle = '#94a3b8';
  ctx.font = '11px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Taxa de Acerto', 120, 195);
  ctx.fillStyle = hitRateColor;
  ctx.font = 'bold 28px system-ui, sans-serif';
  ctx.fillText(`${report.performance.hitRate}%`, 120, 230);

  // Total analyses
  ctx.fillStyle = '#94a3b8';
  ctx.font = '11px system-ui, sans-serif';
  ctx.fillText('Análises', w / 2, 195);
  ctx.fillStyle = '#06b6d4';
  ctx.font = 'bold 28px system-ui, sans-serif';
  ctx.fillText(`${report.performance.totalAnalyses}`, w / 2, 230);

  // Hits / Misses
  ctx.fillStyle = '#94a3b8';
  ctx.font = '11px system-ui, sans-serif';
  ctx.fillText('Acertos / Erros', w - 120, 195);
  ctx.fillStyle = '#10b981';
  ctx.font = 'bold 18px system-ui, sans-serif';
  ctx.fillText(`${report.performance.totalHits}`, w - 145, 230);
  ctx.fillStyle = '#94a3b8';
  ctx.font = '14px system-ui, sans-serif';
  ctx.fillText('/', w - 120, 230);
  ctx.fillStyle = '#ef4444';
  ctx.font = 'bold 18px system-ui, sans-serif';
  ctx.fillText(`${report.performance.totalMisses}`, w - 95, 230);

  ctx.textAlign = 'left';

  // Best strategy
  ctx.fillStyle = '#94a3b8';
  ctx.font = '12px system-ui, sans-serif';
  ctx.fillText('Melhor Estratégia:', 32, 272);
  ctx.fillStyle = '#f59e0b';
  ctx.font = 'bold 14px system-ui, sans-serif';
  ctx.fillText(report.performance.bestStrategy, 180, 272);

  // ===== Top Instruments Section =====
  let yPos = 300;

  ctx.strokeStyle = 'rgba(148, 163, 184, 0.2)';
  ctx.beginPath();
  ctx.moveTo(32, yPos);
  ctx.lineTo(w - 32, yPos);
  ctx.stroke();

  yPos += 22;
  ctx.fillStyle = '#8b5cf6';
  ctx.font = 'bold 14px system-ui, sans-serif';
  ctx.fillText('💱 Instrumentos Mais Analisados', 32, yPos);

  if (report.topInstruments.length === 0) {
    yPos += 24;
    ctx.fillStyle = '#64748b';
    ctx.font = '12px system-ui, sans-serif';
    ctx.fillText('Nenhuma análise nesta semana', 32, yPos);
  } else {
    yPos += 8;
    for (let i = 0; i < report.topInstruments.length; i++) {
      const inst = report.topInstruments[i];
      yPos += 26;
      // Number
      ctx.fillStyle = '#06b6d4';
      ctx.font = 'bold 14px system-ui, sans-serif';
      ctx.fillText(`${i + 1}.`, 40, yPos);
      // Name
      ctx.fillStyle = '#e2e8f0';
      ctx.font = '13px system-ui, sans-serif';
      ctx.fillText(inst.name, 68, yPos);
      // Count
      ctx.fillStyle = '#94a3b8';
      ctx.font = '12px system-ui, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(`${inst.count}x`, w - 40, yPos);
      ctx.textAlign = 'left';
    }
  }

  // ===== Market Highlights (Pro) =====
  if (isPro && report.marketHighlights.length > 0) {
    yPos += 24;
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.2)';
    ctx.beginPath();
    ctx.moveTo(32, yPos);
    ctx.lineTo(w - 32, yPos);
    ctx.stroke();

    yPos += 22;
    ctx.fillStyle = '#f59e0b';
    ctx.font = 'bold 14px system-ui, sans-serif';
    ctx.fillText('🔥 Destaques de Mercado', 32, yPos);

    yPos += 8;
    for (const h of report.marketHighlights) {
      yPos += 26;
      const arrow = h.direction === 'up' ? '📈' : '📉';
      const color = h.direction === 'up' ? '#10b981' : '#ef4444';
      ctx.fillStyle = '#e2e8f0';
      ctx.font = '13px system-ui, sans-serif';
      ctx.fillText(`${arrow} ${h.name}`, 40, yPos);
      ctx.fillStyle = color;
      ctx.font = 'bold 13px system-ui, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(`${h.change >= 0 ? '+' : ''}${h.change.toFixed(2)}%`, w - 40, yPos);
      ctx.textAlign = 'left';
    }
  }

  // ===== Badges Section =====
  yPos += 24;
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.2)';
  ctx.beginPath();
  ctx.moveTo(32, yPos);
  ctx.lineTo(w - 32, yPos);
  ctx.stroke();

  yPos += 22;
  ctx.fillStyle = '#f59e0b';
  ctx.font = 'bold 14px system-ui, sans-serif';
  ctx.fillText('🏆 Conquistas da Semana', 32, yPos);

  if (report.badges.length === 0) {
    yPos += 24;
    ctx.fillStyle = '#64748b';
    ctx.font = '12px system-ui, sans-serif';
    ctx.fillText('Continue usando para desbloquear!', 32, yPos);
  } else {
    yPos += 8;
    let badgeX = 40;
    for (const badge of report.badges) {
      ctx.fillStyle = '#1e293b';
      roundRect(ctx, badgeX, yPos, 110, 36, 8);
      ctx.fill();
      ctx.strokeStyle = 'rgba(245, 158, 11, 0.3)';
      ctx.lineWidth = 1;
      roundRect(ctx, badgeX, yPos, 110, 36, 8);
      ctx.stroke();

      ctx.fillStyle = '#e2e8f0';
      ctx.font = '12px system-ui, sans-serif';
      ctx.fillText(`${badge.emoji} ${badge.name}`, badgeX + 10, yPos + 23);

      badgeX += 120;
      if (badgeX + 110 > w - 32) {
        badgeX = 40;
        yPos += 44;
      }
    }
  }

  // ===== Streak Section =====
  yPos += 52;
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.2)';
  ctx.beginPath();
  ctx.moveTo(32, yPos);
  ctx.lineTo(w - 32, yPos);
  ctx.stroke();

  yPos += 22;
  ctx.fillStyle = '#f97316';
  ctx.font = 'bold 14px system-ui, sans-serif';
  ctx.fillText('🔥 Sequência', 32, yPos);

  // Streak box
  yPos += 10;
  ctx.fillStyle = 'rgba(30, 41, 59, 0.6)';
  roundRect(ctx, 24, yPos, (w - 48) / 2 - 8, 50, 10);
  ctx.fill();
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.15)';
  roundRect(ctx, 24, yPos, (w - 48) / 2 - 8, 50, 10);
  ctx.stroke();

  ctx.fillStyle = 'rgba(30, 41, 59, 0.6)';
  roundRect(ctx, 24 + (w - 48) / 2 + 8, yPos, (w - 48) / 2 - 8, 50, 10);
  ctx.fill();
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.15)';
  roundRect(ctx, 24 + (w - 48) / 2 + 8, yPos, (w - 48) / 2 - 8, 50, 10);
  ctx.stroke();

  // Current streak
  ctx.fillStyle = '#94a3b8';
  ctx.font = '11px system-ui, sans-serif';
  ctx.fillText('Atual', 40, yPos + 20);
  ctx.fillStyle = '#f97316';
  ctx.font = 'bold 20px system-ui, sans-serif';
  ctx.fillText(`${report.streak} dias`, 40, yPos + 42);

  // Longest streak
  const halfX = 24 + (w - 48) / 2 + 8;
  ctx.fillStyle = '#94a3b8';
  ctx.font = '11px system-ui, sans-serif';
  ctx.fillText('Recorde', halfX + 16, yPos + 20);
  ctx.fillStyle = '#f59e0b';
  ctx.font = 'bold 20px system-ui, sans-serif';
  ctx.fillText(`${report.longestStreak} dias`, halfX + 16, yPos + 42);

  // ===== Footer =====
  yPos += 70;
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.2)';
  ctx.beginPath();
  ctx.moveTo(32, yPos);
  ctx.lineTo(w - 32, yPos);
  ctx.stroke();

  yPos += 22;
  ctx.fillStyle = '#64748b';
  ctx.font = '11px system-ui, sans-serif';
  ctx.fillText(`🔗 forexaiproelite.vercel.app  •  ${report.generatedAt}`, 32, yPos);

  // Download
  const link = document.createElement('a');
  link.download = `forexai-relatorio-semanal.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();

  toast.success('Imagem gerada! 🖼️', { description: 'Relatório semanal exportado como PNG' });
}

// ===================== Main Component =====================

export function WeeklyReportDialog({ open, onOpenChange, report, isPro }: WeeklyReportDialogProps) {
  const handleCopy = useCallback(() => {
    const text = buildReportText(report);
    navigator.clipboard.writeText(text).then(() => {
      toast.success('Relatório copiado! 📋', { description: 'Cole onde desejar compartilhar.' });
    }).catch(() => {
      toast.error('Erro ao copiar', { description: 'Não foi possível copiar o relatório.' });
    });
  }, [report]);

  const handleShare = useCallback(() => {
    const text = buildReportText(report);
    if (navigator.share) {
      navigator.share({
        title: 'Relatório Semanal — ForexAI Pro',
        text,
      }).catch(() => {
        // Fallback to clipboard
        navigator.clipboard.writeText(text).then(() => {
          toast.success('Relatório copiado! 📋');
        });
      });
    } else {
      navigator.clipboard.writeText(text).then(() => {
        toast.success('Relatório copiado! 📋', { description: 'Cole onde desejar compartilhar.' });
      });
    }
  }, [report]);

  const handleDownloadImage = useCallback(() => {
    generateReportImage(report, isPro);
  }, [report, isPro]);

  const handleEmail = useCallback(() => {
    const text = buildReportText(report);
    const subject = encodeURIComponent(`Relatório Semanal — ForexAI Pro (${report.period.start} a ${report.period.end})`);
    const body = encodeURIComponent(text);
    window.open(`mailto:?subject=${subject}&body=${body}`, '_blank');
    toast.info('Email aberto! 📧', { description: 'Seu cliente de email deve abrir com o relatório.' });
  }, [report]);

  const hitRateColor = report.performance.hitRate >= 65
    ? '#10b981'
    : report.performance.hitRate >= 45
      ? '#22d3ee'
      : report.performance.hitRate >= 25
        ? '#f59e0b'
        : '#ef4444';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] bg-card border-border/50 overflow-y-auto custom-scrollbar">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <BarChart3 className="w-5 h-5 text-cyan-400" />
            Relatório Semanal
            {isPro && (
              <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[9px] px-1.5 py-0">
                <Crown className="w-2.5 h-2.5 mr-0.5" /> PRO
              </Badge>
            )}
          </DialogTitle>
          <DialogDescription className="text-xs">
            {report.period.start} — {report.period.end}
          </DialogDescription>
        </DialogHeader>

        {/* Performance Section */}
        <div className="mt-2">
          <h3 className="text-xs font-semibold text-cyan-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <Target className="w-3.5 h-3.5" /> Performance da Semana
          </h3>
          <div className="flex items-center gap-4">
            <HitRateRing value={report.performance.hitRate} size={100} />
            <div className="grid grid-cols-2 gap-2 flex-1">
              <StatCard
                icon={BarChart3}
                label="Análises"
                value={report.performance.totalAnalyses}
                color="#06b6d4"
              />
              <StatCard
                icon={Target}
                label="Acertos"
                value={report.performance.totalHits}
                color="#10b981"
              />
              <StatCard
                icon={Target}
                label="Erros"
                value={report.performance.totalMisses}
                color="#ef4444"
              />
              <StatCard
                icon={Zap}
                label="Melhor Estratégia"
                value={report.performance.bestStrategy}
                color="#f59e0b"
              />
            </div>
          </div>
        </div>

        <Separator className="bg-border/30" />

        {/* Top Instruments */}
        <div>
          <h3 className="text-xs font-semibold text-violet-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <BarChart3 className="w-3.5 h-3.5" /> Instrumentos Mais Analisados
          </h3>
          {report.topInstruments.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-3">
              Nenhuma análise nesta semana
            </p>
          ) : (
            <div className="space-y-1.5 max-h-40 overflow-y-auto custom-scrollbar">
              {report.topInstruments.map((inst, i) => (
                <div key={inst.symbol} className="flex items-center justify-between bg-secondary/20 rounded-lg px-3 py-2 border border-border/10">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-cyan-400 w-5">{i + 1}.</span>
                    <span className="text-xs font-medium text-foreground">{inst.name}</span>
                  </div>
                  <Badge variant="outline" className="text-[9px] px-1.5 border-violet-500/30 text-violet-400">
                    {inst.count}x
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Market Highlights (Pro Only) */}
        {isPro && report.marketHighlights.length > 0 && (
          <>
            <Separator className="bg-border/30" />
            <div>
              <h3 className="text-xs font-semibold text-amber-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5" /> Destaques de Mercado
                <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[8px] px-1 py-0">PRO</Badge>
              </h3>
              <div className="space-y-1.5 max-h-36 overflow-y-auto custom-scrollbar">
                {report.marketHighlights.map((h) => (
                  <div key={h.symbol} className="flex items-center justify-between bg-secondary/20 rounded-lg px-3 py-2 border border-border/10">
                    <div className="flex items-center gap-2">
                      {h.direction === 'up' ? (
                        <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <TrendingDown className="w-3.5 h-3.5 text-red-400" />
                      )}
                      <span className="text-xs font-medium text-foreground">{h.name}</span>
                    </div>
                    <span className={`text-xs font-bold ${h.direction === 'up' ? 'text-emerald-400' : 'text-red-400'}`}>
                      {h.change >= 0 ? '+' : ''}{h.change.toFixed(2)}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Pro upsell hint for free users */}
        {!isPro && (
          <div className="bg-gradient-to-r from-emerald-500/10 to-cyan-500/10 rounded-lg p-3 border border-emerald-500/20">
            <div className="flex items-center gap-2">
              <Crown className="w-4 h-4 text-emerald-400" />
              <p className="text-xs text-emerald-400 font-medium">
                Assine o Pro para ver destaques de mercado e insights detalhados no relatório!
              </p>
            </div>
          </div>
        )}

        <Separator className="bg-border/30" />

        {/* Badges Earned */}
        <div>
          <h3 className="text-xs font-semibold text-amber-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <Award className="w-3.5 h-3.5" /> Conquistas da Semana
          </h3>
          {report.badges.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-3">
              Continue usando o app para desbloquear conquistas!
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {report.badges.map((badge, i) => (
                <div key={i} className="flex items-center gap-1.5 bg-secondary/30 rounded-lg px-2.5 py-1.5 border border-amber-500/20">
                  <span className="text-sm">{badge.emoji}</span>
                  <span className="text-xs text-foreground font-medium">{badge.name}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <Separator className="bg-border/30" />

        {/* Streak */}
        <div>
          <h3 className="text-xs font-semibold text-orange-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <Flame className="w-3.5 h-3.5" /> Sequência
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-orange-500/10 rounded-lg p-3 text-center border border-orange-500/20">
              <Flame className="w-5 h-5 text-orange-400 mx-auto mb-1" />
              <p className="text-xl font-bold text-orange-400 tabular-nums">{report.streak}</p>
              <p className="text-[9px] text-muted-foreground uppercase">dias atuais</p>
            </div>
            <div className="bg-amber-500/10 rounded-lg p-3 text-center border border-amber-500/20">
              <Award className="w-5 h-5 text-amber-400 mx-auto mb-1" />
              <p className="text-xl font-bold text-amber-400 tabular-nums">{report.longestStreak}</p>
              <p className="text-[9px] text-muted-foreground uppercase">recorde</p>
            </div>
          </div>
        </div>

        <Separator className="bg-border/30" />

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-2 mt-1">
          <Button
            variant="outline"
            size="sm"
            onClick={handleShare}
            className="flex-1 min-w-[120px] border-violet-500/30 text-violet-400 hover:bg-violet-500/10 hover:text-violet-300"
          >
            <Copy className="w-3.5 h-3.5 mr-1.5" />
            Compartilhar
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownloadImage}
            className="flex-1 min-w-[120px] border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/10 hover:text-cyan-300"
          >
            <ImageIcon className="w-3.5 h-3.5 mr-1.5" />
            Baixar Imagem
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleEmail}
            className="flex-1 min-w-[120px] border-amber-500/30 text-amber-400 hover:bg-amber-500/10 hover:text-amber-300"
          >
            <Mail className="w-3.5 h-3.5 mr-1.5" />
            Enviar por Email
          </Button>
        </div>

        {/* Generated timestamp */}
        <p className="text-[9px] text-muted-foreground text-center mt-1">
          Gerado em: {report.generatedAt}
        </p>
      </DialogContent>
    </Dialog>
  );
}
