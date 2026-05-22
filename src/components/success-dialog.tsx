'use client';

import { useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Brain, Infinity as InfinityIcon, ScanLine, Headset } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

/* ──────────────────────────────────────────── */
/*  Types                                      */
/* ──────────────────────────────────────────── */

interface SuccessDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plan?: 'monthly' | 'annual';
}

/* ──────────────────────────────────────────── */
/*  Confetti particle                          */
/* ──────────────────────────────────────────── */

const CONFETTI_COLORS = [
  '#06b6d4', // cyan
  '#8b5cf6', // violet
  '#22d3ee', // cyan-400
  '#a78bfa', // violet-400
  '#34d399', // emerald-400
  '#fbbf24', // amber-400
  '#f472b6', // pink-400
  '#60a5fa', // blue-400
];

interface ConfettiParticleProps {
  color: string;
  index: number;
  total: number;
}

function ConfettiParticle({ color, index, total }: ConfettiParticleProps) {
  // Spread particles in a full circle around center
  const angle = (index / total) * Math.PI * 2;
  const distance = 120 + Math.random() * 140;
  const x = Math.cos(angle) * distance;
  const y = Math.sin(angle) * distance;

  // Random rotation
  const rotate = Math.random() * 720 - 360;
  // Random size
  const size = 4 + Math.random() * 6;
  // Random shape: 0 = square, 1 = circle, 2 = rectangle
  const shape = Math.floor(Math.random() * 3);

  return (
    <motion.div
      initial={{
        opacity: 1,
        scale: 0,
        x: 0,
        y: 0,
        rotate: 0,
      }}
      animate={{
        opacity: [1, 1, 0],
        scale: [0, 1, 0.5],
        x: [0, x * 0.5, x],
        y: [0, y * 0.5 - 40, y + 60],
        rotate: [0, rotate * 0.6, rotate],
      }}
      transition={{
        duration: 1.8 + Math.random() * 0.6,
        ease: 'easeOut',
        delay: Math.random() * 0.15,
      }}
      className="absolute left-1/2 top-1/2 pointer-events-none"
      style={{
        width: shape === 2 ? size * 2.5 : size,
        height: size,
        backgroundColor: color,
        borderRadius: shape === 1 ? '50%' : shape === 0 ? '2px' : '1px',
        transform: 'translate(-50%, -50%)',
      }}
    />
  );
}

/* ──────────────────────────────────────────── */
/*  Animated checkmark ring                    */
/* ──────────────────────────────────────────── */

function AnimatedCheckmark() {
  return (
    <div className="relative flex items-center justify-center">
      {/* Outer glow pulse */}
      <motion.div
        initial={{ scale: 0, opacity: 0 }}
        animate={{
          scale: [0, 1.4, 1.2],
          opacity: [0, 0.3, 0.15],
        }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
        className="absolute w-28 h-28 rounded-full bg-emerald-500/20 blur-xl"
      />

      {/* Ring background */}
      <motion.div
        initial={{ scale: 0, rotate: -180 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{
          type: 'spring',
          stiffness: 200,
          damping: 15,
          delay: 0.1,
        }}
        className="relative w-24 h-24 rounded-full flex items-center justify-center"
        style={{
          background:
            'radial-gradient(circle at 40% 35%, rgba(16,185,129,0.25), rgba(6,182,212,0.10) 70%, transparent)',
          border: '2px solid rgba(16,185,129,0.3)',
          boxShadow:
            '0 0 40px rgba(16,185,129,0.15), inset 0 0 20px rgba(16,185,129,0.05)',
        }}
      >
        {/* Spinning ring decoration */}
        <motion.div
          animate={{ rotate: 360 }}
          transition={{
            repeat: Infinity,
            duration: 8,
            ease: 'linear',
          }}
          className="absolute inset-[-3px] rounded-full"
          style={{
            background:
              'conic-gradient(from 0deg, transparent 0%, rgba(6,182,212,0.4) 25%, transparent 50%, rgba(139,92,246,0.4) 75%, transparent 100%)',
            mask: 'radial-gradient(farthest-side, transparent calc(100% - 3px), black calc(100% - 3px))',
            WebkitMask:
              'radial-gradient(farthest-side, transparent calc(100% - 3px), black calc(100% - 3px))',
          }}
        />

        {/* Check icon */}
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{
            delay: 0.4,
            type: 'spring',
            stiffness: 300,
            damping: 12,
          }}
        >
          <Check className="w-10 h-10 text-emerald-400 stroke-[3]" />
        </motion.div>
      </motion.div>
    </div>
  );
}

/* ──────────────────────────────────────────── */
/*  Feature item                               */
/* ──────────────────────────────────────────── */

interface FeatureItemProps {
  icon: React.ElementType;
  text: string;
  delay: number;
  color: string;
}

function FeatureItem({ icon: Icon, text, delay, color }: FeatureItemProps) {
  return (
    <motion.li
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay, duration: 0.4, ease: 'easeOut' }}
      className="flex items-center gap-3 py-2"
    >
      <div
        className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center"
        style={{
          backgroundColor: `${color}12`,
          border: `1px solid ${color}25`,
        }}
      >
        <Icon className="w-4 h-4" style={{ color }} />
      </div>
      <span className="text-sm text-gray-200 font-medium">{text}</span>
    </motion.li>
  );
}

/* ──────────────────────────────────────────── */
/*  Main component                             */
/* ──────────────────────────────────────────── */

export function SuccessDialog({ open, onOpenChange, plan }: SuccessDialogProps) {
  // Stable confetti particles (recomputed only when `open` flips to true)
  const particles = useMemo(() => {
    if (!open) return [];
    return Array.from({ length: 50 }, (_, i) => ({
      id: i,
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
    }));
  }, [open]);

  const features = [
    { icon: Brain, text: 'Análises ilimitadas por IA', color: '#8b5cf6' },
    { icon: InfinityIcon, text: 'Créditos infinitos', color: '#06b6d4' },
    { icon: ScanLine, text: 'Scanner de padrões em tempo real', color: '#22d3ee' },
    { icon: Headset, text: 'Suporte prioritário', color: '#a78bfa' },
  ];

  const handleClose = useCallback(() => {
    onOpenChange(false);
  }, [onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="sm:max-w-md p-0 overflow-hidden border-0 bg-transparent shadow-none"
      >
        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 12 }}
              transition={{
                type: 'spring',
                stiffness: 280,
                damping: 24,
              }}
              className="relative rounded-2xl overflow-hidden"
              style={{
                background:
                  'linear-gradient(160deg, #0c1222 0%, #0f172a 40%, #111827 100%)',
                border: '1px solid rgba(139,92,246,0.15)',
                boxShadow:
                  '0 25px 60px -12px rgba(0,0,0,0.6), 0 0 80px -20px rgba(6,182,212,0.15)',
              }}
            >
              {/* ── Decorative background orbs ── */}
              <div className="absolute top-0 left-1/4 w-72 h-72 bg-cyan-500/[0.04] rounded-full blur-3xl pointer-events-none" />
              <div className="absolute bottom-0 right-1/4 w-56 h-56 bg-violet-500/[0.06] rounded-full blur-3xl pointer-events-none" />
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-emerald-500/[0.02] rounded-full blur-3xl pointer-events-none" />

              {/* ── Confetti layer ── */}
              <div className="absolute inset-0 overflow-hidden pointer-events-none z-10">
                {particles.map((p) => (
                  <ConfettiParticle
                    key={p.id}
                    color={p.color}
                    index={p.id}
                    total={particles.length}
                  />
                ))}
              </div>

              {/* ── Content ── */}
              <div className="relative z-20 px-6 sm:px-8 pt-8 pb-8">
                {/* Hidden accessible title / description for screen readers */}
                <DialogHeader className="sr-only">
                  <DialogTitle>Assinatura Ativada com Sucesso!</DialogTitle>
                  <DialogDescription>
                    Seus créditos ilimitados já estão disponíveis.
                  </DialogDescription>
                </DialogHeader>

                {/* Animated checkmark */}
                <div className="flex justify-center mb-6">
                  <AnimatedCheckmark />
                </div>

                {/* Title */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.35, duration: 0.5 }}
                  className="text-center mb-1"
                >
                  <h2 className="text-2xl sm:text-[1.65rem] font-bold text-white leading-tight">
                    🎉 Assinatura Ativada com Sucesso!
                  </h2>
                </motion.div>

                {/* Subtitle */}
                <motion.p
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5, duration: 0.5 }}
                  className="text-center text-sm text-gray-400 mb-7 leading-relaxed"
                >
                  Seus créditos ilimitados já estão disponíveis
                </motion.p>

                {/* Plan card */}
                {plan && (
                  <motion.div
                    initial={{ opacity: 0, y: 8, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ delay: 0.55, duration: 0.4, ease: 'easeOut' }}
                    className="mb-6 rounded-xl p-4 flex items-center justify-between"
                    style={{
                      background: 'rgba(255,255,255,0.04)',
                      border: '1px solid rgba(255,255,255,0.08)',
                    }}
                  >
                    <div className="flex flex-col gap-0.5">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-white">
                          {plan === 'monthly' ? 'Plano Pro Mensal' : 'Plano Pro Anual'}
                        </span>
                        <span
                          className="text-[10px] font-medium uppercase tracking-wider px-1.5 py-0.5 rounded-md"
                          style={{
                            color: plan === 'annual' ? '#34d399' : '#60a5fa',
                            backgroundColor:
                              plan === 'annual'
                                ? 'rgba(52,211,153,0.12)'
                                : 'rgba(96,165,250,0.12)',
                            border:
                              plan === 'annual'
                                ? '1px solid rgba(52,211,153,0.25)'
                                : '1px solid rgba(96,165,250,0.25)',
                          }}
                        >
                          {plan === 'annual' ? 'Anual' : 'Mensal'}
                        </span>
                      </div>
                      <span className="text-xs text-gray-400">
                        {plan === 'monthly' ? 'R$49,90/mês' : 'R$479,00/ano'}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span
                        className="text-lg font-bold"
                        style={{
                          background:
                            'linear-gradient(135deg, #06b6d4, #8b5cf6)',
                          WebkitBackgroundClip: 'text',
                          WebkitTextFillColor: 'transparent',
                        }}
                      >
                        {plan === 'monthly' ? 'R$49,90' : 'R$479,00'}
                      </span>
                    </div>
                  </motion.div>
                )}

                {/* Divider with glow */}
                <motion.div
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{ delay: 0.6, duration: 0.5 }}
                  className="h-px mb-6 origin-center"
                  style={{
                    background:
                      'linear-gradient(90deg, transparent, rgba(6,182,212,0.3), rgba(139,92,246,0.3), transparent)',
                  }}
                />

                {/* Features list */}
                <ul className="space-y-1 mb-7">
                  {features.map((feature, i) => (
                    <FeatureItem
                      key={i}
                      icon={feature.icon}
                      text={feature.text}
                      delay={0.65 + i * 0.1}
                      color={feature.color}
                    />
                  ))}
                </ul>

                {/* CTA Button */}
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 1.1, duration: 0.5 }}
                >
                  <motion.div
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <Button
                      onClick={handleClose}
                      className="w-full h-12 text-base font-semibold bg-gradient-to-r from-cyan-500 to-violet-500 hover:from-cyan-400 hover:to-violet-400 text-white shadow-lg shadow-cyan-500/20 transition-all duration-200 rounded-xl"
                    >
                      Começar a Analisar 🚀
                    </Button>
                  </motion.div>

                  <p className="text-[10px] text-gray-600 text-center mt-3">
                    Acesso imediato · Créditos ilimitados já ativos
                  </p>
                </motion.div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}
