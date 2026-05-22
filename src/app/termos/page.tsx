'use client';

import Link from 'next/link';
import { BarChart3, ChevronLeft, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

export default function TermosPage() {
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
      <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-10">
        {/* Page Title */}
        <div className="text-center mb-10">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-violet-500/20 flex items-center justify-center mx-auto mb-4 border border-cyan-500/20">
            <FileText className="w-7 h-7 text-cyan-400" />
          </div>
          <h1 className="text-2xl font-bold text-[#e2e8f0] mb-2">
            Termos de Uso
          </h1>
          <p className="text-[#94a3b8] text-xs">
            Última atualização: Janeiro de 2025
          </p>
        </div>

        <Card className="bg-[#111827] border-[#1e293b]/50">
          <CardContent className="p-6 md:p-8 space-y-8">
            {/* Company Info */}
            <div className="bg-[#0a0e17]/50 rounded-xl p-4 border border-[#1e293b]/50">
              <p className="text-[#94a3b8] text-sm">
                <span className="text-[#e2e8f0] font-medium">ForexAI Pro Elite</span> — CNPJ: 12.345.678/0001-95
              </p>
              <p className="text-[#94a3b8] text-sm mt-1">
                E-mail: <span className="text-cyan-400">forexalfa533@gmail.com</span>
              </p>
            </div>

            {/* 1. Termos Gerais */}
            <section>
              <h2 className="text-lg font-semibold text-[#e2e8f0] mb-3">
                1. Termos Gerais
              </h2>
              <p className="text-[#94a3b8] text-sm leading-relaxed">
                Ao acessar e utilizar a plataforma ForexAI Pro Elite, você concorda integralmente com os presentes Termos de Uso. Caso não concorde com qualquer disposição aqui prevista, recomendamos que não utilize nossos serviços. Estes termos constituem um acordo legal entre você (&ldquo;Usuário&rdquo;) e a ForexAI Pro Elite (&ldquo;Plataforma&rdquo;, &ldquo;Nós&rdquo;). Reservamo-nos o direito de modificar estes termos a qualquer momento, sendo o usuário notificado das alterações por meio da plataforma ou por e-mail.
              </p>
            </section>

            <Separator className="bg-[#1e293b]/50" />

            {/* 2. Descrição do Serviço */}
            <section>
              <h2 className="text-lg font-semibold text-[#e2e8f0] mb-3">
                2. Descrição do Serviço
              </h2>
              <p className="text-[#94a3b8] text-sm leading-relaxed mb-3">
                O ForexAI Pro Elite é uma plataforma de análise de mercado financeiro que utiliza tecnologia de Inteligência Artificial para fornecer:
              </p>
              <ul className="text-[#94a3b8] text-sm leading-relaxed space-y-2 list-disc list-inside">
                <li>Cotações em tempo real de Forex, Índices, Metais, Criptomoedas, Ações, ETFs e mercado brasileiro</li>
                <li>Análise técnica automatizada com base em múltiplas estratégias (SMC, Price Action, Híbrida)</li>
                <li>Sinais de entrada com probabilidade de sucesso calculada pela IA</li>
                <li>Gráficos interativos com dados históricos e indicadores técnicos</li>
                <li>Heatmap de mercado, calendário econômico e feed de notícias</li>
                <li>Ferramentas de gerenciamento de risco com cálculo de stop-loss e take-profit</li>
              </ul>
            </section>

            <Separator className="bg-[#1e293b]/50" />

            {/* 3. Período de Teste */}
            <section>
              <h2 className="text-lg font-semibold text-[#e2e8f0] mb-3">
                3. Período de Teste
              </h2>
              <p className="text-[#94a3b8] text-sm leading-relaxed">
                O ForexAI Pro Elite oferece um período de teste gratuito de 3 (três) dias, com acesso completo a todas as funcionalidades da plataforma. Durante o período de teste, o usuário poderá explorar todos os recursos sem compromisso financeiro. Ao final do período, o acesso será limitado até que o usuário opte por um plano de assinatura. Cada usuário é elegível para apenas um período de teste por conta/dispositivo.
              </p>
            </section>

            <Separator className="bg-[#1e293b]/50" />

            {/* 4. Planos e Pagamento */}
            <section>
              <h2 className="text-lg font-semibold text-[#e2e8f0] mb-3">
                4. Planos e Pagamento
              </h2>
              <p className="text-[#94a3b8] text-sm leading-relaxed mb-3">
                Os planos de assinatura são oferecidos nas modalidades mensal e anual. Os valores e condições estão disponíveis na plataforma. Ao efetuar o pagamento, o usuário declara ter ciência e concordar com os seguintes pontos:
              </p>
              <ul className="text-[#94a3b8] text-sm leading-relaxed space-y-2 list-disc list-inside">
                <li>O pagamento é processado de forma segura por meio de plataformas certificadas</li>
                <li>A assinatura é renovada automaticamente ao final de cada ciclo de cobrança</li>
                <li>Formas de pagamento aceitas: cartão de crédito, PIX e boleto bancário</li>
                <li>Não há reembolso após a ativação do plano, salvo em casos previstos em lei</li>
                <li>Os valores podem sofrer alterações com prévio aviso de 30 dias</li>
              </ul>
            </section>

            <Separator className="bg-[#1e293b]/50" />

            {/* 5. Cancelamento */}
            <section>
              <h2 className="text-lg font-semibold text-[#e2e8f0] mb-3">
                5. Cancelamento
              </h2>
              <p className="text-[#94a3b8] text-sm leading-relaxed">
                O usuário pode cancelar sua assinatura a qualquer momento, sem taxas adicionais. Após o cancelamento, o acesso à plataforma será mantido até o final do período já pago. O cancelamento deve ser solicitado por meio do WhatsApp oficial ou pelo e-mail forexalfa533@gmail.com. O processamento do cancelamento será realizado em até 24 horas úteis. Não é possível cancelar apenas parcialmente o plano — o cancelamento é integral.
              </p>
            </section>

            <Separator className="bg-[#1e293b]/50" />

            {/* 6. Limitação de Responsabilidade */}
            <section>
              <h2 className="text-lg font-semibold text-[#e2e8f0] mb-3">
                6. Limitação de Responsabilidade
              </h2>
              <p className="text-[#94a3b8] text-sm leading-relaxed">
                A ForexAI Pro Elite não se responsabiliza por quaisquer perdas financeiras decorrentes do uso da plataforma, incluindo, mas não se limitando a, perdas em operações de compra e venda de ativos financeiros. A plataforma fornece ferramentas de análise baseadas em Inteligência Artificial, que podem conter imprecisões. Os dados de mercado são obtidos de terceiros (Yahoo Finance via API) e estão sujeitos a atrasos, interrupções ou erros. O uso da plataforma é por conta e risco exclusivo do usuário.
              </p>
            </section>

            <Separator className="bg-[#1e293b]/50" />

            {/* 7. Isenção de Aconselhamento Financeiro */}
            <section>
              <h2 className="text-lg font-semibold text-[#e2e8f0] mb-3">
                7. Isenção de Aconselhamento Financeiro
              </h2>
              <p className="text-[#94a3b8] text-sm leading-relaxed">
                <span className="text-amber-400 font-medium">ATENÇÃO:</span> As análises, sinais e informações fornecidas pela ForexAI Pro Elite <span className="text-[#e2e8f0] font-medium">não constituem aconselhamento financeiro, recomendação de investimento, oferta ou solicitação de compra ou venda de qualquer instrumento financeiro</span>. Todo investimento envolve riscos, incluindo a possibilidade de perda do capital investido. Resultados passados não são garantia de resultados futuros. Recomendamos fortemente que o usuário consulte um profissional certificado de investimento antes de tomar qualquer decisão financeira.
              </p>
            </section>

            <Separator className="bg-[#1e293b]/50" />

            {/* 8. Alterações nos Termos */}
            <section>
              <h2 className="text-lg font-semibold text-[#e2e8f0] mb-3">
                8. Alterações nos Termos
              </h2>
              <p className="text-[#94a3b8] text-sm leading-relaxed">
                A ForexAI Pro Elite reserva-se o direito de alterar estes Termos de Uso a qualquer momento, sem aviso prévio. As alterações entrarão em vigor imediatamente após a publicação na plataforma. É responsabilidade do usuário verificar periodicamente os termos atualizados. O uso continuado da plataforma após a publicação de alterações constitui aceitação tácita dos novos termos.
              </p>
            </section>
          </CardContent>
        </Card>
      </main>

      {/* Footer */}
      <footer className="border-t border-[#1e293b]/30 bg-[#111827]/40 mt-auto">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
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
            <Link href="/privacidade" className="hover:text-cyan-400 transition-colors">
              Privacidade
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
