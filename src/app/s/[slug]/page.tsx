import { Metadata } from 'next'
import { getSEOPageBySlug, getAllSEOSlugs, SITE_URL, SEO_PAGES } from '@/lib/seo-pages-data'
import Link from 'next/link'
import { notFound } from 'next/navigation'

// ============================================================
// Dynamic Rendering (ISR) — works on Vercel without full build
// ============================================================

export const dynamic = 'force-dynamic'
export const dynamicParams = true
export const revalidate = 86400 // Revalidate every 24 hours

export function generateStaticParams() {
  return getAllSEOSlugs().map(slug => ({ slug }))
}

// ============================================================
// Metadata
// ============================================================

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const page = getSEOPageBySlug(slug)

  if (!page) {
    return { title: 'Página não encontrada | ForexAI Pro' }
  }

  return {
    title: page.title,
    description: page.description,
    keywords: page.keywords,
    authors: [{ name: 'ForexAI Pro' }],
    openGraph: {
      title: page.title,
      description: page.description,
      type: 'article',
      siteName: 'ForexAI Pro',
      url: `${SITE_URL}/s/${slug}`,
    },
    twitter: {
      card: 'summary_large_image',
      title: page.title,
      description: page.description,
    },
    alternates: {
      canonical: `${SITE_URL}/s/${slug}`,
    },
    robots: {
      index: true,
      follow: true,
    },
  }
}

// ============================================================
// Page Component
// ============================================================

export default async function SEOPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const page = getSEOPageBySlug(slug)

  if (!page) {
    notFound()
  }

  const relatedPages = page.relatedSlugs
    .map(s => SEO_PAGES.find(p => p.slug === s))
    .filter(Boolean) as typeof SEO_PAGES

  // JSON-LD structured data for FAQ
  const faqSchema = page.content.faq.length > 0 ? {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: page.content.faq.map(faq => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer,
      },
    })),
  } : null

  // JSON-LD for Article
  const articleSchema = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: page.h1,
    description: page.description,
    author: { '@type': 'Organization', name: 'ForexAI Pro' },
    publisher: {
      '@type': 'Organization',
      name: 'ForexAI Pro',
      logo: { '@type': 'ImageObject', url: `${SITE_URL}/icon-512.png` },
    },
    url: `${SITE_URL}/s/${slug}`,
    mainEntityOfPage: `${SITE_URL}/s/${slug}`,
  }

  return (
    <>
      {/* Structured Data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }}
      />
      {faqSchema && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
        />
      )}

      <div className="min-h-screen bg-gray-950 text-gray-100">
        {/* Navigation */}
        <nav className="border-b border-gray-800 bg-gray-950/80 backdrop-blur-md sticky top-0 z-50">
          <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2 text-lg font-bold">
              <span className="text-emerald-400">📊</span>
              <span>ForexAI Pro</span>
            </Link>
            <Link
              href="/"
              className="bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              Teste Grátis
            </Link>
          </div>
        </nav>

        {/* Breadcrumbs */}
        <div className="max-w-5xl mx-auto px-4 pt-4">
          <nav aria-label="Breadcrumb" className="text-sm text-gray-400">
            <ol className="flex items-center gap-1 flex-wrap">
              <li><Link href="/" className="hover:text-emerald-400 transition-colors">Início</Link></li>
              <li className="mx-1">/</li>
              <li className="text-gray-500 capitalize">{page.category}</li>
              <li className="mx-1">/</li>
              <li className="text-emerald-400">{page.h1}</li>
            </ol>
          </nav>
        </div>

        <main className="max-w-5xl mx-auto px-4 py-8">
          {/* Hero Section */}
          <header className="mb-12">
            <div className="inline-block mb-4 px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-emerald-400 text-xs font-medium capitalize">
              {page.category}
            </div>
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4 leading-tight">
              {page.h1}
            </h1>
            <p className="text-lg md:text-xl text-gray-300 leading-relaxed max-w-3xl">
              {page.content.intro}
            </p>
            {/* CTA */}
            <div className="mt-8 flex flex-col sm:flex-row gap-4">
              <Link
                href="/"
                className="inline-flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-8 py-4 rounded-xl text-lg font-semibold transition-colors shadow-lg shadow-emerald-500/20"
              >
                🚀 Começar Agora
              </Link>
              <Link
                href="https://t.me/forexaipro_sinais"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 bg-gray-800 hover:bg-gray-700 text-white px-8 py-4 rounded-xl text-lg font-semibold transition-colors border border-gray-700"
              >
                📱 Sinais no Telegram
              </Link>
            </div>
          </header>

          {/* Content Sections */}
          <article className="space-y-10 mb-16">
            {page.content.sections.map((section, i) => (
              <section key={i} className="bg-gray-900/50 border border-gray-800 rounded-2xl p-6 md:p-8">
                <h2 className="text-xl md:text-2xl font-bold mb-4 text-emerald-400">
                  {section.title}
                </h2>
                <p className="text-gray-300 leading-relaxed text-base md:text-lg">
                  {section.content}
                </p>
              </section>
            ))}

            {/* Key Features Box */}
            <section className="bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 border border-emerald-500/20 rounded-2xl p-6 md:p-8">
              <h2 className="text-xl md:text-2xl font-bold mb-4 text-emerald-400">
                Por Que Escolher a ForexAI Pro?
              </h2>
              <ul className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  '🤖 IA avançada com taxa de acerto 70-85%',
                  '📊 500+ ativos monitorados em tempo real',
                  '⚡ Sinais instantâneos com entrada, SL e TP',
                  '🛡️ Gerenciamento de risco automático',
                  '📱 Sinais grátis no Telegram',
                  '🎯 Scanner de padrões e detector SMC',
                  '🧪 Simulador de trades integrado',
                  '💻 Plataforma web completa',
                ].map((item, i) => (
                  <li key={i} className="flex items-center gap-2 text-gray-300 text-sm md:text-base">
                    {item}
                  </li>
                ))}
              </ul>
            </section>

            {/* Stats Section */}
            <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: 'Ativos Monitorados', value: '500+', icon: '📊' },
                { label: 'Taxa de Acerto IA', value: '70-85%', icon: '🎯' },
                { label: 'Sinais por Dia', value: '8-12', icon: '📡' },
                { label: 'Usuários Ativos', value: '1000+', icon: '👥' },
              ].map((stat, i) => (
                <div key={i} className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-center">
                  <div className="text-2xl mb-1">{stat.icon}</div>
                  <div className="text-xl md:text-2xl font-bold text-emerald-400">{stat.value}</div>
                  <div className="text-xs md:text-sm text-gray-400 mt-1">{stat.label}</div>
                </div>
              ))}
            </section>
          </article>

          {/* FAQ Section */}
          {page.content.faq.length > 0 && (
            <section className="mb-16">
              <h2 className="text-2xl md:text-3xl font-bold mb-8">
                ❓ Perguntas Frequentes
              </h2>
              <div className="space-y-4">
                {page.content.faq.map((faq, i) => (
                  <details
                    key={i}
                    className="group bg-gray-900/50 border border-gray-800 rounded-xl overflow-hidden"
                  >
                    <summary className="flex items-center justify-between cursor-pointer p-5 md:p-6 font-medium text-gray-100 hover:text-emerald-400 transition-colors list-none">
                      <span className="pr-4">{faq.question}</span>
                      <span className="text-emerald-400 shrink-0 group-open:rotate-45 transition-transform text-xl">+</span>
                    </summary>
                    <div className="px-5 md:px-6 pb-5 md:pb-6 text-gray-300 leading-relaxed">
                      {faq.answer}
                    </div>
                  </details>
                ))}
              </div>
            </section>
          )}

          {/* CTA Final */}
          <section className="bg-gradient-to-br from-emerald-600 to-emerald-800 rounded-2xl p-8 md:p-12 text-center mb-16">
            <h2 className="text-2xl md:text-3xl font-bold mb-4 text-white">
              Comece a Operar com IA Hoje
            </h2>
            <p className="text-emerald-100 text-lg mb-8 max-w-2xl mx-auto">
              Receba sinais grátis no nosso Telegram (@forexaipro_sinais) e desbloqueie todas as ferramentas da plataforma por apenas R$49,90/mês.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/"
                className="inline-flex items-center justify-center gap-2 bg-white text-emerald-700 px-8 py-4 rounded-xl text-lg font-bold hover:bg-gray-100 transition-colors shadow-lg"
              >
                🚀 Acessar Plataforma
              </Link>
              <Link
                href="https://t.me/forexaipro_sinais"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 bg-white/10 text-white px-8 py-4 rounded-xl text-lg font-semibold hover:bg-white/20 transition-colors border border-white/20"
              >
                📱 Entrar no Telegram
              </Link>
            </div>
          </section>

          {/* Related Pages */}
          {relatedPages.length > 0 && (
            <section className="mb-16">
              <h2 className="text-2xl font-bold mb-6">
                📚 Artigos Relacionados
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {relatedPages.map((related) => (
                  <Link
                    key={related.slug}
                    href={`/s/${related.slug}`}
                    className="group bg-gray-900 border border-gray-800 rounded-xl p-5 hover:border-emerald-500/30 transition-colors"
                  >
                    <div className="text-xs text-emerald-400 font-medium mb-2 capitalize">
                      {related.category}
                    </div>
                    <h3 className="font-semibold text-gray-100 group-hover:text-emerald-400 transition-colors mb-2">
                      {related.h1}
                    </h3>
                    <p className="text-sm text-gray-400 line-clamp-2">
                      {related.description}
                    </p>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* All Categories */}
          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-6">
              🗂️ Explorar por Categoria
            </h2>
            <div className="space-y-6">
              {['Sinais & Trading', 'Análise & IA', 'Estratégias', 'Pares & Moedas', 'Educação'].map(category => {
                const pagesInCategory = SEO_PAGES.filter(p => p.category === category)
                if (pagesInCategory.length === 0) return null
                return (
                  <div key={category}>
                    <h3 className="text-lg font-semibold text-emerald-400 mb-3">{category}</h3>
                    <div className="flex flex-wrap gap-2">
                      {pagesInCategory.map(p => (
                        <Link
                          key={p.slug}
                          href={`/s/${p.slug}`}
                          className={`px-3 py-1.5 rounded-lg text-sm transition-colors border ${
                            p.slug === slug
                              ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                              : 'bg-gray-900 border-gray-800 text-gray-300 hover:border-emerald-500/30 hover:text-emerald-400'
                          }`}
                        >
                          {p.h1}
                        </Link>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        </main>

        {/* Footer */}
        <footer className="border-t border-gray-800 bg-gray-950 py-8 mt-auto">
          <div className="max-w-5xl mx-auto px-4">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="text-gray-500 text-sm">
                © {new Date().getFullYear()} ForexAI Pro. Todos os direitos reservados.
              </div>
              <div className="flex items-center gap-4 text-sm">
                <Link href="/termos" className="text-gray-500 hover:text-gray-300 transition-colors">
                  Termos
                </Link>
                <Link href="/privacidade" className="text-gray-500 hover:text-gray-300 transition-colors">
                  Privacidade
                </Link>
                <Link href="/faq" className="text-gray-500 hover:text-gray-300 transition-colors">
                  FAQ
                </Link>
              </div>
            </div>
            <div className="mt-4 text-xs text-gray-600 text-center">
              ⚠️ Trading envolve risco. Resultados passados não garantem resultados futuros. Não é recomendação de investimento.
            </div>
          </div>
        </footer>
      </div>
    </>
  )
}
