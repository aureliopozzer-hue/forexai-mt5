import { NextRequest, NextResponse } from 'next/server';
import { setUserProStatus, fetchUserByStripeCustomerId } from '@/lib/auth-server';
import { findAffiliateBySlug, createAffiliateSale } from '@/lib/db-affiliates';

const stripeSecretKey = process.env.STRIPE_SECRET_KEY || '';
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || '';

// Lazy-loaded Stripe
let stripeInstance: any = null;

async function getStripe() {
  if (stripeInstance) return stripeInstance;
  try {
    const Stripe = (await import('stripe')).default;
    stripeInstance = new Stripe(stripeSecretKey, { typescript: false });
    return stripeInstance;
  } catch (err) {
    console.error('[Stripe Webhook] Failed to import stripe:', err);
    throw new Error('Stripe SDK not available');
  }
}

/**
 * POST /api/stripe/webhook
 *
 * Handles Stripe webhook events using Supabase REST API (not Prisma):
 * - checkout.session.completed: Mark user as Pro after successful payment
 * - customer.subscription.deleted: Remove Pro status and clear Stripe data when subscription is cancelled
 * - customer.subscription.updated: Update subscription status (with past_due logging)
 * - invoice.payment_failed: Remove Pro status when trial ends and payment fails
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const signature = request.headers.get('stripe-signature');

    if (!signature || !webhookSecret) {
      console.error('[Stripe Webhook] Missing signature or webhook secret');
      return NextResponse.json({ error: 'Webhook not configured' }, { status: 400 });
    }

    const stripe = await getStripe();

    // Verify the webhook signature
    let event: any;
    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (err: any) {
      console.error('[Stripe Webhook] Signature verification failed:', err.message);
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
    }

    console.log('[Stripe Webhook] Event received:', event.type);

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const customerEmail = session.customer_email || session.customer_details?.email;

        if (!customerEmail) {
          console.error('[Stripe Webhook] No email in checkout session');
          break;
        }

        // Mark user as Pro using Supabase REST API
        const success = await setUserProStatus(customerEmail, {
          isPro: true,
          stripeCustomerId: session.customer as string,
          stripeSubscriptionId: session.subscription as string,
          stripePriceId: session.metadata?.priceId || null,
        });

        if (success) {
          console.log('[Stripe Webhook] User marked as Pro:', customerEmail);
        } else {
          console.error('[Stripe Webhook] Failed to mark user as Pro:', customerEmail);
        }

        // ✅ Create affiliate sale if referral code exists in metadata
        const affiliateRef = session.metadata?.affiliateRef;
        if (affiliateRef) {
          try {
            const affiliate = await findAffiliateBySlug(affiliateRef);
            if (affiliate && affiliate.status === 'active') {
              // Determine plan and amount
              const amountTotal = session.amount_total || 0; // in cents
              const amountBRL = amountTotal / 100;
              const plan = amountTotal >= 40000 ? 'annual' : 'monthly'; // >= R$400 = annual
              const commissionRate = affiliate.commissionRate || 20;
              const commission = amountBRL * (commissionRate / 100);

              if (commission > 0) {
                await createAffiliateSale({
                  affiliateId: affiliate.id,
                  referredEmail: customerEmail,
                  plan,
                  amount: amountBRL,
                  commission,
                });
                console.log('[Stripe Webhook] Affiliate sale created:', affiliateRef, 'commission:', commission);
              }
            } else {
              console.warn('[Stripe Webhook] Affiliate not found or inactive:', affiliateRef);
            }
          } catch (err) {
            console.error('[Stripe Webhook] Error creating affiliate sale:', err);
            // Don't fail the webhook - payment was already processed
          }
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        const customerId = subscription.customer;

        // Find user by Stripe Customer ID using Supabase REST API
        const user = await fetchUserByStripeCustomerId(customerId);
        if (user) {
          const success = await setUserProStatus(user.email, {
            isPro: false,
            stripeCustomerId: null,
            stripeSubscriptionId: null,
            stripePriceId: null,
          });
          if (success) {
            console.log('[Stripe Webhook] User Pro status removed and Stripe data cleared:', user.email);
          }
        } else {
          console.warn('[Stripe Webhook] User not found for customer ID:', customerId);
        }
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object;
        const customerId = subscription.customer;

        const user = await fetchUserByStripeCustomerId(customerId);
        if (user) {
          // Log past_due status for debugging trial expiration issues
          if (subscription.status === 'past_due') {
            console.warn('[Stripe Webhook] Subscription past_due for user:', user.email, '- trial may have expired without payment');
          }

          // If subscription status is active/trialing, keep Pro; otherwise remove
          const isActive = subscription.status === 'active' || subscription.status === 'trialing';
          const success = await setUserProStatus(user.email, {
            isPro: isActive,
            stripePriceId: subscription.items?.data?.[0]?.price?.id || null,
          });
          if (success) {
            console.log('[Stripe Webhook] User subscription updated:', user.email, 'status:', subscription.status, 'active:', isActive);
          }
        }
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object;
        const customerId = invoice.customer;

        // Only act on the first invoice after trial (subscription_invoice)
        // If the invoice is for a subscription and payment failed, remove Pro
        if (invoice.subscription) {
          const user = await fetchUserByStripeCustomerId(customerId);
          if (user && user.isPro) {
            // Check the subscription status - if it's past_due, remove Pro
            try {
              const subscription = await stripe.subscriptions.retrieve(invoice.subscription);
              if (subscription.status === 'past_due' || subscription.status === 'unpaid') {
                const success = await setUserProStatus(user.email, {
                  isPro: false,
                  stripeSubscriptionId: null,
                  stripePriceId: null,
                });
                if (success) {
                  console.log('[Stripe Webhook] Pro removed due to payment failure:', user.email);
                }
              }
            } catch (err) {
              console.error('[Stripe Webhook] Error checking subscription status:', err);
            }
          }
        }
        break;
      }

      default:
        console.log('[Stripe Webhook] Unhandled event type:', event.type);
    }

    return NextResponse.json({ received: true });
  } catch (error: any) {
    console.error('[Stripe Webhook] Error:', error.message);
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}
