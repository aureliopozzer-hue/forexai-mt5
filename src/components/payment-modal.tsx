'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, CreditCard, Check, Shield, Zap, Star,
  TrendingUp, BarChart3, Brain,
  Activity, ScanLine, Volume2, Calculator,
  Bell, FileText, Trophy, Target, ArrowRightLeft,
  Clock, Globe, Lock, HeartHandshake
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';


interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubscribe: (plan: 'monthly' | 'annual') => void;
  subscribing: boolean;
  error?: string | null;
  creditsRemaining?: number;
  isTrialActive?: boolean;
  trialDaysRemaining?: number;
}

// Animated feature card with stagger
function FeatureCard({ icon: Icon, title, description, color, delay }: {
  icon: any; title: string; description: string; color: string; delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4, ease: 'easeOut' }}
      className="flex items-start gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/[0.05] hover:border-white/[0.1] hover:bg-white/[0.04] transition-all duration-300"
    >
      <div className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${color} bg-opacity-10`}
        style={{ backgroundColor: `${color}15` }}
      >
        <Icon className="w-4 h-4" style={{ color }} />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-semibold text-gray-200 leading-tight">{title}</p>
        <p className="text-[10px] text-gray-500 mt-0.5 leading-relaxed">{description}</p>
      </div>
    </motion.div>
  );
}

export function PaymentModal({ isOpen, onClose, onSubscribe, subscribing, error, creditsRemaining = 0, isTrialActive = false, trialDaysRemaining = 0 }: PaymentModalProps) {
  const [selectedPlan, setSelectedPlan] = useState<'monthly' | 'annual'>('monthly');

  const handleSubscribe = () => {
    onSubscribe(selectedPlan);
  };

  const features = [
    { icon: Globe, title: '500+ Ativos em Tempo Real', description: 'Forex, Índices, Metais, Cripto, Ações, ETFs e Brasil', color: '#06b6d4' },
    { icon: Brain, title: '3 Estratégias de IA', description: 'SMC, Price Action e Híbrido — compare todas', color: '#8b5cf6' },
    { icon: Target, title: 'Sinais de Entrada/Saída', description: 'Entry, Stop Loss, Take Profit com probabilidade', color: '#f59e0b' },
    { icon: Activity, title: 'Modo Conservador/Agressivo', description: 'ATR padrão ou 50% menor para stops curtos', color: '#f97316' },
    { icon: ScanLine, title: 'Scanner de Padrões', description: 'Identifique oportunidades automaticamente', color: '#06b6d4' },
    { icon: Volume2, title: 'Narração por Voz', description: 'Ouça a análise em português', color: '#8b5cf6' },
    { icon: Calculator, title: 'Simulação de Trade', description: 'Calcule risco, lote e lucro antes de operar', color: '#10b981' },
    { icon: Bell, title: 'Alertas de Preço', description: 'Seja avisado quando o preço atingir seu alvo', color: '#f59e0b' },
    { icon: FileText, title: 'Relatório Semanal', description: 'Receba o resumo de performance da semana', color: '#06b6d4' },
    { icon: Trophy, title: 'Gamificação & Badges', description: 'Conquistas, streak e evolução como trader', color: '#f59e0b' },
    { icon: BarChart3, title: 'Performance da IA', description: 'Acompanhe taxa de acerto histórico', color: '#8b5cf6' },
    { icon: ArrowRightLeft, title: 'Sinal para Corretora', description: 'Copie valores direto para MT5/Corretora', color: '#10b981' },
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed inset-0 z-[101] flex items-center justify-center p-3 sm:p-4"
          >
            <div className="relative w-full max-w-3xl max-h-[92vh] overflow-y-auto rounded-2xl">
              {/* Close button */}
              <button
                onClick={onClose}
                className="absolute -top-10 right-0 text-gray-400 hover:text-white transition-colors z-10"
              >
                <X className="w-6 h-6" />
              </button>

              <div className="bg-[#0c1222] border border-[#1e293b] rounded-2xl overflow-hidden shadow-2xl">
                {/* ═══════════════════════════════════════════ */}
                {/* SECTION 1: URGENCY BAR */}
                {/* ═══════════════════════════════════════════ */}
                <div className="bg-gradient-to-r from-red-500/10 via-orange-500/10 to-red-500/10 border-b border-red-500/20 px-6 py-3">
                  <div className="flex items-center justify-center gap-2">
                    <motion.div
                      animate={{ scale: [1, 1.2, 1] }}
                      transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}
                    >
                      <span className="text-base">🔥</span>
                    </motion.div>
                    <span className="text-xs font-bold text-red-400">
                      {isTrialActive && trialDaysRemaining > 0
                        ? `Seu período grátis acaba em ${trialDaysRemaining} dia${trialDaysRemaining !== 1 ? 's' : ''}!`
                        : 'Seu período grátis de 3 dias acabou!'}
                    </span>
                  </div>
                </div>

                {/* ═══════════════════════════════════════════ */}
                {/* SECTION 2: HERO */}
                {/* ═══════════════════════════════════════════ */}
                <div className="relative px-6 sm:px-8 pt-8 pb-6 text-center overflow-hidden">
                  {/* Decorative gradient orbs */}
                  <div className="absolute top-0 left-1/4 w-64 h-64 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />
                  <div className="absolute top-10 right-1/4 w-48 h-48 bg-violet-500/5 rounded-full blur-3xl pointer-events-none" />

                  <div className="relative">
                    {/* Logo */}
                    <motion.div
                      animate={{ rotate: [0, 3, -3, 0] }}
                      transition={{ repeat: Infinity, duration: 5, ease: 'easeInOut' }}
                      className="mx-auto mb-5"
                      style={{ width: 64, height: 64 }}
                    >
                      <img
                        src="/stripe-icon.png"
                        alt="ForexAI Pro"
                        className="w-full h-full rounded-2xl shadow-lg shadow-cyan-500/25 object-cover"
                      />
                    </motion.div>

                    <h2 className="text-2xl sm:text-3xl font-bold text-white mb-2">
                      {isTrialActive && trialDaysRemaining > 0 ? 'Desbloqueie o Poder Completo' : 'A IA Não Precisa Parar'}
                    </h2>
                    <p className="text-gray-400 text-sm max-w-lg mx-auto leading-relaxed">
                      {isTrialActive && trialDaysRemaining > 0
                        ? `Seu período grátis acaba em ${trialDaysRemaining} dia${trialDaysRemaining !== 1 ? 's' : ''}. Assine e tenha acesso ilimitado completo.`
                        : 'Seu período grátis de 3 dias acabou. Continue com análises ilimitadas e acesso completo a mais de 500 ativos com IA em tempo real.'
                      }
                    </p>
                  </div>
                </div>

                {/* ═══════════════════════════════════════════ */}
                {/* SECTION 3: FEATURES SHOWCASE */}
                {/* ═══════════════════════════════════════════ */}
                <div className="px-6 sm:px-8 pb-6">
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.2 }}
                    className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-4 text-center"
                  >
                    Tudo o que você desbloqueia com o Pro
                  </motion.p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                    {features.map((feature, i) => (
                      <FeatureCard
                        key={i}
                        icon={feature.icon}
                        title={feature.title}
                        description={feature.description}
                        color={feature.color}
                        delay={0.1 + i * 0.05}
                      />
                    ))}
                  </div>
                </div>

                {/* ═══════════════════════════════════════════ */}
                {/* SECTION 4: PRICING */}
                {/* ═══════════════════════════════════════════ */}
                <div className="px-6 sm:px-8 pb-6">
                  <div className="bg-gradient-to-b from-white/[0.02] to-transparent rounded-xl border border-white/[0.06] p-5">
                    {/* Section title */}
                    <p className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-5 text-center">
                      Escolha seu plano
                    </p>

                    {/* 3-column: Free | Monthly | Annual */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {/* Free Plan (what they had) */}
                      <div className="rounded-xl border border-gray-700/50 bg-gray-800/20 p-4 opacity-60">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-2">Grátis</p>
                        <div className="flex items-baseline gap-0.5 mb-1">
                          <span className="text-2xl font-bold text-gray-500">R$0</span>
                        </div>
                        <p className="text-[10px] text-gray-600 mb-3">Já utilizado</p>
                        <div className="space-y-1.5">
                          {[
                            '3 dias grátis',
                            '5 categorias de ativos',
                            'Análise básica',
                          ].map((text, i) => (
                            <p key={i} className="text-[10px] text-gray-600 flex items-center gap-1.5">
                              <Check className="w-2.5 h-2.5 text-gray-600 flex-shrink-0" /> {text}
                            </p>
                          ))}
                        </div>
                      </div>

                      {/* Monthly Plan */}
                      <Card
                        className={`cursor-pointer transition-all duration-300 rounded-xl ${
                          selectedPlan === 'monthly'
                            ? 'border-cyan-500 bg-cyan-500/5 shadow-lg shadow-cyan-500/10 scale-[1.02]'
                            : 'border-[#1e293b] hover:border-[#334155] hover:bg-white/[0.02]'
                        }`}
                        onClick={() => setSelectedPlan('monthly')}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-400">Mensal</span>
                            {selectedPlan === 'monthly' && (
                              <Badge className="bg-cyan-500/20 text-cyan-400 border-cyan-500/30 text-[9px] px-2">
                                Selecionado
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-baseline gap-0.5 mb-0.5">
                            <span className="text-3xl font-bold text-white">R$49</span>
                            <span className="text-sm text-gray-400">,90</span>
                          </div>
                          <p className="text-[10px] text-gray-500">/mês</p>
                          <div className="mt-3 space-y-1.5">
                            {[
                              'Créditos ilimitados',
                              'Todas as 12 funcionalidades',
                              'Cancele quando quiser',
                            ].map((text, i) => (
                              <p key={i} className="text-[10px] text-gray-300 flex items-center gap-1.5">
                                <Check className="w-2.5 h-2.5 text-cyan-400 flex-shrink-0" /> {text}
                              </p>
                            ))}
                          </div>
                        </CardContent>
                      </Card>

                      {/* Annual Plan */}
                      <Card
                        className={`cursor-pointer transition-all duration-300 rounded-xl relative ${
                          selectedPlan === 'annual'
                            ? 'border-violet-500 bg-violet-500/5 shadow-lg shadow-violet-500/10 scale-[1.02]'
                            : 'border-[#1e293b] hover:border-[#334155] hover:bg-white/[0.02]'
                        }`}
                        onClick={() => setSelectedPlan('annual')}
                      >
                        {/* Best value badge */}
                        <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 z-10">
                          <Badge className="bg-gradient-to-r from-violet-500 to-cyan-500 text-white border-0 text-[9px] px-2.5 shadow-lg shadow-violet-500/20">
                            <Star className="w-3 h-3 mr-1" /> MAIS POPULAR
                          </Badge>
                        </div>

                        <CardContent className="p-4">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-violet-400">Anual</span>
                            {selectedPlan === 'annual' && (
                              <Badge className="bg-violet-500/20 text-violet-400 border-violet-500/30 text-[9px] px-2">
                                Selecionado
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-baseline gap-0.5 mb-0.5">
                            <span className="text-3xl font-bold text-white">R$479</span>
                            <span className="text-sm text-gray-400">,00</span>
                          </div>
                          <p className="text-[10px] text-gray-500">/ano · <span className="text-violet-400 font-semibold">R$39,90/mês</span></p>
                          <div className="mt-3 space-y-1.5">
                            {[
                              'Economia de R$120/ano',
                              '20% de desconto',
                              'Melhor custo-benefício',
                            ].map((text, i) => (
                              <p key={i} className="text-[10px] text-gray-300 flex items-center gap-1.5">
                                <Check className="w-2.5 h-2.5 text-violet-400 flex-shrink-0" /> {text}
                              </p>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  </div>
                </div>



                {/* ═══════════════════════════════════════════ */}
                {/* SECTION 5: TRUST & SECURITY */}
                {/* ═══════════════════════════════════════════ */}
                <div className="px-6 sm:px-8 pb-5">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                      { icon: Lock, text: 'Pagamento seguro', sub: 'Criptografia SSL' },
                      { icon: CreditCard, text: 'Stripe', sub: 'Processador líder' },
                      { icon: HeartHandshake, text: 'Sem fidelidade', sub: 'Cancele quando quiser' },
                      { icon: Zap, text: 'Acesso imediato', sub: 'Ativação instantânea' },
                    ].map((item, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.6 + i * 0.1 }}
                        className="flex flex-col items-center text-center p-2.5 rounded-lg bg-white/[0.02] border border-white/[0.04]"
                      >
                        <item.icon className="w-4 h-4 text-gray-400 mb-1.5" />
                        <p className="text-[10px] font-semibold text-gray-300">{item.text}</p>
                        <p className="text-[8px] text-gray-600">{item.sub}</p>
                      </motion.div>
                    ))}
                  </div>
                </div>

                {/* ═══════════════════════════════════════════ */}
                {/* SECTION 6: CTA + ERROR + SECURITY BADGES */}
                {/* ═══════════════════════════════════════════ */}
                <div className="px-6 sm:px-8 pb-8">
                  {/* Error message */}
                  {error && (
                    <div className="flex items-start gap-2 mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                      <X className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                      <p className="text-xs text-red-400 leading-relaxed">{error}</p>
                    </div>
                  )}

                  {/* Subscribe Button */}
                  <motion.div
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                  >
                    <Button
                      onClick={handleSubscribe}
                      disabled={subscribing}
                      className={`w-full h-13 text-base font-semibold shadow-lg transition-all duration-200 disabled:opacity-50 py-3.5 bg-gradient-to-r from-cyan-500 to-violet-500 hover:from-cyan-400 hover:to-violet-400 shadow-cyan-500/20 text-white`}
                    >
                      {subscribing ? (
                        <motion.div
                          animate={{ rotate: 360 }}
                          transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                          className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full"
                        />
                      ) : (
                        <>
                          <CreditCard className="w-5 h-5 mr-2" />
                          Assinar Agora — {selectedPlan === 'monthly' ? 'R$49,90/mês' : 'R$479,00/ano'}
                        </>
                      )}
                    </Button>
                  </motion.div>

                  {/* Subtext */}
                  <p className="text-[10px] text-gray-600 text-center mt-3">
                    Acesso imediato após o pagamento · Cancele a qualquer momento
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
