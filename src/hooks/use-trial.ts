'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';

const COST_ANALYSIS = 5;
const COST_COMPARISON = 3;
const TRIAL_DAYS = 3;

export interface CreditStatus {
  credits: number;           // 999 during trial/Pro, 0 when expired
  maxCredits: number;        // Keep for backward compat
  isSubscribed: boolean;
  hasCredits: boolean;       // true during trial or when Pro
  shouldBlock: boolean;      // true when trial expired and not Pro
  isLoggedIn: boolean;
  creditsLoaded: boolean;
  isTrial: boolean;          // true during free trial
  trialEndDate: string | null;
  trialDaysRemaining: number; // days remaining in trial
}

/**
 * Fetch credits from server — ALWAYS fresh, never cached.
 */
export async function fetchCreditStatus(): Promise<CreditStatus> {
  try {
    const res = await fetch(`/api/credits?_t=${Date.now()}`, {
      credentials: 'include',
      signal: AbortSignal.timeout(8000),
      headers: {
        'Cache-Control': 'no-store',
      },
    });
    if (res.ok) {
      const data = await res.json();
      if (data.success) {
        const isTrialActive = data.isTrialActive || false;
        const isPro = data.isPro || false;
        const credits = isPro ? 999 : (isTrialActive ? 999 : (data.credits ?? 0));
        const shouldBlock = data.shouldBlock ?? (data.isLoggedIn ? (!isPro && !isTrialActive) : false);

        return {
          credits,
          maxCredits: TRIAL_DAYS, // For backward compat, but now represents trial days
          isSubscribed: isPro,
          hasCredits: isPro || isTrialActive || credits > 0,
          shouldBlock,
          isLoggedIn: data.isLoggedIn || false,
          creditsLoaded: true,
          isTrial: isTrialActive,
          trialEndDate: data.trialEndDate || null,
          trialDaysRemaining: data.trialDaysRemaining ?? 0,
        };
      }
    }
  } catch {}
  return {
    credits: 0,
    maxCredits: TRIAL_DAYS,
    isSubscribed: false,
    hasCredits: false,
    shouldBlock: false,
    isLoggedIn: false,
    creditsLoaded: true,
    isTrial: false,
    trialEndDate: null,
    trialDaysRemaining: 0,
  };
}

export function useCredits(): CreditStatus & {
  refresh: () => void;
  subscribe: () => void;
  useCredit: () => boolean;
  useCredits: (n: number) => boolean;
  canAnalyze: () => boolean;
  canCompare: () => boolean;
  setCreditsFromServer: (creditsRemaining: number, isPro?: boolean) => void;
} {
  const { data: session, status: authStatus } = useSession();
  const [status, setStatus] = useState<CreditStatus>({
    credits: 0,
    maxCredits: TRIAL_DAYS,
    isSubscribed: false,
    hasCredits: false,
    shouldBlock: false,
    isLoggedIn: false,
    creditsLoaded: false,
    isTrial: false,
    trialEndDate: null,
    trialDaysRemaining: 0,
  });

  // Re-fetch credits when auth status changes (e.g., after Google login)
  useEffect(() => {
    if (authStatus === 'authenticated') {
      console.log('[useCredits] Auth status changed to authenticated — refreshing credits');
      fetchCreditStatus().then(newStatus => {
        setStatus(prev => ({ ...newStatus, creditsLoaded: true }));
      });
    } else if (authStatus === 'unauthenticated') {
      // Reset credits when logged out
      setStatus(prev => ({
        ...prev,
        credits: 0,
        isSubscribed: false,
        hasCredits: false,
        shouldBlock: false,
        isLoggedIn: false,
        creditsLoaded: true,
        isTrial: false,
        trialEndDate: null,
        trialDaysRemaining: 0,
      }));
    }
  }, [authStatus]);

  const refresh = useCallback(() => {
    fetchCreditStatus().then(newStatus => {
      setStatus(prev => ({
        ...newStatus,
        creditsLoaded: prev.creditsLoaded || newStatus.creditsLoaded,
      }));
    });
  }, []);

  const subscribe = useCallback(() => {
    refresh();
  }, [refresh]);

  const useCredit = useCallback((): boolean => {
    return status.isSubscribed || status.isTrial || status.credits >= COST_ANALYSIS;
  }, [status]);

  const useCredits = useCallback((count: number): boolean => {
    return status.isSubscribed || status.isTrial || status.credits >= count;
  }, [status]);

  const canAnalyze = useCallback((): boolean => {
    return status.isSubscribed || status.isTrial || status.credits >= COST_ANALYSIS;
  }, [status]);

  const canCompare = useCallback((): boolean => {
    return status.isSubscribed || status.isTrial || status.credits >= COST_COMPARISON;
  }, [status]);

  useEffect(() => {
    fetchCreditStatus().then(newStatus => {
      setStatus(prev => ({ ...newStatus, creditsLoaded: true }));
    });

    // Poll every 30 seconds to stay in sync
    const interval = setInterval(() => {
      fetchCreditStatus().then(newStatus => {
        setStatus(prev => ({ ...newStatus, creditsLoaded: true }));
      });
    }, 30 * 1000);

    // Listen for cross-tab login events (StorageEvent fires in OTHER tabs)
    const handleAuthLogin = (e: StorageEvent) => {
      if (e.key === 'forexai-auth-login') {
        setTimeout(() => {
          fetchCreditStatus().then(newStatus => {
            setStatus(prev => ({ ...newStatus, creditsLoaded: true }));
          });
        }, 500);
      }
    };

    // Listen for same-tab login events (custom event from auth-provider)
    const handleCreditsRefresh = () => {
      console.log('[useCredits] Received credits-refresh event — fetching fresh credits');
      fetchCreditStatus().then(newStatus => {
        setStatus(prev => ({ ...newStatus, creditsLoaded: true }));
      });
    };

    window.addEventListener('storage', handleAuthLogin);
    window.addEventListener('forexai-credits-refresh', handleCreditsRefresh);

    return () => {
      clearInterval(interval);
      window.removeEventListener('storage', handleAuthLogin);
      window.removeEventListener('forexai-credits-refresh', handleCreditsRefresh);
    };
  }, []);

  // Set credits from server response — the server has ALREADY written to the DB,
  // so this value is authoritative. No need to re-fetch.
  const setCreditsFromServer = useCallback((creditsRemaining: number, isPro?: boolean) => {
    const newIsSubscribed = isPro ?? false;
    const newCredits = newIsSubscribed ? 999 : creditsRemaining;
    console.log(`[setCreditsFromServer] Setting credits to ${newCredits} (isPro: ${isPro}, isSubscribed: ${newIsSubscribed})`);
    setStatus(prev => ({
      ...prev,
      credits: newCredits,
      isSubscribed: newIsSubscribed,
      hasCredits: newIsSubscribed || prev.isTrial || newCredits > 0,
      shouldBlock: prev.isLoggedIn ? (!newIsSubscribed && !prev.isTrial && newCredits < COST_ANALYSIS) : false,
      creditsLoaded: true,
    }));
  }, []);

  return { ...status, refresh, subscribe, useCredit, useCredits, canAnalyze, canCompare, setCreditsFromServer };
}

// Legacy exports
export function getCreditInfo(): CreditStatus {
  return { credits: 0, maxCredits: TRIAL_DAYS, isSubscribed: false, hasCredits: false, shouldBlock: false, isLoggedIn: false, creditsLoaded: false, isTrial: false, trialEndDate: null, trialDaysRemaining: 0 };
}
export function markAsSubscribed() {}
export function isUserSubscribed(): boolean { return false; }
export function resetCredits() {}
export { COST_ANALYSIS, COST_COMPARISON, TRIAL_DAYS };
export { useCredits as useTrial };
