import { NextRequest, NextResponse } from 'next/server';
import { findAffiliateBySlug, incrementAffiliateClicks } from '@/lib/db-affiliates';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const ref = searchParams.get('ref');

    if (!ref) {
      return NextResponse.redirect(new URL('/', request.url));
    }

    const affiliate = await findAffiliateBySlug(ref);
    if (!affiliate) {
      return NextResponse.redirect(new URL('/', request.url));
    }

    // Increment clicks
    await incrementAffiliateClicks(ref);

    // Redirect to home with affiliate cookie
    const response = NextResponse.redirect(new URL('/', request.url));
    response.cookies.set('affiliate_ref', ref, {
      maxAge: 30 * 24 * 60 * 60, // 30 days
      path: '/',
      httpOnly: false,
      sameSite: 'lax',
    });

    return response;
  } catch (err) {
    console.error('[Affiliate Track] Error:', err);
    return NextResponse.redirect(new URL('/', request.url));
  }
}
