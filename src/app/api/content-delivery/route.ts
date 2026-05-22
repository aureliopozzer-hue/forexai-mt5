import { NextRequest, NextResponse } from 'next/server';
import { setUserProStatus } from '@/lib/auth-server';

/**
 * Eduzz Custom Delivery Endpoint
 * 
 * Documentation: https://github.com/eduzz/custom-delivery
 * 
 * When a customer purchases a product on Eduzz, Eduzz sends a POST request
 * to this endpoint with the sale data. We must:
 * 
 * 1. Authenticate using edz_cli_origin_secret
 * 2. When type === 'create': Grant user Pro access
 * 3. When type === 'remove': Remove user Pro access
 * 4. ALWAYS return HTTP 200 (Eduzz considers success as HTTP 200)
 */

const EDUZZ_ORIGIN_SECRET = process.env.EDUZZ_ORIGIN_SECRET || '';

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json();
    const { type, fields } = payload;

    // Log for debugging
    console.log('[Eduzz Delivery] Received:', { type, email: fields?.edz_cli_email });

    // ── Authentication ──────────────────────────────────────────────
    // Validate using edz_cli_origin_secret (recommended by Eduzz)
    // https://orbita.eduzz.com/producer/config-api
    if (EDUZZ_ORIGIN_SECRET && fields?.edz_cli_origin_secret) {
      if (fields.edz_cli_origin_secret !== EDUZZ_ORIGIN_SECRET) {
        console.warn('[Eduzz Delivery] Authentication failed: origin_secret mismatch');
        // Still return 200 to avoid Eduzz retrying, but don't process
        return NextResponse.json({ success: false, message: 'Authentication failed' });
      }
    } else if (EDUZZ_ORIGIN_SECRET && !fields?.edz_cli_origin_secret) {
      console.warn('[Eduzz Delivery] Missing origin_secret in payload');
      return NextResponse.json({ success: false, message: 'Missing authentication' });
    }
    // If EDUZZ_ORIGIN_SECRET is not configured, skip auth (for initial setup/testing)

    // ── Process the delivery event ──────────────────────────────────
    const customerEmail = fields?.edz_cli_email;
    const customerName = fields?.edz_cli_rsocial;
    const productTitle = fields?.edz_cnt_titulo;
    const invoiceStatus = fields?.edz_fat_status;
    const contractStatus = fields?.edz_con_status_cod;

    if (!customerEmail) {
      console.error('[Eduzz Delivery] No customer email in payload');
      return NextResponse.json({ success: false, message: 'No customer email' });
    }

    if (type === 'create') {
      // Grant Pro access to the customer
      // Invoice status 3 = Paga (Paid)
      const isPaid = invoiceStatus === 3;
      
      if (isPaid) {
        const success = await setUserProStatus(customerEmail, {
          isPro: true,
        });

        if (success) {
          console.log(`[Eduzz Delivery] ✅ Pro access granted to: ${customerEmail} (Product: ${productTitle})`);
        } else {
          console.error(`[Eduzz Delivery] ❌ Failed to grant Pro access to: ${customerEmail}`);
        }
      } else {
        console.log(`[Eduzz Delivery] Invoice not paid yet (status: ${invoiceStatus}) for: ${customerEmail}`);
      }
    } else if (type === 'remove') {
      // Remove Pro access (refund, cancelled subscription, etc.)
      const success = await setUserProStatus(customerEmail, {
        isPro: false,
      });

      if (success) {
        console.log(`[Eduzz Delivery] 🔒 Pro access removed from: ${customerEmail}`);
      } else {
        console.error(`[Eduzz Delivery] ❌ Failed to remove Pro access from: ${customerEmail}`);
      }
    } else {
      console.warn(`[Eduzz Delivery] Unknown type: ${type}`);
    }

    // ALWAYS return 200 — Eduzz considers success as HTTP 200
    return NextResponse.json({
      success: true,
      message: `Delivery processed: ${type}`,
    });
  } catch (error: any) {
    console.error('[Eduzz Delivery] Error:', error.message);
    // Still return 200 to prevent Eduzz from retrying endlessly
    return NextResponse.json({
      success: false,
      message: 'Processing error',
    });
  }
}

export async function GET() {
  return NextResponse.json({
    success: true,
    message: 'Eduzz content delivery endpoint active',
  });
}
