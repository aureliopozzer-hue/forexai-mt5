import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth-server';
import { getSupabaseServerClientSafe } from '@/lib/supabase';
import { rateLimitCheckout } from '@/lib/rate-limit';

const stripeSecretKey = process.env.STRIPE_SECRET_KEY || '';

// Lazy-loaded Stripe
let stripeInstance: any = null;

async function getStripe() {
  if (stripeInstance) return stripeInstance;
  try {
    const Stripe = (await import('stripe')).default;
    stripeInstance = new Stripe(stripeSecretKey, { typescript: false });
    return stripeInstance;
  } catch (err) {
    console.error('[Cancel-Subscription] Failed to import stripe:', err);
    throw new Error('Stripe SDK not available');
  }
}

/**
 * POST /api/cancel-subscription
 *
 * Cancels the user's active Stripe subscription.
 * The subscription will be cancelled at the end of the current billing period
 * (not immediately), so the user keeps access until then.
 */
export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const rl = rateLimitCheckout(request);
    if (!rl.success) {
      return NextResponse.json(
        { error: 'Muitas requisições. Aguarde um momento.' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil((rl.resetAt - Date.now()) / 1000)) } }
      );
    }

    const authUser = await getAuthenticatedUser(request);
    if (!authUser) {
      return NextResponse.json(
        { error: 'Faça login para cancelar sua assinatura.' },
        { status: 401 }
      );
    }

    if (!authUser.isPro) {
      return NextResponse.json(
        { error: 'Você não possui uma assinatura ativa.' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServerClientSafe();

    // Get the user's Stripe subscription ID
    let stripeSubscriptionId: string | null = null;

    if (supabase) {
      const { data: user, error } = await supabase
        .from('users')
        .select('stripe_subscription_id, stripe_customer_id')
        .eq('email', authUser.email)
        .single();

      if (error || !user) {
        return NextResponse.json(
          { error: 'Usuário não encontrado.' },
          { status: 404 }
        );
      }
      stripeSubscriptionId = user.stripe_subscription_id;
    }

    if (!stripeSubscriptionId) {
      return NextResponse.json(
        { error: 'Nenhuma assinatura Stripe encontrada. Contate o suporte.' },
        { status: 400 }
      );
    }

    if (!stripeSecretKey) {
      return NextResponse.json(
        { error: 'Configuração de pagamento não disponível.' },
        { status: 503 }
      );
    }

    const stripe = await getStripe();

    // Cancel at period end — user keeps access until the end of their billing period
    const subscription = await stripe.subscriptions.update(stripeSubscriptionId, {
      cancel_at_period_end: true,
    });

    console.log('[Cancel-Subscription] Subscription cancelled for:', authUser.email,
      'cancel_at:', subscription.cancel_at_period_end ? new Date(subscription.current_period_end * 1000).toISOString() : 'immediate');

    return NextResponse.json({
      success: true,
      message: 'Assinatura cancelada. Você manterá acesso até o fim do período atual.',
      cancelAtPeriodEnd: true,
      currentPeriodEnd: subscription.current_period_end
        ? new Date(subscription.current_period_end * 1000).toISOString()
        : null,
    });
  } catch (error: any) {
    console.error('[Cancel-Subscription] Error:', error.message);

    if (error.message?.includes('No such subscription')) {
      return NextResponse.json(
        { error: 'Assinatura não encontrada no Stripe. Contate o suporte.' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: 'Erro ao cancelar assinatura. Tente novamente mais tarde.' },
      { status: 500 }
    );
  }
}
