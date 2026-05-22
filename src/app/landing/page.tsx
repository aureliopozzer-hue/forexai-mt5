'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import {
  Zap,
  Brain,
  Search,
  Building2,
  Mic,
  Coins,
  Timer,
  ChevronRight,
  Menu,
  X,
  Star,
  ArrowRight,
  Check,
  MapPin,
  ShieldAlert,
  Target,
  BarChart3,
  Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { trackLandingCTA } from '@/lib/analytics';

/* ──────────────── Animation Helpers ──────────────── */

const fadeInUp = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: 'easeOut' } },
};

const staggerContainer = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1 } },
};

/* ──────────────── Data ──────────────── */

const features = [
  {
    icon: Brain,
    title: 'Análise por IA',
    description: '3 estratégias exclusivas que calculam entrada, stop e alvo automaticamente',
    emoji: '🧠',
  },
  {
    icon: Search,
    title: 'Scanner de Padrões',
    description: 'Detecta +20 padrões gráficos em 150+ ativos automaticamente',
    emoji: '🔍',
  },
  {
    icon: Building2,
    title: '18+ Prop Firms',
    description: 'Links diretos para as melhores prop firms do mercado',
    emoji: '🏦',
  },
  {
    icon: Mic,
    title: 'Narração por Voz',
    description: 'Ouça a análise completa sem precisar ler',
    emoji: '🎙️',
  },
  {
    icon: Coins,
    title: '+425 Ativos',
    description: 'Forex, Cripto, Ações, Índices, Metais, ETFs e Mercado BR',
    emoji: '💱',
  },
  {
    icon: Timer,
    title: 'Resultado em 10s',
    description: 'Sem horas de análise manual. A IA faz tudo por você',
    emoji: '⚡',
  },
];

const steps = [
  {
    step: '01',
    title: 'Escolha o Ativo',
    description: 'Selecione entre 425+ ativos em 7 categorias',
    icon: Coins,
  },
  {
    step: '02',
    title: 'Selecione a Estratégia',
    description: 'SMC, Price Action ou Híbrido',
    icon: Brain,
  },
  {
    step: '03',
    title: 'Receba a Análise',
    description: 'Entrada, stop, alvo e probabilidade em 10 segundos',
    icon: Target,
  },
];

const strategies = [
  {
    name: 'SMC',
    fullName: 'Smart Money Concepts',
    description: 'Identifica zonas institucionais, order blocks e fluxo de capital',
    accent: 'border-cyan-400/60 hover:border-cyan-400',
    glow: 'shadow-cyan-500/10 hover:shadow-cyan-500/20',
    badgeColor: 'bg-cyan-500/20 text-cyan-400',
  },
  {
    name: 'Price Action',
    fullName: 'Price Action',
    description: 'Análise pura do gráfico: padrões de velas, suportes e resistências',
    accent: 'border-emerald-400/60 hover:border-emerald-400',
    glow: 'shadow-emerald-500/10 hover:shadow-emerald-500/20',
    badgeColor: 'bg-emerald-500/20 text-emerald-400',
  },
  {
    name: 'Híbrido IA',
    fullName: 'Híbrido IA',
    description: 'Combina SMC + Price Action com IA. Maior probabilidade de acerto',
    accent: 'border-amber-400/60 hover:border-amber-400',
    glow: 'shadow-amber-500/10 hover:shadow-amber-500/20',
    badgeColor: 'bg-amber-500/20 text-amber-400',
  },
];

const aiDelivers = [
  { icon: MapPin, label: 'Ponto de Entrada' },
  { icon: ShieldAlert, label: 'Stop Loss' },
  { icon: Target, label: 'Take Profit' },
  { icon: BarChart3, label: 'Probabilidade de Acerto' },
];

const plans = [
  {
    name: 'Grátis',
    price: 'R$0',
    period: '/mês',
    description: 'Experimente o ForexAI Pro sem compromisso',
    features: [
      '100 créditos grátis',
      '1 crédito por análise',
      '1 estratégia',
      'Scanner de Padrões',
    ],
    cta: 'Começar Grátis',
    ctaLocation: 'pricing_free',
    popular: false,
    buttonClass: 'bg-slate-700 hover:bg-slate-600 text-white',
  },
  {
    name: 'Pro',
    price: 'R$49,90',
    period: '/mês',
    description: 'Análises ilimitadas com todas as estratégias',
    features: [
      'Créditos ilimitados',
      '3 estratégias',
      'Comparação de estratégias',
      'Narração por voz',
      'Prioridade na fila',
    ],
    cta: 'Assinar Agora',
    ctaLocation: 'pricing_pro',
    popular: true,
    buttonClass: 'bg-cyan-500 hover:bg-cyan-600 text-white',
  },
  {
    name: 'Anual',
    price: 'R$479',
    period: '/ano',
    description: 'Economia de R$119,80 — equivale a R$39,92/mês',
    features: [
      'Tudo do Pro',
      'Economia de R$119,80',
      'R$39,92/mês',
      'Suporte prioritário',
    ],
    cta: 'Assinar Anual',
    ctaLocation: 'pricing_annual',
    popular: false,
    buttonClass: 'bg-emerald-500 hover:bg-emerald-600 text-white',
  },
];

/* ──────────────── Page Component ──────────────── */

export default function LandingPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
      setMobileMenuOpen(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-white overflow-x-hidden">
      {/* ─── NAVBAR ─── */}
      <nav className="sticky top-0 z-50 bg-slate-950/80 backdrop-blur-xl border-b border-slate-800/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-2 group">
              <div className="w-8 h-8 rounded-lg bg-cyan-500 flex items-center justify-center">
                <Zap className="w-5 h-5 text-white" />
              </div>
              <span className="text-lg font-bold tracking-tight">
                ForexAI <span className="text-cyan-400">Pro</span>
              </span>
            </Link>

            {/* Desktop Nav */}
            <div className="hidden md:flex items-center gap-8">
              <button
                onClick={() => scrollTo('recursos')}
                className="text-sm text-slate-400 hover:text-white transition-colors"
              >
                Recursos
              </button>
              <button
                onClick={() => scrollTo('estrategias')}
                className="text-sm text-slate-400 hover:text-white transition-colors"
              >
                Estratégias
              </button>
              <button
                onClick={() => scrollTo('precos')}
                className="text-sm text-slate-400 hover:text-white transition-colors"
              >
                Preços
              </button>
              <Link href="/" onClick={() => trackLandingCTA('navbar')}>
                <Button className="bg-cyan-500 hover:bg-cyan-600 text-white min-h-[44px]">
                  Começar Grátis
                  <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
              </Link>
            </div>

            {/* Mobile hamburger */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 text-slate-400 hover:text-white min-h-[44px] min-w-[44px] flex items-center justify-center"
              aria-label="Menu"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="md:hidden bg-slate-900 border-b border-slate-800"
          >
            <div className="px-4 py-4 space-y-3">
              <button
                onClick={() => scrollTo('recursos')}
                className="block w-full text-left text-slate-300 hover:text-white py-2 min-h-[44px]"
              >
                Recursos
              </button>
              <button
                onClick={() => scrollTo('estrategias')}
                className="block w-full text-left text-slate-300 hover:text-white py-2 min-h-[44px]"
              >
                Estratégias
              </button>
              <button
                onClick={() => scrollTo('precos')}
                className="block w-full text-left text-slate-300 hover:text-white py-2 min-h-[44px]"
              >
                Preços
              </button>
              <Link href="/" onClick={() => trackLandingCTA('mobile_nav')}>
                <Button className="w-full bg-cyan-500 hover:bg-cyan-600 text-white min-h-[44px] mt-2">
                  Começar Grátis
                  <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
              </Link>
            </div>
          </motion.div>
        )}
      </nav>

      {/* ─── HERO ─── */}
      <section className="relative pt-20 pb-16 sm:pt-28 sm:pb-24 px-4 overflow-hidden">
        {/* Animated gradient bg */}
        <div className="absolute inset-0 -z-10">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl animate-pulse" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl animate-pulse [animation-delay:2s]" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-cyan-500/5 rounded-full blur-3xl" />
        </div>

        {/* Floating elements */}
        <div className="absolute top-20 left-10 w-2 h-2 bg-cyan-400/40 rounded-full animate-bounce [animation-delay:1s] hidden sm:block" />
        <div className="absolute top-40 right-20 w-3 h-3 bg-emerald-400/30 rounded-full animate-bounce [animation-delay:2s] hidden sm:block" />
        <div className="absolute bottom-32 left-1/3 w-2 h-2 bg-amber-400/30 rounded-full animate-bounce [animation-delay:3s] hidden sm:block" />

        <div className="max-w-4xl mx-auto text-center">
          <motion.div initial="hidden" animate="visible" variants={staggerContainer}>
            {/* Badge */}
            <motion.div variants={fadeInUp} className="mb-6">
              <Badge
                variant="outline"
                className="bg-cyan-500/10 border-cyan-500/30 text-cyan-400 px-4 py-1.5 text-sm"
              >
                🚀 Powered by AI — 425+ Ativos
              </Badge>
            </motion.div>

            {/* Headline */}
            <motion.h1
              variants={fadeInUp}
              className="text-4xl sm:text-5xl md:text-6xl font-extrabold leading-tight mb-6"
            >
              A IA Que Analisa o{' '}
              <span className="bg-gradient-to-r from-cyan-400 to-emerald-400 bg-clip-text text-transparent">
                Mercado Por Você
              </span>
            </motion.h1>

            {/* Subtitle */}
            <motion.p
              variants={fadeInUp}
              className="text-lg sm:text-xl text-slate-400 max-w-2xl mx-auto mb-10 leading-relaxed"
            >
              Em 10 segundos, receba entrada, stop, alvo e probabilidade de acerto.
              Sem indicadores. Sem horas de análise.
            </motion.p>

            {/* CTAs */}
            <motion.div
              variants={fadeInUp}
              className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-14"
            >
              <Link href="/" onClick={() => trackLandingCTA('hero')}>
                <Button
                  size="lg"
                  className="bg-cyan-500 hover:bg-cyan-600 text-white min-h-[48px] px-8 text-base shadow-lg shadow-cyan-500/25"
                >
                  Começar Grátis
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
              </Link>
              <Button
                size="lg"
                variant="outline"
                className="bg-slate-800 border-slate-600 text-slate-300 hover:text-white hover:bg-slate-700 min-h-[48px] px-8 text-base"
                onClick={() => scrollTo('recursos')}
              >
                Ver Como Funciona
              </Button>
            </motion.div>

            {/* Stats */}
            <motion.div
              variants={fadeInUp}
              className="grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-2xl mx-auto"
            >
              {[
                { value: '425+', label: 'Ativos' },
                { value: '3', label: 'Estratégias' },
                { value: '10s', label: 'Análise' },
                { value: '78%', label: 'Probabilidade' },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4 text-center"
                >
                  <div className="text-2xl font-bold text-cyan-400">{stat.value}</div>
                  <div className="text-sm text-slate-500">{stat.label}</div>
                </div>
              ))}
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* ─── SOCIAL PROOF ─── */}
      <section className="py-12 px-4 border-y border-slate-800/40 bg-slate-900/40">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-50px' }}
          variants={fadeInUp}
          className="max-w-3xl mx-auto text-center"
        >
          <p className="text-slate-500 text-sm mb-4">Confiado por traders em todo o Brasil</p>
          <div className="flex items-center justify-center gap-4 mb-3">
            {/* Avatars row */}
            <div className="flex -space-x-2">
              {['bg-cyan-500', 'bg-emerald-500', 'bg-amber-500', 'bg-purple-500', 'bg-rose-500'].map(
                (bg, i) => (
                  <div
                    key={i}
                    className={`w-8 h-8 rounded-full ${bg} border-2 border-slate-950 flex items-center justify-center text-xs font-bold text-white`}
                  >
                    {String.fromCharCode(65 + i)}
                  </div>
                )
              )}
            </div>
            <span className="text-slate-300 font-medium">1.500+ traders ativos</span>
          </div>
          <div className="flex items-center justify-center gap-1">
            {[1, 2, 3, 4, 5].map((s) => (
              <Star key={s} className="w-5 h-5 text-amber-400 fill-amber-400" />
            ))}
            <span className="text-slate-400 ml-2 text-sm">4.9/5</span>
          </div>
        </motion.div>
      </section>

      {/* ─── FEATURES ─── */}
      <section id="recursos" className="py-20 px-4">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-50px' }}
            variants={fadeInUp}
            className="text-center mb-14"
          >
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              Tudo Que Você Precisa Para{' '}
              <span className="bg-gradient-to-r from-cyan-400 to-emerald-400 bg-clip-text text-transparent">
                Operar Com IA
              </span>
            </h2>
            <p className="text-slate-400 max-w-xl mx-auto">
              Ferramentas avançadas que transformam sua operação no mercado financeiro
            </p>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-50px' }}
            variants={staggerContainer}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {features.map((feature) => (
              <motion.div key={feature.title} variants={fadeInUp}>
                <Card className="bg-slate-800/50 border-slate-700/50 hover:border-cyan-500/30 transition-all duration-300 hover:shadow-lg hover:shadow-cyan-500/5 h-full">
                  <CardContent className="p-6">
                    <div className="text-3xl mb-4">{feature.emoji}</div>
                    <h3 className="text-lg font-semibold mb-2 text-white">{feature.title}</h3>
                    <p className="text-slate-400 text-sm leading-relaxed">{feature.description}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ─── HOW IT WORKS ─── */}
      <section className="py-20 px-4 bg-slate-900/40 border-y border-slate-800/40">
        <div className="max-w-5xl mx-auto">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-50px' }}
            variants={fadeInUp}
            className="text-center mb-14"
          >
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              Como{' '}
              <span className="bg-gradient-to-r from-cyan-400 to-emerald-400 bg-clip-text text-transparent">
                Funciona
              </span>
            </h2>
            <p className="text-slate-400">Três passos simples para sua próxima operação</p>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-50px' }}
            variants={staggerContainer}
            className="grid grid-cols-1 md:grid-cols-3 gap-8"
          >
            {steps.map((step, idx) => (
              <motion.div key={step.step} variants={fadeInUp} className="relative">
                {idx < steps.length - 1 && (
                  <div className="hidden md:block absolute top-12 left-[60%] w-[80%] h-px bg-gradient-to-r from-cyan-500/30 to-transparent" />
                )}
                <div className="text-center">
                  <div className="w-16 h-16 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center mx-auto mb-5">
                    <step.icon className="w-7 h-7 text-cyan-400" />
                  </div>
                  <div className="text-cyan-400 font-mono text-sm mb-2">{step.step}</div>
                  <h3 className="text-xl font-semibold mb-2">{step.title}</h3>
                  <p className="text-slate-400 text-sm">{step.description}</p>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ─── STRATEGIES ─── */}
      <section id="estrategias" className="py-20 px-4">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-50px' }}
            variants={fadeInUp}
            className="text-center mb-14"
          >
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              3 Estratégias{' '}
              <span className="bg-gradient-to-r from-cyan-400 to-emerald-400 bg-clip-text text-transparent">
                de IA
              </span>
            </h2>
            <p className="text-slate-400 max-w-xl mx-auto">
              Cada estratégia entrega pontos precisos de entrada, stop e alvo com probabilidade de acerto
            </p>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-50px' }}
            variants={staggerContainer}
            className="grid grid-cols-1 md:grid-cols-3 gap-6"
          >
            {strategies.map((s) => (
              <motion.div key={s.name} variants={fadeInUp}>
                <Card
                  className={`bg-slate-800/50 border-2 ${s.accent} transition-all duration-300 hover:shadow-xl ${s.glow} h-full`}
                >
                  <CardContent className="p-6">
                    <Badge className={`${s.badgeColor} mb-4 border-0 font-semibold`}>
                      {s.name}
                    </Badge>
                    <h3 className="text-xl font-bold mb-1 text-white">{s.fullName}</h3>
                    <p className="text-slate-400 text-sm mb-6 leading-relaxed">{s.description}</p>

                    <Separator className="bg-slate-700/50 mb-5" />

                    <p className="text-xs text-slate-500 uppercase tracking-wider mb-3">
                      A IA entrega
                    </p>
                    <div className="space-y-3">
                      {aiDelivers.map((item) => (
                        <div key={item.label} className="flex items-center gap-3">
                          <item.icon className="w-4 h-4 text-cyan-400 shrink-0" />
                          <span className="text-sm text-slate-300">{item.label}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ─── PRICING ─── */}
      <section id="precos" className="py-20 px-4 bg-slate-900/40 border-y border-slate-800/40">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-50px' }}
            variants={fadeInUp}
            className="text-center mb-14"
          >
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              Planos{' '}
              <span className="bg-gradient-to-r from-cyan-400 to-emerald-400 bg-clip-text text-transparent">
                Acessíveis
              </span>
            </h2>
            <p className="text-slate-400">Comece grátis e evolua quando quiser</p>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-50px' }}
            variants={staggerContainer}
            className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch"
          >
            {plans.map((plan) => (
              <motion.div key={plan.name} variants={fadeInUp} className="relative">
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
                    <Badge className="bg-cyan-500 text-white border-0 px-3 py-1 text-xs font-bold shadow-lg shadow-cyan-500/30">
                      MAIS POPULAR
                    </Badge>
                  </div>
                )}
                <Card
                  className={`bg-slate-800/50 border-slate-700/50 h-full transition-all duration-300 ${
                    plan.popular
                      ? 'border-cyan-500/50 shadow-xl shadow-cyan-500/10 ring-1 ring-cyan-500/20'
                      : 'hover:border-slate-600'
                  }`}
                >
                  <CardContent className="p-6 flex flex-col h-full">
                    <h3 className="text-xl font-bold mb-1">{plan.name}</h3>
                    <p className="text-slate-500 text-sm mb-5">{plan.description}</p>

                    <div className="mb-6">
                      <span className="text-4xl font-extrabold text-white">{plan.price}</span>
                      <span className="text-slate-500 text-lg">{plan.period}</span>
                    </div>

                    <Separator className="bg-slate-700/50 mb-5" />

                    <ul className="space-y-3 mb-8 flex-1">
                      {plan.features.map((feature) => (
                        <li key={feature} className="flex items-start gap-2">
                          <Check className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                          <span className="text-sm text-slate-300">{feature}</span>
                        </li>
                      ))}
                    </ul>

                    <Link href="/" onClick={() => trackLandingCTA(plan.ctaLocation)}>
                      <Button
                        className={`w-full min-h-[48px] text-base ${plan.buttonClass}`}
                      >
                        {plan.cta}
                        <ChevronRight className="w-4 h-4 ml-1" />
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ─── FINAL CTA ─── */}
      <section className="py-24 px-4 relative overflow-hidden">
        {/* Background glow */}
        <div className="absolute inset-0 -z-10">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-cyan-500/10 rounded-full blur-3xl" />
        </div>

        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-50px' }}
          variants={staggerContainer}
          className="max-w-3xl mx-auto text-center"
        >
          <motion.h2 variants={fadeInUp} className="text-3xl sm:text-4xl font-bold mb-4">
            Pronto Para Operar Com{' '}
            <span className="bg-gradient-to-r from-cyan-400 to-emerald-400 bg-clip-text text-transparent">
              IA?
            </span>
          </motion.h2>

          <motion.p variants={fadeInUp} className="text-slate-400 text-lg mb-10">
            Milhares de traders já usam o ForexAI Pro. Comece grátis hoje.
          </motion.p>

          <motion.div variants={fadeInUp} className="mb-10">
            <Link href="/" onClick={() => trackLandingCTA('cta_final')}>
              <Button
                size="lg"
                className="bg-cyan-500 hover:bg-cyan-600 text-white min-h-[52px] px-12 text-lg shadow-xl shadow-cyan-500/25"
              >
                Começar Grátis Agora
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </Link>
          </motion.div>

          <motion.div
            variants={fadeInUp}
            className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-8 text-sm text-slate-500"
          >
            <span className="flex items-center gap-1.5">
              <Check className="w-4 h-4 text-emerald-400" /> Sem cartão de crédito
            </span>
            <span className="flex items-center gap-1.5">
              <Check className="w-4 h-4 text-emerald-400" /> 100 créditos grátis
            </span>
            <span className="flex items-center gap-1.5">
              <Check className="w-4 h-4 text-emerald-400" /> Cancele quando quiser
            </span>
          </motion.div>
        </motion.div>
      </section>

      {/* ─── FOOTER ─── */}
      <footer className="mt-auto border-t border-slate-800/60 bg-slate-950 py-8 px-4">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-cyan-500 flex items-center justify-center">
              <Zap className="w-4 h-4 text-white" />
            </div>
            <span className="text-sm font-semibold text-slate-400">
              ForexAI <span className="text-cyan-400">Pro</span>
            </span>
          </div>

          <div className="flex items-center gap-6 text-sm text-slate-500">
            <Link href="/termos" className="hover:text-slate-300 transition-colors">
              Termos
            </Link>
            <Link href="/privacidade" className="hover:text-slate-300 transition-colors">
              Privacidade
            </Link>
            <Link href="/faq" className="hover:text-slate-300 transition-colors">
              FAQ
            </Link>
          </div>

          <p className="text-xs text-slate-600">
            © 2025 ForexAI Pro. Todos os direitos reservados.
          </p>
        </div>
      </footer>
    </div>
  );
}
