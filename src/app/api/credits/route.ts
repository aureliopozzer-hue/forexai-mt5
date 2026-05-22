import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { getAuthenticatedUser, getOrCreateUser, fetchUserByEmail } from '@/lib/auth-server';

const COST_ANALYSIS = 5;
const COST_COMPARISON = 3;
const TRIAL_DAYS = 3;

// Force dynamic rendering — NEVER cache credit data
export const dynamic = 'force-dynamic';

/**
 * GET /api/credits — Get the current user's trial/credit status.
 *
 * Trial system:
 * - Users get a 3-day free trial starting from their created_at timestamp
 * - During the trial, they have UNLIMITED access (no credit counting)
 * - When the trial expires, shouldBlock = true → payment modal appears
 * - After paying (Pro), they get unlimited access
 *
 * CRITICAL: isLoggedIn is determined by the NextAuth SESSION, NOT by Supabase.
 * Even if Supabase is down, if the user has a valid session, they ARE logged in.
 */
export async function GET() {
  try {
    // Step 1: Check NextAuth session FIRST — this is the source of truth for auth
    const session = await getServerSession(authOptions);
    const isLoggedIn = !!(session?.user?.email);

    if (!isLoggedIn) {
      // Not logged in — needs to login to get trial
      return NextResponse.json({
        success: true,
        credits: 0,
        isPro: false,
        isLoggedIn: false,
        isTrialActive: false,
        trialDaysRemaining: 0,
        trialEndDate: null,
        costAnalysis: COST_ANALYSIS,
        costComparison: COST_COMPARISON,
      });
    }

    // Step 2: Get user (from Supabase if possible, session fallback otherwise)
    const user = await getAuthenticatedUser();
    const isPro = user?.isPro ?? false;

    // Step 3: Calculate trial status based on created_at
    let isTrialActive = false;
    let trialDaysRemaining = 0;
    let trialEndDate: string | null = null;

    if (!isPro) {
      // Get the user's created_at from Supabase for trial calculation
      let createdAt: Date | null = null;

      if (user?.email) {
        const supabaseUser = await fetchUserByEmail(user.email);
        if (supabaseUser?.created_at) {
          createdAt = new Date(supabaseUser.created_at);
        }
      }

      // Fallback: if we couldn't get created_at from Supabase, treat trial as active
      // (optimistic for the user — they shouldn't be blocked if DB is unreachable)
      if (createdAt && !isNaN(createdAt.getTime())) {
        const now = new Date();
        const trialEndTime = new Date(createdAt.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000);
        trialEndDate = trialEndTime.toISOString();
        trialDaysRemaining = Math.max(0, Math.ceil((trialEndTime.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
        const trialExpired = now > trialEndTime;
        isTrialActive = !trialExpired;
      } else {
        // No created_at found — assume trial is active (optimistic)
        isTrialActive = true;
        trialDaysRemaining = TRIAL_DAYS;
        trialEndDate = null;
      }
    }

    // Determine credits value for backward compat
    // During trial or when Pro: 999 (unlimited)
    // When trial expired and not Pro: 0
    const credits = isPro ? 999 : (isTrialActive ? 999 : 0);

    // shouldBlock = logged in, not Pro, and trial has expired
    const shouldBlock = isLoggedIn && !isPro && !isTrialActive;

    return NextResponse.json({
      success: true,
      credits,
      isPro,
      isLoggedIn: true,
      isTrialActive,
      trialDaysRemaining,
      trialEndDate,
      shouldBlock,
      costAnalysis: COST_ANALYSIS,
      costComparison: COST_COMPARISON,
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    });
  } catch (err) {
    console.error('[Credits API] GET error:', err);
    return NextResponse.json({ success: false, error: 'Erro ao buscar créditos' }, { status: 500 });
  }
}

/**
 * POST /api/credits — Sync user to database after login.
 * Called by the frontend after Google login to ensure the user exists in DB.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, name, image } = body;

    if (!email) {
      return NextResponse.json({ success: false, error: 'Email é obrigatório' }, { status: 400 });
    }

    const user = await getOrCreateUser(email, name, image);

    // Calculate trial info for the newly created/ synced user
    let isTrialActive = false;
    let trialDaysRemaining = 0;
    let trialEndDate: string | null = null;

    if (!user.isPro) {
      const supabaseUser = await fetchUserByEmail(user.email);
      const createdAt = supabaseUser?.created_at ? new Date(supabaseUser.created_at) : null;

      if (createdAt && !isNaN(createdAt.getTime())) {
        const now = new Date();
        const trialEndTime = new Date(createdAt.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000);
        trialEndDate = trialEndTime.toISOString();
        trialDaysRemaining = Math.max(0, Math.ceil((trialEndTime.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
        isTrialActive = now <= trialEndTime;
      } else {
        isTrialActive = true;
        trialDaysRemaining = TRIAL_DAYS;
      }
    }

    const credits = user.isPro ? 999 : (isTrialActive ? 999 : 0);

    return NextResponse.json({
      success: true,
      credits,
      isPro: user.isPro,
      isLoggedIn: true,
      isTrialActive,
      trialDaysRemaining,
      trialEndDate,
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    });
  } catch (err) {
    console.error('[Credits API] POST error:', err);
    return NextResponse.json({ success: false, error: 'Erro ao sincronizar créditos' }, { status: 500 });
  }
}
