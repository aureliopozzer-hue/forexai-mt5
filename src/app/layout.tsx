import type { Metadata, Viewport } from "next";
import Script from "next/script";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider } from "@/components/auth/auth-provider";

const GA_MEASUREMENT_ID = "G-Y4ZJT67SEF";

// Font CSS variables are declared in globals.css to avoid network-dependent
// fetching from Google Fonts at build time (which can fail in restricted envs).
const geistSans = { variable: "--font-geist-sans" };
const geistMono = { variable: "--font-geist-mono" };

export const viewport: Viewport = {
  themeColor: "#06b6d4",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
};

export const metadata: Metadata = {
  title: "ForexAI Pro - AI-Powered Market Analysis",
  description:
    "Real-time AI analysis for Forex, Indices, and Metals markets. Entry probability, technical analysis, and smart trading signals.",
  keywords: [
    "Forex",
    "AI Trading",
    "Market Analysis",
    "Indices",
    "Metals",
    "Technical Analysis",
  ],
  authors: [{ name: "ForexAI Pro" }],
  icons: {
    icon: [
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "ForexAI Pro",
  },
  openGraph: {
    title: "ForexAI Pro - Análise de Mercado com IA",
    description:
      "Plataforma de análise de mercado com inteligência artificial para Forex, Índices, Cripto e mais",
    type: "website",
    siteName: "ForexAI Pro",
    images: [{ url: "/stripe-icon.png", width: 1024, height: 1024 }],
  },
  other: {
    "mobile-web-app-capable": "yes",
    "msapplication-TileColor": "#06b6d4",
    "msapplication-tap-highlight": "no",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className="dark" suppressHydrationWarning>
      <head>
        <link rel="apple-touch-icon" href="/icon-192.png" />
        <link rel="apple-touch-icon" sizes="192x192" href="/icon-192.png" />
        <link rel="apple-touch-icon" sizes="512x512" href="/icon-512.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="mobile-web-app-capable" content="yes" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <AuthProvider>
          {children}
        </AuthProvider>
        <Toaster />
        {/* Google Analytics 4 */}
        <Script
          src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
          strategy="afterInteractive"
        />
        <Script
          id="google-analytics"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', '${GA_MEASUREMENT_ID}', {
                page_path: window.location.pathname,
              });
            `,
          }}
        />
        {/* Service Worker Registration */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                if ('serviceWorker' in navigator) {
                  window.addEventListener('load', function() {
                    navigator.serviceWorker.register('/sw.js', { scope: '/' })
                      .then(function(reg) {
                        console.log('[SW] Registrado com sucesso, scope:', reg.scope);
                        // Check for updates periodically
                        setInterval(function() {
                          reg.update();
                        }, 60 * 60 * 1000); // every hour
                      })
                      .catch(function(err) {
                        console.log('[SW] Falha no registro:', err);
                      });
                  });
                }
              })();
            `,
          }}
        />
      </body>
    </html>
  );
}
