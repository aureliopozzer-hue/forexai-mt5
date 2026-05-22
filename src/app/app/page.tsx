'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  BarChart3, Activity, Brain, RefreshCw,
  Globe, Cpu, Shield, Zap, Star, Clock, CreditCard, Coins,
  Moon, Sun, Users, LogOut, Download, X, WifiOff,
  Award, Flame, Target, Bell, LayoutGrid, Mail, Search, Volume2, VolumeX,
  ChevronUp, TrendingUp, ScanLine, ArrowRightLeft, Rocket, BookOpen
} from 'lucide-react';
import Link from 'next/link';
import { useCredits, COST_ANALYSIS, COST_COMPARISON } from '@/hooks/use-trial';
import { usePWA } from '@/hooks/use-pwa';
import { useGamification } from '@/hooks/use-gamification';
import { usePerformance } from '@/hooks/use-performance';
import { useScheduledAnalysis } from '@/hooks/use-scheduled-analysis';
import { usePriceAlerts } from '@/hooks/use-price-alerts';
import { useLayout } from '@/hooks/use-layout';
import { useAuth } from '@/components/auth/auth-provider';
import { toast } from 'sonner';
import { PaymentModal } from '@/components/payment-modal';
import { GoogleLoginModal } from '@/components/google-login-modal';
import { CreditBar } from '@/components/dashboard/credit-bar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';

import { MarketTicker } from '@/components/dashboard/market-ticker';
import { PriceCards } from '@/components/dashboard/price-cards';
import { TradeSimulationPanel } from '@/components/dashboard/trade-simulation-panel';
import { AIAnalysisPanel } from '@/components/dashboard/ai-analysis';
import { MarketSignals } from '@/components/dashboard/market-signals';
import { NewsFeed } from '@/components/dashboard/news-feed';
import { MarketHeatmap } from '@/components/dashboard/market-heatmap';
import { EconomicCalendar } from '@/components/dashboard/economic-calendar';
import { ForexSessionClock } from '@/components/dashboard/forex-session-clock';
import { PerformanceSummary } from '@/components/dashboard/performance-summary';
import { PerformanceDashboard } from '@/components/dashboard/performance-dashboard';
import { ScheduledAnalysisDialog } from '@/components/dashboard/scheduled-analysis-dialog';
import { InstrumentSearch } from '@/components/dashboard/instrument-search';

import { ErrorBoundary } from '@/components/error-boundary';
import { PriceAlertDialog } from '@/components/dashboard/price-alert-dialog';
import { PatternScanner } from '@/components/dashboard/pattern-scanner';
import { MT5Dashboard } from '@/components/dashboard/mt5-dashboard';
import { useWeeklyReport } from '@/hooks/use-weekly-report';
import { WeeklyReportDialog } from '@/components/dashboard/weekly-report-dialog';
import { LayoutCustomizerDialog } from '@/components/dashboard/layout-customizer-dialog';
import { UserManualDialog } from '@/components/user-manual-dialog';
import {
  Instrument, QuoteData, AIAnalysis,
  MarketCategory, SparklinePoint, AnalysisStrategy, AnalysisHistoryItem,
  formatPrice,
  getVal, getInstruments, CATEGORY_META, ALL_INSTRUMENTS, STRATEGY_META
} from '@/components/dashboard/types';

const HISTORY_STORAGE_KEY = 'forexAI-analysis-history';
const MAX_HISTORY_ITEMS = 20;

// Robust fetch with auto-retry for Turbopack hot-reload resilience
async function resilientFetch(url: string, options: RequestInit = {}, retries = 3, timeoutMs = 8000): Promise<Response> {
  let lastError: any;
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);
      const mergedSignal = options.signal
        ? (() => {
            const ac = new AbortController();
            const onOuter = () => ac.abort();
            const onInner = () => ac.abort();
            options.signal.addEventListener('abort', onOuter, { once: true });
            controller.signal.addEventListener('abort', onInner, { once: true });
            // Cleanup listeners when signal settles
            ac.signal.addEventListener('abort', () => {
              options.signal.removeEventListener('abort', onOuter);
              controller.signal.removeEventListener('abort', onInner);
            }, { once: true });
            return ac.signal;
          })()
        : controller.signal;
      const res = await fetch(url, { ...options, signal: mergedSignal });
      clearTimeout(timeout);
      if (res.ok) return res;
      // 4xx client errors (auth, credits, validation) — return response so caller can parse JSON
      // No point retrying these; the caller handles needsLogin/needsSubscription/etc.
      if (res.status >= 400 && res.status < 500) return res;
      lastError = new Error(`HTTP ${res.status}`);
      // Backoff on 5xx server errors only (e.g., cold start returning 502/504)
      if (attempt < retries - 1) {
        await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
        continue;
      }
    } catch (e: any) {
      lastError = e;
      if (attempt < retries - 1) {
        // Retry on ALL fetch errors (TypeError, AbortError, network errors, etc.)
        await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
        continue;
      }
      throw e;
    }
  }
  throw lastError;
}

function loadHistoryFromStorage(): AnalysisHistoryItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const stored = localStorage.getItem(HISTORY_STORAGE_KEY);
    if (stored) return JSON.parse(stored);
  } catch {}
  return [];
}

function saveHistoryToStorage(items: AnalysisHistoryItem[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(items));
  } catch {}
}

export default function Home() {
  // Auth system
  const auth = useAuth();

  // Credits system
  const credits = useCredits();
  // PWA install hook
  const pwa = usePWA();
  // Gamification hook
  const gamification = useGamification(credits.isSubscribed);
  const performance = usePerformance();
  const priceAlerts = usePriceAlerts();
  const scheduledAnalysis = useScheduledAnalysis();
  const layout = useLayout();
  const [showBadgeModal, setShowBadgeModal] = useState(false);
  const [showPerformanceModal, setShowPerformanceModal] = useState(false);
  const [showPriceAlertDialog, setShowPriceAlertDialog] = useState(false);
  const [showScheduledModal, setShowScheduledModal] = useState(false);
  const [showScannerModal, setShowScannerModal] = useState(false);
  const [showWeeklyReportModal, setShowWeeklyReportModal] = useState(false);
  const [showLayoutDialog, setShowLayoutDialog] = useState(false);
  const [showUserManual, setShowUserManual] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showGoogleLoginModal, setShowGoogleLoginModal] = useState(false);

  // 🔑 Subscription verification state — blocks payment modal while verifying
  const [verifyingSubscription, setVerifyingSubscription] = useState(false);

  // 🔑 Track whether payment was just completed — prevents shouldBlock from reopening modal
  // after Stripe redirect when Pro status hasn't propagated to all state yet
  const [paymentJustCompleted, setPaymentJustCompleted] = useState(false);

  // Guard: only open payment modal when credits are CONFIRMED 0 from server.
  // Prevents false triggers when credits haven't loaded yet (credits=0 by default).
  const openPaymentModal = useCallback((reason: string, serverCreditsRemaining?: number) => {
    // Pro users NEVER see the payment modal (check both credits hook AND auth provider)
    if (credits.isSubscribed || auth.isPro) {
      console.warn('[PaymentModal] BLOCKED — user is Pro. Reason:', reason);
      return;
    }
    // 🚫 Don't open payment modal if payment was just completed
    if (paymentJustCompleted) {
      console.warn('[PaymentModal] BLOCKED — payment just completed. Reason:', reason);
      return;
    }
    // 🚫 Don't open payment modal while subscription verification is in progress
    if (verifyingSubscription) {
      console.warn('[PaymentModal] BLOCKED — subscription verification in progress. Reason:', reason);
      return;
    }
    // Server explicitly told us credits remaining
    if (typeof serverCreditsRemaining === 'number') {
      if (serverCreditsRemaining <= 0) {
        console.log('[PaymentModal] Opening — server confirmed 0 credits. Reason:', reason);
        setShowPaymentModal(true);
      } else {
        console.warn('[PaymentModal] BLOCKED — server says', serverCreditsRemaining, 'credits remaining. Reason:', reason);
      }
      return;
    }
    // No server info — use client-side state, but ONLY if loaded
    if (!credits.creditsLoaded) {
      console.warn('[PaymentModal] BLOCKED — credits not loaded yet. Reason:', reason);
      return;
    }
    if (credits.credits > 0) {
      console.warn('[PaymentModal] BLOCKED — client has', credits.credits, 'credits. Reason:', reason);
      return;
    }
    // Credits are loaded and === 0, user is not pro
    console.log('[PaymentModal] Opening — client confirmed 0 credits. Reason:', reason);
    setShowPaymentModal(true);
  }, [credits.credits, credits.creditsLoaded, credits.isSubscribed, auth.isPro, verifyingSubscription, paymentJustCompleted]);

  const [subscribing, setSubscribing] = useState(false);
  const [pwaInstalling, setPwaInstalling] = useState(false);

  // 🔑 Auto-close payment modal when Pro status is confirmed (from any source)
  useEffect(() => {
    if ((credits.isSubscribed || auth.isPro) && showPaymentModal) {
      console.log('[PaymentModal] Pro status confirmed — auto-closing payment modal (credits.isSubscribed:', credits.isSubscribed, 'auth.isPro:', auth.isPro, ')');
      setShowPaymentModal(false);
      // Mark as payment completed so shouldBlock effect never reopens the modal
      setPaymentJustCompleted(true);
    }
  }, [credits.isSubscribed, auth.isPro, showPaymentModal]);

  // Handle Stripe success callback
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('subscribed') === 'true') {
        const sessionId = params.get('session_id');

        // 🔑 Block payment modal from opening during verification
        setVerifyingSubscription(true);
        // Close payment modal if it's already open (race condition)
        setShowPaymentModal(false);

        // Verify the subscription with Stripe directly (webhooks may not reach us in preview)
        (async () => {
          // Try up to 5 times with increasing delay (more robust than 3)
          for (let attempt = 1; attempt <= 5; attempt++) {
            try {
              console.log(`[Stripe Callback] Verification attempt ${attempt}/5, sessionId: ${sessionId}`);
              toast.loading(`Verificando pagamento... (tentativa ${attempt}/5)`, { id: 'stripe-verify' });

              const res = await fetch('/api/verify-subscription', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sessionId }),
              });
              const data = await res.json();

              // Log debug info
              if (data.debugLogs) {
                console.log('[Stripe Callback] Debug logs:', data.debugLogs);
              }

              if (data.success && data.isPro) {
                // ✅ IMMEDIATELY set Pro status to prevent payment modal race condition
                // setCreditsFromServer updates state synchronously — no async gap
                credits.setCreditsFromServer(999, true);
                auth.setProStatus(true);
                // Also dispatch a credits-refresh event for other components
                try { window.dispatchEvent(new CustomEvent('forexai-credits-refresh')); } catch {}
                try { localStorage.setItem('forexai-pro-status', 'true'); } catch {}
                toast.success('🎉 Assinatura ativada!', { id: 'stripe-verify', description: 'Você agora tem créditos ilimitados.' });
                // Clean URL only after SUCCESS
                window.history.replaceState({}, '', '/app');
                setVerifyingSubscription(false);
                setPaymentJustCompleted(true);
                // Ensure payment modal is closed
                setShowPaymentModal(false);
                return; // Done!
              } else if (data.alreadyPro) {
                // ✅ IMMEDIATELY set Pro status
                credits.setCreditsFromServer(999, true);
                auth.setProStatus(true);
                try { window.dispatchEvent(new CustomEvent('forexai-credits-refresh')); } catch {}
                try { localStorage.setItem('forexai-pro-status', 'true'); } catch {}
                toast.success('🎉 Assinatura já está ativa!', { id: 'stripe-verify', description: 'Você tem créditos ilimitados.' });
                window.history.replaceState({}, '', '/app');
                setVerifyingSubscription(false);
                setPaymentJustCompleted(true);
                setShowPaymentModal(false);
                return; // Done!
              } else {
                console.warn(`[Stripe Callback] Attempt ${attempt} failed:`, data.error);
                // If not the last attempt, wait and retry
                if (attempt < 5) {
                  await new Promise(r => setTimeout(r, 2000 * attempt));
                  continue;
                }
              }
            } catch (err) {
              console.error(`[Stripe Callback] Attempt ${attempt} error:`, err);
              if (attempt < 5) {
                await new Promise(r => setTimeout(r, 2000 * attempt));
                continue;
              }
            }
          }

          // All attempts failed — try one more time without sessionId (checks if already Pro)
          try {
            const res = await fetch('/api/verify-subscription', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ sessionId: null }),
            });
            const data = await res.json();
            if (data.success && data.isPro) {
              credits.setCreditsFromServer(999, true);
              auth.setProStatus(true);
              try { window.dispatchEvent(new CustomEvent('forexai-credits-refresh')); } catch {}
              try { localStorage.setItem('forexai-pro-status', 'true'); } catch {}
              toast.success('🎉 Assinatura ativada!', { id: 'stripe-verify', description: 'Você agora tem créditos ilimitados.' });
              window.history.replaceState({}, '', '/app');
              setVerifyingSubscription(false);
              setPaymentJustCompleted(true);
              setShowPaymentModal(false);
              return;
            }
          } catch {}

          // Final failure — show error
          toast.error('Pagamento em processamento', { id: 'stripe-verify', description: 'Aguarde alguns segundos e recarregue a página.' });
          // Clean URL after failure too
          window.history.replaceState({}, '', '/app');
          // Allow payment modal to show now (user might want to try again)
          setVerifyingSubscription(false);
        })();
      }
      if (params.get('canceled') === 'true') {
        toast.info('Assinatura cancelada', { description: 'Você pode assinar a qualquer momento.' });
        window.history.replaceState({}, '', '/app');
      }
    }
  }, []);

  // Show payment modal when credits run out (only for logged-in users with confirmed 0 credits)
  // 🚫 DON'T open during subscription verification or after payment just completed
  // Also check URL directly for subscribed=true to prevent flash of payment modal
  useEffect(() => {
    // Triple protection: never reopen modal if user just paid
    if (paymentJustCompleted) {
      console.log('[shouldBlock] Payment just completed — suppressing payment modal');
      return;
    }
    // Double-check: if URL has subscribed=true, don't show payment modal
    // This handles the race condition where credits load before verifyingSubscription state is set
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('subscribed') === 'true') {
        console.log('[shouldBlock] URL has subscribed=true — suppressing payment modal');
        return;
      }
    }
    if (credits.isLoggedIn && credits.shouldBlock && !credits.isSubscribed && credits.creditsLoaded && !verifyingSubscription) {
      toast.error('Período grátis expirado!', { description: 'Assine para continuar usando a análise por IA.' });
      openPaymentModal('shouldBlock-effect');
    }
  }, [credits.shouldBlock, credits.isSubscribed, credits.isLoggedIn, credits.creditsLoaded, verifyingSubscription, openPaymentModal, paymentJustCompleted]);

  // Handle scheduled analysis trigger — when the timer fires, run the analysis
  useEffect(() => {
    if (!scheduledAnalysis.triggeredSchedule) return;

    const schedule = scheduledAnalysis.triggeredSchedule;
    scheduledAnalysis.clearTriggered();

    // Check credits before running — only block if trial expired and not Pro
    if (credits.creditsLoaded && !credits.isSubscribed && credits.shouldBlock) {
      toast.error('⏰ Análise agendada falhou', { description: `Período grátis expirado para ${schedule.instrumentName}` });
      return;
    }

    // Find the instrument from ALL_INSTRUMENTS
    const instrument = ALL_INSTRUMENTS.find(i => i.symbol === schedule.instrumentSymbol);

    if (!instrument) {
      toast.error('⏰ Análise agendada falhou', { description: `Instrumento ${schedule.instrumentName} não encontrado` });
      return;
    }

    toast.info(`⏰ Análise agendada: ${schedule.instrumentName}`, { description: `Estratégia: ${STRATEGY_META[schedule.strategy]?.label || 'Híbrido'}` });

    // Run the analysis with the scheduled strategy
    analyzeWithAI(instrument, schedule.strategy);
  }, [scheduledAnalysis.triggeredSchedule, credits.isSubscribed, credits.hasCredits]);

  const [stripeError, setStripeError] = useState<string | null>(null);

  // Handle subscribe via Stripe
  const handleSubscribe = async (plan: 'monthly' | 'annual') => {
    setSubscribing(true);
    setStripeError(null);
    try {
      // Use longer timeout (30s) for Stripe — Netlify cold start + API call can be slow
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000);

      const res = await fetch('/api/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan, origin: window.location.origin }),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        console.error('[Stripe] API returned status:', res.status, errData);
        // Use the server's error message if available
        const serverMsg = errData?.error;
        if (res.status === 502 || res.status === 504) {
          setStripeError('Servidor temporariamente indisponível. Aguarde alguns segundos e tente novamente.');
        } else if (res.status === 503) {
          setStripeError(serverMsg || 'Serviço de pagamento indisponível no momento. Tente novamente mais tarde.');
        } else if (res.status === 401) {
          setStripeError('Faça login com o Google antes de assinar.');
        } else {
          setStripeError(serverMsg || `Erro no pagamento (HTTP ${res.status}). Tente novamente.`);
        }
        return;
      }

      const json = await res.json();
      if (json.url) {
        // Redirect to Stripe Checkout
        window.location.href = json.url;
      } else {
        console.error('[Stripe] No URL in response:', json);
        setStripeError('Não foi possível gerar o link de pagamento. Tente novamente.');
      }
    } catch (err: any) {
      console.error('[Stripe] Subscribe error:', err?.message || err);
      if (err?.name === 'AbortError') {
        setStripeError('A conexão demorou muito. Verifique sua internet e tente novamente.');
      } else {
        setStripeError('Erro ao conectar com o pagamento. Verifique sua conexão e tente novamente.');
      }
    } finally {
      setSubscribing(false);
    }
  };

  const [category, setCategory] = useState<MarketCategory>('forex');
  const [quotes, setQuotes] = useState<Record<string, QuoteData>>({});
  const [selectedInstrument, setSelectedInstrument] = useState<Instrument | null>(null);
  const [aiAnalysis, setAiAnalysis] = useState<AIAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  // Initialize favorites as empty to avoid hydration mismatch —
  // localStorage is read AFTER mount in the useEffect below
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [allQuotes, setAllQuotes] = useState<Record<string, QuoteData>>({});
  const [sparklineData, setSparklineData] = useState<Record<string, SparklinePoint[]>>({});
  const [loadingSparklines, setLoadingSparklines] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [strategy, setStrategy] = useState<AnalysisStrategy>('hybrid');
  const [riskRewardRatio, setRiskRewardRatio] = useState(2.0);
  const [riskMode, setRiskMode] = useState<'conservative' | 'aggressive'>('conservative');
  const [mounted, setMounted] = useState(false);


  // Voice narration state — persisted to localStorage
  const [voiceEnabled, setVoiceEnabled] = useState(true);

  // Weekly report hook — must be after allQuotes is defined
  const weeklyReport = useWeeklyReport(
    gamification.data,
    performance.stats,
    performance.trades,
    allQuotes,
    credits.isSubscribed,
  );

  // Track client-side mount and load localStorage-dependent state AFTER hydration
  // This prevents hydration mismatch: server renders with empty favorites,
  // client hydrates with empty favorites (matching server), then loads from localStorage.
  useEffect(() => {
    setMounted(true);
    try {
      const stored = localStorage.getItem('forexAI-favorites');
      if (stored) setFavorites(new Set(JSON.parse(stored)));
    } catch {}
    // Also load analysis history from localStorage after mount
    try {
      setAnalysisHistory(loadHistoryFromStorage());
    } catch {}
    // Load voice preference from localStorage
    try {
      const voiceStored = localStorage.getItem('forexAI-voice-enabled');
      if (voiceStored !== null) setVoiceEnabled(voiceStored === 'true');
    } catch {}
  }, []);

  // Toggle voice narration
  const toggleVoice = useCallback(() => {
    setVoiceEnabled(prev => {
      const next = !prev;
      try { localStorage.setItem('forexAI-voice-enabled', String(next)); } catch {}
      // Cancel any ongoing speech when disabling
      if (!next && typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
      return next;
    });
  }, []);

  // Voice narration function — speaks analysis results in Portuguese
  const narrateAnalysis = useCallback((instrument: Instrument, analysis: AIAnalysis) => {
    if (!voiceEnabled || typeof window === 'undefined' || !window.speechSynthesis) return;

    window.speechSynthesis.cancel();

    const dir = analysis.direction === 'BUY' ? 'compra' : analysis.direction === 'SELL' ? 'venda' : 'esperar';
    const isBuy = analysis.direction === 'BUY';
    const entry = isBuy ? analysis.tradePoints?.buyPoint : analysis.tradePoints?.sellPoint;
    const stop = isBuy ? analysis.tradePoints?.stopLossBuy : analysis.tradePoints?.stopLossSell;
    const tp = isBuy ? analysis.tradePoints?.takeProfitBuy : analysis.tradePoints?.takeProfitSell;

    const text = `Análise de ${instrument.name}. Direção: ${dir}. Entrada em ${entry?.toFixed(2) || 'não definido'}. Stop loss em ${stop?.toFixed(2) || 'não definido'}. Take profit em ${tp?.toFixed(2) || 'não definido'}. Confiança: ${analysis.confidence}%. Probabilidade de acerto: ${analysis.successProbability || 0}%.`;

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'pt-BR';
    utterance.rate = 1.0;
    utterance.pitch = 1.0;

    // Try to find a Portuguese voice
    const voices = window.speechSynthesis.getVoices();
    const ptVoice = voices.find(v => v.lang.startsWith('pt'));
    if (ptVoice) utterance.voice = ptVoice;

    window.speechSynthesis.speak(utterance);
  }, [voiceEnabled]);

  // Cleanup: cancel speech on unmount
  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  // Live Visitor Counter (Feature #6)
  const [visitorCount, setVisitorCount] = useState(1500);
  useEffect(() => {
    const updateCount = () => {
      setVisitorCount(prev => {
        const change = Math.floor(Math.random() * 50) - 20; // -20 to +29, trending slightly up
        const next = prev + change;
        return Math.max(1200, Math.min(2100, next));
      });
    };
    const interval = setInterval(updateCount, 8000 + Math.random() * 7000);
    return () => clearInterval(interval);
  }, []);

  // Eye Comfort Mode (Feature #7)
  const [eyeComfort, setEyeComfort] = useState(false);
  useEffect(() => {
    try {
      const stored = localStorage.getItem('forexAI-eye-comfort');
      if (stored === 'true') {
        setEyeComfort(true);
        document.body.classList.add('eye-comfort');
      }
    } catch {}
  }, []);
  const toggleEyeComfort = useCallback(() => {
    setEyeComfort(prev => {
      const next = !prev;
      try {
        localStorage.setItem('forexAI-eye-comfort', String(next));
      } catch {}
      if (next) {
        document.body.classList.add('eye-comfort');
      } else {
        document.body.classList.remove('eye-comfort');
      }
      return next;
    });
  }, []);

  // Comparison state
  const [comparisonResults, setComparisonResults] = useState<Record<AnalysisStrategy, AIAnalysis | null>>({
    smc: null,
    price_action: null,
    hybrid: null,
  });
  const [comparing, setComparing] = useState(false);
  const [viewMode, setViewMode] = useState<'single' | 'comparison'>('single');

  // Shared sentiment state between NewsFeed and AIAnalysisPanel
  const [marketSentiment, setMarketSentiment] = useState<{
    sentiment: 'bullish' | 'bearish' | 'neutral';
    confidence: number;
    summary: string;
    keyFactors: string[];
    source: 'llm' | 'keyword';
  } | null>(null);

  // Analysis history state — initialize empty to avoid hydration mismatch,
  // then load from localStorage after mount
  const [analysisHistory, setAnalysisHistory] = useState<AnalysisHistoryItem[]>([]);

  const instruments = useMemo(() => getInstruments(category, favorites), [category, favorites]);

  // Save analysis to history
  const saveAnalysisToHistory = useCallback((instrument: Instrument, analysis: AIAnalysis) => {
    const item: AnalysisHistoryItem = {
      id: `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      timestamp: Date.now(),
      instrumentSymbol: instrument.symbol,
      instrumentName: instrument.name,
      strategy: analysis.strategy,
      direction: analysis.direction,
      confidence: analysis.confidence,
      successProbability: analysis.successProbability || 0,
      analysis,
    };

    setAnalysisHistory(prev => {
      const updated = [item, ...prev].slice(0, MAX_HISTORY_ITEMS);
      saveHistoryToStorage(updated);
      return updated;
    });
  }, []);

  // Load analysis from history
  const loadAnalysisFromHistory = useCallback((item: AnalysisHistoryItem) => {
    setAiAnalysis(item.analysis);
    setViewMode('single');
    setAiError(null);
  }, []);

  // Fetch quotes for current category
  const fetchQuotes = useCallback(async () => {
    try {
      const res = await resilientFetch(`/api/market/quotes?category=${category}`);
      const json = await res.json();

      if (json.success && json.data?.body) {
        const quotesMap: Record<string, QuoteData> = {};
        const body = json.data.body;
        if (Array.isArray(body)) {
          body.forEach((q: any) => {
            if (q.symbol) quotesMap[q.symbol] = q;
          });
        }
        setQuotes(quotesMap);
        setAllQuotes(prev => ({ ...prev, ...quotesMap }));
        setLastUpdate(new Date());
        // Check price alerts against updated quotes
        priceAlerts.checkAlerts(quotesMap);
      }
    } catch (err) {
      console.error('Failed to fetch quotes:', err);
    } finally {
      setLoading(false);
    }
  }, [category, priceAlerts.checkAlerts]);

  // Ref for allQuotes to avoid callback recreation
  const allQuotesRef = useRef(allQuotes);
  allQuotesRef.current = allQuotes;

  // Ref for quotes to avoid callback recreation
  const quotesRef = useRef(quotes);
  quotesRef.current = quotes;

  // Fetch quotes for all categories in parallel
  const fetchAllQuotes = useCallback(async () => {
    const categories: MarketCategory[] = ['forex', 'indices', 'metals', 'crypto', 'stocks', 'etfs', 'brazil'];
    const results = await Promise.allSettled(
      categories.map(async (cat) => {
        try {
          const res = await resilientFetch(`/api/market/quotes?category=${cat}`);
          const json = await res.json();
          if (json.success && json.data?.body) {
            const body = json.data.body;
            if (Array.isArray(body)) {
              return body.reduce((acc: Record<string, QuoteData>, q: any) => {
                if (q.symbol) acc[q.symbol] = q;
                return acc;
              }, {});
            }
          }
        } catch (err: any) {
          if (err?.name !== 'AbortError') console.error(`Failed to fetch ${cat} quotes:`, err);
        }
        return {};
      })
    );
    const allData: Record<string, QuoteData> = {};
    for (const result of results) {
      if (result.status === 'fulfilled' && result.value) {
        Object.assign(allData, result.value);
      }
    }
    setAllQuotes(prev => ({ ...prev, ...allData }));
    // Check price alerts against all updated quotes
    priceAlerts.checkAlerts(allData);
  }, [priceAlerts.checkAlerts]);

  // Fetch mini-history (sparkline) data for all instruments in the current category
  const fetchSparklines = useCallback(async (cat: MarketCategory) => {
    setLoadingSparklines(true);
    try {
      const insts = getInstruments(cat);
      // Batch symbols (max 50 per request)
      const symbolBatches: string[][] = [];
      for (let i = 0; i < insts.length; i += 50) {
        symbolBatches.push(insts.slice(i, i + 50).map(inst => inst.symbol));
      }

      const allSparkData: Record<string, SparklinePoint[]> = {};
      const results = await Promise.allSettled(
        symbolBatches.map(async (symbols) => {
          try {
            const res = await resilientFetch(`/api/market/mini-history?symbols=${symbols.join(',')}`, {}, 3, 10000);
            const json = await res.json();
            if (json.success && json.data) {
              return json.data as Record<string, SparklinePoint[]>;
            }
          } catch (err: any) {
            if (err?.name !== 'AbortError') console.error(`Failed to fetch sparklines:`, err);
          }
          return {};
        })
      );

      for (const result of results) {
        if (result.status === 'fulfilled' && result.value) {
          Object.assign(allSparkData, result.value);
        }
      }

      setSparklineData(allSparkData);
    } catch (err) {
      console.error('Failed to fetch sparklines:', err);
    } finally {
      setLoadingSparklines(false);
    }
  }, []);

  // AI Analysis — uses allQuotesRef to avoid callback recreation
  const abortControllerRef = useRef<AbortController | null>(null);

  const analyzeWithAI = useCallback(async (instrument: Instrument, selectedStrategy: AnalysisStrategy) => {
    // Not logged in → show Google login modal
    if (!credits.isLoggedIn) {
      console.warn('[analyzeWithAI] User not logged in — showing Google login modal');
      setShowGoogleLoginModal(true);
      return;
    }

    // Trial check: ONLY block if trial is expired and not Pro.
    // If creditsLoaded is false (still loading), let the request go to the server
    // which is the source of truth.
    if (!credits.isSubscribed && !credits.isTrial && credits.creditsLoaded && credits.shouldBlock) {
      console.warn('[analyzeWithAI] Trial expired and not Pro — showing payment modal');
      toast.error('Período grátis expirado!', { description: 'Assine para ter acesso ilimitado.' });
      openPaymentModal('pre-check-trial-expired');
      return;
    }

    // Cancel any previous AI analysis request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;

    // Set a 15-second timeout to auto-abort (technical analysis is fast now)
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    setAnalyzing(true);
    setAiAnalysis(null);
    setAiError(null);

    // Toast: analysis started
    toast.loading(`Analisando ${instrument.name}...`, { id: 'ai-analysis', description: `Estratégia: ${STRATEGY_META[selectedStrategy]?.label || 'Híbrido'} · ${riskMode === 'aggressive' ? '🔥 Agressivo' : '🛡️ Conservador'}` });

    try {
      // Use allQuotes (all categories) instead of quotes (current category only)
      // Wait up to 5 seconds for quote data to load (race condition with fetchAllQuotes)
      let quoteData = allQuotesRef.current[instrument.symbol] || quotesRef.current[instrument.symbol];
      let currentPrice = getVal(quoteData?.regularMarketPrice);

      if (!currentPrice || currentPrice <= 0) {
        // Quote data not loaded yet — retry every 500ms for up to 5 seconds
        toast.loading(`Aguardando cotação de ${instrument.name}...`, { id: 'ai-analysis', description: 'Carregando dados de preço' });
        for (let retry = 0; retry < 10; retry++) {
          await new Promise(r => setTimeout(r, 500));
          if (controller.signal.aborted) return;
          quoteData = allQuotesRef.current[instrument.symbol] || quotesRef.current[instrument.symbol];
          currentPrice = getVal(quoteData?.regularMarketPrice);
          if (currentPrice && currentPrice > 0) break;
        }
      }

      // If still no price data after waiting, show error
      if (!currentPrice || currentPrice <= 0) {
        // Last resort: try fetching quotes for this specific category
        try {
          const cat = instrument.category || category;
          const res = await fetch(`/api/market/quotes?category=${cat}`, { signal: controller.signal });
          const json = await res.json();
          if (json.success && json.data?.body && Array.isArray(json.data.body)) {
            const found = json.data.body.find((q: any) => q.symbol === instrument.symbol);
            if (found) {
              currentPrice = getVal(found.regularMarketPrice);
              quoteData = found;
              // Also merge into allQuotes so it's available next time
              setAllQuotes(prev => ({ ...prev, [instrument.symbol]: found }));
            }
          }
        } catch (fetchErr) {
          // Ignore fetch error — will fall through to error message
        }
      }

      if (!currentPrice || currentPrice <= 0) {
        setAiError('Sem dados de cotação para este ativo. Aguarde o carregamento.');
        setAnalyzing(false);
        clearTimeout(timeoutId);
        toast.dismiss('ai-analysis');
        return;
      }

      const res = await resilientFetch('/api/ai/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          symbol: instrument.symbol,
          name: instrument.name,
          currentPrice,
          change: getVal(quoteData?.regularMarketChange),
          changePercent: getVal(quoteData?.regularMarketChangePercent),
          high: getVal(quoteData?.regularMarketDayHigh),
          low: getVal(quoteData?.regularMarketDayLow),
          volume: getVal(quoteData?.regularMarketVolume),
          category,
          strategy: selectedStrategy,
          riskRewardRatio,
          riskMode,
        }),
      }, 2, 12000);

      // Check if this request was aborted (user started a new one)
      if (controller.signal.aborted) return;

      const json = await res.json();

      // Only update state if this is still the active request
      if (abortControllerRef.current === controller) {
        if (json.success && json.analysis) {
          setAiAnalysis(json.analysis);
          setAiError(null);
          // Save to history
          saveAnalysisToHistory(instrument, json.analysis);
          // Record for gamification (badge tracking)
          gamification.recordAnalysis(instrument.symbol, instrument.category, false);
          // Auto-create pending TradeResult for performance tracking
          const a = json.analysis;
          const isBuy = a.direction === 'BUY';
          performance.addTrade({
            instrumentSymbol: instrument.symbol,
            instrumentName: instrument.name,
            strategy: a.strategy,
            direction: a.direction as 'BUY' | 'SELL' | 'WAIT',
            entryPrice: isBuy ? a.tradePoints.buyPoint : a.tradePoints.sellPoint,
            stopLoss: isBuy ? a.tradePoints.stopLossBuy : a.tradePoints.stopLossSell,
            takeProfit: isBuy ? a.tradePoints.takeProfitBuy : a.tradePoints.takeProfitSell,
            confidence: a.confidence,
            successProbability: a.successProbability || 0,
            timestamp: new Date().toISOString(),
          });
          // Toast: analysis completed
          const dir = json.analysis.direction === 'BUY' ? 'COMPRA' : json.analysis.direction === 'SELL' ? 'VENDA' : 'ESPERAR';
          const dirEmoji = json.analysis.direction === 'BUY' ? '📈' : json.analysis.direction === 'SELL' ? '📉' : '⏸️';
          const toastType = json.analysis.direction === 'WAIT' ? 'warning' : 'success';
          toast[toastType](`${dirEmoji} ${dir} — ${json.analysis.confidence}% confiança`, {
            id: 'ai-analysis',
            description: `${instrument.name} · Prob. acerto: ${json.analysis.successProbability || 0}%`
          });
          // Voice narration
          narrateAnalysis(instrument, json.analysis);
          // Update credits — setCreditsFromServer shows the value immediately
          // and then auto-refreshes from DB after 1s to verify
          if (json.creditsRemaining !== undefined) {
            credits.setCreditsFromServer(json.creditsRemaining, json.isPro);
            // During trial, no credit deduction toast needed — unlimited access
          }
        } else if (json.error) {
          setAiError(json.error);
          // Handle server-side auth/credit errors
          if (json.needsLogin) {
            toast.error('Login necessário!', { id: 'ai-analysis', description: json.error });
          } else if (json.needsSubscription) {
            openPaymentModal('server-needs-subscription', json.creditsRemaining);
            toast.error('Período grátis expirado!', { id: 'ai-analysis', description: json.error });
          } else {
            toast.error('Erro na análise', { id: 'ai-analysis', description: json.error });
          }
          // Update credits from error response + verify from DB
          credits.setCreditsFromServer(json.creditsRemaining ?? 0, json.isPro);
        }
      }
    } catch (err: any) {
      // Don't log aborted requests as errors (they're intentional)
      if (err.name === 'AbortError') return;
      const msg = err.name === 'TimeoutError' || err.message?.includes('abort')
        ? 'A análise demorou muito. Tente novamente.'
        : 'Erro ao conectar com a IA. Verifique sua conexão.';
      setAiError(msg);
      console.error('AI analysis failed:', err);
      toast.error('Erro na análise', { id: 'ai-analysis', description: msg });
    } finally {
      // Only clear analyzing state if this is still the active request
      if (abortControllerRef.current === controller) {
        setAnalyzing(false);
        abortControllerRef.current = null;
      }
      clearTimeout(timeoutId);
    }
  }, [category, riskRewardRatio, riskMode, saveAnalysisToHistory, credits.isLoggedIn, credits.isSubscribed, credits.credits, credits.creditsLoaded, openPaymentModal]);

  // Compare all 3 strategies simultaneously
  const compareAllStrategies = useCallback(async (instrument: Instrument) => {
    // Not logged in → show Google login modal
    if (!credits.isLoggedIn) {
      setShowGoogleLoginModal(true);
      return;
    }

    // Trial check — only block if trial expired and not Pro.
    if (!credits.isSubscribed && credits.creditsLoaded && credits.shouldBlock) {
      toast.error('Período grátis expirado!', { description: 'Assine para comparar estratégias.' });
      openPaymentModal('comparison-trial-expired');
      return;
    }

    setComparing(true);
    setComparisonResults({ smc: null, price_action: null, hybrid: null });

    // Toast: comparison started
    toast.loading(`Comparando ${instrument.name}...`, { id: 'ai-comparison', description: 'SMC · Price Action · Híbrido' });

    const strategies: AnalysisStrategy[] = ['smc', 'price_action', 'hybrid'];

    try {
      // Wait for quote data with retry (same logic as analyzeWithAI)
      let quoteData = allQuotesRef.current[instrument.symbol] || quotesRef.current[instrument.symbol];
      let currentPrice = getVal(quoteData?.regularMarketPrice);

      if (!currentPrice || currentPrice <= 0) {
        toast.loading(`Aguardando cotação de ${instrument.name}...`, { id: 'ai-comparison', description: 'Carregando dados de preço' });
        for (let retry = 0; retry < 10; retry++) {
          await new Promise(r => setTimeout(r, 500));
          quoteData = allQuotesRef.current[instrument.symbol] || quotesRef.current[instrument.symbol];
          currentPrice = getVal(quoteData?.regularMarketPrice);
          if (currentPrice && currentPrice > 0) break;
        }
      }

      if (!currentPrice || currentPrice <= 0) {
        try {
          const cat = instrument.category || category;
          const res = await fetch(`/api/market/quotes?category=${cat}`);
          const json = await res.json();
          if (json.success && json.data?.body && Array.isArray(json.data.body)) {
            const found = json.data.body.find((q: any) => q.symbol === instrument.symbol);
            if (found) {
              currentPrice = getVal(found.regularMarketPrice);
              quoteData = found;
              setAllQuotes(prev => ({ ...prev, [instrument.symbol]: found }));
            }
          }
        } catch {}
      }

      if (!currentPrice || currentPrice <= 0) {
        setAiError('Sem dados de cotação para este ativo. Aguarde o carregamento.');
        setComparing(false);
        toast.dismiss('ai-comparison');
        return;
      }

      const baseData = {
        symbol: instrument.symbol,
        name: instrument.name,
        currentPrice,
        change: getVal(quoteData?.regularMarketChange),
        changePercent: getVal(quoteData?.regularMarketChangePercent),
        high: getVal(quoteData?.regularMarketDayHigh),
        low: getVal(quoteData?.regularMarketDayLow),
        volume: getVal(quoteData?.regularMarketVolume),
        category,
        riskRewardRatio,
        riskMode,
      };

      const results = await Promise.allSettled(
        strategies.map(async (s) => {
          const res = await resilientFetch('/api/ai/analyze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...baseData, strategy: s }),
          }, 2, 10000);
          const json = await res.json();
          return { strategy: s, analysis: json.analysis as AIAnalysis | null };
        })
      );

      const newResults: Record<AnalysisStrategy, AIAnalysis | null> = {
        smc: null,
        price_action: null,
        hybrid: null,
      };

      for (const result of results) {
        if (result.status === 'fulfilled' && result.value?.analysis) {
          newResults[result.value.strategy] = result.value.analysis;
          // Save each strategy result to history
          saveAnalysisToHistory(instrument, result.value.analysis);
        }
      }

      setComparisonResults(newResults);

      // Record for gamification (comparison mode)
      gamification.recordAnalysis(instrument.symbol, instrument.category, true);

      // Auto-create pending TradeResults for performance tracking (each strategy)
      for (const s of strategies) {
        const r = newResults[s];
        if (r) {
          const isBuy = r.direction === 'BUY';
          performance.addTrade({
            instrumentSymbol: instrument.symbol,
            instrumentName: instrument.name,
            strategy: s,
            direction: r.direction as 'BUY' | 'SELL' | 'WAIT',
            entryPrice: isBuy ? r.tradePoints.buyPoint : r.tradePoints.sellPoint,
            stopLoss: isBuy ? r.tradePoints.stopLossBuy : r.tradePoints.stopLossSell,
            takeProfit: isBuy ? r.tradePoints.takeProfitBuy : r.tradePoints.takeProfitSell,
            confidence: r.confidence,
            successProbability: r.successProbability || 0,
            timestamp: new Date().toISOString(),
          });
        }
      }

      // Also set the best strategy as the main analysis for chart display
      let bestStrategy: AnalysisStrategy = 'hybrid';
      let bestProb = 0;
      for (const s of strategies) {
        if (newResults[s] && (newResults[s]?.successProbability || 0) > bestProb) {
          bestProb = newResults[s]?.successProbability || 0;
          bestStrategy = s;
        }
      }
      if (newResults[bestStrategy]) {
        setAiAnalysis(newResults[bestStrategy]!);
      }

      // Toast: comparison completed
      const bestLabel = STRATEGY_META[bestStrategy]?.label || 'Híbrido';
      toast.success(`Comparação concluída!`, {
        id: 'ai-comparison',
        description: `Melhor: ${bestLabel} (${bestProb}% acerto)`
      });

      // Voice narration — only narrate the best strategy result
      if (newResults[bestStrategy]) {
        narrateAnalysis(instrument, newResults[bestStrategy]!);
      }

      // Refresh credits from DB after comparison (3 strategies = 15 credits deducted)
      setTimeout(() => credits.refresh(), 2000);

    } catch (err: any) {
      console.error('Comparison failed:', err);
      setAiError('Erro ao comparar estratégias. Tente novamente.');
      toast.error('Erro na comparação', { id: 'ai-comparison', description: 'Tente novamente.' });
    } finally {
      setComparing(false);
    }
  }, [category, riskRewardRatio, riskMode, saveAnalysisToHistory, credits.isLoggedIn, credits.isSubscribed, credits.credits]);

  // Auto re-analyze when risk/reward ratio or risk mode changes (if analysis already exists)
  const prevRRRef = useRef(riskRewardRatio);
  const prevRiskModeRef = useRef(riskMode);
  const isInitialMount = useRef(true);
  useEffect(() => {
    // Skip on first mount to avoid auto-triggering
    if (isInitialMount.current) {
      isInitialMount.current = false;
      prevRRRef.current = riskRewardRatio;
      prevRiskModeRef.current = riskMode;
      return;
    }
    // Skip if nothing actually changed
    if (prevRRRef.current === riskRewardRatio && prevRiskModeRef.current === riskMode) return;
    prevRRRef.current = riskRewardRatio;
    prevRiskModeRef.current = riskMode;

    // Only re-analyze if there's an existing analysis and a selected instrument
    if (selectedInstrument && (aiAnalysis || Object.values(comparisonResults).some(v => v !== null))) {
      if (viewMode === 'comparison') {
        compareAllStrategies(selectedInstrument);
      } else {
        analyzeWithAI(selectedInstrument, strategy);
      }
    }
  }, [riskRewardRatio, riskMode]);

  // Ref for smooth-scrolling to AI analysis section when instrument is selected
  const aiAnalysisSectionRef = useRef<HTMLDivElement>(null);

  // Track whether a category change was triggered by instrument selection
  // (to avoid overriding the user's chosen instrument with the first in the new category)
  const categoryChangeFromInstrumentRef = useRef(false);

  // Handle instrument selection from global search or price cards
  const handleInstrumentSelect = useCallback((inst: Instrument) => {
    // Cancel any ongoing AI analysis
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    // Cancel any ongoing speech when switching instruments
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    setAnalyzing(false);
    setSelectedInstrument(inst);
    setAiAnalysis(null);
    setAiError(null);
    setComparisonResults({ smc: null, price_action: null, hybrid: null });
    // Also switch to the instrument's category if different
    if (inst.category !== category) {
      // Mark that this category change came from instrument selection
      // so the category change effect doesn't override the selection
      categoryChangeFromInstrumentRef.current = true;
      setCategory(inst.category);
    }
    // Smooth scroll to AI analysis section for better UX
    setTimeout(() => {
      aiAnalysisSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
    // The fetch is triggered by the useEffect that watches selectedInstrument?.symbol
    // No need to manually trigger it here — the useEffect is the single source of truth.
  }, [category]);

  // Toggle favorite — persists to localStorage
  const toggleFavorite = useCallback((symbol: string) => {
    setFavorites(prev => {
      const next = new Set(prev);
      const isAdding = !next.has(symbol);
      if (isAdding) {
        next.add(symbol);
        toast.success('⭐ Favorito adicionado', { description: symbol });
      } else {
        next.delete(symbol);
        toast.info('Favorito removido', { description: symbol });
      }
      try { localStorage.setItem('forexAI-favorites', JSON.stringify([...next])); } catch {}
      return next;
    });
  }, []);

  // Auto-select first instrument when category changes (ONLY when user clicks a tab)
  // When the category changes because the user selected an instrument from another category,
  // we skip auto-selection to preserve the user's choice
  useEffect(() => {
    // If this category change was triggered by instrument selection, don't override
    if (categoryChangeFromInstrumentRef.current) {
      categoryChangeFromInstrumentRef.current = false;
      return;
    }
    // Cancel any ongoing AI analysis when category changes
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setAnalyzing(false);
    const inst = getInstruments(category, favorites);
    if (inst.length > 0) {
      setSelectedInstrument(inst[0]);
      setAiAnalysis(null);
      setAiError(null);
      setComparisonResults({ smc: null, price_action: null, hybrid: null });
    }
  }, [category]);

  // Fetch quotes on mount and periodically (skip category-specific fetch for favorites)
  useEffect(() => {
    if (category !== 'favorites') {
      fetchQuotes();
    }
    fetchAllQuotes();
    const interval = category !== 'favorites' ? setInterval(fetchQuotes, 30000) : null;
    const allInterval = setInterval(fetchAllQuotes, 120000);
    return () => {
      if (interval) clearInterval(interval);
      clearInterval(allInterval);
    };
  }, [fetchQuotes, fetchAllQuotes, category]);

  // Fetch sparkline data when category changes (skip for favorites since it's cross-category)
  useEffect(() => {
    if (category === 'favorites') return;
    fetchSparklines(category);
    // Refresh sparklines every 2 minutes
    const interval = setInterval(() => fetchSparklines(category), 120000);
    return () => clearInterval(interval);
  }, [category, fetchSparklines]);

  // Update sparkline last point with live quote data
  useEffect(() => {
    if (Object.keys(quotes).length === 0 || Object.keys(sparklineData).length === 0) return;

    const updateSparklineLive = () => {
      setSparklineData(prev => {
        let changed = false;
        const updated = { ...prev };

        for (const symbol of Object.keys(updated)) {
          const quote = quotes[symbol];
          if (!quote) continue;

          const livePrice = getVal(quote.regularMarketPrice);
          if (livePrice <= 0) continue;

          const points = updated[symbol];
          if (!points || points.length === 0) continue;

          const lastPoint = points[points.length - 1];
          if (lastPoint.close !== livePrice) {
            updated[symbol] = [...points];
            updated[symbol][updated[symbol].length - 1] = {
              ...lastPoint,
              close: livePrice,
            };
            changed = true;
          }
        }

        return changed ? updated : prev;
      });
    };

    const interval = setInterval(updateSparklineLive, 5000);
    return () => clearInterval(interval);
  }, [quotes, sparklineData]);

  const categoryTabs: MarketCategory[] = ['favorites', 'forex', 'indices', 'metals', 'crypto', 'stocks', 'etfs', 'brazil'];

  // Global keyboard shortcut: Ctrl+K or Cmd+K to open search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        // Focus is handled by InstrumentSearch component internally
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-background relative" suppressHydrationWarning>
      {/* 🔑 Subscription Verification Overlay — shown while verifying payment after Stripe redirect */}
      {verifyingSubscription && (
        <div className="fixed inset-0 z-[200] bg-black/90 backdrop-blur-md flex items-center justify-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center px-6"
          >
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 1.5, ease: 'linear' }}
              className="w-16 h-16 border-4 border-cyan-500/30 border-t-cyan-500 rounded-full mx-auto mb-6"
            />
            <h2 className="text-xl font-bold text-white mb-2">Verificando pagamento...</h2>
            <p className="text-gray-400 text-sm max-w-xs mx-auto">
              Estamos confirmando sua assinatura com a Stripe. Isso levará apenas alguns segundos.
            </p>
          </motion.div>
        </div>
      )}

      {/* PWA Install Banner */}
      {mounted && pwa.isPromptVisible && !pwa.isInstalled && (
        <div className="relative z-[60] bg-gradient-to-r from-cyan-600/90 via-cyan-500/90 to-violet-600/90 backdrop-blur-sm">
          <div className="max-w-[1800px] mx-auto px-4 py-2 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <Download className="w-4 h-4 text-white shrink-0" />
              <span className="text-sm text-white font-medium truncate">
                Instale o ForexAI Pro no seu dispositivo
              </span>
              <span className="hidden sm:inline text-xs text-white/80 truncate">
                — acesso rápido e experiência nativa
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={async () => {
                  setPwaInstalling(true);
                  const accepted = await pwa.promptInstall();
                  setPwaInstalling(false);
                  if (!accepted) {
                    // If native prompt didn't work or was dismissed, dismiss our banner too
                    pwa.dismissPrompt();
                  }
                }}
                disabled={pwaInstalling}
                className="px-3 py-1 bg-white text-cyan-700 rounded-md text-xs font-semibold hover:bg-white/90 transition-colors disabled:opacity-50 flex items-center gap-1"
              >
                <Download className="w-3 h-3" />
                {pwaInstalling ? 'Instalando...' : 'Instalar App'}
              </button>
              <button
                onClick={pwa.dismissPrompt}
                className="p-1 text-white/60 hover:text-white transition-colors rounded"
                aria-label="Fechar"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Offline Indicator */}
      {mounted && !pwa.isOnline && (
        <div className="relative z-[60] bg-amber-600/90 backdrop-blur-sm">
          <div className="max-w-[1800px] mx-auto px-4 py-1.5 flex items-center justify-center gap-2">
            <WifiOff className="w-3.5 h-3.5 text-white" />
            <span className="text-xs text-white font-medium">
              Você está offline — algumas funcionalidades podem estar indisponíveis
            </span>
          </div>
        </div>
      )}

      {/* Google Login Modal */}
      <GoogleLoginModal
        isOpen={showGoogleLoginModal}
        onClose={() => setShowGoogleLoginModal(false)}
        onSignIn={() => {
          setShowGoogleLoginModal(false);
          auth.signInWithGoogle();
        }}
      />

      {/* Payment Modal */}
      <PaymentModal
        isOpen={showPaymentModal}
        onClose={() => {
          // Always allow closing — if user just paid and verification is in progress,
          // the auto-close useEffect will handle it when isSubscribed becomes true
          setShowPaymentModal(false);
        }}
        onSubscribe={handleSubscribe}
        subscribing={subscribing}
        error={stripeError}
        isTrialActive={credits.isTrial}
        trialDaysRemaining={credits.trialDaysRemaining}
      />

      {/* User Manual Dialog */}
      <UserManualDialog open={showUserManual} onOpenChange={setShowUserManual} />

      {/* Badge Collection Modal */}
      <Dialog open={showBadgeModal} onOpenChange={setShowBadgeModal}>
        <DialogContent className="sm:max-w-md bg-card border-border/50">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Award className="w-5 h-5 text-amber-400" />
              Conquistas e Badges
            </DialogTitle>
            <DialogDescription className="text-xs">
              Desbloqueie badges realizando análises e usando o app diariamente.
            </DialogDescription>
          </DialogHeader>

          {/* Stats Summary */}
          <div className="grid grid-cols-3 gap-2 sm:gap-3 mt-2">
            <div className="bg-secondary/30 rounded-lg p-2.5 text-center border border-border/20">
              <p className="text-[9px] text-muted-foreground uppercase mb-0.5">Análises</p>
              <p className="text-lg font-bold text-cyan-400">{gamification.data.totalAnalyses}</p>
            </div>
            <div className="bg-secondary/30 rounded-lg p-2.5 text-center border border-border/20">
              <p className="text-[9px] text-muted-foreground uppercase mb-0.5">Sequência</p>
              <p className="text-lg font-bold text-orange-400">{gamification.data.streak}</p>
            </div>
            <div className="bg-secondary/30 rounded-lg p-2.5 text-center border border-border/20">
              <p className="text-[9px] text-muted-foreground uppercase mb-0.5">Badges</p>
              <p className="text-lg font-bold text-amber-400">{gamification.data.badges.filter(b => b.earned).length}/{gamification.data.badges.length}</p>
            </div>
          </div>

          {/* Streak info */}
          {gamification.data.streak > 0 && (
            <div className="flex items-center gap-2 bg-orange-500/5 rounded-lg p-2.5 border border-orange-500/15">
              <Flame className="w-4 h-4 text-orange-400" />
              <div>
                <p className="text-xs font-semibold text-orange-400">
                  {gamification.data.streak} {gamification.data.streak === 1 ? 'dia' : 'dias'} consecutivos
                </p>
                <p className="text-[9px] text-muted-foreground">
                  Recorde: {gamification.data.longestStreak} dias
                </p>
              </div>
            </div>
          )}

          {/* Badge Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-72 overflow-y-auto pr-1 custom-scrollbar">
            {gamification.data.badges.map((badge) => {
              const isNew = gamification.isNewBadge(badge.id);
              return (
                <button
                  key={badge.id}
                  onClick={() => isNew && gamification.clearNewBadge(badge.id)}
                  className={`relative flex flex-col items-center gap-1.5 p-3 rounded-lg border transition-all text-center ${
                    badge.earned
                      ? isNew
                        ? 'bg-amber-500/10 border-amber-500/30 shadow-sm shadow-amber-500/10'
                        : 'bg-secondary/30 border-border/30'
                      : 'bg-secondary/10 border-border/15 opacity-40'
                  }`}
                >
                  <span className={`text-2xl ${badge.earned ? '' : 'grayscale'}`}>{badge.emoji}</span>
                  <span className={`text-[10px] font-semibold leading-tight ${badge.earned ? 'text-foreground' : 'text-muted-foreground'}`}>
                    {badge.name}
                  </span>
                  <span className="text-[8px] text-muted-foreground leading-tight">{badge.description}</span>
                  {isNew && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 bg-amber-500 text-[7px] font-bold text-white rounded-full flex items-center justify-center animate-pulse">
                      !
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Progress hints */}
          <div className="mt-2 space-y-1">
            {gamification.data.badges.filter(b => !b.earned).slice(0, 2).map(badge => (
              <div key={badge.id} className="flex items-center gap-1.5 text-[9px] text-muted-foreground">
                <span>{badge.emoji}</span>
                <span>{badge.name} — {badge.description}</span>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Performance Dashboard Modal */}
      <Dialog open={showPerformanceModal} onOpenChange={setShowPerformanceModal}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] bg-card border-border/50 overflow-y-auto custom-scrollbar">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Target className="w-5 h-5 text-cyan-400" />
              Performance da IA
            </DialogTitle>
            <DialogDescription className="text-xs">
              Acompanhe a taxa de acerto das análises da IA ao longo do tempo.
            </DialogDescription>
          </DialogHeader>
          <PerformanceDashboard
            stats={performance.stats}
            trades={performance.trades}
            onMarkResult={performance.markResult}
            onRemoveTrade={performance.removeTrade}
            onClearAll={performance.clearAllTrades}
          />
        </DialogContent>
      </Dialog>

      {/* Pattern Scanner Modal */}
      <Dialog open={showScannerModal} onOpenChange={setShowScannerModal}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] bg-card border-border/50 overflow-y-auto custom-scrollbar">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Search className="w-5 h-5 text-violet-400" />
              Scanner de Padrões
            </DialogTitle>
            <DialogDescription className="text-xs">
              Detecte padrões SMC e Price Action automaticamente em múltiplos instrumentos. Grátis — sem consumo de créditos.
            </DialogDescription>
          </DialogHeader>
          <PatternScanner
            instruments={instruments}
            category={category}
            allInstruments={ALL_INSTRUMENTS}
            onAnalyzeInstrument={(inst) => {
              setShowScannerModal(false);
              handleInstrumentSelect(inst);
              // Trigger AI analysis after switching instrument
              setTimeout(() => {
                analyzeWithAI(inst, strategy);
              }, 500);
            }}
          />
        </DialogContent>
      </Dialog>

      {/* Price Alerts Dialog */}
      <PriceAlertDialog
        open={showPriceAlertDialog}
        onOpenChange={setShowPriceAlertDialog}
        instrumentSymbol={selectedInstrument?.symbol || ''}
        instrumentName={selectedInstrument?.name || ''}
        currentQuote={selectedInstrument ? (allQuotes[selectedInstrument.symbol] || quotes[selectedInstrument.symbol]) : undefined}
        priceAlerts={priceAlerts}
      />

      {/* Scheduled Analysis Dialog */}
      <ScheduledAnalysisDialog
        open={showScheduledModal}
        onOpenChange={setShowScheduledModal}
        schedules={scheduledAnalysis.schedules}
        onAddSchedule={scheduledAnalysis.addSchedule}
        onRemoveSchedule={scheduledAnalysis.removeSchedule}
        onUpdateSchedule={scheduledAnalysis.updateSchedule}
        onToggleSchedule={scheduledAnalysis.toggleSchedule}
        onClearAll={scheduledAnalysis.clearAllSchedules}
        canAddMore={scheduledAnalysis.canAddMore}
        getNextRun={scheduledAnalysis.getNextRun}
        currentCategory={category}
        credits={credits.credits}
        isSubscribed={credits.isSubscribed}
      />

      {/* Layout Customizer Dialog */}
      <LayoutCustomizerDialog
        open={showLayoutDialog}
        onOpenChange={setShowLayoutDialog}
        layout={layout}
      />

      {/* Weekly Report Dialog */}
      <WeeklyReportDialog
        open={showWeeklyReportModal}
        onOpenChange={setShowWeeklyReportModal}
        report={weeklyReport.report}
        isPro={credits.isSubscribed}
      />

      {/* Blur overlay when trial expires */}
      {credits.shouldBlock && !credits.isSubscribed && (
        <div className="fixed inset-0 z-[90] bg-black/60 backdrop-blur-sm flex items-center justify-center">
          <div className="text-center p-8 max-w-md">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-red-400 to-orange-500 flex items-center justify-center">
              <Coins className="w-8 h-8 text-white" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Período Grátis Expirado</h3>
            <p className="text-gray-400 text-sm mb-6">
              Seu período grátis de 3 dias acabou. Assine para continuar usando a análise por IA.
            </p>
            <Button
              onClick={() => setShowPaymentModal(true)}
              className="bg-gradient-to-r from-cyan-500 to-violet-500 hover:from-cyan-400 hover:to-violet-400 text-white font-semibold px-8 h-12"
            >
              <CreditCard className="w-5 h-5 mr-2" />
              Assinar Agora
            </Button>
          </div>
        </div>
      )}

      {/* ═══ Trial Banner ═══ */}
      {credits.isTrial && credits.isLoggedIn && !credits.isSubscribed && credits.trialDaysRemaining > 0 && (
        <div className="bg-gradient-to-r from-cyan-500/10 via-violet-500/5 to-cyan-500/10 border-b border-cyan-500/20 px-4 py-2">
          <div className="max-w-[1800px] mx-auto flex items-center justify-center gap-2">
            <Clock className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-xs text-cyan-400 font-medium">
              🎉 Teste grátis ativo — {credits.trialDaysRemaining} dia{credits.trialDaysRemaining !== 1 ? 's' : ''} restante{credits.trialDaysRemaining !== 1 ? 's' : ''}
            </span>
            <span className="text-[10px] text-gray-500 hidden sm:inline">
              · Após o período, assine para continuar
            </span>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="border-b border-border/40 bg-card/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-[1800px] mx-auto px-4 py-2.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <img
                src="/stripe-icon.png"
                alt="ForexAI Pro"
                className="w-9 h-9 rounded-xl shadow-lg shadow-cyan-500/20 object-cover"
              />
              <div className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-400 rounded-full border-2 border-card pulse-glow" />
            </div>
            <div>
              <h1 className="text-base font-bold tracking-tight leading-tight">
                <span className="bg-gradient-to-r from-cyan-400 to-violet-400 bg-clip-text text-transparent">
                  ForexAI
                </span>
                <span className="text-foreground ml-1">Pro</span>
              </h1>
              <p className="text-[9px] text-muted-foreground leading-tight">Análise Inteligente de Mercado</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden md:flex items-center gap-3">
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <Globe className="w-3 h-3" />
                <span>Ao Vivo</span>
                {mounted && lastUpdate && (
                  <span className="text-emerald-400 font-mono">
                    {lastUpdate.toLocaleTimeString('pt-BR')}
                  </span>
                )}
              </div>
              <Separator orientation="vertical" className="h-4 bg-border/40" />
              <Badge variant="outline" className="border-emerald-500/30 text-emerald-400 text-[9px] px-1.5">
                <Activity className="w-2.5 h-2.5 mr-0.5" /> Ao Vivo
              </Badge>
              <Badge variant="outline" className="border-violet-500/30 text-violet-400 text-[9px] px-1.5">
                <Cpu className="w-2.5 h-2.5 mr-0.5" /> IA
              </Badge>
              <Badge variant="outline" className="border-cyan-500/30 text-cyan-400 text-[9px] px-1.5">
                <Shield className="w-2.5 h-2.5 mr-0.5" /> Tempo Real
              </Badge>
              {/* Credit Bar — elegant indicator */}
              {mounted && (
                <CreditBar
                  credits={credits.credits}
                  maxCredits={credits.maxCredits}
                  isSubscribed={credits.isSubscribed}
                  isLoggedIn={credits.isLoggedIn}
                  isTrial={credits.isTrial}
                  trialDaysRemaining={credits.trialDaysRemaining}
                  onClick={() => {
                    if (!credits.isLoggedIn) {
                      setShowGoogleLoginModal(true);
                    } else if (!credits.isSubscribed && credits.shouldBlock) {
                      openPaymentModal('credit-bar-click');
                    }
                  }}
                />
              )}
              {/* Streak counter */}
              {mounted && gamification.data.streak > 0 && (
                <Badge variant="outline" className="border-orange-500/30 text-orange-400 text-[9px] px-1.5">
                  <Flame className="w-2.5 h-2.5 mr-0.5" /> {gamification.data.streak} dias
                </Badge>
              )}
              {/* Badge collection button */}
              {mounted && (
                <button
                  onClick={() => setShowBadgeModal(true)}
                  className="relative flex items-center justify-center h-8 w-8 rounded-md border border-border/40 hover:border-amber-500/40 hover:bg-amber-500/5 transition-all"
                  title="Badges e conquistas"
                >
                  <Award className="w-3.5 h-3.5 text-amber-400" />
                  {gamification.data.badges.filter(b => b.earned).length > 0 && (
                    <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-amber-500 text-[7px] font-bold text-white rounded-full flex items-center justify-center">
                      {gamification.data.badges.filter(b => b.earned).length}
                    </span>
                  )}
                </button>
              )}
              {/* Performance dashboard button */}
              {mounted && (
                <button
                  onClick={() => setShowPerformanceModal(true)}
                  className="relative flex items-center justify-center h-8 w-8 rounded-md border border-border/40 hover:border-cyan-500/40 hover:bg-cyan-500/5 transition-all"
                  title="Performance da IA"
                >
                  <Target className="w-3.5 h-3.5 text-cyan-400" />
                  {performance.pendingCount > 0 && (
                    <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-cyan-500 text-[7px] font-bold text-white rounded-full flex items-center justify-center">
                      {performance.pendingCount}
                    </span>
                  )}
                </button>
              )}
              {/* Pattern Scanner blinking button — eye-catching for beginners */}
              {mounted && (
                <button
                  onClick={() => setShowScannerModal(true)}
                  className="relative flex items-center gap-1 h-8 px-2 rounded-md border animate-scanner-blink transition-all cursor-pointer"
                  title="Scanner de padrões — encontre os melhores ativos!"
                >
                  <Search className="w-3.5 h-3.5" />
                  <span className="text-[9px] font-bold uppercase tracking-wide hidden lg:inline">Scanner</span>
                  {/* Blinking dot */}
                  <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full animate-ping bg-emerald-400" />
                </button>
              )}
              {/* Voice narration toggle button */}
              {mounted && (
                <button
                  onClick={toggleVoice}
                  className="flex items-center justify-center h-8 w-8 rounded-md border border-border/40 hover:border-cyan-500/40 hover:bg-cyan-500/5 transition-all"
                  title={voiceEnabled ? 'Narração ativada' : 'Narração desativada'}
                >
                  {voiceEnabled ? <Volume2 className="w-3.5 h-3.5 text-cyan-400" /> : <VolumeX className="w-3.5 h-3.5 text-muted-foreground" />}
                </button>
              )}
              {/* Price alerts bell button */}
              {mounted && (
                <button
                  onClick={() => setShowPriceAlertDialog(true)}
                  className="relative flex items-center justify-center h-8 w-8 rounded-md border border-border/40 hover:border-amber-500/40 hover:bg-amber-500/5 transition-all"
                  title="Alertas de preço"
                >
                  <Bell className={`w-3.5 h-3.5 ${priceAlerts.triggeredCount > 0 ? 'text-amber-400' : priceAlerts.activeCount > 0 ? 'text-cyan-400' : 'text-muted-foreground'}`} />
                  {priceAlerts.activeCount > 0 && (
                    <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-amber-500 text-[7px] font-bold text-white rounded-full flex items-center justify-center">
                      {priceAlerts.activeCount}
                    </span>
                  )}
                </button>
              )}
              {/* Scheduled analysis clock button */}
              {mounted && (
                <button
                  onClick={() => setShowScheduledModal(true)}
                  className="relative flex items-center justify-center h-8 w-8 rounded-md border border-border/40 hover:border-violet-500/40 hover:bg-violet-500/5 transition-all"
                  title="Análises agendadas"
                >
                  <Clock className={`w-3.5 h-3.5 ${scheduledAnalysis.schedules.length > 0 ? 'text-violet-400' : 'text-muted-foreground'}`} />
                  {scheduledAnalysis.schedules.filter(s => s.enabled).length > 0 && (
                    <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-violet-500 text-[7px] font-bold text-white rounded-full flex items-center justify-center">
                      {scheduledAnalysis.schedules.filter(s => s.enabled).length}
                    </span>
                  )}
                </button>
              )}
              {/* Layout customizer button */}
              {mounted && (
                <button
                  onClick={() => setShowLayoutDialog(true)}
                  className="flex items-center justify-center h-8 w-8 rounded-md border border-border/40 hover:border-cyan-500/40 hover:bg-cyan-500/5 transition-all"
                  title="Personalizar layout"
                >
                  <LayoutGrid className="w-3.5 h-3.5 text-cyan-400" />
                </button>
              )}
              {/* Weekly report button — only visible if user has analyses */}
              {mounted && weeklyReport.hasData && (
                <button
                  onClick={() => setShowWeeklyReportModal(true)}
                  className="relative flex items-center justify-center h-8 w-8 rounded-md border border-border/40 hover:border-emerald-500/40 hover:bg-emerald-500/5 transition-all"
                  title="Relatório Semanal"
                >
                  <Mail className="w-3.5 h-3.5 text-emerald-400" />
                </button>
              )}
            </div>

            {/* Credits indicator — mobile */}
            {mounted && (
            <div className="flex md:hidden items-center gap-1.5">
              <CreditBar
                credits={credits.credits}
                maxCredits={credits.maxCredits}
                isSubscribed={credits.isSubscribed}
                isLoggedIn={credits.isLoggedIn}
                isTrial={credits.isTrial}
                trialDaysRemaining={credits.trialDaysRemaining}
                onClick={() => {
                  if (!credits.isLoggedIn) {
                    setShowGoogleLoginModal(true);
                  } else if (!credits.isSubscribed && credits.shouldBlock) {
                    openPaymentModal('credit-bar-click-mobile');
                  }
                }}
              />
              {/* Mobile streak + badge */}
              {gamification.data.streak > 0 && (
                <div className="flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-semibold bg-orange-500/10 border border-orange-500/20 text-orange-400">
                  <Flame className="w-3 h-3" />
                  <span>{gamification.data.streak}</span>
                </div>
              )}
              <button
                onClick={() => setShowBadgeModal(true)}
                className="relative flex items-center justify-center h-8 w-8 rounded-md border border-border/40 hover:border-amber-500/40"
                title="Badges"
              >
                <Award className="w-3.5 h-3.5 text-amber-400" />
                {gamification.data.badges.filter(b => b.earned).length > 0 && (
                  <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-amber-500 text-[7px] font-bold text-white rounded-full flex items-center justify-center">
                    {gamification.data.badges.filter(b => b.earned).length}
                  </span>
                )}
              </button>
              {/* Mobile performance button */}
              <button
                onClick={() => setShowPerformanceModal(true)}
                className="relative flex items-center justify-center h-8 w-8 rounded-md border border-border/40 hover:border-cyan-500/40"
                title="Performance"
              >
                <Target className="w-3.5 h-3.5 text-cyan-400" />
                {performance.pendingCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-cyan-500 text-[7px] font-bold text-white rounded-full flex items-center justify-center">
                    {performance.pendingCount}
                  </span>
                )}
              </button>
              {/* Mobile pattern scanner blinking button */}
              <button
                onClick={() => setShowScannerModal(true)}
                className="relative flex items-center justify-center h-8 w-8 rounded-md border animate-scanner-blink"
                title="Scanner de padrões"
              >
                <Search className="w-3.5 h-3.5" />
                <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full animate-ping bg-emerald-400" />
              </button>
              {/* Mobile price alerts bell button */}
              <button
                onClick={() => setShowPriceAlertDialog(true)}
                className="relative flex items-center justify-center h-8 w-8 rounded-md border border-border/40 hover:border-amber-500/40"
                title="Alertas de preço"
              >
                <Bell className={`w-3.5 h-3.5 ${priceAlerts.activeCount > 0 ? 'text-amber-400' : 'text-muted-foreground'}`} />
                {priceAlerts.activeCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-amber-500 text-[7px] font-bold text-white rounded-full flex items-center justify-center">
                    {priceAlerts.activeCount}
                  </span>
                )}
              </button>
              {/* Mobile scheduled analysis clock button */}
              <button
                onClick={() => setShowScheduledModal(true)}
                className="relative flex items-center justify-center h-8 w-8 rounded-md border border-border/40 hover:border-violet-500/40"
                title="Análises agendadas"
              >
                <Clock className={`w-3.5 h-3.5 ${scheduledAnalysis.schedules.length > 0 ? 'text-violet-400' : 'text-muted-foreground'}`} />
                {scheduledAnalysis.schedules.filter(s => s.enabled).length > 0 && (
                  <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-violet-500 text-[7px] font-bold text-white rounded-full flex items-center justify-center">
                    {scheduledAnalysis.schedules.filter(s => s.enabled).length}
                  </span>
                )}
              </button>
              {/* Mobile voice narration toggle button */}
              <button
                onClick={toggleVoice}
                className="flex items-center justify-center h-8 w-8 rounded-md border border-border/40 hover:border-cyan-500/40 hover:bg-cyan-500/5 transition-all"
                title={voiceEnabled ? 'Narração ativada' : 'Narração desativada'}
              >
                {voiceEnabled ? <Volume2 className="w-3.5 h-3.5 text-cyan-400" /> : <VolumeX className="w-3.5 h-3.5 text-muted-foreground" />}
              </button>
              {/* Mobile layout customizer button */}
              <button
                onClick={() => setShowLayoutDialog(true)}
                className="flex items-center justify-center h-8 w-8 rounded-md border border-border/40 hover:border-cyan-500/40"
                title="Personalizar layout"
              >
                <LayoutGrid className="w-3.5 h-3.5 text-cyan-400" />
              </button>
              {/* Mobile weekly report button */}
              {weeklyReport.hasData && (
                <button
                  onClick={() => setShowWeeklyReportModal(true)}
                  className="flex items-center justify-center h-8 w-8 rounded-md border border-border/40 hover:border-emerald-500/40"
                  title="Relatório Semanal"
                >
                  <Mail className="w-3.5 h-3.5 text-emerald-400" />
                </button>
              )}
            </div>
            )}

            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setLoading(true);
                fetchQuotes();
                fetchSparklines(category);
              }}
              className="text-muted-foreground hover:text-cyan-400 h-8 w-8 p-0"
              title="Atualizar dados"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleEyeComfort}
              className={`h-8 w-8 p-0 ${eyeComfort ? 'text-amber-400 hover:text-amber-300' : 'text-muted-foreground hover:text-amber-400'}`}
              title={eyeComfort ? 'Modo conforto visual ativo' : 'Modo conforto visual'}
            >
              {eyeComfort ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
            </Button>
            <Separator orientation="vertical" className="h-4 bg-border/40 hidden md:block" />
            {/* User Profile or Google Login — wrapped in mounted to avoid hydration mismatch */}
            {mounted && auth.user ? (
              <div className="flex items-center gap-2">
                <div className="hidden md:flex items-center gap-1.5">
                  {auth.user.image && (
                    <img src={auth.user.image} alt="" className="w-5 h-5 rounded-full" />
                  )}
                  <span className="text-[11px] text-muted-foreground max-w-[100px] truncate">
                    {auth.user.name || auth.user.email?.split('@')[0]}
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={auth.signOut}
                  className="text-muted-foreground hover:text-red-400 h-8 px-2"
                  title="Sair"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </Button>
              </div>
            ) : mounted && !auth.user ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowGoogleLoginModal(true)}
                className="text-muted-foreground hover:text-cyan-400 h-8 px-2 gap-1.5"
                title="Entrar com Google"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                <span className="hidden md:inline text-[11px]">Entrar</span>
              </Button>
            ) : null}
          </div>
        </div>
      </header>

      {/* Market Ticker — only render after mount to avoid hydration mismatch */}
      {mounted && <MarketTicker quotes={allQuotes} />}



      {/* Main Content */}
      <main className="flex-1 max-w-[1800px] mx-auto w-full px-4 py-5 space-y-5">
        {!mounted ? (
          /* Loading skeleton — rendered during SSR and initial hydration to prevent mismatch */
          <div className="space-y-5 animate-in fade-in duration-300">
            {/* Performance Summary Skeleton — 4 small cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[0,1,2,3].map(i => (
                <div key={`perf-${i}`} className="bg-card/40 animate-pulse rounded-xl h-20 border border-border/20" />
              ))}
            </div>
            {/* Price Cards Skeleton — 6 cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {[0,1,2,3,4,5].map(i => (
                <div key={`price-${i}`} className="bg-card/40 animate-pulse rounded-xl h-28 border border-border/20" />
              ))}
            </div>
            {/* Chart + AI Analysis Skeleton */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              <div className="lg:col-span-2 bg-card/40 animate-pulse rounded-xl h-[420px] border border-border/20" />
              <div className="bg-card/40 animate-pulse rounded-xl h-[420px] border border-border/20" />
            </div>
            {/* Heatmap + Calendar Skeleton */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <div className="bg-card/40 animate-pulse rounded-xl h-64 border border-border/20" />
              <div className="bg-card/40 animate-pulse rounded-xl h-64 border border-border/20" />
            </div>
            {/* Market Overview Skeleton */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
              {[0,1,2,3,4,5,6].map(i => (
                <div key={`overview-${i}`} className="bg-card/40 animate-pulse rounded-xl h-16 border border-border/20" />
              ))}
            </div>
          </div>
        ) : (
        <>
        {/* Category Tabs + Search */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide flex-nowrap pb-1 -mb-1">
            {categoryTabs.map((cat) => {
              const meta = CATEGORY_META[cat];
              const isActive = category === cat;
              const colorMap: Record<string, { bg: string; text: string; border: string; glow: string; pulseBg: string }> = {
                amber:    { bg: 'bg-amber-500/15', text: 'text-amber-400', border: 'border-amber-500/40', glow: 'shadow-amber-500/30', pulseBg: 'bg-amber-400' },
                cyan:     { bg: 'bg-cyan-500/15', text: 'text-cyan-400', border: 'border-cyan-500/40', glow: 'shadow-cyan-500/30', pulseBg: 'bg-cyan-400' },
                violet:   { bg: 'bg-violet-500/15', text: 'text-violet-400', border: 'border-violet-500/40', glow: 'shadow-violet-500/30', pulseBg: 'bg-violet-400' },
                orange:   { bg: 'bg-orange-500/15', text: 'text-orange-400', border: 'border-orange-500/40', glow: 'shadow-orange-500/30', pulseBg: 'bg-orange-400' },
                yellow:   { bg: 'bg-yellow-500/15', text: 'text-yellow-400', border: 'border-yellow-500/40', glow: 'shadow-yellow-500/30', pulseBg: 'bg-yellow-400' },
                emerald:  { bg: 'bg-emerald-500/15', text: 'text-emerald-400', border: 'border-emerald-500/40', glow: 'shadow-emerald-500/30', pulseBg: 'bg-emerald-400' },
                rose:     { bg: 'bg-rose-500/15', text: 'text-rose-400', border: 'border-rose-500/40', glow: 'shadow-rose-500/30', pulseBg: 'bg-rose-400' },
                lime:     { bg: 'bg-lime-500/15', text: 'text-lime-400', border: 'border-lime-500/40', glow: 'shadow-lime-500/30', pulseBg: 'bg-lime-400' },
              };
              const c = colorMap[meta?.color || 'cyan'] || colorMap.cyan;
              return (
                <motion.button
                  key={cat}
                  onClick={() => setCategory(cat)}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-300 border ${
                    isActive
                      ? `${c.bg} ${c.text} ${c.border} shadow-lg ${c.glow}`
                      : `bg-secondary/20 ${c.text}/60 border-border/15 hover:${c.bg} hover:${c.text} animate-cat-breathe`
                  }`}
                  style={{
                    ...(isActive ? {
                      boxShadow: `0 0 12px ${meta?.glowFrom}40, 0 0 24px ${meta?.glowFrom}15`,
                    } : {
                      '--cat-glow-from': `${meta?.glowFrom}15`,
                      '--cat-glow-to': `${meta?.glowTo}08`,
                      '--cat-border-rest': `${meta?.glowFrom}15`,
                      '--cat-border-active': `${meta?.glowFrom}30`,
                    } as React.CSSProperties),
                  }}
                >
                  {/* Pulse dot for active tab */}
                  {isActive && (
                    <span className="absolute -top-0.5 -right-0.5 flex h-2 w-2">
                      <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${c.pulseBg}`} />
                      <span className={`relative inline-flex rounded-full h-2 w-2 ${c.pulseBg}`} />
                    </span>
                  )}
                  <span className="text-sm">{meta?.emoji}</span>
                  <span className="hidden sm:inline">{meta?.label}</span>
                </motion.button>
              );
            })}
          </div>

          <div className="flex items-center gap-2">
            {/* Global Instrument Search */}
            <InstrumentSearch
              instruments={instruments}
              quotes={allQuotes}
              onSelect={handleInstrumentSelect}
              selectedSymbol={selectedInstrument?.symbol || null}
              category={category}
            />

            {/* Quick stats */}
            <div className="hidden sm:flex items-center gap-2">
              {instruments.slice(0, 3).map(inst => {
                const quote = quotes[inst.symbol];
                const isPositive = getVal(quote?.regularMarketChange) >= 0;
                return (
                  <Badge key={inst.id} variant="outline" className={`text-[10px] px-2 ${
                    isPositive ? 'border-emerald-500/20 text-emerald-400' : 'border-red-500/20 text-red-400'
                  }`}>
                    {inst.name} {isPositive ? '↑' : '↓'} {Math.abs(getVal(quote?.regularMarketChangePercent)).toFixed(2)}%
                  </Badge>
                );
              })}
            </div>
          </div>
        </div>

        {/* Favorites empty state */}
        {category === 'favorites' && instruments.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 rounded-full bg-amber-500/10 flex items-center justify-center mb-4">
              <Star className="w-8 h-8 text-amber-400/50" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-1">Nenhum favorito ainda</h3>
            <p className="text-sm text-muted-foreground max-w-sm">
              Clique no ícone <Star className="w-3 h-3 inline text-amber-400" /> em qualquer ativo para adicioná-lo aos seus favoritos.
              Eles aparecerão aqui para acesso rápido.
            </p>
          </div>
        )}

        {/* Performance Summary — always visible */}
        {!(category === 'favorites' && instruments.length === 0) && (
          <PerformanceSummary
            instruments={instruments}
            quotes={category === 'favorites' ? allQuotes : quotes}
            category={category}
          />
        )}

        {/* Forex Session Clock — always visible near top */}
        {!(category === 'favorites' && instruments.length === 0) && (
          <ForexSessionClock />
        )}

        {/* Layout-managed sections — rendered in order based on layout preferences */}
        {!(category === 'favorites' && instruments.length === 0) && (
        <>
          {layout.sortedSections.map(section => {
            if (!section.visible) return null;

            switch (section.id) {
              case 'priceCards':
                return (
                  <div key={section.id}>
                    <PriceCards
                      instruments={instruments}
                      quotes={category === 'favorites' ? allQuotes : quotes}
                      selectedSymbol={selectedInstrument?.symbol || null}
                      onSelect={handleInstrumentSelect}
                      favorites={favorites}
                      onToggleFavorite={toggleFavorite}
                      sparklineData={sparklineData}
                    />
                  </div>
                );

              case 'chart':
                return (
                  <ErrorBoundary key={section.id}>
                    <div ref={aiAnalysisSectionRef} className="space-y-3">
                      {/* Trade Simulation Panel */}
                      {aiAnalysis && selectedInstrument && (
                        <TradeSimulationPanel
                          analysis={aiAnalysis}
                          instrument={selectedInstrument}
                          quote={selectedInstrument ? allQuotes[selectedInstrument.symbol] : undefined}
                          allQuotes={allQuotes}
                        />
                      )}
                      {/* AI Analysis Panel */}
                      <AIAnalysisPanel
                        instrument={selectedInstrument}
                        analysis={aiAnalysis}
                        analyzing={analyzing}
                        quote={selectedInstrument ? allQuotes[selectedInstrument.symbol] : undefined}
                        onAnalyze={analyzeWithAI}
                        error={aiError}
                        strategy={strategy}
                        onStrategyChange={setStrategy}
                        comparisonResults={comparisonResults}
                        comparing={comparing}
                        onCompareAll={compareAllStrategies}
                        analysisHistory={analysisHistory}
                        onLoadHistory={loadAnalysisFromHistory}
                        viewMode={viewMode}
                        onViewModeChange={setViewMode}
                        riskRewardRatio={riskRewardRatio}
                        onRiskRewardChange={setRiskRewardRatio}
                        riskMode={riskMode}
                        onRiskModeChange={setRiskMode}
                        sentiment={marketSentiment}
                      />
                    </div>
                  </ErrorBoundary>
                );

              case 'analysis':
                // Analysis is rendered inside the chart section above (locked), skip standalone render
                return null;

              case 'heatmap':
                return (
                  <ErrorBoundary key={section.id}>
                    <div className={`grid grid-cols-1 ${layout.isVisible('calendar') ? 'lg:grid-cols-2' : ''} gap-5`}>
                      <MarketHeatmap
                        instruments={instruments}
                        quotes={category === 'favorites' ? allQuotes : quotes}
                        category={category}
                      />
                      {layout.isVisible('calendar') && <EconomicCalendar />}
                    </div>
                  </ErrorBoundary>
                );

              case 'calendar':
                // Calendar is rendered inside the heatmap section above if heatmap is visible
                // If heatmap is hidden but calendar is visible, render calendar alone
                if (layout.isVisible('heatmap')) return null;
                return (
                  <ErrorBoundary key={section.id}>
                    <div>
                      <EconomicCalendar />
                    </div>
                  </ErrorBoundary>
                );

              case 'signals':
                return (
                  <ErrorBoundary key={section.id}>
                    <div className={`grid grid-cols-1 ${layout.isVisible('news') ? 'lg:grid-cols-2' : ''} gap-5`}>
                      <MarketSignals
                        instruments={instruments}
                        quotes={category === 'favorites' ? allQuotes : quotes}
                        category={category}
                      />
                      {layout.isVisible('news') && <NewsFeed symbol={selectedInstrument?.symbol} instrumentName={selectedInstrument?.name} onSentimentChange={setMarketSentiment} />}
                    </div>
                  </ErrorBoundary>
                );

              case 'news':
                // News is rendered inside the signals section above if signals is visible
                // If signals is hidden but news is visible, render news alone
                if (layout.isVisible('signals')) return null;
                return (
                  <ErrorBoundary key={section.id}>
                    <div>
                      <NewsFeed symbol={selectedInstrument?.symbol} instrumentName={selectedInstrument?.name} onSentimentChange={setMarketSentiment} />
                    </div>
                  </ErrorBoundary>
                );

              case 'marketOverview':
                return (
                  <ErrorBoundary key={section.id}>
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
                      {categoryTabs.map((cat, i) => {
                        const meta = CATEGORY_META[cat];
                        const count = cat === 'favorites' ? (mounted ? favorites.size : 0) : getInstruments(cat).length;
                        const cardColorMap: Record<string, { bg: string; text: string; iconBg: string; border: string }> = {
                          amber:   { bg: 'bg-amber-500/5', text: 'text-amber-400', iconBg: 'bg-amber-500/15', border: 'border-amber-500/20' },
                          cyan:    { bg: 'bg-cyan-500/5', text: 'text-cyan-400', iconBg: 'bg-cyan-500/15', border: 'border-cyan-500/20' },
                          violet:  { bg: 'bg-violet-500/5', text: 'text-violet-400', iconBg: 'bg-violet-500/15', border: 'border-violet-500/20' },
                          orange:  { bg: 'bg-orange-500/5', text: 'text-orange-400', iconBg: 'bg-orange-500/15', border: 'border-orange-500/20' },
                          yellow:  { bg: 'bg-yellow-500/5', text: 'text-yellow-400', iconBg: 'bg-yellow-500/15', border: 'border-yellow-500/20' },
                          emerald: { bg: 'bg-emerald-500/5', text: 'text-emerald-400', iconBg: 'bg-emerald-500/15', border: 'border-emerald-500/20' },
                          rose:    { bg: 'bg-rose-500/5', text: 'text-rose-400', iconBg: 'bg-rose-500/15', border: 'border-rose-500/20' },
                          lime:    { bg: 'bg-lime-500/5', text: 'text-lime-400', iconBg: 'bg-lime-500/15', border: 'border-lime-500/20' },
                        };
                        const cc = cardColorMap[meta?.color || 'cyan'] || cardColorMap.cyan;
                        return (
                          <motion.div
                            key={cat}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.05 }}
                            whileHover={{ scale: 1.04 }}
                            onClick={() => setCategory(cat)}
                            className="cursor-pointer"
                          >
                            <Card className={`${cc.border} ${cc.bg} backdrop-blur-sm transition-shadow duration-300 hover:shadow-lg`}
                              style={{ boxShadow: category === cat ? `0 0 12px ${meta?.glowFrom}30` : undefined }}>
                              <CardContent className="p-3 flex items-center gap-2">
                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm ${cc.iconBg}`}>
                                  {meta?.emoji}
                                </div>
                                <div>
                                  <p className={`text-lg font-bold ${cc.text}`}>{count}</p>
                                  <p className="text-[9px] text-muted-foreground">{meta?.label}</p>
                                </div>
                              </CardContent>
                            </Card>
                          </motion.div>
                        );
                      })}
                    </div>
                  </ErrorBoundary>
                );

              case 'mt5':
                return (
                  <ErrorBoundary key={section.id}>
                    <MT5Dashboard />
                  </ErrorBoundary>
                );

              default:
                return null;
            }
          })}
        </>
        )}
        </>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-border/30 bg-card/40 mt-auto">
        <div className="max-w-[1800px] mx-auto px-4 py-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-md bg-gradient-to-br from-cyan-400 to-violet-500 flex items-center justify-center">
                <BarChart3 className="w-3 h-3 text-white" />
              </div>
              <span className="bg-gradient-to-r from-cyan-400 to-violet-400 bg-clip-text text-transparent font-bold text-xs">
                ForexAI Pro
              </span>
              <span className="text-[9px] text-muted-foreground">© 2025</span>
              {/* Subscribe button in footer — guard with mounted */}
              {mounted && !credits.isSubscribed && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowPaymentModal(true)}
                  className="text-[9px] text-cyan-400 hover:text-cyan-300 h-5 px-2"
                >
                  <CreditCard className="w-2.5 h-2.5 mr-1" /> Assinar
                </Button>
              )}
            </div>

            <div className="flex items-center gap-4 text-[9px] text-muted-foreground">
              <span className="flex items-center gap-1">
                <Zap className="w-2.5 h-2.5 text-amber-400" /> Dados em tempo real
              </span>
              <span className="flex items-center gap-1">
                <Brain className="w-2.5 h-2.5 text-violet-400" /> Análise por IA
              </span>
              <span className="flex items-center gap-1">
                <Shield className="w-2.5 h-2.5 text-cyan-400" /> API Finance
              </span>
              {/* Live Visitor Counter — guard with mounted */}
              {mounted && (
              <span className="flex items-center gap-1">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
                </span>
                <Users className="w-2.5 h-2.5 text-emerald-400" />
                <span className="text-emerald-400 font-mono tabular-nums">{visitorCount} pessoas online</span>
              </span>
              )}
            </div>

            <div className="text-[9px] text-muted-foreground/60 text-center sm:text-right">
              <p>Dados: Yahoo Finance via API. Análise gerada por IA.</p>
              <p className="mt-0.5">
                <button onClick={() => setShowUserManual(true)} className="text-cyan-400 hover:text-cyan-300 transition-colors font-medium">
                  Manual de Uso
                </button>
                {' · '}
                <Link href="/faq" className="text-muted-foreground hover:text-cyan-400 transition-colors">FAQ</Link>
                {' · '}
                <Link href="/termos" className="text-muted-foreground hover:text-cyan-400 transition-colors">Termos de Uso</Link>
                {' · '}
                <Link href="/privacidade" className="text-muted-foreground hover:text-cyan-400 transition-colors">Privacidade</Link>
                {' · '}
                <Link href="/depoimentos" className="text-muted-foreground hover:text-cyan-400 transition-colors">Depoimentos</Link>
              </p>
              <p>Não constitui aconselhamento financeiro. Investir envolve riscos.</p>
            </div>
          </div>
        </div>
      </footer>

    </div>
  );
}
