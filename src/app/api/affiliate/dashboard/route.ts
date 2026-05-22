import { NextRequest, NextResponse } from 'next/server';
import { findAffiliateById, getAffiliateSales } from '@/lib/db-affiliates';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const affiliateId = searchParams.get('affiliateId');

    if (!affiliateId) {
      return NextResponse.json(
        { success: false, error: 'ID do afiliado é obrigatório.' },
        { status: 400 }
      );
    }

    const [affiliate, sales] = await Promise.all([
      findAffiliateById(affiliateId),
      getAffiliateSales(affiliateId),
    ]);

    if (!affiliate) {
      return NextResponse.json(
        { success: false, error: 'Afiliado não encontrado.' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
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
        sales,
      },
    });
  } catch (err) {
    console.error('[Affiliate Dashboard] Error:', err);
    return NextResponse.json(
      { success: false, error: 'Erro interno no servidor.' },
      { status: 500 }
    );
  }
}
