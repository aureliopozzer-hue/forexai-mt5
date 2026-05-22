'use client';

import Link from 'next/link';
import { BarChart3, ChevronLeft, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

export default function PrivacidadePage() {
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
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 flex items-center justify-center mx-auto mb-4 border border-emerald-500/20">
            <ShieldCheck className="w-7 h-7 text-emerald-400" />
          </div>
          <h1 className="text-2xl font-bold text-[#e2e8f0] mb-2">
            Política de Privacidade
          </h1>
          <p className="text-[#94a3b8] text-xs">
            Última atualização: Janeiro de 2025 — Em conformidade com a LGPD (Lei nº 13.709/2018)
          </p>
        </div>

        <Card className="bg-[#111827] border-[#1e293b]/50">
          <CardContent className="p-6 md:p-8 space-y-8">
            {/* Company Info */}
            <div className="bg-[#0a0e17]/50 rounded-xl p-4 border border-[#1e293b]/50">
              <p className="text-[#94a3b8] text-sm">
                <span className="text-[#e2e8f0] font-medium">Controlador de Dados:</span> ForexAI Pro Elite — CNPJ: 12.345.678/0001-95
              </p>
              <p className="text-[#94a3b8] text-sm mt-1">
                E-mail para contato: <span className="text-cyan-400">forexalfa533@gmail.com</span>
              </p>
            </div>

            {/* 1. Dados Coletados */}
            <section>
              <h2 className="text-lg font-semibold text-[#e2e8f0] mb-3">
                1. Dados Coletados
              </h2>
              <p className="text-[#94a3b8] text-sm leading-relaxed mb-3">
                Coletamos os seguintes tipos de dados para o funcionamento adequado da plataforma:
              </p>
              <div className="space-y-4">
                <div>
                  <h3 className="text-[#e2e8f0] text-sm font-medium mb-1">Dados de identificação</h3>
                  <p className="text-[#94a3b8] text-sm leading-relaxed">
                    Nome, endereço de e-mail e dados de pagamento fornecidos no momento do cadastro e assinatura.
                  </p>
                </div>
                <div>
                  <h3 className="text-[#e2e8f0] text-sm font-medium mb-1">Dados de uso</h3>
                  <p className="text-[#94a3b8] text-sm leading-relaxed">
                    Preferências de navegação, ativos favoritos, histórico de análises realizadas, configurações de estratégia e taxa de risco/recompensa, armazenados localmente no navegador (localStorage).
                  </p>
                </div>
                <div>
                  <h3 className="text-[#e2e8f0] text-sm font-medium mb-1">Dados técnicos</h3>
                  <p className="text-[#94a3b8] text-sm leading-relaxed">
                    Endereço IP (para segurança), tipo de navegador, sistema operacional e informações do dispositivo, coletados automaticamente para garantir a qualidade do serviço.
                  </p>
                </div>
              </div>
            </section>

            <Separator className="bg-[#1e293b]/50" />

            {/* 2. Uso dos Dados */}
            <section>
              <h2 className="text-lg font-semibold text-[#e2e8f0] mb-3">
                2. Uso dos Dados
              </h2>
              <p className="text-[#94a3b8] text-sm leading-relaxed mb-3">
                Os dados coletados são utilizados para as seguintes finalidades:
              </p>
              <ul className="text-[#94a3b8] text-sm leading-relaxed space-y-2 list-disc list-inside">
                <li>Prestação e melhoria dos serviços da plataforma</li>
                <li>Processamento de pagamentos e gestão de assinaturas</li>
                <li>Personalização da experiência do usuário (favoritos, configurações)</li>
                <li>Envio de comunicações relacionadas ao serviço (atualizações, suporte)</li>
                <li>Análise de uso para aprimoramento da plataforma</li>
                <li>Garantia de segurança e prevenção de fraudes</li>
                <li>Cumprimento de obrigações legais e regulatórias</li>
              </ul>
            </section>

            <Separator className="bg-[#1e293b]/50" />

            {/* 3. Cookies e localStorage */}
            <section>
              <h2 className="text-lg font-semibold text-[#e2e8f0] mb-3">
                3. Cookies e localStorage
              </h2>
              <p className="text-[#94a3b8] text-sm leading-relaxed mb-3">
                A plataforma utiliza as seguintes tecnologias de armazenamento local:
              </p>
              <ul className="text-[#94a3b8] text-sm leading-relaxed space-y-2 list-disc list-inside">
                <li><span className="text-[#e2e8f0]">localStorage:</span> Armazenamento local no navegador para salvar preferências do usuário, lista de ativos favoritos, histórico de análises e estado da assinatura e créditos. Esses dados não são enviados aos nossos servidores.</li>
                <li><span className="text-[#e2e8f0]">Cookies essenciais:</span> Utilizados para o funcionamento básico da plataforma, como autenticação e sessão do usuário.</li>
                <li><span className="text-[#e2e8f0]">Cookies de analytics:</span> Utilizados para entender como os usuários interagem com a plataforma, podendo ser desabilitados nas configurações do navegador.</li>
              </ul>
            </section>

            <Separator className="bg-[#1e293b]/50" />

            {/* 4. Compartilhamento de Dados */}
            <section>
              <h2 className="text-lg font-semibold text-[#e2e8f0] mb-3">
                4. Compartilhamento de Dados
              </h2>
              <p className="text-[#94a3b8] text-sm leading-relaxed">
                A ForexAI Pro Elite <span className="text-[#e2e8f0] font-medium">não vende, aluga ou comercializa</span> dados pessoais de seus usuários. Os dados podem ser compartilhados apenas nas seguintes situações:
              </p>
              <ul className="text-[#94a3b8] text-sm leading-relaxed space-y-2 list-disc list-inside mt-3">
                <li>Processadores de pagamento (Stripe) para o processamento seguro de transações financeiras</li>
                <li>Provedores de dados de mercado (Yahoo Finance API) exclusivamente para obtenção de cotações e dados financeiros</li>
                <li>Obrigações legais, quando exigido por lei, decisão judicial ou requisito de autoridade competente</li>
                <li>Proteção dos direitos e segurança da plataforma e seus usuários</li>
              </ul>
            </section>

            <Separator className="bg-[#1e293b]/50" />

            {/* 5. Segurança */}
            <section>
              <h2 className="text-lg font-semibold text-[#e2e8f0] mb-3">
                5. Segurança
              </h2>
              <p className="text-[#94a3b8] text-sm leading-relaxed">
                Adotamos medidas técnicas e organizacionais adequadas para proteger os dados pessoais dos usuários contra acesso não autorizado, destruição, perda, alteração ou qualquer forma de tratamento inadequado. As medidas incluem: criptografia de dados em trânsito (SSL/TLS), controle de acesso baseado em função, monitoramento contínuo de segurança e backups regulares. Embora adotemos as melhores práticas do mercado, nenhum sistema de segurança é completamente infalível.
              </p>
            </section>

            <Separator className="bg-[#1e293b]/50" />

            {/* 6. Direitos do Titular */}
            <section>
              <h2 className="text-lg font-semibold text-[#e2e8f0] mb-3">
                6. Direitos do Titular
              </h2>
              <p className="text-[#94a3b8] text-sm leading-relaxed mb-3">
                Em conformidade com a Lei Geral de Proteção de Dados (LGPD), você possui os seguintes direitos:
              </p>
              <ul className="text-[#94a3b8] text-sm leading-relaxed space-y-2 list-disc list-inside">
                <li><span className="text-[#e2e8f0]">Confirmação e acesso:</span> Confirmar a existência e acessar seus dados pessoais</li>
                <li><span className="text-[#e2e8f0]">Correção:</span> Solicitar a correção de dados incompletos, inexatos ou desatualizados</li>
                <li><span className="text-[#e2e8f0]">Anonimização ou eliminação:</span> Solicitar a anonimização, bloqueio ou eliminação de dados desnecessários</li>
                <li><span className="text-[#e2e8f0]">Portabilidade:</span> Solicitar a portabilidade dos dados a outro fornecedor de serviço</li>
                <li><span className="text-[#e2e8f0]">Revogação:</span> Revogar o consentimento a qualquer momento</li>
                <li><span className="text-[#e2e8f0]">Oposição:</span> Opor-se ao tratamento de dados em casos específicos</li>
              </ul>
              <p className="text-[#94a3b8] text-sm leading-relaxed mt-3">
                Para exercer qualquer um destes direitos, entre em contato pelo e-mail <span className="text-cyan-400">forexalfa533@gmail.com</span>.
              </p>
            </section>

            <Separator className="bg-[#1e293b]/50" />

            {/* 7. Contato */}
            <section>
              <h2 className="text-lg font-semibold text-[#e2e8f0] mb-3">
                7. Contato
              </h2>
              <p className="text-[#94a3b8] text-sm leading-relaxed">
                Para dúvidas, solicitações ou reclamações relacionadas a esta Política de Privacidade ou ao tratamento de seus dados pessoais, entre em contato:
              </p>
              <div className="mt-3 space-y-1">
                <p className="text-[#94a3b8] text-sm">
                  <span className="text-[#e2e8f0]">E-mail:</span> <span className="text-cyan-400">forexalfa533@gmail.com</span>
                </p>
                <p className="text-[#94a3b8] text-sm">
                  <span className="text-[#e2e8f0]">WhatsApp:</span> +55 45 99931-6708
                </p>
                <p className="text-[#94a3b8] text-sm">
                  <span className="text-[#e2e8f0]">CNPJ:</span> 12.345.678/0001-95
                </p>
              </div>
              <p className="text-[#94a3b8] text-sm leading-relaxed mt-3">
                As solicitações serão respondidas em até 15 (quinze) dias úteis, conforme previsto na LGPD.
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
            <Link href="/termos" className="hover:text-cyan-400 transition-colors">
              Termos de Uso
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
