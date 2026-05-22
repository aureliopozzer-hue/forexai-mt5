'use client';

import { useState } from 'react';
import {
  DollarSign,
  Zap,
  Wallet,
  Link2,
  BarChart3,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ArrowRight,
  Brain,
  Shield,
} from 'lucide-react';

// ─── Benefits data ────────────────────────────────────────────────
const benefits = [
  {
    icon: DollarSign,
    title: '20% Comissão',
    description: 'Ganhe 20% de comissão em cada venda realizada através do seu link de afiliado.',
  },
  {
    icon: Zap,
    title: 'Auto-aprovação',
    description: 'Sua conta é ativada automaticamente após o cadastro. Sem espera, sem burocracia.',
  },
  {
    icon: Wallet,
    title: 'Pagamento via PIX',
    description: 'Receba seus ganhos diretamente na sua chave PIX, de forma rápida e segura.',
  },
  {
    icon: Link2,
    title: 'Link personalizado',
    description: 'Receba um link único de afiliado para compartilhar e rastrear suas indicações.',
  },
  {
    icon: BarChart3,
    title: 'Dashboard em tempo real',
    description: 'Acompanhe cliques, conversões e ganhos em tempo real pelo painel exclusivo.',
  },
];

// ─── PIX type options ─────────────────────────────────────────────
const pixTypeOptions = [
  { value: 'CPF', label: 'CPF' },
  { value: 'CNPJ', label: 'CNPJ' },
  { value: 'Email', label: 'Email' },
  { value: 'Telefone', label: 'Telefone' },
  { value: 'Chave Aleatória', label: 'Chave Aleatória' },
];

// ─── Main Page Component ──────────────────────────────────────────
export default function AfiliadosPage() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    pixType: '',
    pixKey: '',
  });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [referralCode, setReferralCode] = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (error) setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess(false);

    if (!formData.name || !formData.email || !formData.pixType || !formData.pixKey) {
      setError('Todos os campos são obrigatórios.');
      setLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/affiliate/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          pixType: formData.pixType,
          pixKey: formData.pixKey,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.error || 'Erro ao realizar cadastro. Tente novamente.');
        setLoading(false);
        return;
      }

      setReferralCode(data.affiliate?.referralCode || '');
      setSuccess(true);
    } catch {
      setError('Erro de conexão. Verifique sua internet e tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#050510] text-white">
      {/* ─── NAVBAR ─── */}
      <nav className="sticky top-0 z-50 backdrop-blur-xl bg-[#050510]/80 border-b border-white/[0.04]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <a href="/" className="flex items-center gap-2.5 group">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500 to-violet-500 flex items-center justify-center">
              <Brain className="w-4.5 h-4.5 text-white" />
            </div>
            <span className="text-lg font-bold tracking-tight">ForexAI Pro</span>
          </a>
          <a
            href="/afiliados/dashboard"
            className="px-4 py-2 rounded-full bg-white/[0.06] border border-white/[0.1] text-sm font-medium hover:bg-white/[0.1] hover:border-white/[0.15] transition-all duration-300 flex items-center gap-2"
          >
            <BarChart3 className="w-4 h-4" />
            <span className="hidden sm:inline">Dashboard</span>
          </a>
        </div>
      </nav>

      {/* ─── MAIN CONTENT ─── */}
      <main className="flex-1">
        {/* ─── HERO / HEADER ─── */}
        <section className="relative py-16 sm:py-24 px-4 sm:px-6 overflow-hidden">
          {/* Background glow */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] rounded-full bg-cyan-500/[0.07] blur-[120px] pointer-events-none" />
          <div className="absolute bottom-0 right-0 w-[400px] h-[300px] rounded-full bg-violet-500/[0.06] blur-[100px] pointer-events-none" />

          <div className="relative z-10 max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-cyan-500/10 border border-cyan-500/20 mb-6">
              <DollarSign className="w-3.5 h-3.5 text-cyan-400" />
              <span className="text-xs font-medium text-cyan-400 tracking-wide">PROGRAMA DE AFILIADOS</span>
            </div>

            <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight leading-[1.1] mb-5">
              <span className="bg-gradient-to-b from-white via-white to-gray-500 bg-clip-text text-transparent">
                Seja um Afiliado
              </span>
              <br />
              <span className="bg-gradient-to-r from-cyan-400 via-cyan-300 to-violet-400 bg-clip-text text-transparent">
                ForexAI Pro
              </span>
            </h1>

            <p className="text-base sm:text-lg text-gray-400 max-w-xl mx-auto leading-relaxed">
              Ganhe <span className="text-cyan-400 font-semibold">20% de comissão</span> em cada venda realizada
              através do seu link. Cadastro gratuito e aprovação automática.
            </p>
          </div>
        </section>

        {/* ─── REGISTRATION + BENEFITS ─── */}
        <section className="relative px-4 sm:px-6 pb-20">
          <div className="max-w-6xl mx-auto">
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
              {/* ─── FORM CARD ─── */}
              <div className="lg:col-span-3">
                <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-sm p-6 sm:p-8">
                  <h2 className="text-xl sm:text-2xl font-bold mb-1">Cadastro de Afiliado</h2>
                  <p className="text-sm text-gray-400 mb-8">
                    Preencha os campos abaixo para criar sua conta de afiliado.
                  </p>

                  {/* Success State */}
                  {success ? (
                    <div className="flex flex-col items-center justify-center py-10 text-center">
                      <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center mb-5">
                        <CheckCircle2 className="w-8 h-8 text-emerald-400" />
                      </div>
                      <h3 className="text-2xl font-bold text-white mb-2">Cadastro realizado!</h3>
                      <p className="text-gray-400 max-w-md mb-2">
                        Sua conta de afiliado está <span className="text-emerald-400 font-semibold">ativa</span> e
                        pronta para uso. Acesse o dashboard para obter seu link de indicação.
                      </p>
                      {referralCode && (
                        <div className="mt-4 px-4 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08]">
                          <span className="text-xs text-gray-500">Seu código: </span>
                          <span className="text-cyan-400 font-mono font-bold">{referralCode}</span>
                        </div>
                      )}
                      <a
                        href="/afiliados/dashboard"
                        className="mt-8 inline-flex items-center gap-2 px-6 py-3 rounded-full bg-gradient-to-r from-cyan-500 to-violet-500 text-white font-semibold shadow-lg shadow-cyan-500/20 hover:shadow-cyan-500/40 transition-shadow duration-300"
                      >
                        Acessar Dashboard
                        <ArrowRight className="w-5 h-5" />
                      </a>
                    </div>
                  ) : (
                    <form onSubmit={handleSubmit} className="space-y-5">
                      {/* Name */}
                      <div>
                        <label htmlFor="name" className="block text-sm font-medium text-gray-300 mb-1.5">
                          Nome completo
                        </label>
                        <input
                          type="text"
                          id="name"
                          name="name"
                          value={formData.name}
                          onChange={handleChange}
                          placeholder="Seu nome completo"
                          required
                          className="w-full px-4 py-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white placeholder:text-gray-500 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/25 transition-all duration-200 text-sm"
                        />
                      </div>

                      {/* Email */}
                      <div>
                        <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-1.5">
                          Email
                        </label>
                        <input
                          type="email"
                          id="email"
                          name="email"
                          value={formData.email}
                          onChange={handleChange}
                          placeholder="seu@email.com"
                          required
                          className="w-full px-4 py-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white placeholder:text-gray-500 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/25 transition-all duration-200 text-sm"
                        />
                      </div>

                      {/* PIX Type + PIX Key */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {/* PIX Type */}
                        <div>
                          <label htmlFor="pixType" className="block text-sm font-medium text-gray-300 mb-1.5">
                            Tipo da Chave PIX
                          </label>
                          <select
                            id="pixType"
                            name="pixType"
                            value={formData.pixType}
                            onChange={handleChange}
                            required
                            className="w-full px-4 py-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/25 transition-all duration-200 text-sm appearance-none cursor-pointer"
                            style={{
                              backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`,
                              backgroundRepeat: 'no-repeat',
                              backgroundPosition: 'right 12px center',
                            }}
                          >
                            <option value="" disabled className="bg-[#111827] text-gray-400">
                              Selecione o tipo
                            </option>
                            {pixTypeOptions.map((opt) => (
                              <option key={opt.value} value={opt.value} className="bg-[#111827] text-white">
                                {opt.label}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* PIX Key */}
                        <div>
                          <label htmlFor="pixKey" className="block text-sm font-medium text-gray-300 mb-1.5">
                            Chave PIX
                          </label>
                          <input
                            type="text"
                            id="pixKey"
                            name="pixKey"
                            value={formData.pixKey}
                            onChange={handleChange}
                            placeholder="Sua chave PIX"
                            required
                            className="w-full px-4 py-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white placeholder:text-gray-500 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/25 transition-all duration-200 text-sm"
                          />
                        </div>
                      </div>

                      {/* Error Message */}
                      {error && (
                        <div className="flex items-start gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/20">
                          <AlertCircle className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" />
                          <p className="text-sm text-red-300">{error}</p>
                        </div>
                      )}

                      {/* Submit Button */}
                      <button
                        type="submit"
                        disabled={loading}
                        className="w-full flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-gradient-to-r from-cyan-500 to-violet-500 text-white font-semibold text-base shadow-lg shadow-cyan-500/20 hover:shadow-cyan-500/40 disabled:opacity-60 disabled:cursor-not-allowed transition-all duration-300"
                      >
                        {loading ? (
                          <>
                            <Loader2 className="w-5 h-5 animate-spin" />
                            Cadastrando...
                          </>
                        ) : (
                          <>
                            Cadastrar como Afiliado
                            <ArrowRight className="w-5 h-5" />
                          </>
                        )}
                      </button>

                      {/* Login Link */}
                      <p className="text-center text-sm text-gray-500">
                        Já é afiliado?{' '}
                        <a
                          href="/afiliados/dashboard"
                          className="text-cyan-400 hover:text-cyan-300 font-medium transition-colors duration-200"
                        >
                          Acesse o dashboard
                        </a>
                      </p>
                    </form>
                  )}
                </div>
              </div>

              {/* ─── BENEFITS CARD ─── */}
              <div className="lg:col-span-2">
                <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-sm p-6 sm:p-8">
                  <div className="flex items-center gap-2 mb-6">
                    <Shield className="w-5 h-5 text-cyan-400" />
                    <h2 className="text-lg font-bold">Vantagens do Programa</h2>
                  </div>

                  <div className="space-y-5">
                    {benefits.map((benefit, i) => (
                      <div key={i} className="flex gap-4 group">
                        <div className="w-10 h-10 rounded-lg bg-cyan-500/10 flex items-center justify-center flex-shrink-0 group-hover:bg-cyan-500/20 transition-colors duration-200">
                          <benefit.icon className="w-5 h-5 text-cyan-400" />
                        </div>
                        <div>
                          <h3 className="text-sm font-semibold text-white mb-0.5">{benefit.title}</h3>
                          <p className="text-xs text-gray-500 leading-relaxed">{benefit.description}</p>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Divider */}
                  <div className="my-6 h-px bg-white/[0.06]" />

                  {/* Commission highlight */}
                  <div className="rounded-xl bg-gradient-to-br from-cyan-500/10 to-violet-500/10 border border-white/[0.06] p-4 text-center">
                    <p className="text-xs text-gray-400 mb-1 uppercase tracking-wider">Comissão por venda</p>
                    <p className="text-3xl font-bold bg-gradient-to-r from-cyan-400 to-violet-400 bg-clip-text text-transparent">
                      20%
                    </p>
                    <p className="text-xs text-gray-500 mt-1">em cada indicação paga</p>
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-2 gap-3 mt-4">
                    <div className="rounded-lg bg-white/[0.03] border border-white/[0.06] p-3 text-center">
                      <p className="text-lg font-bold text-white font-mono">0</p>
                      <p className="text-[10px] text-gray-500 uppercase tracking-wider">Taxa de adesão</p>
                    </div>
                    <div className="rounded-lg bg-white/[0.03] border border-white/[0.06] p-3 text-center">
                      <p className="text-lg font-bold text-cyan-400 font-mono">PIX</p>
                      <p className="text-[10px] text-gray-500 uppercase tracking-wider">Pagamento</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* ─── FOOTER ─── */}
      <footer className="border-t border-white/[0.04] bg-[#050510]/80">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-gradient-to-br from-cyan-500 to-violet-500 flex items-center justify-center">
              <Brain className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="text-sm font-semibold text-gray-400">ForexAI Pro</span>
          </div>
          <div className="flex items-center gap-6 text-sm text-gray-500">
            <a href="/" className="hover:text-white transition-colors duration-200">
              Voltar ao site
            </a>
            <a href="/afiliados/dashboard" className="hover:text-cyan-400 transition-colors duration-200">
              Dashboard Afiliados
            </a>
          </div>
          <p className="text-xs text-gray-600">
            &copy; {new Date().getFullYear()} ForexAI Pro. Todos os direitos reservados.
          </p>
        </div>
      </footer>
    </div>
  );
}
