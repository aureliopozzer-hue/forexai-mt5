import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth-server';

// Stripe keys
const stripeSecretKey = process.env.STRIPE_SECRET_KEY || '';
const monthlyPriceId = process.env.STRIPE_MONTHLY_PRICE_ID || '';
const annualPriceId = process.env.STRIPE_ANNUAL_PRICE_ID || '';

// Promo codes that grant discounts (no more free trial codes)
const TRIAL_PROMO_CODES: string[] = [];

/**
 * Validates a promo code against Stripe API using raw fetch.
 */
async function validatePromoCode(code: string): Promise<{ id: string; coupon: any } | null> {
  try {
    const stripeVersion = '2024-12-18.acacia';
    const response = await fetch(
      `https://api.stripe.com/v1/promotion_codes?code=${encodeURIComponent(code)}&active=true&limit=1`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${stripeSecretKey}`,
          'Stripe-Version': stripeVersion,
        },
      }
    );

    const data = await response.json();
    if (data.data && data.data.length > 0) {
      const promo = data.data[0];
      if (promo.coupon && promo.coupon.valid) {
        return { id: promo.id, coupon: promo.coupon };
      }
    }
    return null;
  } catch (err: any) {
    console.error('[Stripe] Error validating promo code:', err.message);
    return null;
  }
}

/**
 * Creates a checkout session using raw Stripe API fetch.
 */
async function createCheckoutSessionRaw(params: Record<string, string>): Promise<any> {
  const stripeVersion = '2024-12-18.acacia';
  const formBody = Object.entries(params)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');

  const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${stripeSecretKey}`,
      'Stripe-Version': stripeVersion,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: formBody,
  });

  const data = await response.json();
  if (data.error) {
    throw new Error(data.error.message);
  }
  return data;
}

export async function POST(request: NextRequest) {
  try {
    const authUser = await getAuthenticatedUser();

    if (!authUser) {
      return NextResponse.json(
        { error: 'Faça login com o Google antes de assinar.' },
        { status: 401 }
      );
    }

    if (!stripeSecretKey) {
      console.error('[Stripe] Missing STRIPE_SECRET_KEY');
      return NextResponse.json(
        { error: 'Pagamento não configurado. Chave Stripe ausente.' },
        { status: 503 }
      );
    }

    const body = await request.json();
    const plan = body?.plan || 'monthly';
    const promoCode = body?.promoCode?.trim().toUpperCase() || '';
    const origin = body?.origin || request.headers.get('origin') || process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

    const priceId = plan === 'annual' ? annualPriceId : monthlyPriceId;

    if (!priceId) {
      console.error('[Stripe] Missing price ID for plan:', plan);
      return NextResponse.json(
        { error: 'Pagamento não configurado. Plano não encontrado.' },
        { status: 503 }
      );
    }

    console.log('[Stripe] Creating checkout session for plan:', plan, 'priceId:', priceId, 'promoCode:', promoCode || 'none');

    // Get affiliate referral from cookies
    const affiliateRef = request.cookies.get('affiliate_ref')?.value || null;

    // Validate promo code against Stripe if provided
    let validatedPromo: { id: string; coupon: any } | null = null;
    if (promoCode) {
      validatedPromo = await validatePromoCode(promoCode);
      if (!validatedPromo) {
        return NextResponse.json(
          { error: 'Código promocional inválido ou expirado.' },
          { status: 400 }
        );
      }
    }

    // Check if promo code grants a free trial (no card required)
    const isTrialPromo = TRIAL_PROMO_CODES.includes(promoCode) && validatedPromo !== null;

    // Build base checkout session parameters
    const sessionParams: Record<string, string> = {
      'mode': 'subscription',
      'line_items[0][price]': priceId,
      'line_items[0][quantity]': '1',
      'success_url': `${origin}/app/?subscribed=true&session_id={CHECKOUT_SESSION_ID}`,
      'cancel_url': `${origin}/app/?canceled=true`,
      'locale': 'pt-BR',
      // Store email in metadata for verification, but do NOT pre-fill customer_email
      // This prevents Stripe Link from auto-detecting the user and requiring card
      'metadata[userId]': authUser.id,
      'metadata[userEmail]': authUser.email,
      'metadata[priceId]': priceId,
      'metadata[affiliateRef]': affiliateRef || '',
      'metadata[promoCode]': promoCode || '',
      'metadata[isTrialPromo]': isTrialPromo ? 'true' : 'false',
    };

    if (isTrialPromo) {
      // 🎫 FREE TRIAL MODE — No card required
      // Legacy trial promo codes — currently empty, no codes grant trial
      console.log('[Stripe] Creating FREE TRIAL checkout (no coupon, no card) for promo code:', promoCode);

      // Only card payment method
      sessionParams['payment_method_types[0]'] = 'card';

      // Trial period — no card needed
      sessionParams['subscription_data[trial_period_days]'] = '3';

      // Don't require payment method during trial — THIS IS THE KEY
      sessionParams['payment_method_collection'] = 'if_required';

      // DO NOT pre-fill customer_email — prevents Stripe Link from triggering
      // DO NOT apply the promotion code discount — trial already covers the free period
      // DO NOT set allow_promotion_codes — we handle promo codes in our UI

    } else if (promoCode && validatedPromo) {
      // 🎫 NORMAL PROMO CODE — Card required, with discount
      console.log('[Stripe] Applying promo code with discount:', promoCode);

      sessionParams['payment_method_types[0]'] = 'card';
      sessionParams['discounts[0][promotion_code]'] = validatedPromo.id;
      // Pre-fill email for normal (non-trial) checkouts
      sessionParams['customer_email'] = authUser.email;

    } else {
      // 💳 NORMAL CHECKOUT — No promo code, card required
      console.log('[Stripe] Creating normal checkout');

      sessionParams['payment_method_types[0]'] = 'card';
      // Pre-fill email for normal checkouts
      sessionParams['customer_email'] = authUser.email;
      // Don't allow promo codes on Stripe page — we handle them in our UI
    }

    const session = await createCheckoutSessionRaw(sessionParams);

    console.log('[Stripe] Checkout session created:', session.id, '->', session.url, 'trial:', isTrialPromo);

    if (!session.url) {
      console.error('[Stripe] No session URL returned');
      return NextResponse.json(
        { error: 'Sessão criada mas sem URL de redirecionamento' },
        { status: 500 }
      );
    }

    return NextResponse.json({ url: session.url, isTrial: isTrialPromo });
  } catch (error: any) {
    const message = error?.message || 'Erro ao criar sessão de pagamento';
    console.error('[Stripe] Checkout error:', message);

    if (message.includes('No such price')) {
      return NextResponse.json(
        { error: 'Plano de pagamento indisponível no momento. Por favor, tente novamente mais tarde.' },
        { status: 503 }
      );
    }

    if (message.includes('Invalid API Key')) {
      return NextResponse.json(
        { error: 'Configuração de pagamento inválida. Contate o suporte.' },
        { status: 503 }
      );
    }

    if (message.includes('rate limit')) {
      return NextResponse.json(
        { error: 'Muitas tentativas. Aguarde um momento e tente novamente.' },
        { status: 429 }
      );
    }

    return NextResponse.json(
      { error: 'Erro ao processar pagamento. Tente novamente mais tarde.' },
      { status: 500 }
    );
  }
}
