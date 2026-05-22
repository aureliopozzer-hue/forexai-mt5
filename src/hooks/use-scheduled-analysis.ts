'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { AnalysisStrategy } from '@/components/dashboard/types';

export interface ScheduledAnalysis {
  id: string;
  instrumentSymbol: string;
  instrumentName: string;
  strategy: AnalysisStrategy;
  time: string; // "HH:MM" format (24h)
  days: number[]; // 0=Sunday, 1=Monday, ..., 6=Saturday
  enabled: boolean;
  lastRun?: string; // ISO date of last execution
  createdAt: string;
}

const STORAGE_KEY = 'forexAI-scheduled-analyses';
const MAX_SCHEDULED = 10;
const CHECK_INTERVAL_MS = 30_000; // Check every 30 seconds

// Day labels in Portuguese
export const DAY_LABELS: Record<number, string> = {
  0: 'Dom',
  1: 'Seg',
  2: 'Ter',
  3: 'Qua',
  4: 'Qui',
  5: 'Sex',
  6: 'Sáb',
};

export const DAY_FULL_LABELS: Record<number, string> = {
  0: 'Domingo',
  1: 'Segunda',
  2: 'Terça',
  3: 'Quarta',
  4: 'Quinta',
  5: 'Sexta',
  6: 'Sábado',
};

function loadSchedules(): ScheduledAnalysis[] {
  if (typeof window === 'undefined') return [];
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) return parsed.slice(0, MAX_SCHEDULED);
    }
  } catch {}
  return [];
}

function saveSchedules(schedules: ScheduledAnalysis[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(schedules.slice(0, MAX_SCHEDULED)));
  } catch {}
}

/** Calculate the next run time for a schedule, or null if no future run exists */
export function getNextRunTime(schedule: ScheduledAnalysis): Date | null {
  const now = new Date();
  const [hours, minutes] = schedule.time.split(':').map(Number);

  // Check today and the next 7 days
  for (let i = 0; i <= 7; i++) {
    const candidate = new Date(now);
    candidate.setDate(candidate.getDate() + i);
    candidate.setHours(hours, minutes, 0, 0);

    // Must be in the future
    if (candidate.getTime() <= now.getTime()) continue;

    // Must be on an enabled day
    const dayOfWeek = candidate.getDay();
    if (schedule.days.includes(dayOfWeek)) {
      return candidate;
    }
  }

  return null;
}

/** Format a countdown to the next scheduled run */
export function formatCountdown(nextRun: Date | null): string {
  if (!nextRun) return '—';

  const now = new Date();
  const diffMs = nextRun.getTime() - now.getTime();

  if (diffMs <= 0) return 'Agora';

  const diffMins = Math.floor(diffMs / 60_000);
  const hours = Math.floor(diffMins / 60);
  const mins = diffMins % 60;

  if (hours > 24) {
    const days = Math.floor(hours / 24);
    const remainHours = hours % 24;
    return `${days}d ${remainHours}h`;
  }

  if (hours > 0) {
    return `${hours}h ${mins}m`;
  }

  return `${mins}m`;
}

export interface UseScheduledAnalysisReturn {
  schedules: ScheduledAnalysis[];
  addSchedule: (schedule: Omit<ScheduledAnalysis, 'id' | 'enabled' | 'lastRun' | 'createdAt'>) => ScheduledAnalysis | null;
  removeSchedule: (id: string) => void;
  updateSchedule: (id: string, updates: Partial<ScheduledAnalysis>) => void;
  toggleSchedule: (id: string) => void;
  clearAllSchedules: () => void;
  getNextRun: (id: string) => Date | null;
  canAddMore: boolean;
  /** Triggered schedule — set when a scheduled analysis fires, cleared by consumer */
  triggeredSchedule: ScheduledAnalysis | null;
  clearTriggered: () => void;
}

export function useScheduledAnalysis(): UseScheduledAnalysisReturn {
  const [schedules, setSchedules] = useState<ScheduledAnalysis[]>([]);
  const [triggeredSchedule, setTriggeredSchedule] = useState<ScheduledAnalysis | null>(null);
  const lastCheckedMinuteRef = useRef<string>('');

  // Load schedules after mount
  useEffect(() => {
    setSchedules(loadSchedules());
  }, []);

  // Persist whenever schedules change
  useEffect(() => {
    saveSchedules(schedules);
  }, [schedules]);

  // Check every 30 seconds if it's time to run a scheduled analysis
  useEffect(() => {
    const check = () => {
      const now = new Date();
      const currentDay = now.getDay();
      const currentHour = now.getHours();
      const currentMinute = now.getMinutes();
      const currentTimeKey = `${currentDay}-${currentHour}-${currentMinute}`;

      // Avoid re-triggering in the same minute
      if (lastCheckedMinuteRef.current === currentTimeKey) return;
      lastCheckedMinuteRef.current = currentTimeKey;

      const timeStr = `${String(currentHour).padStart(2, '0')}:${String(currentMinute).padStart(2, '0')}`;

      setSchedules(prev => {
        let updated = false;
        const newSchedules = prev.map(schedule => {
          if (!schedule.enabled) return schedule;
          if (!schedule.days.includes(currentDay)) return schedule;
          if (schedule.time !== timeStr) return schedule;

          // Check if already ran in this slot (within the same day)
          if (schedule.lastRun) {
            const lastRunDate = new Date(schedule.lastRun);
            const sameDay =
              lastRunDate.getFullYear() === now.getFullYear() &&
              lastRunDate.getMonth() === now.getMonth() &&
              lastRunDate.getDate() === now.getDate();
            if (sameDay) return schedule;
          }

          // Trigger this schedule!
          updated = true;
          setTriggeredSchedule(schedule);
          return { ...schedule, lastRun: now.toISOString() };
        });

        if (updated) {
          saveSchedules(newSchedules);
          return newSchedules;
        }
        return prev;
      });
    };

    // Check immediately on mount
    check();

    const interval = setInterval(check, CHECK_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  const addSchedule = useCallback(
    (schedule: Omit<ScheduledAnalysis, 'id' | 'enabled' | 'lastRun' | 'createdAt'>): ScheduledAnalysis | null => {
      let newSchedule: ScheduledAnalysis | null = null;

      setSchedules(prev => {
        if (prev.length >= MAX_SCHEDULED) return prev;

        newSchedule = {
          ...schedule,
          id: `sched-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          enabled: true,
          createdAt: new Date().toISOString(),
        };

        return [...prev, newSchedule!];
      });

      return newSchedule;
    },
    []
  );

  const removeSchedule = useCallback((id: string) => {
    setSchedules(prev => prev.filter(s => s.id !== id));
  }, []);

  const updateSchedule = useCallback((id: string, updates: Partial<ScheduledAnalysis>) => {
    setSchedules(prev =>
      prev.map(s => (s.id === id ? { ...s, ...updates } : s))
    );
  }, []);

  const toggleSchedule = useCallback((id: string) => {
    setSchedules(prev =>
      prev.map(s => (s.id === id ? { ...s, enabled: !s.enabled } : s))
    );
  }, []);

  const clearAllSchedules = useCallback(() => {
    setSchedules([]);
  }, []);

  const getNextRun = useCallback((id: string): Date | null => {
    const schedule = schedules.find(s => s.id === id);
    if (!schedule || !schedule.enabled) return null;
    return getNextRunTime(schedule);
  }, [schedules]);

  const clearTriggered = useCallback(() => {
    setTriggeredSchedule(null);
  }, []);

  return {
    schedules,
    addSchedule,
    removeSchedule,
    updateSchedule,
    toggleSchedule,
    clearAllSchedules,
    getNextRun,
    canAddMore: schedules.length < MAX_SCHEDULED,
    triggeredSchedule,
    clearTriggered,
  };
}
