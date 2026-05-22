import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth-server';
import { sendWelcomeEmail } from '@/lib/email';
import { rateLimitCredits } from '@/lib/rate-limit';

export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const rl = rateLimitCredits(request);
    if (!rl.success) {
      return NextResponse.json(
        { success: false, error: 'Muitas requisições. Aguarde um momento.' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil((rl.resetAt - Date.now()) / 1000)) } }
      );
    }

    // Require authentication
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Não autorizado. Faça login para continuar.' },
        { status: 401 },
      );
    }

    // Parse request body
    let body: { email?: string; name?: string };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: 'Corpo da requisição inválido.' },
        { status: 400 },
      );
    }

    const { email, name } = body;

    // Validate required fields
    if (!email || typeof email !== 'string') {
      return NextResponse.json(
        { success: false, error: 'O campo "email" é obrigatório.' },
        { status: 400 },
      );
    }

    // Verify the authenticated user's email matches the requested email
    if (user.email !== email) {
      return NextResponse.json(
        { success: false, error: 'O email não corresponde ao usuário autenticado.' },
        { status: 403 },
      );
    }

    // Send welcome email
    await sendWelcomeEmail(email, name || user.name || '');

    return NextResponse.json({
      success: true,
      message: 'Email de boas-vindas enviado com sucesso.',
    });
  } catch (err) {
    console.error('[API /send-welcome] Error:', err);
    return NextResponse.json(
      { success: false, error: 'Erro interno do servidor.' },
      { status: 500 },
    );
  }
}
