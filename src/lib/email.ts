import { Resend } from 'resend';

const FROM = 'ForexAI Pro <noreply@forexaiproelite.vercel.app>';

function getResendClient(): Resend | null {
  if (!process.env.RESEND_API_KEY) {
    console.log('[Email] RESEND_API_KEY not set — running in dev mode, emails will be logged to console');
    return null;
  }
  return new Resend(process.env.RESEND_API_KEY);
}

/* ──────────────────────────────────────────────
   Welcome Email
   ────────────────────────────────────────────── */

export async function sendWelcomeEmail(email: string, name: string): Promise<void> {
  const displayName = name || 'Trader';

  const html = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Bem-vindo ao ForexAI Pro</title>
</head>
<body style="margin:0;padding:0;background-color:#0f172a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#0f172a;min-height:100%;">
    <tr>
      <td align="center" style="padding:20px 16px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

          <!-- Gradient Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#06b6d4,#8b5cf6);border-radius:16px 16px 0 0;padding:40px 32px;text-align:center;">
              <h1 style="margin:0;font-size:32px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;">
                📈 ForexAI Pro
              </h1>
              <p style="margin:12px 0 0;font-size:16px;color:rgba(255,255,255,0.85);font-weight:400;">
                Análise inteligente de Forex com IA
              </p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="background-color:#1e293b;padding:36px 32px;border-left:1px solid #334155;border-right:1px solid #334155;">
              <h2 style="margin:0 0 8px;font-size:24px;font-weight:700;color:#f1f5f9;">
                Olá, ${displayName}! 🎉
              </h2>
              <p style="margin:0 0 24px;font-size:16px;color:#94a3b8;line-height:1.6;">
                Bem-vindo ao <strong style="color:#06b6d4;">ForexAI Pro</strong>! Estamos muito felizes por você ter se juntado à nossa plataforma de análise de Forex com inteligência artificial.
              </p>

              <!-- 100 Free Credits Card -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
                <tr>
                  <td style="background:linear-gradient(135deg,rgba(6,182,212,0.15),rgba(139,92,246,0.15));border:1px solid rgba(6,182,212,0.3);border-radius:12px;padding:24px;">
                    <p style="margin:0 0 4px;font-size:14px;color:#06b6d4;font-weight:600;text-transform:uppercase;letter-spacing:1px;">
                      🎁 Créditos Grátis
                    </p>
                    <p style="margin:0 0 8px;font-size:28px;font-weight:800;color:#ffffff;">
                      100 Créditos
                    </p>
                    <p style="margin:0;font-size:14px;color:#94a3b8;line-height:1.5;">
                      Você recebeu <strong style="color:#06b6d4;">100 créditos gratuitos</strong> para começar a usar nossa plataforma. Cada análise de IA consome créditos — use-os sabiamente!
                    </p>
                  </td>
                </tr>
              </table>

              <!-- How AI Analysis Works -->
              <h3 style="margin:0 0 12px;font-size:18px;font-weight:600;color:#e2e8f0;">
                🤖 Como funciona a Análise com IA?
              </h3>
              <p style="margin:0 0 16px;font-size:15px;color:#94a3b8;line-height:1.7;">
                Nossa IA analisa dados de mercado em tempo real, combinando indicadores técnicos, análise de sentimento e padrões históricos para gerar sinais de trading precisos. Basta selecionar um par de moedas e receber uma análise completa em segundos.
              </p>

              <ul style="margin:0 0 24px;padding-left:20px;color:#94a3b8;font-size:15px;line-height:2;">
                <li><strong style="color:#06b6d4;">Scan de Mercado</strong> — Identifica oportunidades em tempo real</li>
                <li><strong style="color:#8b5cf6;">Análise Profunda</strong> — Relatório detalhado com níveis de entrada e saída</li>
                <li><strong style="color:#06b6d4;">Gestão de Risco</strong> — Stop-loss e take-profit calculados pela IA</li>
              </ul>

              <!-- Subscription Info -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
                <tr>
                  <td style="background-color:#0f172a;border:1px solid #334155;border-radius:12px;padding:20px;">
                    <p style="margin:0 0 6px;font-size:14px;color:#8b5cf6;font-weight:600;">
                      ⚡ Quer créditos ilimitados?
                    </p>
                    <p style="margin:0;font-size:14px;color:#94a3b8;line-height:1.5;">
                      Assine o plano <strong style="color:#8b5cf6;">ForexAI Pro</strong> e tenha acesso ilimitado a todas as análises de IA, sem se preocupar com créditos. Cancele quando quiser!
                    </p>
                  </td>
                </tr>
              </table>

              <!-- CTA Button -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding:8px 0;">
                    <a href="https://forexaiproelite.vercel.app"
                       style="display:inline-block;background:linear-gradient(135deg,#06b6d4,#8b5cf6);color:#ffffff;text-decoration:none;font-size:16px;font-weight:700;padding:16px 40px;border-radius:12px;letter-spacing:0.3px;">
                      Começar Agora →
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color:#0f172a;border-radius:0 0 16px 16px;padding:24px 32px;border-top:1px solid #1e293b;text-align:center;">
              <p style="margin:0 0 8px;font-size:13px;color:#64748b;">
                © ${new Date().getFullYear()} ForexAI Pro. Todos os direitos reservados.
              </p>
              <p style="margin:0;font-size:12px;color:#475569;line-height:1.6;">
                <a href="https://forexaiproelite.vercel.app/terms" style="color:#64748b;text-decoration:underline;">Termos de Uso</a>
                &nbsp;·&nbsp;
                <a href="https://forexaiproelite.vercel.app/privacy" style="color:#64748b;text-decoration:underline;">Política de Privacidade</a>
                &nbsp;·&nbsp;
                <a href="mailto:noreply@forexaiproelite.vercel.app?subject=Unsubscribe" style="color:#64748b;text-decoration:underline;">Cancelar Inscrição</a>
              </p>
              <p style="margin:12px 0 0;font-size:11px;color:#475569;line-height:1.5;">
                Trading envolve riscos. Os sinais gerados pela IA são sugestões e não constituem aconselhamento financeiro. Sempre faça sua própria pesquisa antes de investir.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const subject = '🎉 Bem-vindo ao ForexAI Pro!';

  const resend = getResendClient();
  if (!resend) {
    console.log('[Email Dev] Would send welcome email:', { to: email, subject, name: displayName });
    return;
  }

  try {
    await resend.emails.send({ from: FROM, to: email, subject, html });
    console.log('[Email] Welcome email sent to:', email);
  } catch (err) {
    console.error('[Email] Failed to send welcome email:', err);
  }
}

/* ──────────────────────────────────────────────
   Payment Confirmation Email
   ────────────────────────────────────────────── */

export async function sendPaymentConfirmationEmail(email: string, name: string, plan: string): Promise<void> {
  const displayName = name || 'Trader';
  const planLabel = plan || 'ForexAI Pro';

  const html = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Assinatura ForexAI Pro Ativada</title>
</head>
<body style="margin:0;padding:0;background-color:#0f172a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#0f172a;min-height:100%;">
    <tr>
      <td align="center" style="padding:20px 16px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

          <!-- Gradient Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#06b6d4,#8b5cf6);border-radius:16px 16px 0 0;padding:40px 32px;text-align:center;">
              <h1 style="margin:0;font-size:32px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;">
                ✅ Assinatura Ativada!
              </h1>
              <p style="margin:12px 0 0;font-size:16px;color:rgba(255,255,255,0.85);font-weight:400;">
                ForexAI Pro — Bem-vindo ao próximo nível
              </p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="background-color:#1e293b;padding:36px 32px;border-left:1px solid #334155;border-right:1px solid #334155;">
              <h2 style="margin:0 0 8px;font-size:24px;font-weight:700;color:#f1f5f9;">
                Parabéns, ${displayName}! 🎉
              </h2>
              <p style="margin:0 0 24px;font-size:16px;color:#94a3b8;line-height:1.6;">
                Sua assinatura foi ativada com sucesso! Agora você tem acesso completo a todas as funcionalidades do <strong style="color:#06b6d4;">ForexAI Pro</strong>.
              </p>

              <!-- Plan Details Card -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
                <tr>
                  <td style="background:linear-gradient(135deg,rgba(6,182,212,0.15),rgba(139,92,246,0.15));border:1px solid rgba(6,182,212,0.3);border-radius:12px;padding:24px;">
                    <p style="margin:0 0 4px;font-size:14px;color:#06b6d4;font-weight:600;text-transform:uppercase;letter-spacing:1px;">
                       Seu Plano
                    </p>
                    <p style="margin:0 0 12px;font-size:28px;font-weight:800;color:#ffffff;">
                      ${planLabel}
                    </p>
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding:6px 0;color:#94a3b8;font-size:14px;">
                          <span style="color:#22c55e;font-weight:bold;">✓</span>&nbsp; Créditos ilimitados
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:6px 0;color:#94a3b8;font-size:14px;">
                          <span style="color:#22c55e;font-weight:bold;">✓</span>&nbsp; Análises de IA sem limites
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:6px 0;color:#94a3b8;font-size:14px;">
                          <span style="color:#22c55e;font-weight:bold;">✓</span>&nbsp; Scan de mercado em tempo real
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:6px 0;color:#94a3b8;font-size:14px;">
                          <span style="color:#22c55e;font-weight:bold;">✓</span>&nbsp; Suporte prioritário
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Unlimited Credits Badge -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
                <tr>
                  <td style="background-color:#0f172a;border:1px solid #334155;border-radius:12px;padding:20px;text-align:center;">
                    <p style="margin:0 0 4px;font-size:36px;">🚀</p>
                    <p style="margin:0 0 4px;font-size:20px;font-weight:800;color:#22c55e;">
                      Créditos Ilimitados Ativados
                    </p>
                    <p style="margin:0;font-size:14px;color:#94a3b8;">
                      Agora você pode fazer quantas análises quiser, sem restrições!
                    </p>
                  </td>
                </tr>
              </table>

              <!-- Thank You -->
              <p style="margin:0 0 24px;font-size:15px;color:#94a3b8;line-height:1.7;">
                Obrigado por confiar no <strong style="color:#06b6d4;">ForexAI Pro</strong>. Nossa missão é fornecer as melhores ferramentas de análise para que você tome decisões de trading mais informadas e confiantes.
              </p>

              <!-- CTA Button -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding:8px 0;">
                    <a href="https://forexaiproelite.vercel.app"
                       style="display:inline-block;background:linear-gradient(135deg,#06b6d4,#8b5cf6);color:#ffffff;text-decoration:none;font-size:16px;font-weight:700;padding:16px 40px;border-radius:12px;letter-spacing:0.3px;">
                      Usar Agora →
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color:#0f172a;border-radius:0 0 16px 16px;padding:24px 32px;border-top:1px solid #1e293b;text-align:center;">
              <p style="margin:0 0 8px;font-size:13px;color:#64748b;">
                © ${new Date().getFullYear()} ForexAI Pro. Todos os direitos reservados.
              </p>
              <p style="margin:0;font-size:12px;color:#475569;line-height:1.6;">
                <a href="https://forexaiproelite.vercel.app/terms" style="color:#64748b;text-decoration:underline;">Termos de Uso</a>
                &nbsp;·&nbsp;
                <a href="https://forexaiproelite.vercel.app/privacy" style="color:#64748b;text-decoration:underline;">Política de Privacidade</a>
                &nbsp;·&nbsp;
                <a href="mailto:noreply@forexaiproelite.vercel.app?subject=Unsubscribe" style="color:#64748b;text-decoration:underline;">Cancelar Inscrição</a>
              </p>
              <p style="margin:12px 0 0;font-size:11px;color:#475569;line-height:1.5;">
                Trading envolve riscos. Os sinais gerados pela IA são sugestões e não constituem aconselhamento financeiro. Sempre faça sua própria pesquisa antes de investir.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const subject = '✅ Assinatura ForexAI Pro Ativada!';

  const resend = getResendClient();
  if (!resend) {
    console.log('[Email Dev] Would send payment confirmation email:', { to: email, subject, name: displayName, plan: planLabel });
    return;
  }

  try {
    await resend.emails.send({ from: FROM, to: email, subject, html });
    console.log('[Email] Payment confirmation email sent to:', email);
  } catch (err) {
    console.error('[Email] Failed to send payment confirmation email:', err);
  }
}
