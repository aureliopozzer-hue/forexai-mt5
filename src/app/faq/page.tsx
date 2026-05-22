'use client';

import { useState } from 'react';
import Link from 'next/link';
import { BarChart3, ChevronLeft, HelpCircle, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

const faqs = [
  {
    question: 'O que é o ForexAI Pro Elite?',
    answer:
      'O ForexAI Pro Elite é uma plataforma avançada de análise de mercado financeiro que utiliza Inteligência Artificial para fornecer insights em tempo real sobre Forex, Índices, Metais, Criptomoedas, Ações, ETFs e o mercado brasileiro. Nossa tecnologia combina múltiplas estratégias de análise técnica — incluindo Smart Money Concepts, Price Action e análise híbrida — para gerar sinais de entrada com probabilidades de sucesso calculadas.',
  },
  {
    question: 'Como funcionam os créditos gratuitos?',
    answer:
      'Oferecemos 100 créditos gratuitos para que você possa explorar todas as funcionalidades da plataforma sem compromisso. Cada análise por IA consome 5 créditos (ou 3 créditos no modo de comparação de estratégias). Com os créditos, você terá acesso à análise por IA, cotações em tempo real, gráficos interativos, sinais de mercado e todas as categorias de ativos. Quando os créditos acabarem, você pode escolher um plano de assinatura para ter créditos ilimitados e acesso completo.',
  },
  {
    question: 'Quais formas de pagamento são aceitas?',
    answer:
      'Aceitamos pagamentos via cartão de crédito (Visa, Mastercard, American Express e outras bandeiras), PIX e boleto bancário. Também oferecemos a opção de pagamento via WhatsApp para maior comodidade. Todas as transações são processadas de forma segura e criptografada.',
  },
  {
    question: 'Posso cancelar minha assinatura a qualquer momento?',
    answer:
      'Sim! Você pode cancelar sua assinatura a qualquer momento sem taxas adicionais. Após o cancelamento, você continuará tendo acesso até o final do período já pago. Para cancelar, basta entrar em contato pelo WhatsApp ou pelo e-mail forexalfa533@gmail.com.',
  },
  {
    question: 'Quantos ativos estão disponíveis na plataforma?',
    answer:
      'Nossa plataforma cobre mais de 100 ativos distribuídos em 7 categorias: Forex (EUR/USD, GBP/USD, USD/JPY e mais), Índices (S&P 500, NASDAQ, DAX e outros), Metais (Ouro, Prata, Platina), Criptomoedas (Bitcoin, Ethereum, Solana e mais), Ações, ETFs e o mercado brasileiro (B3). Novos ativos são adicionados regularmente.',
  },
  {
    question: 'A análise por IA substitui o aconselhamento financeiro?',
    answer:
      'Não. As análises e sinais gerados pela nossa IA são ferramentas de apoio à tomada de decisão e não constituem aconselhamento financeiro, recomendação de investimento ou garantia de lucro. Todo investimento envolve riscos, e os resultados passados não garantem resultados futuros. Recomendamos que você consulte um profissional certificado antes de tomar decisões de investimento.',
  },
  {
    question: 'Com que frequência os dados são atualizados?',
    answer:
      'Os dados de cotação são atualizados em tempo real durante o horário de funcionamento dos mercados financeiros. As cotações são atualizadas automaticamente a cada 30 segundos na plataforma, e os gráficos recebem atualizações a cada 5 segundos. Os dados são provenientes do Yahoo Finance via API, garantindo precisão e confiabilidade.',
  },
  {
    question: 'Como funciona a análise por IA?',
    answer:
      'Nossa análise por IA utiliza modelos avançados que processam dados de mercado em tempo real — incluindo preço atual, variações, volume, suportes e resistências, e indicadores técnicos. A IA avalia múltiplas estratégias (SMC, Price Action e Híbrida) e gera sinais com probabilidades de sucesso, níveis de entrada, stop-loss, take-profit e gerenciamento de risco. Você pode comparar até 3 estratégias simultaneamente para tomar decisões mais informadas.',
  },
  {
    question: 'A plataforma funciona em dispositivos móveis?',
    answer:
      'Sim! O ForexAI Pro Elite é totalmente responsivo e funciona perfeitamente em smartphones, tablets e desktops. A interface se adapta automaticamente ao tamanho da tela, garantindo uma experiência otimizada em qualquer dispositivo.',
  },
  {
    question: 'Quais são os planos disponíveis?',
    answer:
      'Oferecemos planos mensais e anuais com acesso completo a todas as funcionalidades da plataforma. O plano anual oferece desconto significativo em relação ao plano mensal. Para conhecer os valores atuais e as condições especiais, entre em contato pelo WhatsApp ou visite a página de assinatura na plataforma.',
  },
];

export default function FAQPage() {
  const [openItems, setOpenItems] = useState<string[]>([]);

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
            <HelpCircle className="w-7 h-7 text-cyan-400" />
          </div>
          <h1 className="text-2xl font-bold text-[#e2e8f0] mb-2">
            Perguntas Frequentes
          </h1>
          <p className="text-[#94a3b8] text-sm max-w-lg mx-auto">
            Encontre respostas para as dúvidas mais comuns sobre o ForexAI Pro Elite.
          </p>
        </div>

        {/* FAQ Accordion */}
        <Card className="bg-[#111827] border-[#1e293b]/50">
          <CardContent className="p-2">
            <Accordion type="multiple" value={openItems} onValueChange={setOpenItems}>
              {faqs.map((faq, index) => (
                <AccordionItem
                  key={index}
                  value={`item-${index}`}
                  className="border-[#1e293b]/50 px-2"
                >
                  <AccordionTrigger className="text-[#e2e8f0] hover:text-cyan-400 hover:no-underline text-sm font-medium">
                    {faq.question}
                  </AccordionTrigger>
                  <AccordionContent className="text-[#94a3b8] text-sm leading-relaxed">
                    {faq.answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </CardContent>
        </Card>

        {/* CTA */}
        <div className="mt-10 text-center">
          <p className="text-[#94a3b8] text-sm mb-4">
            Não encontrou o que procurava?
          </p>
          <a
            href="https://wa.me/5545999316708?text=Olá! Tenho interesse no ForexAI Pro Elite"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button className="bg-gradient-to-r from-cyan-500 to-violet-500 hover:from-cyan-400 hover:to-violet-400 text-white shadow-lg shadow-cyan-500/20">
              <MessageCircle className="w-4 h-4 mr-2" />
              Fale Conosco no WhatsApp
            </Button>
          </a>
        </div>
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
