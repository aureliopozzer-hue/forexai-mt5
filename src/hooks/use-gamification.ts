'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';

// ===================== Badge Definitions =====================

export interface Badge {
  id: string;
  name: string;
  emoji: string;
  description: string;
  earned: boolean;
  earnedAt: string | null;
}

const BADGE_DEFINITIONS: Omit<Badge, 'earned' | 'earnedAt'>[] = [
  { id: 'beginner', name: 'Iniciante', emoji: '🔥', description: 'Primeira análise realizada' },
  { id: 'analyst', name: 'Analista', emoji: '📊', description: '10 análises realizadas' },
  { id: 'expert', name: 'Expert', emoji: '🧠', description: '50 análises realizadas' },
  { id: 'master', name: 'Mestre', emoji: '🏆', description: '100 análises realizadas' },
  { id: 'comparator', name: 'Comparador', emoji: '🔄', description: 'Primeira comparação (3 estratégias)' },
  { id: 'collector', name: 'Colecionador', emoji: '⭐', description: 'Analisou 5 instrumentos diferentes' },
  { id: 'global', name: 'Global', emoji: '🌍', description: 'Analisou instrumentos de 3 categorias diferentes' },
  { id: 'dedicated', name: 'Dedicado', emoji: '💎', description: '7 dias consecutivos usando o app' },
  { id: 'vip', name: 'VIP', emoji: '👑', description: 'Assinante ativo' },
];

// ===================== Storage Keys =====================

const STORAGE_KEY = 'forexAI-gamification';
const NEW_BADGE_KEY = 'forexAI-new-badges';

// ===================== Data Types =====================

export interface GamificationData {
  badges: Badge[];
  streak: number;
  longestStreak: number;
  totalAnalyses: number;
  uniqueInstruments: string[];
  categoriesUsed: string[];
  firstAnalysisDate: string | null;
  lastActiveDate: string | null;
}

function getDefaultData(): GamificationData {
  return {
    badges: BADGE_DEFINITIONS.map(b => ({ ...b, earned: false, earnedAt: null })),
    streak: 0,
    longestStreak: 0,
    totalAnalyses: 0,
    uniqueInstruments: [],
    categoriesUsed: [],
    firstAnalysisDate: null,
    lastActiveDate: null,
  };
}

// ===================== Helper Functions =====================

function getTodayStr(): string {
  return new Date().toISOString().split('T')[0]; // YYYY-MM-DD
}

function getYesterdayStr(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().split('T')[0];
}

function loadData(): GamificationData {
  if (typeof window === 'undefined') return getDefaultData();
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as GamificationData;
      // Merge with new badge definitions (in case we add badges later)
      const existingIds = new Set(parsed.badges.map(b => b.id));
      const mergedBadges = [
        ...parsed.badges,
        ...BADGE_DEFINITIONS.filter(b => !existingIds.has(b.id)).map(b => ({ ...b, earned: false, earnedAt: null })),
      ];
      return { ...parsed, badges: mergedBadges };
    }
  } catch {}
  return getDefaultData();
}

function saveData(data: GamificationData): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {}
}

function loadNewBadgeIds(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const stored = localStorage.getItem(NEW_BADGE_KEY);
    if (stored) return new Set(JSON.parse(stored));
  } catch {}
  return new Set();
}

function saveNewBadgeIds(ids: Set<string>): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(NEW_BADGE_KEY, JSON.stringify([...ids]));
  } catch {}
}

// ===================== Streak Logic =====================

function updateStreak(data: GamificationData): { streak: number; longestStreak: number } {
  const today = getTodayStr();
  const yesterday = getYesterdayStr();

  // Already active today — no change
  if (data.lastActiveDate === today) {
    return { streak: data.streak, longestStreak: data.longestStreak };
  }

  let newStreak = data.streak;
  if (data.lastActiveDate === yesterday) {
    // Consecutive day
    newStreak = data.streak + 1;
  } else if (data.lastActiveDate && data.lastActiveDate !== today) {
    // Streak broken
    newStreak = 1;
  } else {
    // First time ever
    newStreak = 1;
  }

  return {
    streak: newStreak,
    longestStreak: Math.max(data.longestStreak, newStreak),
  };
}

// ===================== Badge Check Logic =====================

function checkBadges(data: GamificationData, isSubscribed: boolean): Badge[] {
  const earned: Badge[] = [];

  for (const badge of data.badges) {
    if (badge.earned) continue;

    let shouldEarn = false;

    switch (badge.id) {
      case 'beginner':
        shouldEarn = data.totalAnalyses >= 1;
        break;
      case 'analyst':
        shouldEarn = data.totalAnalyses >= 10;
        break;
      case 'expert':
        shouldEarn = data.totalAnalyses >= 50;
        break;
      case 'master':
        shouldEarn = data.totalAnalyses >= 100;
        break;
      case 'comparator':
        // Checked externally when comparison mode is used
        break;
      case 'collector':
        shouldEarn = data.uniqueInstruments.length >= 5;
        break;
      case 'global':
        shouldEarn = data.categoriesUsed.length >= 3;
        break;
      case 'dedicated':
        shouldEarn = data.streak >= 7;
        break;
      case 'vip':
        shouldEarn = isSubscribed;
        break;
    }

    if (shouldEarn) {
      badge.earned = true;
      badge.earnedAt = new Date().toISOString();
      earned.push(badge);
    }
  }

  return earned;
}

// ===================== Hook =====================

export function useGamification(isSubscribed: boolean = false): {
  data: GamificationData;
  recordAnalysis: (instrumentSymbol: string, category: string, isComparison: boolean) => void;
  checkNewBadges: () => Badge[];
  isNewBadge: (badgeId: string) => boolean;
  clearNewBadge: (badgeId: string) => void;
} {
  const [data, setData] = useState<GamificationData>(getDefaultData);
  const [newBadgeIds, setNewBadgeIds] = useState<Set<string>>(new Set());
  const [mounted, setMounted] = useState(false);
  const toastShownRef = useRef<Set<string>>(new Set());

  // Load from localStorage after mount
  useEffect(() => {
    setData(loadData());
    setNewBadgeIds(loadNewBadgeIds());
    setMounted(true);
  }, []);

  // Check VIP badge when subscription status changes
  useEffect(() => {
    if (!mounted) return;
    const current = loadData();
    const newlyEarned = checkBadges(current, isSubscribed);
    if (newlyEarned.length > 0) {
      saveData(current);
      setData({ ...current });
      // Show toast for newly earned badges
      const newIds = new Set(newBadgeIds);
      for (const badge of newlyEarned) {
        if (!toastShownRef.current.has(badge.id)) {
          toastShownRef.current.add(badge.id);
          toast.success(`🏆 Novo badge desbloqueado: ${badge.emoji} ${badge.name}!`, {
            description: badge.description,
            duration: 4000,
          });
        }
        newIds.add(badge.id);
      }
      setNewBadgeIds(newIds);
      saveNewBadgeIds(newIds);
    }
  }, [isSubscribed, mounted]);

  // Record an analysis and check for new badges
  const recordAnalysis = useCallback((instrumentSymbol: string, category: string, isComparison: boolean) => {
    if (typeof window === 'undefined') return;

    const current = loadData();

    // Update total analyses
    current.totalAnalyses += 1;

    // Update unique instruments
    if (!current.uniqueInstruments.includes(instrumentSymbol)) {
      current.uniqueInstruments.push(instrumentSymbol);
    }

    // Update categories
    if (!current.categoriesUsed.includes(category)) {
      current.categoriesUsed.push(category);
    }

    // Update first analysis date
    if (!current.firstAnalysisDate) {
      current.firstAnalysisDate = new Date().toISOString();
    }

    // Update streak
    const { streak, longestStreak } = updateStreak(current);
    current.streak = streak;
    current.longestStreak = longestStreak;
    current.lastActiveDate = getTodayStr();

    // Mark comparator badge if comparison
    if (isComparison) {
      const compBadge = current.badges.find(b => b.id === 'comparator');
      if (compBadge && !compBadge.earned) {
        compBadge.earned = true;
        compBadge.earnedAt = new Date().toISOString();
      }
    }

    // Check all badges
    const newlyEarned = checkBadges(current, isSubscribed);

    // Save
    saveData(current);
    setData({ ...current });

    // Show toast for newly earned badges
    if (newlyEarned.length > 0) {
      const newIds = new Set(newBadgeIds);
      for (const badge of newlyEarned) {
        if (!toastShownRef.current.has(badge.id)) {
          toastShownRef.current.add(badge.id);
          toast.success(`🏆 Novo badge desbloqueado: ${badge.emoji} ${badge.name}!`, {
            description: badge.description,
            duration: 4000,
          });
        }
        newIds.add(badge.id);
      }
      setNewBadgeIds(newIds);
      saveNewBadgeIds(newIds);
    }
  }, [isSubscribed, newBadgeIds]);

  // Check for new badges (manual check)
  const checkNewBadgesFn = useCallback((): Badge[] => {
    if (typeof window === 'undefined') return [];
    const current = loadData();
    const newlyEarned = checkBadges(current, isSubscribed);
    if (newlyEarned.length > 0) {
      saveData(current);
      setData({ ...current });
    }
    return newlyEarned;
  }, [isSubscribed]);

  // Check if a badge is newly earned (for UI highlighting)
  const isNewBadge = useCallback((badgeId: string): boolean => {
    return newBadgeIds.has(badgeId);
  }, [newBadgeIds]);

  // Clear a new badge notification
  const clearNewBadge = useCallback((badgeId: string) => {
    setNewBadgeIds(prev => {
      const next = new Set(prev);
      next.delete(badgeId);
      saveNewBadgeIds(next);
      return next;
    });
  }, []);

  return {
    data,
    recordAnalysis,
    checkNewBadges: checkNewBadgesFn,
    isNewBadge,
    clearNewBadge,
  };
}
