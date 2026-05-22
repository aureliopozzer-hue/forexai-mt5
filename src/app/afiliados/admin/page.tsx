'use client';

import { useState, useEffect } from 'react';
import { Eye, EyeOff, RefreshCw, Users, DollarSign, TrendingUp, ShoppingBag } from 'lucide-react';

/* ──────────────── Types ──────────────── */

interface Affiliate {
  id: string;
  email: string;
  name: string;
  referralCode: string;
  status: 'active' | 'pending' | 'suspended';
  totalEarned: number;
  totalPaid: number;
  balance: number;
  clicks: number;
  conversions: number;
  createdAt: string;
}

interface Sale {
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

interface AdminData {
  affiliates: Affiliate[];
  sales: Sale[];
}

/* ──────────────── Helpers ──────────────── */

function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatDate(iso: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function isHoldPeriodOver(holdUntil: string): boolean {
  if (!holdUntil) return true;
  return new Date(holdUntil) <= new Date();
}

/* ──────────────── Badge Component ──────────────── */

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; classes: string }> = {
    active: { label: 'Ativo', classes: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' },
    pending: { label: 'Pendente', classes: 'bg-amber-500/15 text-amber-400 border-amber-500/30' },
    suspended: { label: 'Suspenso', classes: 'bg-red-500/15 text-red-400 border-red-500/30' },
    approved: { label: 'Aprovado', classes: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30' },
    paid: { label: 'Pago', classes: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' },
    cancelled: { label: 'Cancelado', classes: 'bg-red-500/15 text-red-400 border-red-500/30' },
  };
  const cfg = map[status] ?? { label: status, classes: 'bg-gray-500/15 text-gray-400 border-gray-500/30' };
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${cfg.classes}`}>
      {cfg.label}
    </span>
  );
}

/* ══════════════════════════════════════════════════════════
   Main Page
   ══════════════════════════════════════════════════════════ */

export default function AffiliateAdminPage() {
  /* ── Auth state ── */
  const [email, setEmail] = useState('aureliopozzer@gmail.com');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  /* ── Data state ── */
  const [data, setData] = useState<AdminData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [markingId, setMarkingId] = useState<string | null>(null);

  /* ── Active tab ── */
  const [activeTab, setActiveTab] = useState<'affiliates' | 'sales'>('affiliates');

  /* ──────────────── Fetch data ──────────────── */

  const fetchData = async (em: string, pw: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/affiliate/admin?email=${encodeURIComponent(em)}&password=${encodeURIComponent(pw)}`);
      const json = await res.json();
      if (!json.success) {
        setError(json.error || 'Erro ao carregar dados.');
        if (res.status === 401) setIsLoggedIn(false);
        return;
      }
      setData(json.data);
      setIsLoggedIn(true);
    } catch {
      setError('Erro de conexão com o servidor.');
    } finally {
      setLoading(false);
    }
  };

  /* ──────────────── Login handler ──────────────── */

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    fetchData(email, password);
  };

  /* ──────────────── Refresh ──────────────── */

  const handleRefresh = () => {
    if (isLoggedIn && email && password) fetchData(email, password);
  };

  /* ──────────────── Mark as paid ──────────────── */

  const handleMarkPaid = async (saleId: string) => {
    setMarkingId(saleId);
    try {
      const res = await fetch('/api/affiliate/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, action: 'mark_paid', saleId }),
      });
      const json = await res.json();
      if (json.success) {
        // Optimistically update local state
        setData(prev => {
          if (!prev) return prev;
          return {
            ...prev,
            sales: prev.sales.map(s => (s.id === saleId ? { ...s, status: 'paid' as const, paidAt: new Date().toISOString() } : s)),
          };
        });
      }
    } catch {
      // Silently fail — user can refresh
    } finally {
      setMarkingId(null);
    }
  };

  /* ──────────────── Computed stats ──────────────── */

  const totalAffiliates = data?.affiliates.length ?? 0;
  const totalSales = data?.sales.length ?? 0;
  const pendingCommissions = data?.sales.filter(s => s.status === 'pending').reduce((sum, s) => sum + s.commission, 0) ?? 0;
  const paidCommissions = data?.sales.filter(s => s.status === 'paid').reduce((sum, s) => sum + s.commission, 0) ?? 0;

  /* ════════════════════════════════════════════════════════
     Render — Login Gate
     ════════════════════════════════════════════════════════ */

  if (!isLoggedIn) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="w-full max-w-md">
          {/* Logo / Title */}
          <div className="mb-8 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-cyan-500/10 ring-1 ring-cyan-500/30">
              <svg viewBox="0 0 24 24" className="h-7 w-7 text-cyan-400" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M12 2L2 7l10 5 10-5-10-5z" />
                <path d="M2 17l10 5 10-5" />
                <path d="M2 12l10 5 10-5" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-foreground">ForexAI Pro</h1>
            <p className="mt-1 text-sm text-muted-foreground">Painel Administrativo — Afiliados</p>
          </div>

          {/* Login Form */}
          <form onSubmit={handleLogin} className="rounded-xl border border-border bg-card p-6 shadow-lg shadow-black/20">
            {error && (
              <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                {error}
              </div>
            )}

            {/* Email */}
            <div className="mb-4">
              <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-foreground">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-cyan-500/50 focus:outline-none focus:ring-1 focus:ring-cyan-500/30"
                placeholder="admin@email.com"
                autoComplete="email"
              />
            </div>

            {/* Password */}
            <div className="mb-6">
              <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-foreground">
                Senha
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2.5 pr-10 text-sm text-foreground placeholder:text-muted-foreground focus:border-cyan-500/50 focus:outline-none focus:ring-1 focus:ring-cyan-500/30"
                  placeholder="••••••••"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground"
                  tabIndex={-1}
                  aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center rounded-lg bg-cyan-500 px-4 py-2.5 text-sm font-semibold text-background transition-colors hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                'Entrar'
              )}
            </button>
          </form>
        </div>
      </div>
    );
  }

  /* ════════════════════════════════════════════════════════
     Render — Dashboard
     ════════════════════════════════════════════════════════ */

  return (
    <div className="min-h-screen bg-background px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        {/* ── Header ── */}
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-bold text-foreground sm:text-2xl">Painel de Afiliados</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">ForexAI Pro — Administração</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleRefresh}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-secondary disabled:opacity-60"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Atualizar
            </button>
            <button
              onClick={() => { setIsLoggedIn(false); setData(null); setPassword(''); }}
              className="inline-flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm font-medium text-red-400 transition-colors hover:bg-red-500/20"
            >
              Sair
            </button>
          </div>
        </div>

        {/* ── Stats Cards ── */}
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
          <StatCard
            icon={<Users className="h-5 w-5" />}
            label="Total Afiliados"
            value={totalAffiliates.toString()}
            color="cyan"
          />
          <StatCard
            icon={<ShoppingBag className="h-5 w-5" />}
            label="Total Vendas"
            value={totalSales.toString()}
            color="amber"
          />
          <StatCard
            icon={<TrendingUp className="h-5 w-5" />}
            label="Comissões Pendentes"
            value={formatCurrency(pendingCommissions)}
            color="amber"
          />
          <StatCard
            icon={<DollarSign className="h-5 w-5" />}
            label="Comissões Pagas"
            value={formatCurrency(paidCommissions)}
            color="emerald"
          />
        </div>

        {/* ── Tab Switcher ── */}
        <div className="mb-4 flex gap-1 rounded-lg border border-border bg-card p-1">
          <button
            onClick={() => setActiveTab('affiliates')}
            className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === 'affiliates'
                ? 'bg-cyan-500/15 text-cyan-400'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Afiliados
          </button>
          <button
            onClick={() => setActiveTab('sales')}
            className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === 'sales'
                ? 'bg-cyan-500/15 text-cyan-400'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Vendas
          </button>
        </div>

        {/* ── Affiliates Table ── */}
        {activeTab === 'affiliates' && (
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-secondary/50">
                    <th className="whitespace-nowrap px-4 py-3 text-left font-medium text-muted-foreground">Nome</th>
                    <th className="whitespace-nowrap px-4 py-3 text-left font-medium text-muted-foreground">Email</th>
                    <th className="whitespace-nowrap px-4 py-3 text-left font-medium text-muted-foreground">Código</th>
                    <th className="whitespace-nowrap px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
                    <th className="whitespace-nowrap px-4 py-3 text-right font-medium text-muted-foreground">Cliques</th>
                    <th className="whitespace-nowrap px-4 py-3 text-right font-medium text-muted-foreground">Conversões</th>
                    <th className="whitespace-nowrap px-4 py-3 text-right font-medium text-muted-foreground">Ganho Total</th>
                    <th className="whitespace-nowrap px-4 py-3 text-right font-medium text-muted-foreground">Saldo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {data?.affiliates.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">
                        Nenhum afiliado cadastrado.
                      </td>
                    </tr>
                  )}
                  {data?.affiliates.map(af => (
                    <tr key={af.id} className="transition-colors hover:bg-secondary/30">
                      <td className="whitespace-nowrap px-4 py-3 font-medium text-foreground">{af.name}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">{af.email}</td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <code className="rounded bg-secondary px-1.5 py-0.5 text-xs text-cyan-400">{af.referralCode}</code>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3"><StatusBadge status={af.status} /></td>
                      <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-foreground">{af.clicks}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-foreground">{af.conversions}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-emerald-400">{formatCurrency(af.totalEarned)}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-cyan-400">{formatCurrency(af.balance)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── Sales Table ── */}
        {activeTab === 'sales' && (
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-secondary/50">
                    <th className="whitespace-nowrap px-4 py-3 text-left font-medium text-muted-foreground">Afiliado</th>
                    <th className="whitespace-nowrap px-4 py-3 text-left font-medium text-muted-foreground">Email Referido</th>
                    <th className="whitespace-nowrap px-4 py-3 text-left font-medium text-muted-foreground">Plano</th>
                    <th className="whitespace-nowrap px-4 py-3 text-right font-medium text-muted-foreground">Valor</th>
                    <th className="whitespace-nowrap px-4 py-3 text-right font-medium text-muted-foreground">Comissão</th>
                    <th className="whitespace-nowrap px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
                    <th className="whitespace-nowrap px-4 py-3 text-left font-medium text-muted-foreground">Data</th>
                    <th className="whitespace-nowrap px-4 py-3 text-center font-medium text-muted-foreground">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {data?.sales.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">
                        Nenhuma venda registrada.
                      </td>
                    </tr>
                  )}
                  {data?.sales.map(sale => {
                    const affiliate = data?.affiliates.find(a => a.id === sale.affiliateId);
                    const canMarkPaid = sale.status === 'pending' && isHoldPeriodOver(sale.holdUntil);
                    return (
                      <tr key={sale.id} className="transition-colors hover:bg-secondary/30">
                        <td className="whitespace-nowrap px-4 py-3 font-medium text-foreground">
                          {affiliate?.name ?? '—'}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">{sale.referredEmail}</td>
                        <td className="whitespace-nowrap px-4 py-3">
                          <span className="rounded bg-secondary px-2 py-0.5 text-xs text-foreground">{sale.plan}</span>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-foreground">{formatCurrency(sale.amount)}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-emerald-400">{formatCurrency(sale.commission)}</td>
                        <td className="whitespace-nowrap px-4 py-3"><StatusBadge status={sale.status} /></td>
                        <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">{formatDate(sale.createdAt)}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-center">
                          {canMarkPaid ? (
                            <button
                              onClick={() => handleMarkPaid(sale.id)}
                              disabled={markingId === sale.id}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-400 transition-colors hover:bg-emerald-500/20 disabled:opacity-50"
                            >
                              {markingId === sale.id ? (
                                <RefreshCw className="h-3 w-3 animate-spin" />
                              ) : (
                                <DollarSign className="h-3 w-3" />
                              )}
                              Marcar como Pago
                            </button>
                          ) : sale.status === 'pending' ? (
                            <span className="text-xs text-muted-foreground" title={`Disponível após ${formatDate(sale.holdUntil)}`}>
                              Aguardando ({formatDate(sale.holdUntil)})
                            </span>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ──────────────── Stat Card ──────────────── */

function StatCard({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  color: 'cyan' | 'emerald' | 'amber' | 'red';
}) {
  const colorMap = {
    cyan: 'text-cyan-400 bg-cyan-500/10 ring-cyan-500/20',
    emerald: 'text-emerald-400 bg-emerald-500/10 ring-emerald-500/20',
    amber: 'text-amber-400 bg-amber-500/10 ring-amber-500/20',
    red: 'text-red-400 bg-red-500/10 ring-red-500/20',
  };
  const iconColorMap = {
    cyan: 'text-cyan-400',
    emerald: 'text-emerald-400',
    amber: 'text-amber-400',
    red: 'text-red-400',
  };

  return (
    <div className="rounded-xl border border-border bg-card p-4 sm:p-5">
      <div className="mb-3 flex items-center gap-3">
        <div className={`flex h-9 w-9 items-center justify-center rounded-lg ring-1 ${colorMap[color]}`}>
          <span className={iconColorMap[color]}>{icon}</span>
        </div>
        <span className="text-xs font-medium text-muted-foreground sm:text-sm">{label}</span>
      </div>
      <p className="text-lg font-bold text-foreground sm:text-xl">{value}</p>
    </div>
  );
}
