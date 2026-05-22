'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription
} from '@/components/ui/dialog';
import {
  BarChart3, Brain, Target, TrendingUp, Shield, Zap, Clock,
  Globe, Cpu, Coins, Bell, Search, Volume2, VolumeX,
  ChevronDown, ChevronRight, Activity, CandlestickChart,
  ScanLine, Calendar, Award, LayoutGrid, Eye, EyeOff,
  ArrowRightLeft, Lightbulb, AlertTriangle, CheckCircle2,
  Info, Star, Rocket, BookOpen, Settings, Users
} from 'lucide-react';

interface UserManualDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface Section {
  id: string;
  title: string;
  icon: React.ReactNode;
  color: string;
  items: {
    subtitle: string;
    description: string;
    tip?: string;
  }[];
}

const SECTIONS: Section[] = [
  {
    id: 'getting-started',
    title: 'Primeiros Passos',
    icon: <Rocket className="w-4 h-4" />,
    color: '#22d3ee',
    items: [
      {
        subtitle: 'Login com Google',
        description: 'Clique em "Entrar com Google" no canto superior direito. Após o login, você recebe 100 créditos grátis para testar a plataforma.',
        tip: 'Seus créditos são vinculados ao seu e-mail. Não perca o acesso!'
      },
      {
        subtitle: 'Sistema de Créditos',
        description: 'Cada análise IA consome 5 créditos. Comparação de 3 estratégias consome 15 créditos. Assinantes Pro têm créditos ilimitados.',
        tip: 'Você pode acompanhar seus créditos no badge amarelo no header ou no rodapé.'
      },
      {
        subtitle: 'Assinatura Pro',
        description: 'Quando seus créditos grátis acabarem, clique em "Assinar" para obter créditos ilimitados. Planos mensal e anual disponíveis.',
      },
    ]
  },
  {
    id: 'market-data',
    title: 'Cotações em Tempo Real',
    icon: <Globe className="w-4 h-4" />,
    color: '#10b981',
    items: [
      {
        subtitle: 'Categorias de Ativos',
        description: 'Navegue entre 7 categorias: Forex, Índices, Metais, Cripto, Ações, ETFs e Brasil. Use as abas no topo da área de cotações.',
      },
      {
        subtitle: 'Cards de Preço',
        description: 'Cada card mostra: preço atual, variação (%), mini-gráfico (sparkline) e volume. Clique em um card para selecioná-lo e ver detalhes.',
        tip: 'Clique na estrela ☆ para favoritar um ativo e encontrá-lo rapidamente.'
      },
      {
        subtitle: 'Busca de Ativos',
        description: 'Use o ícone de lupa 🔍 no header para buscar qualquer ativo pelo nome ou símbolo (ex: EURUSD, PETR4, BTC).',
      },
      {
        subtitle: 'Ticker Superior',
        description: 'A barra de ticker no topo mostra os principais ativos em tempo real com scroll automático.',
      },
    ]
  },
  {
    id: 'ai-analysis',
    title: 'Análise por IA',
    icon: <Brain className="w-4 h-4" />,
    color: '#8b5cf6',
    items: [
      {
        subtitle: 'Como Analisar',
        description: 'Selecione um ativo clicando no card, depois clique em "Analisar com IA" no painel de análise. A IA processa dados técnicos em tempo real.',
        tip: 'A análise leva de 3 a 10 segundos. Aguarde o resultado antes de iniciar outra.'
      },
      {
        subtitle: '3 Estratégias de IA',
        description: 'Escolha entre: SMC (Smart Money Concepts), Price Action ou Híbrido (combinação das duas). Use o seletor no painel de análise.',
      },
      {
        subtitle: 'Modo Conservador vs Agressivo',
        description: 'No modo Conservador, o stop loss usa 1.0x ATR (mais seguro). No Agressivo, usa 0.5x ATR (mais apertado, maior risco). Alterne no painel.',
        tip: 'Conservador: Stop mais largo, menos chance de ser atingido. Agressivo: Stop mais curto, maior risco/recompensa.'
      },
      {
        subtitle: 'Comparação de Estratégias',
        description: 'Clique em "Comparar Estratégias" para ver as 3 estratégias lado a lado e identificar a melhor para o momento atual.',
      },
      {
        subtitle: 'Resultados da Análise',
        description: 'A IA retorna: direção (COMPRA/VENDA/ESPERAR), pontos de entrada, stop loss, take profit, confiança (%) e probabilidade de acerto (%).',
        tip: 'A probabilidade de acerto é calculada com base em indicadores técnicos e padrões históricos.'
      },
      {
        subtitle: 'Narração por Voz',
        description: 'Ative/desative a narração automática dos resultados clicando no ícone 🔊/🔇 no painel de análise. A IA fala os resultados em português.',
      },
    ]
  },
  {
    id: 'signals-alerts',
    title: 'Sinais e Alertas',
    icon: <Bell className="w-4 h-4" />,
    color: '#f59e0b',
    items: [
      {
        subtitle: 'Sinais de Mercado',
        description: 'O painel de sinais mostra ativos com movimento forte: RSI sobrecomprado/sobrevendido, cruzamentos de média, volume anômalo.',
        tip: 'Sinais são atualizados automaticamente. Fique de olho nos sinais de alta probabilidade!'
      },
      {
        subtitle: 'Alertas de Preço',
        description: 'Crie alertas de preço personalizados. Clique no ícone de sino 🔔 no header, defina o ativo e o preço alvo. Você será notificado quando o preço for atingido.',
      },
      {
        subtitle: 'Análise Agendada',
        description: 'Agende análises automáticas para horários específicos. Clique no ícone de relógio ⏰ no header para configurar.',
      },
      {
        subtitle: 'Scanner de Padrões',
        description: 'O scanner identifica padrões gráficos automáticos (doji, martelo, engulfamento, etc.) em múltiplos ativos. Acesse pelo ícone de scan no header.',
      },
    ]
  },
  {
    id: 'tools',
    title: 'Ferramentas Avançadas',
    icon: <Settings className="w-4 h-4" />,
    color: '#06b6d4',
    items: [
      {
        subtitle: 'Simulação de Trade',
        description: 'Simule entradas e saídas com cálculo automático de lucro/prejuízo, risco/retorno e tamanho de posição. Acesse pelo painel de simulação.',
      },
      {
        subtitle: 'Mapa de Calor',
        description: 'Visualize a performance de todos os ativos de uma categoria por cores: verde (alta), vermelho (baixa), cinza (neutro).',
      },
      {
        subtitle: 'Calendário Econômico',
        description: 'Acompanhe eventos econômicos importantes que podem impactar o mercado: decisões de juros, NFP, CPI, etc.',
      },
      {
        subtitle: 'Relógio de Sessões',
        description: 'Veja quais sessões de mercado estão abertas (Ásia, Europa, EUA) e o horário de fechamento de cada uma.',
      },
      {
        subtitle: 'Relatório Semanal',
        description: 'Gere um relatório completo da semana com suas análises, performance e estatísticas. Acesse pelo ícone de gráfico no header.',
      },
      {
        subtitle: 'Personalização de Layout',
        description: 'Reordene e oculte painéis do dashboard conforme sua preferência. Clique no ícone de grid no header para personalizar.',
      },
    ]
  },
  {
    id: 'performance',
    title: 'Performance e Gamificação',
    icon: <Award className="w-4 h-4" />,
    color: '#ef4444',
    items: [
      {
        subtitle: 'Dashboard de Performance',
        description: 'Acompanhe suas métricas: taxa de acerto, lucro/prejuízo total, melhor/pior trade e streak de acertos.',
      },
      {
        subtitle: 'Sistema de Conquistas',
        description: 'Desbloqueie badges por marcos: primeira análise, 10 análises, 100 análises, comparações, etc. Clique no ícone de troféu no header.',
      },
      {
        subtitle: 'Histórico de Análises',
        description: 'Veja e recarregue análises anteriores no painel de histórico. As últimas 20 análises são salvas automaticamente.',
      },
    ]
  },
  {
    id: 'extras',
    title: 'Recursos Extras',
    icon: <Lightbulb className="w-4 h-4" />,
    color: '#a855f7',
    items: [
      {
        subtitle: 'Modo Conforto Visual',
        description: 'Ative o modo conforto para reduzir o brilho e cansaço visual. Acesse pelo ícone de olho no header.',
      },
      {
        subtitle: 'Instalar como App (PWA)',
        description: 'Instale o ForexAI Pro no seu celular ou desktop como um app nativo. Clique no botão "Instalar App" quando aparecer.',
        tip: 'Como app, você recebe notificações de alertas de preço mesmo com o navegador fechado!'
      },
      {
        subtitle: 'Notícias de Mercado',
        description: 'O painel de notícias mostra manchetes relevantes do mercado financeiro em tempo real, filtradas pelo ativo selecionado.',
      },
      {
        subtitle: 'Tema Escuro',
        description: 'O ForexAI Pro usa tema escuro otimizado para traders. Alternância automática entre claro/escuro via ícone de sol/lua no header.',
      },
    ]
  },
  {
    id: 'disclaimer',
    title: 'Aviso Legal',
    icon: <AlertTriangle className="w-4 h-4" />,
    color: '#f97316',
    items: [
      {
        subtitle: 'Não é aconselhamento financeiro',
        description: 'As análises geradas pela IA são baseadas em indicadores técnicos e não constituem recomendação de investimento. Sempre faça sua própria pesquisa (DYOR).',
      },
      {
        subtitle: 'Riscos do mercado',
        description: 'Investir em mercados financeiros envolve riscos significativos. Você pode perder todo o capital investido. Nunca invista mais do que pode perder.',
      },
      {
        subtitle: 'Precisão da IA',
        description: 'A probabilidade de acerto indica a confiança do modelo baseada em dados históricos, mas não garante resultados futuros. Use como ferramenta complementar.',
      },
    ]
  },
];

function SectionAccordion({ section, isOpen, onToggle }: { section: Section; isOpen: boolean; onToggle: () => void }) {
  return (
    <div className="border border-border/40 rounded-xl overflow-hidden transition-all duration-200">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors text-left"
      >
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: `${section.color}15`, color: section.color }}
        >
          {section.icon}
        </div>
        <span className="font-semibold text-sm text-foreground flex-1">{section.title}</span>
        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        </motion.div>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-3 space-y-3">
              {section.items.map((item, idx) => (
                <div key={idx} className="pl-4 border-l-2" style={{ borderColor: `${section.color}30` }}>
                  <h4 className="text-xs font-bold text-foreground mb-0.5">{item.subtitle}</h4>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">{item.description}</p>
                  {item.tip && (
                    <div className="mt-1.5 flex items-start gap-1.5 px-2.5 py-1.5 rounded-lg bg-amber-500/5 border border-amber-500/10">
                      <Lightbulb className="w-3 h-3 text-amber-400 flex-shrink-0 mt-0.5" />
                      <span className="text-[10px] text-amber-300/80 leading-relaxed">{item.tip}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function UserManualDialog({ open, onOpenChange }: UserManualDialogProps) {
  const [openSections, setOpenSections] = useState<Set<string>>(new Set(['getting-started']));

  const toggleSection = (id: string) => {
    setOpenSections(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const expandAll = () => setOpenSections(new Set(SECTIONS.map(s => s.id)));
  const collapseAll = () => setOpenSections(new Set());

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] flex flex-col p-0 gap-0 bg-card border-border/50">
        <DialogHeader className="px-5 pt-5 pb-3 border-b border-border/30 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-400 to-violet-500 flex items-center justify-center shadow-lg shadow-cyan-500/20">
              <BookOpen className="w-5 h-5 text-white" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold">Manual do ForexAI Pro</DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Guia completo de uso da plataforma
              </DialogDescription>
            </div>
          </div>
          <div className="flex items-center gap-2 mt-3">
            <button
              onClick={expandAll}
              className="text-[10px] text-cyan-400 hover:text-cyan-300 transition-colors px-2 py-1 rounded-md hover:bg-cyan-500/10"
            >
              Expandir tudo
            </button>
            <span className="text-muted-foreground/40 text-[10px]">|</span>
            <button
              onClick={collapseAll}
              className="text-[10px] text-cyan-400 hover:text-cyan-300 transition-colors px-2 py-1 rounded-md hover:bg-cyan-500/10"
            >
              Recolher tudo
            </button>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-2 scrollbar-thin">
          {SECTIONS.map(section => (
            <SectionAccordion
              key={section.id}
              section={section}
              isOpen={openSections.has(section.id)}
              onToggle={() => toggleSection(section.id)}
            />
          ))}

          {/* Quick Reference Card */}
          <div className="mt-4 p-4 rounded-xl bg-gradient-to-br from-cyan-500/5 to-violet-500/5 border border-cyan-500/10">
            <h4 className="text-xs font-bold text-foreground mb-3 flex items-center gap-2">
              <Zap className="w-3.5 h-3.5 text-cyan-400" />
              Referência Rápida de Custos
            </h4>
            <div className="grid grid-cols-2 gap-2">
              <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-card/80 border border-border/30">
                <Coins className="w-3 h-3 text-amber-400" />
                <div>
                  <p className="text-[10px] font-semibold text-foreground">1 Análise IA</p>
                  <p className="text-[9px] text-muted-foreground">5 créditos</p>
                </div>
              </div>
              <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-card/80 border border-border/30">
                <ArrowRightLeft className="w-3 h-3 text-violet-400" />
                <div>
                  <p className="text-[10px] font-semibold text-foreground">Comparação 3x</p>
                  <p className="text-[9px] text-muted-foreground">15 créditos</p>
                </div>
              </div>
              <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-card/80 border border-border/30">
                <Star className="w-3 h-3 text-emerald-400" />
                <div>
                  <p className="text-[10px] font-semibold text-foreground">Créditos Grátis</p>
                  <p className="text-[9px] text-muted-foreground">100 (login)</p>
                </div>
              </div>
              <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-card/80 border border-border/30">
                <Infinity className="w-3 h-3 text-cyan-400" />
                <div>
                  <p className="text-[10px] font-semibold text-foreground">Assinante Pro</p>
                  <p className="text-[9px] text-muted-foreground">Ilimitados ∞</p>
                </div>
              </div>
            </div>
          </div>

          {/* Keyboard shortcuts / Quick actions */}
          <div className="p-4 rounded-xl bg-muted/20 border border-border/30">
            <h4 className="text-xs font-bold text-foreground mb-2 flex items-center gap-2">
              <Info className="w-3.5 h-3.5 text-blue-400" />
              Dicas Importantes
            </h4>
            <ul className="space-y-1.5">
              {[
                'Clique na estrela ☆ para favoritar ativos e acessá-los rapidamente',
                'Use a busca (🔍) para encontrar qualquer ativo pelo nome ou símbolo',
                'Ative a narração por voz para ouvir os resultados das análises',
                'Agende análises automáticas para não perder oportunidades',
                'Crie alertas de preço para ser notificado quando o ativo atingir seu alvo',
                'Compare as 3 estratégias para encontrar a melhor oportunidade',
              ].map((tip, i) => (
                <li key={i} className="flex items-start gap-1.5">
                  <CheckCircle2 className="w-3 h-3 text-emerald-400 flex-shrink-0 mt-0.5" />
                  <span className="text-[10px] text-muted-foreground leading-relaxed">{tip}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="px-5 py-3 border-t border-border/30 flex-shrink-0">
          <p className="text-[9px] text-muted-foreground/60 text-center">
            ForexAI Pro v2.0 · As análises não constituem aconselhamento financeiro · Investir envolve riscos
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Small infinity icon component
function Infinity({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M12 12c-2-2.67-4-4-6-4a4 4 0 1 0 0 8c2 0 4-1.33 6-4Zm0 0c2 2.67 4 4 6 4a4 4 0 0 0 0-8c-2 0-4 1.33-6 4Z" />
    </svg>
  );
}
