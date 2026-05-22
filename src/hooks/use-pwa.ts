'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

// localStorage key for tracking install prompt dismissal
const DISMISS_KEY = 'forexai-pwa-dismissed';
const DISMISS_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days before showing again

interface PWAState {
  /** Whether the app is running in standalone/installed mode */
  isInstalled: boolean;
  /** Whether the browser supports install prompt and it hasn't been dismissed */
  canInstall: boolean;
  /** Function to trigger the native install prompt */
  promptInstall: () => Promise<boolean>;
  /** Whether the device is currently online */
  isOnline: boolean;
  /** Whether the install prompt is currently being shown */
  isPromptVisible: boolean;
  /** Dismiss the install prompt */
  dismissPrompt: () => void;
}

export function usePWA(): PWAState {
  const [isInstalled, setIsInstalled] = useState(false);
  const [canInstall, setCanInstall] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [isPromptVisible, setIsPromptVisible] = useState(false);

  // Store the beforeinstallprompt event for later use
  const deferredPromptRef = useRef<any>(null);

  // Detect if app is installed (standalone mode)
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Check if running in standalone mode
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true || // iOS Safari
      document.referrer.includes('android-app://'); // Android TWA

    setIsInstalled(isStandalone);
  }, []);

  // Listen for beforeinstallprompt event
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleBeforeInstallPrompt = (e: Event) => {
      // Prevent the default mini-infobar on mobile
      e.preventDefault();
      // Store the event so it can be triggered later
      deferredPromptRef.current = e;

      // Check if user hasn't dismissed the prompt recently
      const dismissedAt = localStorage.getItem(DISMISS_KEY);
      if (dismissedAt) {
        const elapsed = Date.now() - parseInt(dismissedAt, 10);
        if (elapsed < DISMISS_DURATION) {
          setCanInstall(false);
          return;
        }
      }

      setCanInstall(true);
      // Show prompt after a brief delay (don't be too aggressive)
      const timer = setTimeout(() => {
        setIsPromptVisible(true);
      }, 5000);

      return () => clearTimeout(timer);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Listen for app installed event
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setCanInstall(false);
      setIsPromptVisible(false);
      deferredPromptRef.current = null;
      // Clear dismissal since user installed
      try {
        localStorage.removeItem(DISMISS_KEY);
      } catch {}
    };

    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  // Monitor online/offline status
  useEffect(() => {
    if (typeof window === 'undefined') return;

    setIsOnline(navigator.onLine);

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Prompt the user to install the app
  const promptInstall = useCallback(async (): Promise<boolean> => {
    const promptEvent = deferredPromptRef.current;

    if (!promptEvent) {
      // Fallback: guide user to use browser menu
      return false;
    }

    try {
      // Show the install prompt
      (promptEvent as any).prompt();

      // Wait for the user to respond to the prompt
      const { outcome } = await (promptEvent as any).userChoice;

      if (outcome === 'accepted') {
        setIsInstalled(true);
        setCanInstall(false);
        setIsPromptVisible(false);
        // Clear dismissal
        try {
          localStorage.removeItem(DISMISS_KEY);
        } catch {}
      }

      // Clear the deferred prompt — it can only be used once
      deferredPromptRef.current = null;

      return outcome === 'accepted';
    } catch {
      return false;
    }
  }, []);

  // Dismiss the install prompt
  const dismissPrompt = useCallback(() => {
    setIsPromptVisible(false);
    setCanInstall(false);
    // Remember dismissal time
    try {
      localStorage.setItem(DISMISS_KEY, Date.now().toString());
    } catch {}
  }, []);

  return {
    isInstalled,
    canInstall,
    promptInstall,
    isOnline,
    isPromptVisible,
    dismissPrompt,
  };
}
