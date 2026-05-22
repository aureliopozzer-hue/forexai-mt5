import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { getAuthenticatedUser, setUserProStatus, fetchUserByEmail } from '@/lib/auth-server';

const stripeSecretKey = process.env.STRIPE_SECRET_KEY || '';

// Lazy-loaded Stripe
let stripeInstance: any = null;

async function getStripe() {
  if (stripeInstance && process.env.NODE_ENV === 'production') return stripeInstance;
  try {
    const Stripe = (await import('stripe')).default;
    stripeInstance = new Stripe(stripeSecretKey, { typescript: false });
    return stripeInstance;
  } catch (err) {
    console.error('[Verify-Subscription] Failed to import stripe:', err);
    throw new Error('Stripe SDK not available');
  }
}

/**
 * POST /api/verify-subscription
 *
 * Called after a successful Stripe Checkout redirect (/?subscribed=true).
 * Verifies the checkout session directly with Stripe API and marks the user as Pro
 * using Supabase REST API.
 *
 * Also works as a "check current status" endpoint when no sessionId is provided.
 */
export async function POST(request: NextRequest) {
  const debugLogs: string[] = [];

  try {
    debugLogs.push(`[1] Starting verification...`);
    debugLogs.push(`[2] STRIPE_SECRET_KEY: ${stripeSecretKey ? 'SET' : 'NOT SET'}`);

    // Step 1: Get authenticated user
    // Try getAuthenticatedUser first (uses Supabase), but also check NextAuth session directly
    // as a fallback — sometimes the session is valid but Supabase lookup fails
    let authUser = await getAuthenticatedUser();
    debugLogs.push(`[3] authUser: email=${authUser?.email}, id=${authUser?.id}, isPro=${authUser?.isPro}`);

    // If getAuthenticatedUser returned null, check NextAuth session directly
    // This handles the edge case where Supabase is down but the user has a valid session
    if (!authUser) {
      const session = await getServerSession(authOptions);
      debugLogs.push(`[3b] Direct session check: email=${session?.user?.email}`);
      if (session?.user?.email) {
        // Create a minimal auth user from the session
        authUser = {
          id: session.user.email, // Use email as ID for fallback
          email: session.user.email,
          name: session.user.name ?? null,
          image: session.user.image ?? null,
          credits: 0,
          isPro: false,
          createdAt: null,
        };
        debugLogs.push(`[3c] Using session fallback for: ${session.user.email}`);
      }
    }

    if (!authUser) {
      debugLogs.push('[4] No authenticated user — returning 401');
      return NextResponse.json(
        { error: 'Faça login para verificar sua assinatura.', debugLogs },
        { status: 401 }
      );
    }

    const body = await request.json();
    const sessionId = body?.sessionId;
    debugLogs.push(`[5] sessionId: ${sessionId || 'NOT PROVIDED'}`);

    // If no session ID or no Stripe key, check if user is already Pro in Supabase
    if (!sessionId || !stripeSecretKey) {
      debugLogs.push('[6] No sessionId or no Stripe key — checking if already Pro');
      const user = await fetchUserByEmail(authUser.email);
      debugLogs.push(`[7] Supabase user: is_pro=${user?.is_pro}, credits=${user?.credits}`);
      if (user?.is_pro) {
        return NextResponse.json({ success: true, isPro: true, alreadyPro: true, debugLogs });
      }
      return NextResponse.json(
        { error: 'Sessão de pagamento não encontrada.', debugLogs },
        { status: 400 }
      );
    }

    // Retrieve the checkout session from Stripe
    debugLogs.push(`[8] Retrieving Stripe session: ${sessionId}`);
    const stripe = await getStripe();

    let session: any;
    try {
      session = await stripe.checkout.sessions.retrieve(sessionId);
    } catch (stripeErr: any) {
      debugLogs.push(`[8b] Stripe retrieve error: ${stripeErr.message}`);
      console.error('[Verify-Subscription] Stripe retrieve error:', stripeErr.message);

      // If we can't reach Stripe, check if already Pro in Supabase
      const user = await fetchUserByEmail(authUser.email);
      if (user?.is_pro) {
        debugLogs.push(`[8c] Stripe failed but user is already Pro`);
        return NextResponse.json({ success: true, isPro: true, alreadyPro: true, debugLogs });
      }

      return NextResponse.json(
        { error: 'Erro ao verificar pagamento com Stripe. Tente novamente.', debugLogs },
        { status: 500 }
      );
    }

    debugLogs.push(`[9] Stripe session: payment_status=${session.payment_status}, mode=${session.mode}, customer_email=${session.customer_email}`);

    if (!session) {
      debugLogs.push('[10] Session not found');
      return NextResponse.json(
        { error: 'Sessão de pagamento não encontrada.', debugLogs },
        { status: 404 }
      );
    }

    // Verify the session belongs to this user
    // Check both customer_email and customer_details.email
    const sessionEmail = session.customer_email || session.customer_details?.email;
    const isTrialSession = session.amount_total === 0 || session.metadata?.isTrialPromo === 'true';
    debugLogs.push(`[11] Session email: ${sessionEmail}, auth email: ${authUser.email}, isTrial: ${isTrialSession}`);

    // Email match check — be lenient (case-insensitive)
    // For trial sessions: skip email check since customer_email isn't pre-filled
    // (we skip it to prevent Stripe Link from requiring card verification)
    // Instead, we verify via metadata userId or userEmail
    if (!isTrialSession) {
      if (sessionEmail && sessionEmail.toLowerCase() !== authUser.email.toLowerCase()) {
        debugLogs.push('[12] Email mismatch — returning 403');
        return NextResponse.json(
          { error: 'Sessão de pagamento não pertence a este usuário.', debugLogs },
          { status: 403 }
        );
      }
    } else {
      // Trial session: verify via metadata instead of email
      const metadataEmail = session.metadata?.userEmail;
      const metadataUserId = session.metadata?.userId;
      debugLogs.push(`[12] Trial session — verifying via metadata. metadataEmail: ${metadataEmail}, metadataUserId: ${metadataUserId}`);
      
      // For trial, we trust the session if metadata matches the authenticated user
      if (metadataEmail && metadataEmail.toLowerCase() !== authUser.email.toLowerCase()) {
        debugLogs.push('[12b] Metadata email mismatch — returning 403');
        return NextResponse.json(
          { error: 'Sessão de pagamento não pertence a este usuário.', debugLogs },
          { status: 403 }
        );
      }
    }

    // Check if the session is completed and payment is successful
    if (session.payment_status === 'paid' || session.payment_status === 'no_payment_required') {
      debugLogs.push('[13] Payment confirmed! Setting Pro status...');

      const stripeCustomerId = session.customer as string || null;
      const stripeSubscriptionId = session.subscription as string || null;
      const stripePriceId = session.metadata?.priceId || null;
      debugLogs.push(`[14] stripeCustomerId=${stripeCustomerId}, subId=${stripeSubscriptionId}, priceId=${stripePriceId}`);

      const success = await setUserProStatus(authUser.email, {
        isPro: true,
        stripeCustomerId,
        stripeSubscriptionId,
        stripePriceId,
      });

      debugLogs.push(`[15] setUserProStatus result: ${success}`);

      if (success) {
        // Verify the update actually took effect
        const verifyUser = await fetchUserByEmail(authUser.email);
        debugLogs.push(`[16] Verification: is_pro=${verifyUser?.is_pro}, credits=${verifyUser?.credits}`);

        if (verifyUser?.is_pro) {
          console.log('[Verify-Subscription] SUCCESS — User is now Pro:', authUser.email);
          return NextResponse.json({ success: true, isPro: true, debugLogs });
        } else {
          debugLogs.push('[17] WARNING: setUserProStatus returned true but is_pro is still false!');
          console.error('[Verify-Subscription] Pro status not persisted:', authUser.email);
          return NextResponse.json(
            { error: 'Erro ao ativar assinatura. Tente novamente.', debugLogs },
            { status: 500 }
          );
        }
      } else {
        debugLogs.push('[18] setUserProStatus returned false');
        console.error('[Verify-Subscription] Failed to update Pro status in Supabase');
        return NextResponse.json(
          { error: 'Erro ao ativar assinatura. Tente novamente.', debugLogs },
          { status: 500 }
        );
      }
    }

    // Payment is still pending
    if (session.payment_status === 'unpaid') {
      debugLogs.push('[19] Payment status is unpaid');
      return NextResponse.json({
        success: false,
        isPro: false,
        error: 'Pagamento ainda não confirmado. Aguarde um momento e tente novamente.',
        debugLogs,
      });
    }

    debugLogs.push(`[20] Unexpected payment status: ${session.payment_status}`);
    return NextResponse.json({
      success: false,
      isPro: false,
      error: 'Status do pagamento: ' + session.payment_status,
      debugLogs,
    });
  } catch (error: any) {
    debugLogs.push(`[ERROR] ${error.message}`);
    debugLogs.push(`[ERROR STACK] ${error.stack?.substring(0, 500)}`);
    console.error('[Verify-Subscription] Error:', error.message, error.stack);
    return NextResponse.json(
      { error: 'Erro ao verificar assinatura. Tente novamente.', debugLogs },
      { status: 500 }
    );
  }
}
