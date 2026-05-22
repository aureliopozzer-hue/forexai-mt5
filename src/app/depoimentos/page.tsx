'use client';

import Link from 'next/link';
import { BarChart3, ChevronLeft, Star, Quote } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

const testimonials = [
  {
    name: 'Ricardo Mendes',
    role: 'Trader Forex',
    avatar: 'RM',
    rating: 5,
    comment:
      'A análise por IA do ForexAI Pro mudou completamente minha forma de operar. Os sinais de entrada com probabilidades calculadas me dão muito mais confiança nas decisões. O recurso de comparação entre estratégias SMC, Price Action e Híbrida é incrível.',
  },
  {
    name: 'Ana Carolina Silva',
    role: 'Investidora de Ações',
    avatar: 'AC',
    rating: 5,
    comment:
      'Comecei a usar a plataforma no período de teste e em 2 dias já assinei o plano anual. A visualização em tempo real dos mercados e a análise automatizada economizam horas de trabalho manual. O heatmap de mercado é fantástico para identificar oportunidades.',
  },
  {
    name: 'Felipe Oliveira',
    role: 'Trader de Criptomoedas',
    avatar: 'FO',
    rating: 4,
    comment:
      'Muito boa para quem opera cripto. Os sinais são precisos e o tempo real dos dados me ajuda a não perder nenhuma oportunidade. O cálculo automático de stop-loss e take-profit baseado no risco/recompensa é uma mão na roda.',
  },
  {
    name: 'Mariana Costa',
    role: 'Analista Financeira',
    avatar: 'MC',
    rating: 5,
    comment:
      'Como analista, uso o ForexAI Pro como ferramenta complementar nos meus estudos. A qualidade dos dados e a velocidade das atualizações são impressionantes. Recomendo para qualquer profissional que busca uma vantagem competitiva no mercado.',
  },
  {
    name: 'João Pedro Santos',
    role: 'Trader de Índices',
    avatar: 'JP',
    rating: 4,
    comment:
      'Opero mini índice e mini dólar e a plataforma me ajuda muito na identificação de zonas de liquidez e níveis de suporte/resistência. A IA é surpreendentemente precisa na maioria das análises. Interface muito limpa e intuitiva.',
  },
  {
    name: 'Patrícia Almeida',
    role: 'Investidora ETF',
    avatar: 'PA',
    rating: 5,
    comment:
      'Sou iniciante no mercado financeiro e o ForexAI Pro me ajudou a entender melhor os movimentos do mercado. As análises são claras e fáceis de interpretar, mesmo para quem não tem muita experiência. O suporte via WhatsApp é excelente.',
  },
];

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={`w-3.5 h-3.5 ${
            i < rating
              ? 'fill-amber-400 text-amber-400'
              : 'fill-[#1e293b] text-[#1e293b]'
          }`}
        />
      ))}
    </div>
  );
}

function AvatarPlaceholder({ initials }: { initials: string }) {
  const gradients = [
    'from-cyan-500 to-violet-500',
    'from-emerald-500 to-cyan-500',
    'from-violet-500 to-rose-500',
    'from-amber-500 to-rose-500',
    'from-cyan-500 to-emerald-500',
    'from-violet-500 to-cyan-500',
  ];

  return (
    <div
      className={`w-10 h-10 rounded-full bg-gradient-to-br ${
        gradients[initials.charCodeAt(0) % gradients.length]
      } flex items-center justify-center text-white font-bold text-sm shadow-lg`}
    >
      {initials}
    </div>
  );
}

export default function DepoimentosPage() {
  return (
    <div className="min-h-screen flex flex-col bg-[#0a0e17]">
      {/* Header */}
      <header className="border-b border-[#1e293b]/40 bg-[#111827]/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-[1800px] mx-auto px-4 py-3 flex items-center gap-3">
          <Link href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
            <div className="relative">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-400 to-violet-500 flex items-center justify-center shadow-lg shadow-cyan-500/20">
                <BarChart3 className="w-[18px] h-[18px] text-white" />
              </div>
            </div>
            <div>
              <h1 className="text-base font-bold tracking-tight leading-tight">
                <span className="bg-gradient-to-r from-cyan-400 to-violet-400 bg-clip-text text-transparent">
                  ForexAI
                </span>
                <span className="text-[#e2e8f0] ml-1">Pro</span>
              </h1>
            </div>
          </Link>

          <div className="flex-1" />

          <Link href="/">
            <Button variant="ghost" size="sm" className="text-[#94a3b8] hover:text-cyan-400 text-xs">
              <ChevronLeft className="w-3 h-3 mr-1" /> Voltar ao Dashboard
            </Button>
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-10">
        {/* Page Title */}
        <div className="text-center mb-10">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-500/20 to-rose-500/20 flex items-center justify-center mx-auto mb-4 border border-amber-500/20">
            <Quote className="w-7 h-7 text-amber-400" />
          </div>
          <h1 className="text-2xl font-bold text-[#e2e8f0] mb-2">
            O que nossos usuários dizem
          </h1>
          <p className="text-[#94a3b8] text-sm max-w-lg mx-auto">
            Veja como o ForexAI Pro Elite está ajudando traders e investidores a tomar decisões mais inteligentes.
          </p>
        </div>

        {/* Testimonials Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {testimonials.map((testimonial, index) => (
            <Card
              key={index}
              className="bg-[#111827] border-[#1e293b]/50 hover:border-cyan-500/20 transition-all duration-300 hover:shadow-lg hover:shadow-cyan-500/5 hover:-translate-y-1"
            >
              <CardContent className="p-5">
                <StarRating rating={testimonial.rating} />

                <p className="text-[#94a3b8] text-sm leading-relaxed mt-4 mb-5">
                  &ldquo;{testimonial.comment}&rdquo;
                </p>

                <div className="flex items-center gap-3 pt-4 border-t border-[#1e293b]/50">
                  <AvatarPlaceholder initials={testimonial.avatar} />
                  <div>
                    <p className="text-[#e2e8f0] text-sm font-medium">{testimonial.name}</p>
                    <p className="text-[#94a3b8] text-xs">{testimonial.role}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-[#1e293b]/30 bg-[#111827]/40 mt-auto">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-md bg-gradient-to-br from-cyan-400 to-violet-500 flex items-center justify-center">
              <BarChart3 className="w-3 h-3 text-white" />
            </div>
            <span className="bg-gradient-to-r from-cyan-400 to-violet-400 bg-clip-text text-transparent font-bold text-xs">
              ForexAI Pro
            </span>
            <span className="text-[9px] text-[#94a3b8]">© 2025</span>
          </div>
          <div className="flex items-center gap-3 text-[9px] text-[#94a3b8]">
            <Link href="/faq" className="hover:text-cyan-400 transition-colors">
              FAQ
            </Link>
            <Link href="/termos" className="hover:text-cyan-400 transition-colors">
              Termos de Uso
            </Link>
            <Link href="/privacidade" className="hover:text-cyan-400 transition-colors">
              Privacidade
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
