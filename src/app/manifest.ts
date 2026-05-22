import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'ForexAI Pro - Análise de Mercado com IA',
    short_name: 'ForexAI Pro',
    description:
      'Plataforma de análise de mercado com inteligência artificial para Forex, Índices, Cripto e mais',
    start_url: '/',
    display: 'standalone',
    background_color: '#0f172a',
    theme_color: '#06b6d4',
    orientation: 'any',
    scope: '/',
    lang: 'pt-BR',
    dir: 'ltr',
    categories: ['finance', 'business'],
    icons: [
      {
        src: '/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
    screenshots: [],
  };
}
