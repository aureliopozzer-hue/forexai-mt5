// Google Analytics 4 custom event tracking
// GA4 Measurement ID: G-Y4ZJT67SEF

declare global {
  interface Window {
    gtag?: (...args: any[]) => void;
    dataLayer?: any[];
  }
}

function gtag(...args: any[]) {
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag(...args);
  }
}

// Track AI analysis usage
export function trackAIAnalysis(symbol: string, strategy: string) {
  gtag('event', 'ai_analysis', {
    event_category: 'engagement',
    event_label: symbol,
    strategy,
  });
}

// Track checkout initiation
export function trackCheckoutStart(plan: string, valueBRL: number) {
  gtag('event', 'begin_checkout', {
    currency: 'BRL',
    value: valueBRL,
    items: [{
      item_name: plan,
      item_category: 'subscription',
      price: valueBRL,
      quantity: 1,
    }],
  });
}

// Track completed purchase
export function trackPurchase(plan: string, valueBRL: number) {
  gtag('event', 'purchase', {
    currency: 'BRL',
    value: valueBRL,
    transaction_id: `txn_${Date.now()}`,
    items: [{
      item_name: plan,
      item_category: 'subscription',
      price: valueBRL,
      quantity: 1,
    }],
  });
}

// Track landing page CTA clicks
export function trackLandingCTA(location: string) {
  gtag('event', 'landing_cta', {
    event_category: 'engagement',
    event_label: location,
  });
}

// Track pattern scanner usage
export function trackPatternScan() {
  gtag('event', 'pattern_scan', {
    event_category: 'engagement',
  });
}

// Generic custom event
export function trackEvent(name: string, params?: Record<string, any>) {
  gtag('event', name, params);
}
