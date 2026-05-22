import { NextRequest, NextResponse } from 'next/server';
import { getAllAffiliates, getAllSales, markSalePaid } from '@/lib/db-affiliates';

const ADMIN_PASSWORD = 'ForexA1@Pr0!2025';
const ADMIN_EMAIL = 'aureliopozzer@gmail.com';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get('email');
    const password = searchParams.get('password');

    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: 'Email e senha são obrigatórios.' },
        { status: 400 }
      );
    }

    if (email !== ADMIN_EMAIL || password !== ADMIN_PASSWORD) {
      return NextResponse.json(
        { success: false, error: 'Credenciais inválidas.' },
        { status: 401 }
      );
    }

    const [affiliates, sales] = await Promise.all([
      getAllAffiliates(),
      getAllSales(),
    ]);

    return NextResponse.json({
      success: true,
      data: { affiliates, sales },
    });
  } catch (err) {
    console.error('[Affiliate Admin] GET Error:', err);
    return NextResponse.json(
      { success: false, error: 'Erro interno no servidor.' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password, action, saleId } = body;

    if (email !== ADMIN_EMAIL || password !== ADMIN_PASSWORD) {
      return NextResponse.json(
        { success: false, error: 'Credenciais inválidas.' },
        { status: 401 }
      );
    }

    if (action === 'mark_paid' && saleId) {
      const ok = await markSalePaid(saleId);
      if (!ok) {
        return NextResponse.json(
          { success: false, error: 'Erro ao marcar venda como paga.' },
          { status: 500 }
        );
      }
      return NextResponse.json({ success: true });
    }

    return NextResponse.json(
      { success: false, error: 'Ação inválida.' },
      { status: 400 }
    );
  } catch (err) {
    console.error('[Affiliate Admin] POST Error:', err);
    return NextResponse.json(
      { success: false, error: 'Erro interno no servidor.' },
      { status: 500 }
    );
  }
}
