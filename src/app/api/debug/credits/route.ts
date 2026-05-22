import { NextResponse } from 'next/server';
import { getAuthenticatedUser, consumeCredits } from '@/lib/auth-server';

// Debug endpoint to trace credit deduction flow
// REMOVE THIS IN PRODUCTION
export const dynamic = 'force-dynamic';

export async function POST() {
  const logs: string[] = [];
  
  try {
    logs.push(`[DEBUG] SUPABASE_URL: ${process.env.NEXT_PUBLIC_SUPABASE_URL ? 'SET' : 'NOT SET'}`);
    logs.push(`[DEBUG] SUPABASE_KEY: ${process.env.SUPABASE_SERVICE_ROLE_KEY ? 'SET' : 'NOT SET'}`);
    
    // Step 1: Get authenticated user
    const authUser = await getAuthenticatedUser();
    if (!authUser) {
      return NextResponse.json({ logs, error: 'Not authenticated' });
    }
    
    logs.push(`[DEBUG] authUser.id: ${authUser.id}`);
    logs.push(`[DEBUG] authUser.email: ${authUser.email}`);
    logs.push(`[DEBUG] authUser.credits BEFORE: ${authUser.credits}`);
    logs.push(`[DEBUG] authUser.isPro: ${authUser.isPro}`);
    
    // Step 2: Consume 5 credits
    const result = await consumeCredits(authUser.id, 5);
    logs.push(`[DEBUG] consumeCredits(5) result: ${result}`);
    
    // Step 3: Re-read credits after deduction
    const authUser2 = await getAuthenticatedUser();
    if (authUser2) {
      logs.push(`[DEBUG] authUser.credits AFTER: ${authUser2.credits}`);
    }
    
    return NextResponse.json({ 
      logs, 
      creditsBefore: authUser.credits, 
      consumeResult: result,
      creditsAfter: authUser2?.credits,
    });
  } catch (err: any) {
    logs.push(`[DEBUG] ERROR: ${err.message}`);
    logs.push(`[DEBUG] STACK: ${err.stack?.substring(0, 500)}`);
    return NextResponse.json({ logs, error: err.message }, { status: 500 });
  }
}

export async function GET() {
  const logs: string[] = [];
  
  try {
    logs.push(`[DEBUG] SUPABASE_URL: ${process.env.NEXT_PUBLIC_SUPABASE_URL ? 'SET' : 'NOT SET'}`);
    logs.push(`[DEBUG] SUPABASE_KEY: ${process.env.SUPABASE_SERVICE_ROLE_KEY ? 'SET' : 'NOT SET'}`);
    
    const authUser = await getAuthenticatedUser();
    if (!authUser) {
      return NextResponse.json({ logs, error: 'Not authenticated' });
    }
    
    logs.push(`[DEBUG] authUser.id: ${authUser.id}`);
    logs.push(`[DEBUG] authUser.email: ${authUser.email}`);
    logs.push(`[DEBUG] authUser.credits: ${authUser.credits}`);
    logs.push(`[DEBUG] authUser.isPro: ${authUser.isPro}`);
    
    return NextResponse.json({ logs, credits: authUser.credits, isPro: authUser.isPro });
  } catch (err: any) {
    logs.push(`[DEBUG] ERROR: ${err.message}`);
    return NextResponse.json({ logs, error: err.message }, { status: 500 });
  }
}
