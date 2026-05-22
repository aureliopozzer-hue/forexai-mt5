'use client';

import { motion } from 'framer-motion';
import { Coins, Clock } from 'lucide-react';

interface CreditBarProps {
  credits: number;
  maxCredits: number;
  isSubscribed: boolean;
  isLoggedIn: boolean;
  isTrial?: boolean;
  trialDaysRemaining?: number;
  onClick?: () => void;
}

export function CreditBar({ credits, maxCredits, isSubscribed, isLoggedIn, isTrial, trialDaysRemaining = 0, onClick }: CreditBarProps) {
  // Pro subscribers always show unlimited
  if (isSubscribed) {
    return (
      <motion.button
        onClick={onClick}
        whileHover={{ scale: 1.03 }}
        whileTap={{ scale: 0.97 }}
        className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-gradient-to-r from-emerald-500/15 to-cyan-500/15 border border-emerald-500/25 hover:border-emerald-500/40 transition-all duration-300"
      >
        <Coins className="w-3.5 h-3.5 text-emerald-400" />
        <span className="text-xs font-semibold text-emerald-400">PRO ∞</span>
      </motion.button>
    );
  }

  // Not logged in — hide the bar
  if (!isLoggedIn) {
    return null;
  }

  // During trial — show countdown
  if (isTrial && trialDaysRemaining > 0) {
    return (
      <motion.button
        onClick={onClick}
        whileHover={{ scale: 1.03 }}
        whileTap={{ scale: 0.97 }}
        className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-gradient-to-r from-cyan-500/15 to-violet-500/15 border border-cyan-500/25 hover:border-cyan-500/40 transition-all duration-300"
      >
        <span className="text-xs">🎉</span>
        <span className="text-xs font-semibold text-cyan-400">
          3 dias grátis — {trialDaysRemaining} dia{trialDaysRemaining !== 1 ? 's' : ''} restante{trialDaysRemaining !== 1 ? 's' : ''}
        </span>
      </motion.button>
    );
  }

  // Trial expired — show warning in red
  if (!isTrial && credits <= 0) {
    return (
      <motion.button
        onClick={onClick}
        whileHover={{ scale: 1.03 }}
        whileTap={{ scale: 0.97 }}
        className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-500/10 border border-red-500/25 hover:border-red-500/40 transition-all duration-300"
        animate={{ opacity: [1, 0.7, 1] }}
        transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}
      >
        <span className="text-xs">⚠️</span>
        <span className="text-xs font-semibold text-red-400">Trial expirado</span>
      </motion.button>
    );
  }

  // Fallback: show credit count (shouldn't normally happen with trial system)
  return (
    <motion.button
      onClick={onClick}
      whileHover={{ scale: 1.03 }}
      whileTap={{ scale: 0.97 }}
      className="flex items-center gap-2.5 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 hover:border-white/20 transition-all duration-300"
    >
      <Coins className="w-3.5 h-3.5 text-cyan-400" />
      <span className="text-xs font-semibold text-gray-300">
        {credits}
      </span>
    </motion.button>
  );
}
