import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const envInfo = {
    NEXTAUTH_URL: process.env.NEXTAUTH_URL || '(empty)',
    VERCEL_URL: process.env.VERCEL_URL || '(empty)',
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL || '(empty)',
    GOOGLE_CLIENT_ID_SET: !!process.env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET_SET: !!process.env.GOOGLE_CLIENT_SECRET,
    NEXTAUTH_SECRET_SET: !!process.env.NEXTAUTH_SECRET,
    NODE_ENV: process.env.NODE_ENV,
    VERCEL_ENV: process.env.VERCEL_ENV || '(not Vercel)',
    // Computed base URL that NextAuth would use
    computedBaseUrl: process.env.NEXTAUTH_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '(none)'),
  };

  return NextResponse.json(envInfo, { status: 200 });
}
