import { NextRequest, NextResponse } from 'next/server';
import { registerAffiliate, findAffiliateByEmail } from '@/lib/db-affiliates';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, name, pixKey, pixType } = body;

    if (!email || !name || !pixKey || !pixType) {
      return NextResponse.json(
        { success: false, error: 'Todos os campos são obrigatórios.' },
        { status: 400 }
      );
    }

    // Check if already exists
    const existing = await findAffiliateByEmail(email);
    if (existing) {
      return NextResponse.json(
        { success: false, error: 'Este email já está cadastrado como afiliado.' },
        { status: 409 }
      );
    }

    const affiliate = await registerAffiliate({ email, name, pixKey, pixType });
    if (!affiliate) {
      return NextResponse.json(
        { success: false, error: 'Erro ao criar conta de afiliado.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      affiliate: {
        id: affiliate.id,
        email: affiliate.email,
        name: affiliate.name,
        referralCode: affiliate.referralCode,
        status: affiliate.status,
      },
    });
  } catch (err: any) {
    if (err.message === 'EMAIL_EXISTS') {
      return NextResponse.json(
        { success: false, error: 'Este email já está cadastrado como afiliado.' },
        { status: 409 }
      );
    }
    console.error('[Affiliate Register] Error:', err);
    return NextResponse.json(
      { success: false, error: 'Erro interno no servidor.' },
      { status: 500 }
    );
  }
}
