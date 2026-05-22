import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth-server';
import { getSupabaseServerClientSafe } from '@/lib/supabase';
import { rateLimitCredits } from '@/lib/rate-limit';

/**
 * GET /api/user/history — Returns payment/subscription history for the authenticated user.
 */
export async function GET(request: NextRequest) {
  try {
    // Rate limiting
    const rl = rateLimitCredits(request);
    if (!rl.success) {
      return NextResponse.json(
        { error: 'Muitas requisições. Aguarde um momento.' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil((rl.resetAt - Date.now()) / 1000)) } }
      );
    }

    const authUser = await getAuthenticatedUser(request);
    if (!authUser) {
      return NextResponse.json({ error: 'Faça login para ver seu histórico.' }, { status: 401 });
    }

    const supabase = getSupabaseServerClientSafe();

    if (!supabase) {
      return NextResponse.json({ payments: [] });
    }

    // Get user details from Supabase including subscription info
    const { data: user, error } = await supabase
      .from('users')
      .select('id, email, name, is_pro, credits, stripe_customer_id, stripe_subscription_id, stripe_price_id, created_at, updated_at')
      .eq('email', authUser.email)
      .single();

    if (error || !user) {
      console.error('[User History] Supabase error:', error);
      return NextResponse.json({ payments: [] });
    }

    // Build payment history from subscription data
    const payments: Array<{
      id: string;
      date: string;
      description: string;
      amount: string;
      status: 'paid' | 'pending' | 'failed' | 'refunded';
      plan: string;
    }> = [];

    // If user has a Stripe subscription, fetch invoices from Stripe
    if (user.stripe_customer_id) {
      try {
        const Stripe = (await import('stripe')).default;
        const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', { typescript: false });

        const invoices = await stripe.invoices.list({
          customer: user.stripe_customer_id,
          limit: 20,
        });

        for (const invoice of invoices.data) {
          const plan = invoice.lines.data[0]?.price?.id === process.env.STRIPE_ANNUAL_PRICE_ID
            ? 'Plano Anual'
            : 'Plano Mensal';

          payments.push({
            id: invoice.id,
            date: new Date(invoice.created * 1000).toISOString(),
            description: `ForexAI Pro — ${plan}`,
            amount: new Intl.NumberFormat('pt-BR', {
              style: 'currency',
              currency: invoice.currency.toUpperCase() === 'BRL' ? 'BRL' : 'USD',
            }).format(invoice.amount_paid / 100),
            status: invoice.status === 'paid' ? 'paid'
              : invoice.status === 'open' ? 'pending'
              : invoice.status === 'void' ? 'failed'
              : invoice.status === 'uncollectible' ? 'refunded'
              : 'pending',
            plan,
          });
        }
      } catch (stripeErr) {
        console.error('[User History] Stripe invoice fetch error:', stripeErr);
        // Fallback: show basic subscription info without invoices
      }
    }

    // Calculate subscription details
    let subscriptionPlan: 'monthly' | 'annual' | null = null;
    let nextBillingDate: string | null = null;
    let cancelAtPeriodEnd = false;
    let isTrial = false;
    let trialEndDate: string | null = null;
    let trialDaysRemaining: number | null = null;

    if (user.is_pro && user.stripe_subscription_id) {
      subscriptionPlan = user.stripe_price_id === process.env.STRIPE_ANNUAL_PRICE_ID
        ? 'annual'
        : 'monthly';

      // Try to fetch next billing date, cancellation status, and trial info from Stripe
      try {
        const Stripe = (await import('stripe')).default;
        const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', { typescript: false });
        const subscription = await stripe.subscriptions.retrieve(user.stripe_subscription_id);
        if (subscription.current_period_end) {
          nextBillingDate = new Date(subscription.current_period_end * 1000).toISOString();
        }
        cancelAtPeriodEnd = subscription.cancel_at_period_end ?? false;

        // Check if subscription is in trial mode
        isTrial = subscription.status === 'trialing';
        if (isTrial && subscription.trial_end) {
          trialEndDate = new Date(subscription.trial_end * 1000).toISOString();
          const now = Date.now();
          const endMs = subscription.trial_end * 1000;
          trialDaysRemaining = Math.max(0, Math.ceil((endMs - now) / (1000 * 60 * 60 * 24)));
        }
      } catch {
        // If we can't get the billing date, just leave it null
      }
    }

    const planName = !user.is_pro
      ? 'Gratuito'
      : isTrial
        ? 'Período de Teste (3 dias)'
        : subscriptionPlan === 'annual'
          ? 'Plano Pro Anual'
          : 'Plano Pro Mensal';

    return NextResponse.json({
      payments,
      subscription: {
        plan: planName,
        isPro: user.is_pro,
        credits: user.credits,
        stripeCustomerId: user.stripe_customer_id,
        memberSince: user.created_at,
        subscriptionPlan: isTrial ? null : subscriptionPlan,
        nextBillingDate,
        cancelAtPeriodEnd,
        isTrial,
        trialEndDate,
        trialDaysRemaining,
      },
    });
  } catch (error: any) {
    console.error('[User History] Error:', error.message);
    return NextResponse.json({ error: 'Erro ao buscar histórico.' }, { status: 500 });
  }
}
