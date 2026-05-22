import { NextRequest, NextResponse } from 'next/server';
import { findAffiliateByEmail } from '@/lib/db-affiliates';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email } = body;

    if (!email) {
      return NextResponse.json(
        { success: false, error: 'Email é obrigatório.' },
        { status: 400 }
      );
    }

    const affiliate = await findAffiliateByEmail(email);
    if (!affiliate) {
      return NextResponse.json(
        { success: false, error: 'Afiliado não encontrado.' },
        { status: 404 }
      );
    }

    if (affiliate.status === 'suspended') {
      return NextResponse.json(
        { success: false, error: 'Conta suspensa. Entre em contato com o suporte.' },
        { status: 403 }
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
        pixKey: affiliate.pixKey,
        pixType: affiliate.pixType,
        totalEarned: affiliate.totalEarned,
        totalPaid: affiliate.totalPaid,
        balance: affiliate.balance,
        clicks: affiliate.clicks,
        conversions: affiliate.conversions,
        createdAt: affiliate.createdAt,
      },
    });
  } catch (err) {
    console.error('[Affiliate Login] Error:', err);
    return NextResponse.json(
      { success: false, error: 'Erro interno no servidor.' },
      { status: 500 }
    );
  }
}
