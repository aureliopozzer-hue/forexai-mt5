'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import { getVal, formatPrice, QuoteData } from '@/components/dashboard/types';

const ALERTS_STORAGE_KEY = 'forexAI-price-alerts';
const MAX_ALERTS = 50;
const TRIGGERED_EXPIRY_HOURS = 24;

export interface PriceAlert {
  id: string;
  instrumentSymbol: string;
  instrumentName: string;
  targetPrice: number;
  direction: 'above' | 'below'; // alert when price goes above or below target
  createdAt: string;
  triggered: boolean;
  triggeredAt?: string;
}

interface UsePriceAlertsReturn {
  alerts: PriceAlert[];
  addAlert: (instrumentSymbol: string, instrumentName: string, targetPrice: number, direction: 'above' | 'below') => void;
  removeAlert: (id: string) => void;
  clearTriggered: () => void;
  checkAlerts: (quotes: Record<string, QuoteData>) => void;
  activeCount: number; // non-triggered alerts
  triggeredCount: number;
  notificationPermission: NotificationPermission | 'default';
  requestNotificationPermission: () => Promise<boolean>;
}

function loadAlertsFromStorage(): PriceAlert[] {
  if (typeof window === 'undefined') return [];
  try {
    const stored = localStorage.getItem(ALERTS_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as PriceAlert[];
      // Auto-remove triggered alerts older than 24h
      const now = Date.now();
      return parsed.filter(a => {
        if (a.triggered && a.triggeredAt) {
          const triggeredTime = new Date(a.triggeredAt).getTime();
          const hoursSinceTriggered = (now - triggeredTime) / (1000 * 60 * 60);
          return hoursSinceTriggered < TRIGGERED_EXPIRY_HOURS;
        }
        return true;
      });
    }
  } catch {}
  return [];
}

function saveAlertsToStorage(alerts: PriceAlert[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(ALERTS_STORAGE_KEY, JSON.stringify(alerts));
  } catch {}
}

function getNotificationPermission(): NotificationPermission | 'default' {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'default';
  return Notification.permission;
}

export function usePriceAlerts(): UsePriceAlertsReturn {
  const [alerts, setAlerts] = useState<PriceAlert[]>([]);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission | 'default'>('default');
  const [mounted, setMounted] = useState(false);
  // Track which alerts we've already notified for in this session
  const notifiedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    setMounted(true);
    setAlerts(loadAlertsFromStorage());
    setNotificationPermission(getNotificationPermission());
  }, []);

  const requestNotificationPermission = useCallback(async (): Promise<boolean> => {
    if (typeof window === 'undefined' || !('Notification' in window)) return false;

    try {
      const permission = await Notification.requestPermission();
      setNotificationPermission(permission);
      return permission === 'granted';
    } catch {
      return false;
    }
  }, []);

  const addAlert = useCallback((
    instrumentSymbol: string,
    instrumentName: string,
    targetPrice: number,
    direction: 'above' | 'below'
  ) => {
    const newAlert: PriceAlert = {
      id: `alert-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      instrumentSymbol,
      instrumentName,
      targetPrice,
      direction,
      createdAt: new Date().toISOString(),
      triggered: false,
    };

    setAlerts(prev => {
      const updated = [newAlert, ...prev].slice(0, MAX_ALERTS);
      saveAlertsToStorage(updated);
      return updated;
    });

    // Request notification permission gracefully on first alert creation
    if (getNotificationPermission() !== 'granted') {
      requestNotificationPermission();
    }

    const dirLabel = direction === 'above' ? 'acima de' : 'abaixo de';
    toast.success('🔔 Alerta criado!', {
      description: `${instrumentName} ${dirLabel} ${formatPrice(targetPrice, instrumentSymbol)}`,
    });
  }, [requestNotificationPermission]);

  const removeAlert = useCallback((id: string) => {
    setAlerts(prev => {
      const updated = prev.filter(a => a.id !== id);
      saveAlertsToStorage(updated);
      return updated;
    });
    notifiedRef.current.delete(id);
  }, []);

  const clearTriggered = useCallback(() => {
    setAlerts(prev => {
      const updated = prev.filter(a => !a.triggered);
      saveAlertsToStorage(updated);
      return updated;
    });
  }, []);

  const checkAlerts = useCallback((quotes: Record<string, QuoteData>) => {
    if (!mounted) return;

    setAlerts(prev => {
      let hasNewTrigger = false;
      const updated = prev.map(alert => {
        if (alert.triggered) return alert;

        const quote = quotes[alert.instrumentSymbol];
        if (!quote) return alert;

        const currentPrice = getVal(quote.regularMarketPrice);
        if (!currentPrice || currentPrice <= 0) return alert;

        const isTriggered = alert.direction === 'above'
          ? currentPrice >= alert.targetPrice
          : currentPrice <= alert.targetPrice;

        if (isTriggered && !notifiedRef.current.has(alert.id)) {
          hasNewTrigger = true;
          notifiedRef.current.add(alert.id);

          const dirLabel = alert.direction === 'above' ? 'acima de' : 'abaixo de';
          const emoji = alert.direction === 'above' ? '📈' : '📉';
          const message = `${emoji} ${alert.instrumentName} está ${dirLabel} ${formatPrice(alert.targetPrice, alert.instrumentSymbol)}! Preço atual: ${formatPrice(currentPrice, alert.instrumentSymbol)}`;

          // Show in-app toast
          toast.success('🔔 Alerta disparado!', {
            description: message,
            duration: 6000,
          });

          // Show browser notification if permitted
          if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
            try {
              new Notification('ForexAI Pro — Alerta de Preço', {
                body: message,
                icon: '/icon-192.png',
                tag: alert.id, // prevents duplicate notifications
              });
            } catch {}
          }

          return {
            ...alert,
            triggered: true,
            triggeredAt: new Date().toISOString(),
          };
        }

        return alert;
      });

      if (hasNewTrigger) {
        saveAlertsToStorage(updated);
      }

      return hasNewTrigger ? updated : prev;
    });
  }, [mounted]);

  const activeCount = alerts.filter(a => !a.triggered).length;
  const triggeredCount = alerts.filter(a => a.triggered).length;

  return {
    alerts,
    addAlert,
    removeAlert,
    clearTriggered,
    checkAlerts,
    activeCount,
    triggeredCount,
    notificationPermission,
    requestNotificationPermission,
  };
}
