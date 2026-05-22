'use client';

import { useState } from 'react';
import { Copy, LogOut, DollarSign, MousePointer, TrendingUp, Users } from 'lucide-react';

// ── Types ────────────────────────────────────────────────────────

interface AffiliateInfo {
  id: string;
  email: string;
  name: string;
  referralCode: string;
  status: string;
  pixKey: string;
  pixType: string;
  totalEarned: number;
  totalPaid: number;
  balance: number;
  clicks: number;
  conversions: number;
  createdAt: string;
}

interface SaleInfo {
  id: string;
  affiliateId: string;
  referredEmail: string;
  plan: string;
  amount: number;
  commission: number;
  status: 'pending' | 'approved' | 'paid' | 'cancelled';
  holdUntil: string;
  paidAt: string | null;
  createdAt: string;
}

interface DashboardData {
  affiliate: AffiliateInfo;
  sales: SaleInfo[];
}

// ── Helpers ──────────────────────────────────────────────────────

function formatBRL(value: number): string {
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

function formatDate(iso: string): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}

// ── Status Badge ─────────────────────────────────────────────────

function StatusBadge({ status }: { status: SaleInfo['status'] }) {
  const config: Record<string, { label: string; classes: string }> = {
    pending: {
      label: 'Pendente 14d',
      classes: 'bg-amber-400/15 text-amber-400 border-amber-400/30',
    },
    approved: {
      label: 'Aprovado',
      classes: 'bg-cyan-400/15 text-cyan-400 border-cyan-400/30',
    },
    paid: {
      label: 'Pago',
      classes: 'bg-emerald-400/15 text-emerald-400 border-emerald-400/30',
    },
    cancelled: {
      label: 'Cancelado',
      classes: 'bg-red-400/15 text-red-400 border-red-400/30',
    },
  };

  const { label, classes } = config[status] ?? {
    label: status,
    classes: 'bg-gray-400/15 text-gray-400 border-gray-400/30',
  };

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${classes}`}
    >
      {label}
    </span>
  );
}

// ── Copy Button ──────────────────────────────────────────────────

function CopyButton({ text, label }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for insecure contexts
      const textarea = document.createElement('textarea');
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <button
      onClick={handleCopy}
      className="inline-flex items-center gap-1.5 rounded-lg bg-white/5 px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-white/10 active:scale-95"
      title={copied ? 'Copiado!' : `Copiar ${label ?? ''}`}
    >
      <Copy className="h-3.5 w-3.5" />
      {copied ? (
        <span className="text-emerald-400">Copiado!</span>
      ) : (
        <span>Copiar</span>
      )}
    </button>
  );
}

// ── Main Page ────────────────────────────────────────────────────

export default function AffiliateDashboardPage() {
  const [email, setEmail] = useState('');
  const [affiliateId, setAffiliateId] = useState<string | null>(null);
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Login ────────────────────────────────────────

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch('/api/affiliate/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });

      const data = await res.json();

      if (!data.success) {
        setError(data.error || 'Erro ao fazer login.');
        return;
      }

      const id: string = data.affiliate.id;
      setAffiliateId(id);

      // Fetch dashboard data
      const dashRes = await fetch(`/api/affiliate/dashboard?affiliateId=${encodeURIComponent(id)}`);
      const dashData = await dashRes.json();

      if (!dashData.success) {
        setError(dashData.error || 'Erro ao carregar dashboard.');
        return;
      }

      setDashboard(dashData.data);
    } catch {
      setError('Erro de conexão. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  // ── Refresh Dashboard ────────────────────────────

  const refreshDashboard = async () => {
    if (!affiliateId) return;
    try {
      const res = await fetch(`/api/affiliate/dashboard?affiliateId=${encodeURIComponent(affiliateId)}`);
      const data = await res.json();
      if (data.success) {
        setDashboard(data.data);
      }
    } catch {
      // silent
    }
  };

  // ── Logout ───────────────────────────────────────

  const handleLogout = () => {
    setAffiliateId(null);
    setDashboard(null);
    setEmail('');
    setError(null);
  };

  // ── Render: Login Form ───────────────────────────

  if (!dashboard) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0a0e1a] px-4">
        <div className="w-full max-w-md">
          {/* Logo / Header */}
          <div className="mb-8 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-emerald-400/10 ring-1 ring-emerald-400/20">
              <TrendingUp className="h-7 w-7 text-emerald-400" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">
              Painel do Afiliado
            </h1>
            <p className="mt-2 text-sm text-foreground/60">
              Acesse seu dashboard de afiliado ForexAI Pro Elite
            </p>
          </div>

          {/* Login Card */}
          <div className="rounded-2xl border border-border bg-card p-6 shadow-2xl shadow-black/40">
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label
                  htmlFor="email"
                  className="mb-1.5 block text-sm font-medium text-foreground/80"
                >
                  Email do Afiliado
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  className="w-full rounded-lg border border-border bg-[#111827] px-4 py-3 text-sm text-foreground placeholder:text-foreground/30 focus:border-emerald-400/50 focus:outline-none focus:ring-1 focus:ring-emerald-400/30 transition-colors"
                />
              </div>

              {error && (
                <div className="rounded-lg border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-400">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-lg bg-emerald-400 px-4 py-3 text-sm font-semibold text-[#0a0e1a] transition-all hover:bg-emerald-300 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? (
                  <span className="inline-flex items-center gap-2">
                    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Entrando...
                  </span>
                ) : (
                  'Entrar'
                )}
              </button>
            </form>
          </div>

          <p className="mt-6 text-center text-xs text-foreground/40">
            ForexAI Pro Elite &mdash; Programa de Afiliados
          </p>
        </div>
      </div>
    );
  }

  // ── Render: Dashboard ────────────────────────────

  const { affiliate, sales } = dashboard;
  const referralLink = `https://forexaiproelite.vercel.app/api/affiliate/track?ref=${affiliate.referralCode}`;

  const stats = [
    {
      label: 'Saldo Disponível',
      value: formatBRL(affiliate.balance),
      icon: DollarSign,
      color: 'text-emerald-400',
      bg: 'bg-emerald-400/10',
      ring: 'ring-emerald-400/20',
    },
    {
      label: 'Total Ganho',
      value: formatBRL(affiliate.totalEarned),
      icon: TrendingUp,
      color: 'text-cyan-400',
      bg: 'bg-cyan-400/10',
      ring: 'ring-cyan-400/20',
    },
    {
      label: 'Total Pago',
      value: formatBRL(affiliate.totalPaid),
      icon: DollarSign,
      color: 'text-emerald-400',
      bg: 'bg-emerald-400/10',
      ring: 'ring-emerald-400/20',
    },
    {
      label: 'Cliques',
      value: affiliate.clicks.toLocaleString('pt-BR'),
      icon: MousePointer,
      color: 'text-amber-400',
      bg: 'bg-amber-400/10',
      ring: 'ring-amber-400/20',
    },
    {
      label: 'Conversões',
      value: affiliate.conversions.toLocaleString('pt-BR'),
      icon: Users,
      color: 'text-cyan-400',
      bg: 'bg-cyan-400/10',
      ring: 'ring-cyan-400/20',
    },
  ];

  return (
    <div className="min-h-screen bg-[#0a0e1a] text-foreground">
      {/* ── Top Bar ────────────────────────────── */}
      <header className="sticky top-0 z-30 border-b border-border bg-[#0a0e1a]/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-400/10 ring-1 ring-emerald-400/20">
              <TrendingUp className="h-5 w-5 text-emerald-400" />
            </div>
            <div>
              <h1 className="text-sm font-bold leading-tight sm:text-base">
                Painel do Afiliado
              </h1>
              <p className="text-xs text-foreground/50">{affiliate.name}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={refreshDashboard}
              className="rounded-lg bg-white/5 px-3 py-2 text-xs font-medium text-foreground/70 transition-colors hover:bg-white/10 hover:text-foreground"
            >
              Atualizar
            </button>
            <button
              onClick={handleLogout}
              className="inline-flex items-center gap-1.5 rounded-lg bg-red-400/10 px-3 py-2 text-xs font-semibold text-red-400 transition-colors hover:bg-red-400/20 active:scale-95"
            >
              <LogOut className="h-3.5 w-3.5" />
              Sair
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6 sm:py-8">
        {/* ── Affiliate Info Card ─────────────── */}
        <section className="rounded-2xl border border-border bg-card p-5 sm:p-6">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-foreground/50">
            Suas Informações
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {/* Name & Email */}
            <div className="space-y-2">
              <div>
                <span className="text-xs text-foreground/40">Nome</span>
                <p className="text-sm font-medium">{affiliate.name}</p>
              </div>
              <div>
                <span className="text-xs text-foreground/40">Email</span>
                <p className="text-sm font-medium">{affiliate.email}</p>
              </div>
              <div>
                <span className="text-xs text-foreground/40">Chave PIX</span>
                <p className="text-sm font-medium">
                  {affiliate.pixKey || '—'}{' '}
                  {affiliate.pixKey && (
                    <span className="text-foreground/30">({affiliate.pixType})</span>
                  )}
                </p>
              </div>
            </div>

            {/* Referral Code */}
            <div className="space-y-3">
              <div>
                <span className="text-xs text-foreground/40">
                  Código de Referência
                </span>
                <div className="mt-1 flex items-center gap-2">
                  <code className="rounded-lg bg-emerald-400/10 px-4 py-2.5 text-lg font-bold tracking-widest text-emerald-400 ring-1 ring-emerald-400/20">
                    {affiliate.referralCode}
                  </code>
                  <CopyButton text={affiliate.referralCode} label="código" />
                </div>
              </div>

              <div>
                <span className="text-xs text-foreground/40">
                  Link de Referência
                </span>
                <div className="mt-1 flex items-center gap-2">
                  <code className="min-w-0 flex-1 truncate rounded-lg bg-white/5 px-3 py-2 text-xs text-foreground/70">
                    {referralLink}
                  </code>
                  <CopyButton text={referralLink} label="link" />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Stats Cards ─────────────────────── */}
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="rounded-xl border border-border bg-card p-4 transition-colors hover:border-foreground/10"
            >
              <div className="mb-3 flex items-center justify-between">
                <span className="text-xs font-medium text-foreground/50">
                  {stat.label}
                </span>
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-lg ${stat.bg} ring-1 ${stat.ring}`}
                >
                  <stat.icon className={`h-4 w-4 ${stat.color}`} />
                </div>
              </div>
              <p className={`text-xl font-bold ${stat.color}`}>
                {stat.value}
              </p>
            </div>
          ))}
        </section>

        {/* ── Sales History ───────────────────── */}
        <section className="rounded-2xl border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border px-5 py-4 sm:px-6">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-foreground/50">
              Histórico de Vendas
            </h2>
            <span className="rounded-full bg-white/5 px-2.5 py-0.5 text-xs text-foreground/50">
              {sales.length} {sales.length === 1 ? 'venda' : 'vendas'}
            </span>
          </div>

          {sales.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-foreground/30">
              <Users className="mb-3 h-10 w-10" />
              <p className="text-sm font-medium">Nenhuma venda registrada</p>
              <p className="mt-1 text-xs">
                Compartilhe seu link de referência para começar a ganhar
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs font-medium text-foreground/40">
                    <th className="px-5 py-3 sm:px-6">Email Referido</th>
                    <th className="px-5 py-3">Plano</th>
                    <th className="px-5 py-3">Valor</th>
                    <th className="px-5 py-3">Comissão (R$)</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3 sm:px-6">Data</th>
                  </tr>
                </thead>
                <tbody>
                  {sales.map((sale) => (
                    <tr
                      key={sale.id}
                      className="border-b border-border/50 transition-colors hover:bg-white/[0.02]"
                    >
                      <td className="px-5 py-3.5 sm:px-6">
                        <span className="font-medium text-foreground/80">
                          {sale.referredEmail
                            ? sale.referredEmail.replace(/(.{2})(.*)(@.*)/, '$1***$3')
                            : '—'}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-foreground/70">
                        {sale.plan || '—'}
                      </td>
                      <td className="px-5 py-3.5 text-foreground/70">
                        {formatBRL(sale.amount)}
                      </td>
                      <td className="px-5 py-3.5 font-semibold text-emerald-400">
                        {formatBRL(sale.commission)}
                      </td>
                      <td className="px-5 py-3.5">
                        <StatusBadge status={sale.status} />
                      </td>
                      <td className="px-5 py-3.5 text-foreground/50 sm:px-6">
                        {formatDate(sale.createdAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* ── Info Note ───────────────────────── */}
        <section className="rounded-2xl border border-amber-400/20 bg-amber-400/5 p-5 sm:p-6">
          <div className="flex gap-3">
            <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-400/10">
              <svg
                className="h-4 w-4 text-amber-400"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
                />
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-amber-400">
                Período de Carência e Pagamentos
              </h3>
              <p className="mt-1 text-sm leading-relaxed text-foreground/60">
                Todas as comissões possuem um{' '}
                <strong className="text-amber-400">período de carência de 14 dias</strong>{' '}
                antes de serem aprovadas. Isso garante a segurança contra
                cancelamentos e reembolsos. Após a aprovação, os pagamentos são
                realizados via <strong className="text-foreground/80">PIX</strong>{' '}
                na chave cadastrada. O saldo disponível reflete comissões já
                aprovadas e prontas para saque.
              </p>
            </div>
          </div>
        </section>
      </main>

      {/* ── Footer ──────────────────────────────── */}
      <footer className="mt-auto border-t border-border bg-[#0a0e1a] py-6 text-center">
        <p className="text-xs text-foreground/30">
          ForexAI Pro Elite &mdash; Programa de Afiliados &copy; {new Date().getFullYear()}
        </p>
      </footer>
    </div>
  );
}
