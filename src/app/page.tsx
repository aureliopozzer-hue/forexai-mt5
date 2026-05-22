'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, useScroll, useTransform, useInView, AnimatePresence } from 'framer-motion';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, LineChart, Line,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import {
  Brain, TrendingUp, Shield, Zap, BarChart3, Activity,
  ChevronRight, ArrowRight, Globe, Sparkles, Target,
  Star, Users, Lock, Play, LineChart as LineChartIcon,
  PieChart as PieChartIcon, CandlestickChart, Wallet,
  FileText, Clock, AlertTriangle, CheckCircle2, ArrowUpRight,
  ArrowDownRight, Minus, Gauge, ScanLine, Volume2, Layers,
  MonitorSmartphone, BadgeDollarSign, TrendingDown, Radio, Send, ExternalLink, Share2
} from 'lucide-react';

// ─── CHART DATA ───────────────────────────────────────────────────
const equityData = [
  { month: 'Jan', value: 10000 }, { month: 'Fev', value: 10200 },
  { month: 'Mar', value: 10150 }, { month: 'Abr', value: 10800 },
  { month: 'Mai', value: 11200 }, { month: 'Jun', value: 10900 },
  { month: 'Jul', value: 11500 }, { month: 'Ago', value: 12100 },
  { month: 'Set', value: 11800 }, { month: 'Out', value: 12600 },
  { month: 'Nov', value: 13200 }, { month: 'Dez', value: 14100 },
];

const monthlyReturns = [
  { month: 'Jan', retorno: 2.0 }, { month: 'Fev', retorno: -0.5 },
  { month: 'Mar', retorno: 6.4 }, { month: 'Abr', retorno: 3.7 },
  { month: 'Mai', retorno: -2.7 }, { month: 'Jun', retorno: 5.5 },
  { month: 'Jul', retorno: 5.2 }, { month: 'Ago', retorno: -2.5 },
  { month: 'Set', retorno: 6.8 }, { month: 'Out', retorno: 4.8 },
  { month: 'Nov', retorno: 6.3 }, { month: 'Dez', retorno: 8.2 },
];

const winRateData = [
  { name: 'Wins', value: 72, color: '#06b6d4' },
  { name: 'Losses', value: 28, color: '#6b21a8' },
];

const strategyCompare = [
  { name: 'SMC', winRate: 84, avgRR: 2.1, trades: 156 },
  { name: 'Price Action', winRate: 79, avgRR: 1.8, trades: 143 },
  { name: 'Híbrido', winRate: 89, avgRR: 2.4, trades: 168 },
];

const assetAllocation = [
  { name: 'Forex', value: 42, color: '#06b6d4' },
  { name: 'Índices', value: 22, color: '#8b5cf6' },
  { name: 'Cripto', value: 18, color: '#22d3ee' },
  { name: 'Metais', value: 12, color: '#a78bfa' },
  { name: 'Ações', value: 6, color: '#67e8f9' },
];

const performanceLine = [
  { day: '1', smc: 52, pa: 48, hybrid: 55 },
  { day: '5', smc: 56, pa: 51, hybrid: 60 },
  { day: '10', smc: 61, pa: 55, hybrid: 66 },
  { day: '15', smc: 58, pa: 53, hybrid: 63 },
  { day: '20', smc: 65, pa: 59, hybrid: 71 },
  { day: '25', smc: 70, pa: 63, hybrid: 76 },
  { day: '30', smc: 76, pa: 67, hybrid: 82 },
  { day: '35', smc: 78, pa: 71, hybrid: 85 },
  { day: '40', smc: 81, pa: 74, hybrid: 87 },
  { day: '45', smc: 83, pa: 76, hybrid: 89 },
  { day: '50', smc: 84, pa: 79, hybrid: 91 },
];

const recentTrades = [
  { pair: 'EUR/USD', dir: 'BUY', entry: 1.0842, sl: 1.0818, tp: 1.0890, result: '+48 pips', pnl: '+$480', status: 'win' },
  { pair: 'GBP/JPY', dir: 'SELL', entry: 191.45, sl: 191.90, tp: 190.55, result: '+90 pips', pnl: '+$900', status: 'win' },
  { pair: 'BTC/USD', dir: 'BUY', entry: 67420, sl: 66800, tp: 69200, result: '-40 pips', pnl: '-$400', status: 'loss' },
  { pair: 'USD/JPY', dir: 'SELL', entry: 154.82, sl: 155.20, tp: 154.10, result: '+72 pips', pnl: '+$720', status: 'win' },
  { pair: 'XAU/USD', dir: 'BUY', entry: 2340.50, sl: 2325.00, tp: 2375.00, result: '+34.5 pts', pnl: '+$690', status: 'win' },
];

// ─── Animated Counter ───────────────────────────────────────────────
function AnimatedCounter({ end, duration = 2, suffix = '', prefix = '' }: { end: number; duration?: number; suffix?: string; prefix?: string }) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true });

  useEffect(() => {
    if (!isInView) return;
    let start = 0;
    const increment = end / (duration * 60);
    const timer = setInterval(() => {
      start += increment;
      if (start >= end) { setCount(end); clearInterval(timer); }
      else { setCount(Math.floor(start)); }
    }, 1000 / 60);
    return () => clearInterval(timer);
  }, [isInView, end, duration]);

  return <span ref={ref}>{prefix}{count.toLocaleString('pt-BR')}{suffix}</span>;
}

// ─── Floating Particles ─────────────────────────────────────────────
function FloatingParticles() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {Array.from({ length: 25 }).map((_, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full"
          style={{
            width: Math.random() * 3 + 1,
            height: Math.random() * 3 + 1,
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
            background: i % 3 === 0 ? '#06b6d4' : i % 3 === 1 ? '#8b5cf6' : '#06b6d480',
          }}
          animate={{ y: [0, -30, 0], opacity: [0.2, 0.6, 0.2] }}
          transition={{ duration: Math.random() * 4 + 3, repeat: Infinity, delay: Math.random() * 3, ease: 'easeInOut' }}
        />
      ))}
    </div>
  );
}

// ─── Gradient Orb ───────────────────────────────────────────────────
function GradientOrb({ className, color = 'cyan' }: { className?: string; color?: 'cyan' | 'violet' }) {
  return (
    <motion.div
      className={`absolute rounded-full blur-[120px] pointer-events-none ${className}`}
      style={{
        background: color === 'cyan'
          ? 'radial-gradient(circle, rgba(6,182,212,0.15) 0%, rgba(6,182,212,0) 70%)'
          : 'radial-gradient(circle, rgba(139,92,246,0.15) 0%, rgba(139,92,246,0) 70%)',
      }}
      animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0.8, 0.5] }}
      transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
    />
  );
}

// ─── Section Reveal ─────────────────────────────────────────────────
function SectionReveal({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-80px' });
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 50 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.8, ease: [0.25, 0.46, 0.45, 0.94] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// ─── Animated Candlestick Line (Hero Background) ────────────────────
function AnimatedChartLine() {
  const points = [20, 35, 28, 45, 38, 55, 48, 62, 58, 72, 65, 78, 70, 85, 80, 92, 88, 95];
  const width = 800;
  const height = 200;
  const stepX = width / (points.length - 1);

  const pathD = points.map((p, i) => {
    const x = i * stepX;
    const y = height - (p / 100) * height;
    return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
  }).join(' ');

  const areaD = pathD + ` L ${width} ${height} L 0 ${height} Z`;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full" preserveAspectRatio="none">
      <defs>
        <linearGradient id="chartGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#06b6d4" stopOpacity="0" />
        </linearGradient>
      </defs>
      <motion.path
        d={areaD}
        fill="url(#chartGrad)"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 2, delay: 0.5 }}
      />
      <motion.path
        d={pathD}
        fill="none"
        stroke="#06b6d4"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 2, delay: 0.5, ease: 'easeInOut' }}
      />
    </svg>
  );
}

// ─── Custom Tooltip for Charts ──────────────────────────────────────
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#0a0a1a]/90 backdrop-blur-md border border-white/10 rounded-lg px-3 py-2 text-xs shadow-xl">
      <p className="text-gray-400 mb-1">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} className="font-mono" style={{ color: p.color }}>
          {p.name}: {typeof p.value === 'number' ? p.value.toLocaleString('pt-BR') : p.value}
        </p>
      ))}
    </div>
  );
}

// ─── MAIN LANDING PAGE ─────────────────────────────────────────────
export default function LandingPage() {
  const [mounted, setMounted] = useState(false);
  const [mousePos, setMousePos] = useState({ x: 0.5, y: 0.5 });
  const heroRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll();
  const heroOpacity = useTransform(scrollYProgress, [0, 0.12], [1, 0]);
  const heroScale = useTransform(scrollYProgress, [0, 0.12], [1, 0.97]);

  useEffect(() => {
    // Hydration marker - must be set after mount to avoid SSR/client mismatch
    requestAnimationFrame(() => setMounted(true));
    const handleMouse = (e: MouseEvent) => {
      setMousePos({ x: e.clientX / window.innerWidth, y: e.clientY / window.innerHeight });
    };
    window.addEventListener('mousemove', handleMouse);
    return () => window.removeEventListener('mousemove', handleMouse);
  }, []);

  const handleEnterApp = () => {
    window.location.href = '/app';
  };

  const [showTelegramPopup, setShowTelegramPopup] = useState(false);
  const [telegramPopupShown, setTelegramPopupShown] = useState(false);

  useEffect(() => {
    // Show Telegram popup after 8 seconds
    const timer = setTimeout(() => {
      if (!telegramPopupShown) {
        setShowTelegramPopup(true);
        setTelegramPopupShown(true);
      }
    }, 8000);
    return () => clearTimeout(timer);
  }, [telegramPopupShown]);

  if (!mounted) return null;

  return (
    <div className="min-h-screen bg-[#050510] text-white overflow-x-hidden relative">
      {/* ═══════════════════ FLOATING TELEGRAM BUTTON ═══════════════════ */}
      <motion.div
        className="fixed bottom-6 right-6 z-[60]"
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 2, type: 'spring', stiffness: 200 }}
      >
        {/* Pulse ring */}
        <div className="absolute inset-0 rounded-full bg-[#229ED9] animate-ping opacity-20" />
        <motion.a
          href="https://t.me/forexaipro_sinais"
          target="_blank"
          rel="noopener noreferrer"
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
          className="relative flex items-center justify-center w-14 h-14 rounded-full bg-[#229ED9] shadow-lg shadow-[#229ED9]/30 hover:shadow-[#229ED9]/50 transition-shadow"
          title="Entrar no canal do Telegram"
        >
          <Send className="w-6 h-6 text-white" />
        </motion.a>
      </motion.div>

      {/* ═══════════════════ TELEGRAM POPUP (appears after 8s) ═══════════════════ */}
      <AnimatePresence>
        {showTelegramPopup && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 50, scale: 0.9 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            className="fixed bottom-24 right-6 z-[60] w-80"
          >
            <div className="bg-[#0f0f2a]/95 backdrop-blur-xl border border-[#229ED9]/30 rounded-2xl p-5 shadow-2xl shadow-[#229ED9]/10">
              <button
                onClick={() => setShowTelegramPopup(false)}
                className="absolute top-3 right-3 text-gray-500 hover:text-white transition-colors text-lg leading-none"
              >
                ×
              </button>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-[#229ED9]/20 flex items-center justify-center">
                  <Send className="w-5 h-5 text-[#229ED9]" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">Sinais Grátis no Telegram</p>
                  <p className="text-xs text-gray-400">@forexaipro_sinais</p>
                </div>
              </div>
              <p className="text-xs text-gray-400 mb-4 leading-relaxed">
                Receba sinais de Forex, Cripto e Índices gratuitamente. 4 sinais por dia com IA!
              </p>
              <div className="flex items-center gap-2 mb-3">
                {['🔥', '🚀', '🎯'].map((e, i) => (
                  <span key={i} className="text-lg">{e}</span>
                ))}
                <span className="text-xs text-gray-500">+20.000 traders</span>
              </div>
              <a
                href="https://t.me/forexaipro_sinais"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-[#229ED9] hover:bg-[#1a8bc4] text-white text-sm font-semibold transition-colors"
              >
                <Send className="w-4 h-4" />
                Entrar no Canal Grátis
              </a>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {/* ═══════════════════ NAVBAR ═══════════════════ */}
      <motion.nav
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.2 }}
        className="fixed top-0 left-0 right-0 z-50 backdrop-blur-xl bg-[#050510]/80 border-b border-white/[0.04]"
      >
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500 to-violet-500 flex items-center justify-center">
              <Brain className="w-4.5 h-4.5 text-white" />
            </div>
            <span className="text-lg font-bold tracking-tight">ForexAI Pro</span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm text-gray-400">
            <a href="#features" className="hover:text-white transition-colors">Funcionalidades</a>
            <a href="#dashboard" className="hover:text-white transition-colors">Plataforma</a>
            <a href="#stats" className="hover:text-white transition-colors">Estatísticas</a>
            <a href="#pricing" className="hover:text-white transition-colors">Preços</a>
            <a href="https://t.me/forexaipro_sinais" target="_blank" rel="noopener noreferrer" className="hover:text-[#229ED9] transition-colors flex items-center gap-1 text-[#229ED9]">
              <Send className="w-3.5 h-3.5" />
              Telegram
            </a>
            <a href="/afiliados" className="hover:text-cyan-400 transition-colors flex items-center gap-1">
              <BadgeDollarSign className="w-3.5 h-3.5" />
              Afiliados
            </a>
          </div>
          <motion.button
            onClick={handleEnterApp}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            className="px-5 py-2 rounded-full bg-white/[0.06] border border-white/[0.1] text-sm font-medium hover:bg-white/[0.1] hover:border-white/[0.15] transition-all duration-300"
          >
            Acessar Plataforma
          </motion.button>
        </div>
      </motion.nav>

      {/* ═══════════════════ HERO ═══════════════════ */}
      <motion.section
        ref={heroRef}
        style={{ opacity: heroOpacity, scale: heroScale }}
        className="relative min-h-screen flex flex-col items-center justify-center px-6 pt-16"
      >
        <GradientOrb className="w-[700px] h-[700px] -top-40 -left-40" color="cyan" />
        <GradientOrb className="w-[500px] h-[500px] -bottom-20 -right-20" color="violet" />
        <FloatingParticles />

        {/* Mouse-following gradient */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: `radial-gradient(800px circle at ${mousePos.x * 100}% ${mousePos.y * 100}%, rgba(6,182,212,0.04), transparent 60%)`,
          }}
        />

        <div className="relative z-10 text-center max-w-5xl mx-auto">
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-cyan-500/10 border border-cyan-500/20 mb-8"
          >
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-xs font-medium text-cyan-400 tracking-wide">POWERED BY INTELIGÊNCIA ARTIFICIAL</span>
          </motion.div>

          {/* Headline */}
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.5 }}
            className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-bold tracking-tight leading-[0.95] mb-6"
          >
            <span className="bg-gradient-to-b from-white via-white to-gray-500 bg-clip-text text-transparent">
              Inteligência
            </span>
            <br />
            <span className="bg-gradient-to-r from-cyan-400 via-cyan-300 to-violet-400 bg-clip-text text-transparent">
              Artificial
            </span>
            <br />
            <span className="bg-gradient-to-b from-white via-white to-gray-500 bg-clip-text text-transparent">
              que opera com você
            </span>
          </motion.h1>

          {/* Subheadline */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.7 }}
            className="text-base sm:text-lg text-gray-400 max-w-2xl mx-auto mb-10 leading-relaxed"
          >
            Análises em tempo real, sinais de entrada e saída, controle de trades e estatísticas completas.
            Tudo para Forex, Índices, Cripto e 500+ ativos.
          </motion.p>

          {/* CTA Button */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.9 }}
            className="flex flex-col items-center gap-4"
          >
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <motion.button
                onClick={handleEnterApp}
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.97 }}
                className="group relative inline-flex items-center gap-3 px-8 py-4 rounded-full bg-gradient-to-r from-cyan-500 to-violet-500 text-white font-semibold text-base shadow-2xl shadow-cyan-500/25 hover:shadow-cyan-500/40 transition-shadow duration-500"
              >
                <div className="absolute inset-0 rounded-full bg-gradient-to-r from-cyan-500 to-violet-500 blur-xl opacity-40 group-hover:opacity-60 transition-opacity duration-500" />
                <span className="relative">Entrar no ForexAI Pro</span>
                <ArrowRight className="relative w-5 h-5 group-hover:translate-x-1 transition-transform duration-300" />
              </motion.button>
              <motion.a
                href="https://t.me/forexaipro_sinais"
                target="_blank"
                rel="noopener noreferrer"
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.97 }}
                className="group relative inline-flex items-center gap-3 px-8 py-4 rounded-full bg-[#229ED9] text-white font-semibold text-base shadow-2xl shadow-[#229ED9]/25 hover:shadow-[#229ED9]/40 transition-shadow duration-500"
              >
                <div className="absolute inset-0 rounded-full bg-[#229ED9] blur-xl opacity-40 group-hover:opacity-60 transition-opacity duration-500" />
                <Send className="relative w-5 h-5" />
                <span className="relative">Sinais Grátis no Telegram</span>
              </motion.a>
            </div>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 1.2 }}
              className="text-xs text-gray-500 flex items-center gap-3 flex-wrap justify-center"
            >
              <span className="flex items-center gap-1"><Zap className="w-3 h-3" /> 3 dias grátis</span>
              <span>·</span>
              <span className="flex items-center gap-1"><Radio className="w-3 h-3" /> Sinais no Telegram</span>
              <span>·</span>
              <span>Sem cartão de crédito</span>
            </motion.p>
          </motion.div>
        </div>

        {/* Hero Chart Animation */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 0.3, y: 0 }}
          transition={{ duration: 1.5, delay: 1.2 }}
          className="absolute bottom-0 left-0 right-0 h-40 pointer-events-none"
        >
          <AnimatedChartLine />
        </motion.div>

        {/* Scroll indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.8 }}
          className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10"
        >
          <motion.div
            animate={{ y: [0, 8, 0] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            className="w-6 h-10 rounded-full border-2 border-white/20 flex justify-center pt-2"
          >
            <div className="w-1 h-2 rounded-full bg-white/40" />
          </motion.div>
        </motion.div>
      </motion.section>

      {/* ═══════════════════ LIVE STATS BAR ═══════════════════ */}
      <section className="relative py-16 px-6 border-y border-white/[0.04]">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {[
              { value: 50, suffix: 'K+', label: 'Análises realizadas', icon: BarChart3 },
              { value: 500, suffix: '+', label: 'Ativos monitorados', icon: Globe },
              { value: 89, suffix: '%', label: 'Taxa de acerto IA', icon: TrendingUp },
              { value: 15, suffix: 'K+', label: 'Traders ativos', icon: Users },
            ].map((stat, i) => (
              <SectionReveal key={i}>
                <div className="text-center">
                  <div className="flex justify-center mb-3">
                    <div className="w-10 h-10 rounded-lg bg-cyan-500/10 flex items-center justify-center">
                      <stat.icon className="w-5 h-5 text-cyan-400" />
                    </div>
                  </div>
                  <div className="text-3xl sm:text-4xl md:text-5xl font-bold bg-gradient-to-b from-white to-gray-400 bg-clip-text text-transparent">
                    <AnimatedCounter end={stat.value} suffix={stat.suffix} />
                  </div>
                  <p className="text-sm text-gray-500 mt-1">{stat.label}</p>
                </div>
              </SectionReveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════ INTERACTIVE DASHBOARD PREVIEW ═══════════════════ */}
      <section id="dashboard" className="relative py-28 px-6">
        <GradientOrb className="w-[500px] h-[500px] top-0 right-0" color="violet" />
        <div className="max-w-7xl mx-auto">
          <SectionReveal>
            <div className="text-center mb-16">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-400 mb-4">Dashboard ao Vivo</p>
              <h2 className="text-4xl sm:text-5xl font-bold tracking-tight bg-gradient-to-b from-white to-gray-400 bg-clip-text text-transparent mb-4">
                Controle total dos seus trades
              </h2>
              <p className="text-gray-400 max-w-2xl mx-auto">
                Acompanhe sua evolução, gerencie riscos e visualize estatísticas detalhadas de cada operação em tempo real.
              </p>
            </div>
          </SectionReveal>

          {/* Main Dashboard Grid */}
          <SectionReveal>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Equity Curve - Takes 2 cols */}
              <div className="lg:col-span-2 rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-sm p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                      <LineChartIcon className="w-4 h-4 text-cyan-400" />
                      Curva de Capital
                    </h3>
                    <p className="text-xs text-gray-500 mt-0.5">Evolução do portfólio em 12 meses</p>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="px-2 py-1 rounded-md bg-green-500/10 text-green-400 font-mono">+41.0%</span>
                  </div>
                </div>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={equityData}>
                      <defs>
                        <linearGradient id="equityGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                          <stop offset="0%" stopColor="#06b6d4" stopOpacity={0.3} />
                          <stop offset="100%" stopColor="#06b6d4" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" />
                      <XAxis dataKey="month" tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `R$${(v/1000).toFixed(0)}k`} />
                      <Tooltip content={<CustomTooltip />} />
                      <Area type="monotone" dataKey="value" stroke="#06b6d4" strokeWidth={2.5} fill="url(#equityGrad)" name="Capital" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Win Rate + Allocation */}
              <div className="flex flex-col gap-4">
                {/* Win Rate Donut */}
                <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-sm p-6 flex-1">
                  <h3 className="text-sm font-semibold text-white flex items-center gap-2 mb-4">
                    <PieChartIcon className="w-4 h-4 text-violet-400" />
                    Taxa de Acerto
                  </h3>
                  <div className="relative h-40">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={winRateData}
                          cx="50%"
                          cy="50%"
                          innerRadius={50}
                          outerRadius={70}
                          paddingAngle={3}
                          dataKey="value"
                          strokeWidth={0}
                        >
                          {winRateData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip content={<CustomTooltip />} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="text-center">
                        <span className="text-2xl font-bold text-white">72%</span>
                        <p className="text-[10px] text-gray-500">Win Rate</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Asset Allocation */}
                <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-sm p-6">
                  <h3 className="text-sm font-semibold text-white flex items-center gap-2 mb-3">
                    <Layers className="w-4 h-4 text-cyan-400" />
                    Alocação por Classe
                  </h3>
                  <div className="space-y-2">
                    {assetAllocation.map((item, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full" style={{ background: item.color }} />
                        <span className="text-xs text-gray-400 w-16">{item.name}</span>
                        <div className="flex-1 h-1.5 rounded-full bg-white/[0.06]">
                          <motion.div
                            className="h-full rounded-full"
                            style={{ background: item.color }}
                            initial={{ width: 0 }}
                            whileInView={{ width: `${item.value}%` }}
                            viewport={{ once: true }}
                            transition={{ duration: 1, delay: i * 0.1 }}
                          />
                        </div>
                        <span className="text-xs text-gray-300 w-8 text-right font-mono">{item.value}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </SectionReveal>

          {/* Second Row: Monthly Returns + Strategy Performance */}
          <SectionReveal>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
              {/* Monthly Returns Bar Chart */}
              <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-sm p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                      <BarChart3 className="w-4 h-4 text-cyan-400" />
                      Retorno Mensal
                    </h3>
                    <p className="text-xs text-gray-500 mt-0.5">Resultados mês a mês (%)</p>
                  </div>
                  <span className="text-xs px-2 py-1 rounded-md bg-cyan-500/10 text-cyan-400 font-mono">Acum: +43.2%</span>
                </div>
                <div className="h-52">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={monthlyReturns}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" />
                      <XAxis dataKey="month" tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `${v}%`} />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="retorno" name="Retorno" radius={[4, 4, 0, 0]} maxBarSize={32}>
                        {monthlyReturns.map((entry, i) => (
                          <Cell key={i} fill={entry.retorno >= 0 ? '#06b6d4' : '#ef4444'} fillOpacity={0.8} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Strategy Performance Line Chart */}
              <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-sm p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                      <Gauge className="w-4 h-4 text-violet-400" />
                      Performance das Estratégias
                    </h3>
                    <p className="text-xs text-gray-500 mt-0.5">Evolução do win rate ao longo do tempo</p>
                  </div>
                  <div className="flex items-center gap-3 text-[10px]">
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-cyan-400" /> SMC</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-violet-400" /> Price Action</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-400" /> Híbrido</span>
                  </div>
                </div>
                <div className="h-52">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={performanceLine}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" />
                      <XAxis dataKey="day" tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={false} tickLine={false} label={{ value: 'Dias', position: 'insideBottom', offset: -5, fill: '#6b7280', fontSize: 10 }} />
                      <YAxis tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `${v}%`} domain={[40, 100]} />
                      <Tooltip content={<CustomTooltip />} />
                      <Line type="monotone" dataKey="smc" stroke="#06b6d4" strokeWidth={2} dot={false} name="SMC" />
                      <Line type="monotone" dataKey="pa" stroke="#8b5cf6" strokeWidth={2} dot={false} name="Price Action" />
                      <Line type="monotone" dataKey="hybrid" stroke="#34d399" strokeWidth={2.5} dot={false} name="Híbrido" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </SectionReveal>
        </div>
      </section>

      {/* ═══════════════════ TRADE CONTROL & JOURNAL ═══════════════════ */}
      <section className="relative py-28 px-6 border-t border-white/[0.04]">
        <GradientOrb className="w-[400px] h-[400px] top-1/4 left-0" color="cyan" />
        <div className="max-w-7xl mx-auto">
          <SectionReveal>
            <div className="text-center mb-16">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-violet-400 mb-4">Controle de Trades</p>
              <h2 className="text-4xl sm:text-5xl font-bold tracking-tight bg-gradient-to-b from-white to-gray-400 bg-clip-text text-transparent mb-4">
                Diário de operações inteligente
              </h2>
              <p className="text-gray-400 max-w-2xl mx-auto">
                Registre, acompanhe e analise cada trade. Estatísticas automáticas, P&L em tempo real e relatórios semanais.
              </p>
            </div>
          </SectionReveal>

          <SectionReveal>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Recent Trades Table */}
              <div className="lg:col-span-2 rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-sm overflow-hidden">
                <div className="p-5 border-b border-white/[0.06]">
                  <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                    <FileText className="w-4 h-4 text-cyan-400" />
                    Trades Recentes
                  </h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-white/[0.04] text-gray-500">
                        <th className="text-left py-3 px-5 font-medium">Ativo</th>
                        <th className="text-left py-3 px-2 font-medium">Direção</th>
                        <th className="text-left py-3 px-2 font-medium">Entrada</th>
                        <th className="text-left py-3 px-2 font-medium">Stop Loss</th>
                        <th className="text-left py-3 px-2 font-medium">Take Profit</th>
                        <th className="text-right py-3 px-5 font-medium">P&L</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentTrades.map((trade, i) => (
                        <motion.tr
                          key={i}
                          initial={{ opacity: 0, x: -20 }}
                          whileInView={{ opacity: 1, x: 0 }}
                          viewport={{ once: true }}
                          transition={{ delay: i * 0.1 }}
                          className="border-b border-white/[0.02] hover:bg-white/[0.02] transition-colors"
                        >
                          <td className="py-3 px-5 font-semibold text-white">{trade.pair}</td>
                          <td className="py-3 px-2">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold ${trade.dir === 'BUY' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
                              {trade.dir === 'BUY' ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                              {trade.dir === 'BUY' ? 'COMPRA' : 'VENDA'}
                            </span>
                          </td>
                          <td className="py-3 px-2 font-mono text-gray-300">{trade.entry}</td>
                          <td className="py-3 px-2 font-mono text-red-400/70">{trade.sl}</td>
                          <td className="py-3 px-2 font-mono text-green-400/70">{trade.tp}</td>
                          <td className="py-3 px-5 text-right font-mono font-semibold">
                            <span className={trade.status === 'win' ? 'text-green-400' : 'text-red-400'}>
                              {trade.pnl}
                            </span>
                          </td>
                        </motion.tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Trade Stats Cards */}
              <div className="flex flex-col gap-4">
                {[
                  { label: 'Total de Trades', value: '847', icon: BarChart3, color: 'cyan', change: '+12%' },
                  { label: 'Profit Factor', value: '2.34', icon: TrendingUp, color: 'emerald', change: '+0.18' },
                  { label: 'Max Drawdown', value: '-8.2%', icon: TrendingDown, color: 'red', change: '-2.1%' },
                  { label: 'Avg. Risk/Reward', value: '1:2.4', icon: Target, color: 'violet', change: '+0.3' },
                ].map((item, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.1 }}
                    className="rounded-xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-sm p-4 flex items-center gap-4 group hover:border-white/[0.12] hover:bg-white/[0.04] transition-all duration-300"
                  >
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      item.color === 'cyan' ? 'bg-cyan-500/10' :
                      item.color === 'emerald' ? 'bg-emerald-500/10' :
                      item.color === 'red' ? 'bg-red-500/10' :
                      'bg-violet-500/10'
                    }`}>
                      <item.icon className={`w-5 h-5 ${
                        item.color === 'cyan' ? 'text-cyan-400' :
                        item.color === 'emerald' ? 'text-emerald-400' :
                        item.color === 'red' ? 'text-red-400' :
                        'text-violet-400'
                      }`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] text-gray-500 uppercase tracking-wider">{item.label}</p>
                      <p className="text-lg font-bold text-white font-mono">{item.value}</p>
                    </div>
                    <span className={`text-[10px] font-mono px-2 py-0.5 rounded ${
                      item.change.startsWith('+') ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
                    }`}>
                      {item.change}
                    </span>
                  </motion.div>
                ))}
              </div>
            </div>
          </SectionReveal>
        </div>
      </section>

      {/* ═══════════════════ FEATURES ═══════════════════ */}
      <section id="features" className="relative py-28 px-6 border-t border-white/[0.04]">
        <div className="max-w-7xl mx-auto">
          <SectionReveal>
            <div className="text-center mb-16">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-400 mb-4">Funcionalidades</p>
              <h2 className="text-4xl sm:text-5xl font-bold tracking-tight bg-gradient-to-b from-white to-gray-400 bg-clip-text text-transparent mb-4">
                Tudo que você precisa para operar com IA
              </h2>
              <p className="text-gray-400 max-w-2xl mx-auto">
                Do sinal de entrada ao controle de risco. Cada funcionalidade projetada para maximizar seus resultados.
              </p>
            </div>
          </SectionReveal>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {[
              {
                icon: Brain, title: '3 Estratégias de IA',
                description: 'SMC, Price Action e Híbrido. Compare todas simultaneamente e escolha a melhor para cada cenário de mercado.',
                visual: (
                  <div className="mt-4 space-y-2">
                    {strategyCompare.map((s, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs">
                        <span className="text-gray-400 w-20">{s.name}</span>
                        <div className="flex-1 h-1.5 rounded-full bg-white/[0.06]">
                          <motion.div
                            className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-violet-500"
                            initial={{ width: 0 }}
                            whileInView={{ width: `${s.winRate}%` }}
                            viewport={{ once: true }}
                            transition={{ duration: 1, delay: 0.5 + i * 0.15 }}
                          />
                        </div>
                        <span className="text-cyan-400 w-10 text-right font-mono">{s.winRate}%</span>
                      </div>
                    ))}
                  </div>
                ),
              },
              {
                icon: Target, title: 'Sinais de Entrada e Saída',
                description: 'Entry point, Stop Loss e Take Profit com probabilidade de acerto calculada pela IA em tempo real.',
                visual: (
                  <div className="mt-4 rounded-lg bg-white/[0.02] border border-white/[0.06] p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs font-semibold text-cyan-400">EUR/USD</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-500/20 text-green-400">COMPRA</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-[10px]">
                      <div><span className="text-gray-500">Entrada</span><p className="text-white font-mono">1.0842</p></div>
                      <div><span className="text-gray-500">Stop Loss</span><p className="text-red-400 font-mono">1.0818</p></div>
                      <div><span className="text-gray-500">Take Profit</span><p className="text-green-400 font-mono">1.0890</p></div>
                    </div>
                  </div>
                ),
              },
              {
                icon: Globe, title: '500+ Ativos em Tempo Real',
                description: 'Forex, Índices, Metais, Cripto, Ações, ETFs e ativos brasileiros. Cotações atualizadas automaticamente.',
                visual: (
                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {['EUR/USD', 'BTC', 'Ouro', 'S&P500', 'IBOV', 'GBP/JPY', 'ETH', 'PETR4'].map((t, i) => (
                      <span key={i} className="text-[10px] px-2 py-1 rounded-md bg-white/[0.04] border border-white/[0.06] text-gray-300 font-mono">
                        {t}
                      </span>
                    ))}
                  </div>
                ),
              },
              {
                icon: Shield, title: 'Gestão de Risco Inteligente',
                description: 'Modo Conservador e Agressivo. Cálculo automático de posição, Stop Loss e Take Profit baseado no seu perfil.',
                visual: (
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <div className="rounded-lg bg-cyan-500/5 border border-cyan-500/20 p-2.5 text-center">
                      <Shield className="w-4 h-4 text-cyan-400 mx-auto mb-1" />
                      <p className="text-[10px] text-cyan-400 font-semibold">Conservador</p>
                      <p className="text-[10px] text-gray-500">R:R 1:2 · SL apertado</p>
                    </div>
                    <div className="rounded-lg bg-violet-500/5 border border-violet-500/20 p-2.5 text-center">
                      <Zap className="w-4 h-4 text-violet-400 mx-auto mb-1" />
                      <p className="text-[10px] text-violet-400 font-semibold">Agressivo</p>
                      <p className="text-[10px] text-gray-500">R:R 1:3 · SL amplo</p>
                    </div>
                  </div>
                ),
              },
              {
                icon: ScanLine, title: 'Scanner de Padrões',
                description: 'Identifique automaticamente oportunidades em múltiplos ativos e timeframes. Ordene por confiança da IA.',
                visual: (
                  <div className="mt-4 space-y-1.5">
                    {[
                      { pair: 'GBP/USD', pattern: 'Double Bottom', conf: 92 },
                      { pair: 'USD/JPY', pattern: 'Breakout', conf: 87 },
                      { pair: 'XAU/USD', pattern: 'Bull Flag', conf: 84 },
                    ].map((s, i) => (
                      <div key={i} className="flex items-center gap-2 text-[10px] bg-white/[0.02] rounded-md px-2.5 py-1.5">
                        <span className="text-white font-semibold w-16">{s.pair}</span>
                        <span className="text-gray-400 flex-1">{s.pattern}</span>
                        <span className="text-cyan-400 font-mono">{s.conf}%</span>
                      </div>
                    ))}
                  </div>
                ),
              },
              {
                icon: Volume2, title: 'Narração por Voz',
                description: 'Ouça a análise completa em português. Perfeito para operar em movimento sem olhar a tela.',
                visual: (
                  <div className="mt-4 flex items-center gap-2">
                    <div className="flex items-end gap-0.5 h-6">
                      {[3, 5, 8, 12, 8, 14, 10, 6, 9, 12, 7, 4].map((h, i) => (
                        <motion.div
                          key={i}
                          className="w-1 rounded-full bg-cyan-400"
                          initial={{ height: 2 }}
                          whileInView={{ height: h }}
                          viewport={{ once: true }}
                          transition={{ duration: 0.3, delay: i * 0.05 }}
                        />
                      ))}
                    </div>
                    <span className="text-[10px] text-gray-500">"EUR/USD. Direção: compra. Entrada em 1.0842..."</span>
                  </div>
                ),
              },
            ].map((feature, i) => (
              <SectionReveal key={i}>
                <div className="group relative rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-sm p-7 hover:border-white/[0.12] hover:bg-white/[0.04] transition-all duration-500 h-full">
                  <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-cyan-500/5 via-transparent to-violet-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                  <div className="relative">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500/20 to-violet-500/20 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform duration-500">
                      <feature.icon className="w-6 h-6 text-cyan-400" />
                    </div>
                    <h3 className="text-lg font-semibold text-white mb-2">{feature.title}</h3>
                    <p className="text-sm text-gray-400 leading-relaxed">{feature.description}</p>
                    {feature.visual}
                  </div>
                </div>
              </SectionReveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════ STRATEGY COMPARISON ═══════════════════ */}
      <section id="stats" className="relative py-28 px-6 border-t border-white/[0.04]">
        <GradientOrb className="w-[500px] h-[500px] top-1/2 right-0" color="cyan" />
        <div className="max-w-6xl mx-auto">
          <SectionReveal>
            <div className="text-center mb-16">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-400 mb-4">Comparativo</p>
              <h2 className="text-4xl sm:text-5xl font-bold tracking-tight bg-gradient-to-b from-white to-gray-400 bg-clip-text text-transparent mb-4">
                3 Estratégias, 1 Objetivo
              </h2>
              <p className="text-gray-400 max-w-2xl mx-auto">
                Compare o desempenho das 3 estratégias de IA lado a lado e descubra qual se adapta melhor ao seu estilo.
              </p>
            </div>
          </SectionReveal>

          <SectionReveal>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {[
                { name: 'SMC', subtitle: 'Smart Money Concepts', winRate: 84, avgRR: '1:2.1', trades: 156, profitFactor: 2.1, color: 'cyan', icon: Brain },
                { name: 'Price Action', subtitle: 'Análise de Preço Pura', winRate: 79, avgRR: '1:1.8', trades: 143, profitFactor: 1.8, color: 'violet', icon: LineChartIcon },
                { name: 'Híbrido', subtitle: 'O Melhor dos Dois', winRate: 89, avgRR: '1:2.4', trades: 168, profitFactor: 2.6, color: 'emerald', icon: Sparkles, featured: true },
              ].map((strat, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.15 }}
                  className={`relative rounded-2xl border p-6 transition-all duration-500 ${
                    strat.featured
                      ? 'border-cyan-500/30 bg-gradient-to-b from-cyan-500/5 to-violet-500/5 shadow-lg shadow-cyan-500/10'
                      : 'border-white/[0.06] bg-white/[0.02]'
                  }`}
                >
                  {strat.featured && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-gradient-to-r from-cyan-500 to-violet-500 text-[10px] font-bold text-white">
                      MAIS POPULAR
                    </div>
                  )}
                  <div className="flex items-center gap-3 mb-5">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      strat.color === 'cyan' ? 'bg-cyan-500/10' :
                      strat.color === 'violet' ? 'bg-violet-500/10' :
                      'bg-emerald-500/10'
                    }`}>
                      <strat.icon className={`w-5 h-5 ${
                        strat.color === 'cyan' ? 'text-cyan-400' :
                        strat.color === 'violet' ? 'text-violet-400' :
                        'text-emerald-400'
                      }`} />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-white">{strat.name}</h3>
                      <p className="text-[10px] text-gray-500">{strat.subtitle}</p>
                    </div>
                  </div>

                  <div className="text-center mb-5">
                    <div className="text-4xl font-bold bg-gradient-to-b from-white to-gray-400 bg-clip-text text-transparent">
                      {strat.winRate}%
                    </div>
                    <p className="text-xs text-gray-500">Win Rate</p>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-500">Risk/Reward</span>
                      <span className="text-white font-mono">{strat.avgRR}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-500">Total Trades</span>
                      <span className="text-white font-mono">{strat.trades}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-500">Profit Factor</span>
                      <span className="text-white font-mono">{strat.profitFactor}</span>
                    </div>
                    <div className="pt-2">
                      <div className="h-1.5 rounded-full bg-white/[0.06]">
                        <motion.div
                          className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-violet-500"
                          initial={{ width: 0 }}
                          whileInView={{ width: `${strat.winRate}%` }}
                          viewport={{ once: true }}
                          transition={{ duration: 1, delay: 0.3 }}
                        />
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </SectionReveal>
        </div>
      </section>

      {/* ═══════════════════ PLATFORM WALKTHROUGH ═══════════════════ */}
      <section className="relative py-28 px-6 border-t border-white/[0.04]">
        <div className="max-w-7xl mx-auto">
          <SectionReveal>
            <div className="text-center mb-16">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-400 mb-4">Fluxo Completo</p>
              <h2 className="text-4xl sm:text-5xl font-bold tracking-tight bg-gradient-to-b from-white to-gray-400 bg-clip-text text-transparent mb-4">
                Do sinal ao resultado
              </h2>
              <p className="text-gray-400 max-w-2xl mx-auto">
                Veja como o ForexAI Pro funciona em cada etapa da operação.
              </p>
            </div>
          </SectionReveal>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {[
              {
                step: '01',
                icon: Globe,
                title: 'Escolha o Ativo',
                description: 'Selecione entre 500+ ativos: Forex, Índices, Cripto, Metais e mais.',
                color: 'cyan',
              },
              {
                step: '02',
                icon: Brain,
                title: 'Análise da IA',
                description: '3 estratégias analisam simultaneamente com probabilidade de acerto.',
                color: 'violet',
              },
              {
                step: '03',
                icon: Target,
                title: 'Receba o Sinal',
                description: 'Entry, Stop Loss e Take Profit calculados automaticamente.',
                color: 'emerald',
              },
              {
                step: '04',
                icon: BarChart3,
                title: 'Acompanhe o Resultado',
                description: 'Registro automático no diário com estatísticas e relatórios.',
                color: 'cyan',
              },
            ].map((item, i) => (
              <SectionReveal key={i}>
                <div className="relative group">
                  {/* Step number */}
                  <div className={`text-6xl font-black absolute -top-4 -left-2 opacity-[0.04] group-hover:opacity-[0.08] transition-opacity ${
                    item.color === 'cyan' ? 'text-cyan-400' :
                    item.color === 'violet' ? 'text-violet-400' :
                    'text-emerald-400'
                  }`}>
                    {item.step}
                  </div>
                  <div className="relative rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-sm p-7 hover:border-white/[0.12] hover:bg-white/[0.04] transition-all duration-500 h-full">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-5 ${
                      item.color === 'cyan' ? 'bg-cyan-500/10' :
                      item.color === 'violet' ? 'bg-violet-500/10' :
                      'bg-emerald-500/10'
                    }`}>
                      <item.icon className={`w-6 h-6 ${
                        item.color === 'cyan' ? 'text-cyan-400' :
                        item.color === 'violet' ? 'text-violet-400' :
                        'text-emerald-400'
                      }`} />
                    </div>
                    <p className={`text-xs font-bold uppercase tracking-wider mb-2 ${
                      item.color === 'cyan' ? 'text-cyan-400' :
                      item.color === 'violet' ? 'text-violet-400' :
                      'text-emerald-400'
                    }`}>
                      Passo {item.step}
                    </p>
                    <h3 className="text-lg font-semibold text-white mb-2">{item.title}</h3>
                    <p className="text-sm text-gray-400 leading-relaxed">{item.description}</p>
                  </div>
                  {/* Connector arrow */}
                  {i < 3 && (
                    <div className="hidden lg:flex absolute top-1/2 -right-3 z-10">
                      <ChevronRight className="w-5 h-5 text-white/10" />
                    </div>
                  )}
                </div>
              </SectionReveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════ DETAILED STATS SECTION ═══════════════════ */}
      <section className="relative py-28 px-6 border-t border-white/[0.04]">
        <GradientOrb className="w-[400px] h-[400px] bottom-0 left-0" color="violet" />
        <div className="max-w-6xl mx-auto">
          <SectionReveal>
            <div className="text-center mb-16">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-violet-400 mb-4">Estatísticas</p>
              <h2 className="text-4xl sm:text-5xl font-bold tracking-tight bg-gradient-to-b from-white to-gray-400 bg-clip-text text-transparent mb-4">
                Dados que importam
              </h2>
              <p className="text-gray-400 max-w-2xl mx-auto">
                Métricas detalhadas para você tomar decisões baseadas em dados reais, não achismos.
              </p>
            </div>
          </SectionReveal>

          <SectionReveal>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: 'Win Rate Médio', value: '72%', sublabel: 'Últimos 90 dias', icon: CheckCircle2, trend: 'up' },
                { label: 'Profit Factor', value: '2.34', sublabel: 'Todos os trades', icon: TrendingUp, trend: 'up' },
                { label: 'Avg. Win', value: '+R$580', sublabel: 'Por operação', icon: ArrowUpRight, trend: 'up' },
                { label: 'Max Drawdown', value: '-8.2%', sublabel: 'Desde o início', icon: AlertTriangle, trend: 'down' },
                { label: 'Sharpe Ratio', value: '1.87', sublabel: 'Risk-adjusted', icon: Gauge, trend: 'up' },
                { label: 'Avg. Holding', value: '4.2h', sublabel: 'Tempo médio', icon: Clock, trend: 'neutral' },
                { label: 'Total Trades', value: '847', sublabel: 'Últimos 6 meses', icon: BarChart3, trend: 'up' },
                { label: 'Best Streak', value: '14 wins', sublabel: 'Sequência máxima', icon: Star, trend: 'up' },
              ].map((stat, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.05 }}
                  className="rounded-xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-sm p-4 hover:border-white/[0.12] hover:bg-white/[0.04] transition-all duration-300"
                >
                  <stat.icon className={`w-4 h-4 mb-2 ${
                    stat.trend === 'up' ? 'text-cyan-400' :
                    stat.trend === 'down' ? 'text-red-400' :
                    'text-gray-400'
                  }`} />
                  <p className="text-xl sm:text-2xl font-bold text-white font-mono">{stat.value}</p>
                  <p className="text-xs text-gray-400">{stat.label}</p>
                  <p className="text-[10px] text-gray-600">{stat.sublabel}</p>
                </motion.div>
              ))}
            </div>
          </SectionReveal>
        </div>
      </section>

      {/* ═══════════════════ COMPATIBILITY STRIP ═══════════════════ */}
      <section className="relative py-16 px-6 border-y border-white/[0.04]">
        <div className="max-w-4xl mx-auto">
          <SectionReveal>
            <div className="flex flex-wrap justify-center gap-8 md:gap-14 items-center opacity-40">
              {['MetaTrader 5', 'TradingView', 'B3', 'Binance', 'XP Investimentos'].map((name, i) => (
                <span key={i} className="text-sm font-medium text-gray-400 tracking-wider uppercase">{name}</span>
              ))}
            </div>
          </SectionReveal>
        </div>
      </section>

      {/* ═══════════════════ PRICING ═══════════════════ */}
      <section id="pricing" className="relative py-28 px-6">
        <div className="max-w-5xl mx-auto">
          <SectionReveal>
            <div className="text-center mb-16">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-400 mb-4">Planos</p>
              <h2 className="text-4xl sm:text-5xl font-bold tracking-tight bg-gradient-to-b from-white to-gray-400 bg-clip-text text-transparent mb-4">
                Sinais grátis no Telegram, ferramentas no Pro
              </h2>
            </div>
          </SectionReveal>

          <SectionReveal>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
              {/* Free Plan */}
              <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-sm p-8">
                <h3 className="text-lg font-bold text-white mb-1">Gratuito</h3>
                <p className="text-sm text-gray-500 mb-6">Para conhecer a plataforma</p>
                <div className="mb-6">
                  <span className="text-4xl font-bold text-white">R$0</span>
                  <span className="text-sm text-gray-500">/mês</span>
                </div>
                <ul className="space-y-3 mb-8">
                  {[
                    '3 dias grátis',
                    'Sinais no Telegram',
                    'Análise com 3 estratégias',
                    '500+ ativos em tempo real',
                    'Modo conservador e agressivo',
                    'Narração por voz',
                  ].map((f, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm text-gray-400">
                      <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
                <motion.button
                  onClick={handleEnterApp}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="w-full py-3 rounded-xl border border-white/[0.1] bg-white/[0.04] text-sm font-semibold hover:bg-white/[0.08] transition-colors"
                >
                  Começar Grátis
                </motion.button>
              </div>

              {/* Pro Mensal */}
              <div className="relative rounded-2xl border border-cyan-500/30 bg-gradient-to-b from-cyan-500/5 to-violet-500/5 backdrop-blur-sm p-8 shadow-xl shadow-cyan-500/10">
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-gradient-to-r from-cyan-500 to-violet-500 text-xs font-bold text-white">
                  POPULAR
                </div>
                <h3 className="text-lg font-bold text-white mb-1">Pro Mensal</h3>
                <p className="text-sm text-gray-500 mb-6">Para traders sérios</p>
                <div className="mb-6">
                  <span className="text-4xl font-bold bg-gradient-to-r from-cyan-400 to-violet-400 bg-clip-text text-transparent">R$49,90</span>
                  <span className="text-sm text-gray-500">/mês</span>
                </div>
                <ul className="space-y-3 mb-8">
                  {[
                    'Créditos ilimitados',
                    'Tudo do plano Gratuito',
                    'Scanner de padrões',
                    'Relatórios semanais',
                    'Alertas de preço',
                    'Análise agendada',
                    'Suporte prioritário',
                  ].map((f, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm text-gray-300">
                      <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
                <motion.button
                  onClick={handleEnterApp}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-violet-500 text-sm font-bold text-white shadow-lg shadow-cyan-500/25"
                >
                  Assinar Agora
                </motion.button>
              </div>

              {/* Pro Anual */}
              <div className="relative rounded-2xl border border-violet-500/30 bg-gradient-to-b from-violet-500/5 to-cyan-500/5 backdrop-blur-sm p-8 shadow-xl shadow-violet-500/10">
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-gradient-to-r from-violet-500 to-cyan-500 text-xs font-bold text-white">
                  MELHOR CUSTO-BENEFÍCIO
                </div>
                <h3 className="text-lg font-bold text-white mb-1">Pro Anual</h3>
                <p className="text-sm text-gray-500 mb-6">Economia de R$119,80/ano</p>
                <div className="mb-6">
                  <span className="text-4xl font-bold bg-gradient-to-r from-violet-400 to-cyan-400 bg-clip-text text-transparent">R$479,00</span>
                  <span className="text-sm text-gray-500">/ano</span>
                </div>
                <ul className="space-y-3 mb-8">
                  {[
                    'Créditos ilimitados',
                    'Tudo do plano Gratuito',
                    'Scanner de padrões',
                    'Relatórios semanais',
                    'Alertas de preço',
                    'Análise agendada',
                    'Suporte prioritário',
                  ].map((f, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm text-gray-300">
                      <CheckCircle2 className="w-4 h-4 text-violet-400 shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
                <motion.button
                  onClick={handleEnterApp}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-violet-500 to-cyan-500 text-sm font-bold text-white shadow-lg shadow-violet-500/25"
                >
                  Assinar Agora
                </motion.button>
              </div>
            </div>
          </SectionReveal>
        </div>
      </section>

      {/* ═══════════════════ TELEGRAM CHANNEL SECTION ═══════════════════ */}
      <section id="telegram" className="relative py-28 px-6 border-t border-white/[0.04] overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-[#229ED9]/5 to-transparent pointer-events-none" />
        <div className="max-w-5xl mx-auto relative z-10">
          <SectionReveal>
            <div className="text-center">
              <motion.div
                initial={{ scale: 0 }}
                whileInView={{ scale: 1 }}
                viewport={{ once: true }}
                transition={{ type: 'spring', stiffness: 200, delay: 0.2 }}
                className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-[#229ED9]/10 border border-[#229ED9]/20 mb-8"
              >
                <Send className="w-10 h-10 text-[#229ED9]" />
              </motion.div>
              <h2 className="text-4xl sm:text-5xl font-bold tracking-tight bg-gradient-to-b from-white to-gray-400 bg-clip-text text-transparent mb-4">
                Sinais Grátis no Telegram
              </h2>
              <p className="text-gray-400 max-w-2xl mx-auto mb-10 text-lg leading-relaxed">
                Receba sinais de entrada e saída automaticamente, 4x por dia. Tudo gratuito, direto no seu Telegram.
              </p>
            </div>
          </SectionReveal>

          <SectionReveal>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
              {[
                { icon: Target, title: 'Sinais Precisos', desc: 'Entry, Stop Loss e Take Profit calculados por IA em tempo real', emoji: '🎯' },
                { icon: Clock, title: '4 Sinais por Dia', desc: '08h, 12h, 18h e 21h — horários fixos todos os dias', emoji: '⏰' },
                { icon: TrendingUp, title: '+70% Win Rate', desc: 'Taxa de acerto consistente verificada diariamente', emoji: '📈' },
              ].map((item, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.2 + i * 0.15 }}
                  className="rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-sm p-6 text-center hover:border-[#229ED9]/20 hover:bg-[#229ED9]/5 transition-all duration-300"
                >
                  <div className="text-3xl mb-3">{item.emoji}</div>
                  <h3 className="text-base font-semibold text-white mb-2">{item.title}</h3>
                  <p className="text-sm text-gray-400">{item.desc}</p>
                </motion.div>
              ))}
            </div>
          </SectionReveal>

          <SectionReveal>
            <div className="text-center">
              <motion.a
                href="https://t.me/forexaipro_sinais"
                target="_blank"
                rel="noopener noreferrer"
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.97 }}
                className="group inline-flex items-center gap-3 px-10 py-5 rounded-full bg-[#229ED9] text-white font-bold text-lg shadow-2xl shadow-[#229ED9]/30 hover:shadow-[#229ED9]/50 transition-shadow duration-500"
              >
                <Send className="w-6 h-6 group-hover:rotate-12 transition-transform duration-300" />
                Entrar no Canal — É Grátis
                <ExternalLink className="w-4 h-4 opacity-60" />
              </motion.a>
              <p className="text-sm text-gray-500 mt-4">
                @forexaipro_sinais · 20.000+ traders · Sem spam
              </p>
            </div>
          </SectionReveal>
        </div>
      </section>

      {/* ═══════════════════ CTA FINAL ═══════════════════ */}
      <section className="relative py-32 px-6">
        <GradientOrb className="w-[600px] h-[600px] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" color="cyan" />
        <GradientOrb className="w-[400px] h-[400px] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" color="violet" />

        <div className="relative z-10 max-w-3xl mx-auto text-center">
          <SectionReveal>
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
            >
              <h2 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight mb-6">
                <span className="bg-gradient-to-b from-white to-gray-400 bg-clip-text text-transparent">
                  Comece agora com
                </span>
                <br />
                <span className="bg-gradient-to-r from-cyan-400 to-violet-400 bg-clip-text text-transparent">
                  3 dias grátis
                </span>
              </h2>
              <p className="text-base sm:text-lg text-gray-400 mb-10 max-w-lg mx-auto leading-relaxed">
                Sem cartão de crédito. Sem compromisso. A inteligência artificial que está transformando a análise de mercado.
              </p>
              <motion.button
                onClick={handleEnterApp}
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.97 }}
                className="group relative inline-flex items-center gap-3 px-10 py-5 rounded-full bg-gradient-to-r from-cyan-500 to-violet-500 text-white font-semibold text-lg shadow-2xl shadow-cyan-500/25 hover:shadow-cyan-500/40 transition-shadow duration-500"
              >
                <div className="absolute inset-0 rounded-full bg-gradient-to-r from-cyan-500 to-violet-500 blur-xl opacity-40 group-hover:opacity-60 transition-opacity duration-500" />
                <span className="relative">Acessar Plataforma</span>
                <ArrowRight className="relative w-5 h-5 group-hover:translate-x-1 transition-transform duration-300" />
              </motion.button>
              <p className="mt-5 text-xs text-gray-600 flex items-center justify-center gap-4 flex-wrap">
                <span className="flex items-center gap-1"><Lock className="w-3 h-3" /> Pagamento seguro</span>
                <span className="flex items-center gap-1"><Shield className="w-3 h-3" /> Stripe</span>
                <span className="flex items-center gap-1"><Zap className="w-3 h-3" /> Acesso imediato</span>
              </p>
            </motion.div>
          </SectionReveal>
        </div>
      </section>

      {/* ═══════════════════ FOOTER ═══════════════════ */}
      <footer className="border-t border-white/[0.04] py-8 px-6">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded-md bg-gradient-to-br from-cyan-500 to-violet-500 flex items-center justify-center">
              <Brain className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="text-sm font-semibold text-gray-400">ForexAI Pro</span>
          </div>
          <div className="flex items-center gap-6 text-xs text-gray-500">
            <a href="https://t.me/forexaipro_sinais" target="_blank" rel="noopener noreferrer" className="text-[#229ED9] hover:text-[#229ED9]/80 flex items-center gap-1.5 transition-colors">
              <Send className="w-3 h-3" />
              Telegram
            </a>
            <a href="/afiliados" className="hover:text-cyan-400 transition-colors">Programa de Afiliados</a>
            <a href="/afiliados/dashboard" className="hover:text-cyan-400 transition-colors">Dashboard Afiliado</a>
          </div>
          <p className="text-xs text-gray-600">
            © {new Date().getFullYear()} ForexAI Pro. Todos os direitos reservados.
          </p>
        </div>
      </footer>
    </div>
  );
}
