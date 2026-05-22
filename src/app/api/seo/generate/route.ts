import { NextRequest, NextResponse } from 'next/server'
import ZAI from 'z-ai-web-dev-sdk'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { topic, category, language = 'pt-BR' } = body

    if (!topic) {
      return NextResponse.json(
        { error: 'Topic is required' },
        { status: 400 }
      )
    }

    const zai = await ZAI.create()

    const response = await zai.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: `You are an expert SEO content writer for a forex trading platform called ForexAI Pro (forexaiproelite.vercel.app). 
Write in ${language}. Generate SEO-optimized content for the topic: "${topic}" in category: "${category}".

Return ONLY valid JSON with this structure:
{
  "title": "SEO title tag (60 chars max)",
  "description": "Meta description (160 chars max)",
  "keywords": ["keyword1", "keyword2", ...],
  "h1": "Main heading",
  "intro": "Introduction paragraph (2-3 sentences)",
  "sections": [
    {
      "title": "Section heading",
      "content": "Section content (3-5 sentences)"
    }
  ],
  "faq": [
    {
      "question": "Common question",
      "answer": "Helpful answer (2-3 sentences)"
    }
  ]
}

Important rules:
- All content must be in ${language}
- Include relevant keywords naturally
- Each section should be informative and valuable
- Include 3-4 sections and 3-5 FAQs
- Mention that users can get free signals on Telegram at @forexaipro_sinais
- Reference the platform URL: forexaiproelite.vercel.app
- Do NOT make unrealistic promises about trading profits
- Always include risk disclaimers context`
        },
        {
          role: 'user',
          content: `Generate SEO content for topic: "${topic}" in category: "${category}"`
        }
      ],
      thinking: { type: 'disabled' }
    })

    const content = response.choices[0]?.message?.content || ''
    const jsonMatch = content.match(/\{[\s\S]*\}/)

    if (!jsonMatch) {
      return NextResponse.json(
        { error: 'Failed to generate valid content' },
        { status: 500 }
      )
    }

    const generatedContent = JSON.parse(jsonMatch[0])

    return NextResponse.json({
      success: true,
      content: generatedContent,
    })
  } catch (error) {
    console.error('[SEO Generate] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 }
    )
  }
}
