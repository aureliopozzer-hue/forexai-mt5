'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  User,
  CreditCard,
  Crown,
  LogOut,
  History,
  Calendar,
  ChevronRight,
  Infinity as InfinityIcon,
  Shield,
  Star,
  Coins,
  AlertTriangle,
  Loader2,
  CheckCircle2,
  XCircle,
  Sparkles,
  ArrowUpRight,
  TrendingDown,
  Zap,
  Clock,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { signOut } from 'next-auth/react';

// ─── Types ───────────────────────────────────────────────────────────────────

interface UserPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: {
    name: string | null;
    email: string | null;
    image: string | null;
  } | null;
  isPro: boolean;
  credits: number;
  onUpgrade?: (plan: 'monthly' | 'annual') => void;
}

interface PaymentRecord {
  id: string;
  date: string;
  description: string;
  amount: string;
  status: 'paid' | 'pending' | 'failed' | 'refunded';
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getInitials(name: string | null): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

function formatDate(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

function formatMemberSince(dateStr: string | null): string {
  if (!dateStr) return '—';
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('pt-BR', {
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

// ─── Status Badge ────────────────────────────────────────────────────────────

function PaymentStatusBadge({ status }: { status: PaymentRecord['status'] }) {
  const config = {
    paid: {
      icon: CheckCircle2,
      label: 'Pago',
      className: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25',
    },
    pending: {
      icon: Loader2,
      label: 'Pendente',
      className: 'bg-amber-500/15 text-amber-400 border-amber-500/25',
    },
    failed: {
      icon: XCircle,
      label: 'Falhou',
      className: 'bg-red-500/15 text-red-400 border-red-500/25',
    },
    refunded: {
      icon: AlertTriangle,
      label: 'Reembolsado',
      className: 'bg-gray-500/15 text-gray-400 border-gray-500/25',
    },
  };

  const { icon: Icon, label, className } = config[status];

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold border ${className}`}
    >
      <Icon className="w-3 h-3" />
      {label}
    </span>
  );
}

// ─── Section Wrapper ─────────────────────────────────────────────────────────

function Section({
  icon: Icon,
  title,
  children,
  delay = 0,
}: {
  icon: React.ElementType;
  title: string;
  children: React.ReactNode;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.35, ease: 'easeOut' }}
    >
      <div className="flex items-center gap-2 mb-3">
        <div className="flex items-center justify-center w-6 h-6 rounded-md bg-white/[0.05] border border-white/[0.08]">
          <Icon className="w-3.5 h-3.5 text-cyan-400" />
        </div>
        <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400">
          {title}
        </h3>
      </div>
      {children}
    </motion.div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function UserPanel({ open, onOpenChange, user, isPro, credits, onUpgrade }: UserPanelProps) {
  const [paymentHistory, setPaymentHistory] = useState<PaymentRecord[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [subscriptionPlan, setSubscriptionPlan] = useState<'monthly' | 'annual' | null>(
    null
  );
  const [nextBillingDate, setNextBillingDate] = useState<string | null>(null);
  const [memberSince, setMemberSince] = useState<string | null>(null);
  const [cancelAtPeriodEnd, setCancelAtPeriodEnd] = useState(false);
  const [isTrial, setIsTrial] = useState(false);
  const [trialDaysRemaining, setTrialDaysRemaining] = useState<number | null>(null);

  // Fetch payment history
  useEffect(() => {
    if (!open) return;

    let cancelled = false;

    async function fetchHistory() {
      setLoadingHistory(true);
      try {
        const res = await fetch('/api/user/history');
        if (!res.ok) throw new Error('Failed to fetch');
        const data = await res.json();

        if (!cancelled) {
          setPaymentHistory(data.payments ?? []);
          setSubscriptionPlan(data.subscription?.subscriptionPlan ?? null);
          setNextBillingDate(data.subscription?.nextBillingDate ?? null);
          setMemberSince(data.subscription?.memberSince ?? null);
          setCancelAtPeriodEnd(data.subscription?.cancelAtPeriodEnd ?? false);
          setIsTrial(data.subscription?.isTrial ?? false);
          setTrialDaysRemaining(data.subscription?.trialDaysRemaining ?? null);
        }
      } catch {
        if (!cancelled) {
          setPaymentHistory([]);
        }
      } finally {
        if (!cancelled) {
          setLoadingHistory(false);
        }
      }
    }

    fetchHistory();
    return () => {
      cancelled = true;
    };
  }, [open]);

  const creditPercentage = Math.min(Math.round((credits / 100) * 100), 100);
  const isLow = credits <= 20 && credits > 5;
  const isCritical = credits <= 5;

  const getBarGradient = () => {
    if (isPro) return 'from-emerald-500 to-cyan-500';
    if (isCritical) return 'from-red-500 to-red-400';
    if (isLow) return 'from-amber-500 to-yellow-400';
    return 'from-cyan-500 to-violet-500';
  };

  const getCreditColor = () => {
    if (isPro) return 'text-emerald-400';
    if (isCritical) return 'text-red-400';
    if (isLow) return 'text-amber-400';
    return 'text-gray-200';
  };

  const planLabel = !isPro
    ? 'Gratuito'
    : isTrial
      ? 'Período de Teste'
      : subscriptionPlan === 'annual'
        ? 'Plano Pro Anual'
        : 'Plano Pro Mensal';

  const planPrice = !isPro
    ? null
    : isTrial
      ? 'Período de teste'
      : subscriptionPlan === 'annual'
        ? 'R$479,00/ano'
        : 'R$49,90/mês';

  // Annual plan saves ~20% compared to monthly (49.90*12 = 598.80 vs 479.00 = save 119.80)
  const annualSavings = 'R$119,80';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-[480px] bg-[#0c1222] border-[#1e293b] text-white p-0 gap-0 overflow-hidden"
        showCloseButton
      >
        {/* ─── Scrollable Content ─── */}
        <div className="max-h-[80vh] overflow-y-auto">
          {/* ─── Header Gradient ─── */}
          <div className="relative">
            {/* Decorative gradient orb */}
            <div className="absolute top-0 left-1/4 w-48 h-48 bg-cyan-500/[0.06] rounded-full blur-3xl pointer-events-none" />
            <div className="absolute top-8 right-1/4 w-32 h-32 bg-violet-500/[0.06] rounded-full blur-3xl pointer-events-none" />

            {/* ─── 1. Profile Section ─── */}
            <div className="relative px-6 pt-6 pb-5">
              <DialogHeader className="mb-5">
                <DialogTitle className="text-lg font-bold text-white flex items-center gap-2">
                  <Shield className="w-5 h-5 text-cyan-400" />
                  Minha Conta
                </DialogTitle>
                <DialogDescription className="text-gray-500 text-xs">
                  Gerencie seu perfil, créditos e assinatura
                </DialogDescription>
              </DialogHeader>

              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3, ease: 'easeOut' }}
                className="flex items-center gap-4"
              >
                {/* Avatar */}
                <div className="relative">
                  <Avatar className="w-14 h-14 border-2 border-white/10 shadow-lg shadow-black/20">
                    {user?.image && (
                      <AvatarImage src={user.image} alt={user.name ?? 'Avatar'} />
                    )}
                    <AvatarFallback className="bg-gradient-to-br from-cyan-500/20 to-violet-500/20 text-cyan-300 font-bold text-lg">
                      {getInitials(user?.name ?? null)}
                    </AvatarFallback>
                  </Avatar>
                  {/* Pro indicator dot */}
                  {isPro && (
                    <motion.div
                      animate={{ scale: [1, 1.15, 1] }}
                      transition={{ repeat: Infinity, duration: 2.5, ease: 'easeInOut' }}
                      className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-emerald-500 rounded-full border-2 border-[#0c1222] flex items-center justify-center"
                    >
                      <Crown className="w-2 h-2 text-white" />
                    </motion.div>
                  )}
                </div>

                {/* Name + Email + Badge */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <h2 className="text-sm font-bold text-white truncate">
                      {user?.name ?? 'Usuário'}
                    </h2>
                    {isPro ? (
                      <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 text-[10px] px-2 py-0 font-bold">
                        <Crown className="w-3 h-3 mr-0.5" />
                        Pro
                      </Badge>
                    ) : (
                      <Badge className="bg-gray-500/15 text-gray-400 border-gray-500/30 text-[10px] px-2 py-0 font-bold">
                        Gratuito
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 truncate">
                    {user?.email ?? 'email@example.com'}
                  </p>
                  <p className="text-[10px] text-gray-600 mt-1 flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    Membro desde {formatMemberSince(memberSince)}
                  </p>
                </div>
              </motion.div>
            </div>
          </div>

          <div className="px-6 space-y-6 pb-6">
            {/* ─── 2. Credits Section ─── */}
            <Separator className="bg-white/[0.06]" />

            <Section icon={Coins} title="Créditos" delay={0.05}>
              <div className="rounded-xl bg-white/[0.02] border border-white/[0.06] p-4">
                {isPro ? (
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-bold text-emerald-400">
                          Créditos Ilimitados
                        </span>
                        <span className="text-lg">♾️</span>
                      </div>
                      <p className="text-[10px] text-gray-500">
                        Análises ilimitadas como membro Pro
                      </p>
                    </div>
                    <div className="w-10 h-10 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                      <InfinityIcon className="w-5 h-5 text-emerald-400" />
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="flex items-center justify-between mb-2.5">
                      <span className={`text-sm font-bold ${getCreditColor()}`}>
                        {credits} / 100 créditos
                      </span>
                      <span className="text-[10px] text-gray-500">
                        {100 - credits} restantes
                      </span>
                    </div>
                    {/* Progress bar */}
                    <div className="w-full h-2 bg-gray-800/60 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${creditPercentage}%` }}
                        transition={{ duration: 0.8, ease: 'easeOut' }}
                        className={`h-full rounded-full bg-gradient-to-r ${getBarGradient()}`}
                      />
                    </div>
                    <p className="text-[10px] text-gray-600 mt-2">
                      Cada análise custa 5 créditos
                    </p>
                  </div>
                )}
              </div>
            </Section>

            {/* ─── 3. Subscription Section ─── */}
            <Section icon={CreditCard} title="Assinatura" delay={0.1}>
              <div className="rounded-xl bg-white/[0.02] border border-white/[0.06] p-4 space-y-3">
                {/* Current Plan */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                        isPro
                          ? 'bg-gradient-to-br from-cyan-500/15 to-violet-500/15 border border-cyan-500/20'
                          : 'bg-gray-700/30 border border-gray-600/30'
                      }`}
                    >
                      {isPro ? (
                        <Star className="w-4 h-4 text-cyan-400" />
                      ) : (
                        <User className="w-4 h-4 text-gray-400" />
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white">{planLabel}</p>
                      {planPrice && (
                        <p className="text-[10px] text-gray-500">{planPrice}</p>
                      )}
                    </div>
                  </div>
                  {isPro && (
                    <Badge className={`text-[10px] px-2 font-bold ${
                      isTrial
                        ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                        : cancelAtPeriodEnd
                          ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                          : 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                    }`}>
                      {isTrial ? 'Teste Grátis' : cancelAtPeriodEnd ? 'Cancelamento Pendente' : 'Ativo'}
                    </Badge>
                  )}
                </div>

                {/* Billing Info (Pro only, not trial) */}
                {isPro && nextBillingDate && !cancelAtPeriodEnd && !isTrial && (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                    <Calendar className="w-3.5 h-3.5 text-gray-500" />
                    <span className="text-[11px] text-gray-400">
                      Próxima cobrança:{' '}
                      <span className="text-gray-300 font-medium">
                        {formatDate(nextBillingDate)}
                      </span>
                    </span>
                  </div>
                )}

                {/* Trial Countdown (Trial users) */}
                {isPro && isTrial && trialDaysRemaining !== null && (
                  <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.15, duration: 0.35 }}
                    className="rounded-xl overflow-hidden"
                    style={{
                      background: trialDaysRemaining <= 3
                        ? 'linear-gradient(135deg, rgba(239,68,68,0.1), rgba(249,115,22,0.08))'
                        : 'linear-gradient(135deg, rgba(245,158,11,0.08), rgba(6,182,212,0.05))',
                      border: `1px solid ${trialDaysRemaining <= 3 ? 'rgba(239,68,68,0.25)' : 'rgba(245,158,11,0.2)'}`,
                    }}
                  >
                    <div className="p-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                          trialDaysRemaining <= 3
                            ? 'bg-red-500/15 border border-red-500/25'
                            : 'bg-amber-500/15 border border-amber-500/25'
                        }`}>
                          <Clock className={`w-4 h-4 ${trialDaysRemaining <= 3 ? 'text-red-400' : 'text-amber-400'}`} />
                        </div>
                        <div className="flex-1">
                          <p className={`text-xs font-bold ${trialDaysRemaining <= 3 ? 'text-red-400' : 'text-amber-400'}`}>
                            {trialDaysRemaining <= 3 ? '⚠️ Teste acabando!' : '⏳ Período de teste'}
                          </p>
                          <p className="text-[10px] text-gray-500 mt-0.5">
                            {trialDaysRemaining === 0
                              ? 'Seu teste acaba hoje! Assine para não perder acesso.'
                              : `${trialDaysRemaining} dia${trialDaysRemaining !== 1 ? 's' : ''} restante${trialDaysRemaining !== 1 ? 's' : ''} de acesso grátis`
                            }
                          </p>
                        </div>
                      </div>
                      {trialDaysRemaining <= 7 && (
                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => {
                            onOpenChange(false);
                            if (onUpgrade) onUpgrade('monthly');
                          }}
                          className="w-full mt-3 flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-500 to-violet-500 hover:from-cyan-400 hover:to-violet-400 text-white text-xs font-semibold shadow-lg shadow-cyan-500/15 transition-all duration-200"
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                          Assinar Agora — R$49,90/mês
                        </motion.button>
                      )}
                    </div>
                  </motion.div>
                )}

                {/* ─── Upgrade to Annual (Monthly users, not trial) ─── */}
                {isPro && subscriptionPlan === 'monthly' && !isTrial && (
                  <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2, duration: 0.35 }}
                    className="rounded-xl overflow-hidden"
                    style={{
                      background: 'linear-gradient(135deg, rgba(6,182,212,0.08), rgba(139,92,246,0.08))',
                      border: '1px solid rgba(6,182,212,0.2)',
                    }}
                  >
                    <div className="p-4">
                      {/* Header */}
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-violet-500/15 border border-violet-500/25 flex items-center justify-center">
                            <Zap className="w-3.5 h-3.5 text-violet-400" />
                          </div>
                          <span className="text-sm font-bold text-white">
                            Plano Pro Anual
                          </span>
                        </div>
                        <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/25 text-[10px] px-2 py-0 font-bold">
                          <TrendingDown className="w-3 h-3 mr-0.5" />
                          -20%
                        </Badge>
                      </div>

                      <p className="text-[11px] text-gray-400 mb-3 leading-relaxed">
                        Economize <span className="text-emerald-400 font-bold">{annualSavings}</span> por ano 
                        com o plano anual. Equivalente a apenas{' '}
                        <span className="text-cyan-400 font-semibold">R$39,92/mês</span>.
                      </p>

                      {/* Price comparison */}
                      <div className="flex items-center gap-3 mb-3">
                        <div className="flex-1 px-3 py-2 rounded-lg bg-white/[0.03] border border-white/[0.06] text-center">
                          <p className="text-[10px] text-gray-500 mb-0.5">Mensal</p>
                          <p className="text-xs font-semibold text-gray-400 line-through">R$598,80/ano</p>
                        </div>
                        <ArrowUpRight className="w-4 h-4 text-emerald-400 shrink-0" />
                        <div className="flex-1 px-3 py-2 rounded-lg bg-emerald-500/[0.08] border border-emerald-500/20 text-center">
                          <p className="text-[10px] text-emerald-400 mb-0.5">Anual</p>
                          <p className="text-xs font-bold text-white">R$479,00/ano</p>
                        </div>
                      </div>

                      {/* CTA Button */}
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => {
                          onOpenChange(false);
                          if (onUpgrade) onUpgrade('annual');
                        }}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-gradient-to-r from-violet-500 to-cyan-500 hover:from-violet-400 hover:to-cyan-400 text-white text-sm font-semibold shadow-lg shadow-violet-500/15 transition-all duration-200"
                      >
                        <Zap className="w-4 h-4" />
                        Fazer Upgrade para Anual
                      </motion.button>
                    </div>
                  </motion.div>
                )}

                {/* ─── Already on Annual (Best plan) ─── */}
                {isPro && subscriptionPlan === 'annual' && !isTrial && (
                  <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2, duration: 0.35 }}
                    className="flex items-center gap-3 px-4 py-3 rounded-xl"
                    style={{
                      background: 'linear-gradient(135deg, rgba(16,185,129,0.08), rgba(6,182,212,0.05))',
                      border: '1px solid rgba(16,185,129,0.15)',
                    }}
                  >
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center shrink-0">
                      <Crown className="w-4 h-4 text-emerald-400" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-emerald-400">Melhor plano ativo!</p>
                      <p className="text-[10px] text-gray-500">Você está economizando {annualSavings}/ano com o plano anual.</p>
                    </div>
                  </motion.div>
                )}

                {/* ─── Upgrade to Pro (Free users) ─── */}
                {!isPro && (
                  <motion.button
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => {
                      onOpenChange(false);
                      if (onUpgrade) onUpgrade('monthly');
                    }}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-gradient-to-r from-cyan-500 to-violet-500 hover:from-cyan-400 hover:to-violet-400 text-white text-sm font-semibold shadow-lg shadow-cyan-500/15 transition-all duration-200"
                  >
                    <Sparkles className="w-4 h-4" />
                    Fazer Upgrade para Pro
                  </motion.button>
                )}
              </div>
            </Section>

            {/* ─── 4. Payment History Section ─── */}
            <Section icon={History} title="Histórico de Pagamentos" delay={0.15}>
              <div className="rounded-xl bg-white/[0.02] border border-white/[0.06] overflow-hidden">
                {loadingHistory ? (
                  <div className="flex items-center justify-center py-8 gap-2">
                    <Loader2 className="w-4 h-4 text-cyan-400 animate-spin" />
                    <span className="text-xs text-gray-500">Carregando histórico...</span>
                  </div>
                ) : paymentHistory.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 gap-3">
                    <div className="w-10 h-10 rounded-full bg-white/[0.04] border border-white/[0.06] flex items-center justify-center">
                      <CreditCard className="w-5 h-5 text-gray-600" />
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-gray-500 font-medium">
                        Nenhum pagamento encontrado
                      </p>
                      <p className="text-[10px] text-gray-600 mt-0.5">
                        Seu histórico aparecerá aqui após a primeira assinatura
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="divide-y divide-white/[0.04]">
                    {/* Table Header */}
                    <div className="grid grid-cols-[1fr_1fr_80px_80px] gap-2 px-4 py-2.5 bg-white/[0.02]">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-gray-600">
                        Data
                      </span>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-gray-600">
                        Descrição
                      </span>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-gray-600 text-right">
                        Valor
                      </span>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-gray-600 text-right">
                        Status
                      </span>
                    </div>
                    {/* Table Rows */}
                    {paymentHistory.map((payment) => (
                      <div
                        key={payment.id}
                        className="grid grid-cols-[1fr_1fr_80px_80px] gap-2 px-4 py-3 hover:bg-white/[0.015] transition-colors"
                      >
                        <span className="text-[11px] text-gray-400 font-mono">
                          {formatDate(payment.date)}
                        </span>
                        <span className="text-[11px] text-gray-300 truncate">
                          {payment.description}
                        </span>
                        <span className="text-[11px] text-gray-300 text-right font-medium">
                          {payment.amount}
                        </span>
                        <div className="flex justify-end">
                          <PaymentStatusBadge status={payment.status} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </Section>

            {/* ─── 5. Account Section (Sign Out only) ─── */}
            <Section icon={Shield} title="Conta" delay={0.2}>
              <motion.button
                whileHover={{ scale: 1.005 }}
                whileTap={{ scale: 0.995 }}
                onClick={() => {
                  signOut({ callbackUrl: '/' });
                }}
                className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-red-500/[0.06] border border-red-500/15 hover:border-red-500/30 hover:bg-red-500/[0.1] transition-all duration-200 group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                    <LogOut className="w-4 h-4 text-red-400" />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-semibold text-red-400">Sair da Conta</p>
                    <p className="text-[10px] text-gray-600">Encerrar sua sessão atual</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-red-500/40 group-hover:text-red-400 transition-colors" />
              </motion.button>
            </Section>

            {/* Bottom safe area */}
            <div className="h-2" />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
