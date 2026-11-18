import { GoogleGenerativeAI } from '@google/generative-ai'

export interface InvoiceContextAnalysisInput {
  id: string
  date: string
  description: string
  amount: number
  installment?: string | null
}

export interface InvoiceContextAnalysisOutput {
  id: string
  category: string
  merchant: string
}

const MODEL_FALLBACKS = [
  'gemini-3.5-flash-lite',
  'gemini-3.5-flash',
  'gemini-3.8-flash',
  'gemini-3.7-flash',
  'gemini-3.6-flash',
  'gemini-3.1-flash-lite',
]

function modelFailure(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  if (/\[(429|500|503|504)\b/.test(message) || /high demand|unavailable|overloaded|resource_exhausted/i.test(message)) {
    return 'busy'
  }
  if (/\[404\b/.test(message) || /no longer available|not found|not supported/i.test(message)) {
    return 'missing'
  }
  return 'fatal'
}

function candidateModels(preferred: string) {
  return [preferred, ...MODEL_FALLBACKS.filter((name) => name !== preferred)]
}

function readModelJson(text: string): unknown {
  let value: unknown = text.trim()
  if (typeof value === 'string') {
    const fenced = value.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i)
    if (fenced?.[1]) value = fenced[1].trim()
  }

  for (let attempt = 0; attempt < 2 && typeof value === 'string'; attempt += 1) {
    value = JSON.parse(value)
  }
  return value
}

export const INVOICE_CONTEXT_PROMPT = `Você analisa os lançamentos de uma fatura de cartão de crédito brasileiro para classificar o CONTEXTO DE GASTO de cada item.
Responda somente com o JSON. Sem markdown, sem bloco de código e sem texto antes ou depois.

Regras:
1. Não tente adivinhar endereço ou falar sobre o local físico. Foque exclusivamente no CONTEXTO DE GASTO (com o que a pessoa gastou).
2. Para cada item enviado, devolva um objeto com:
   - "id": o mesmo id recebido
   - "category": a macrocategoria do gasto. Escolha uma destas categorias:
     * "Delivery & Restaurantes" (iFood, restaurantes, padarias, lanchonetes, bares, cafés, docerias, fast food)
     * "Supermercado" (mercados, atacadistas, hortifruti, açougues, conveniências, mercearias)
     * "Transporte & Combustível" (Uber, 99, postos de combustível, pedágio, estacionamento, manutenção automotiva, transporte)
     * "Compras & Lojas" (vestuário, calçados, marketplaces como Mercado Livre/Shopee/Amazon/Shein, eletrônicos, presentes, lojas diversas)
     * "Assinaturas & Streaming" (serviços mensais, streaming de vídeo/música, softwares, clubes, nuvem, jogos, internet/apps recorrentes)
     * "Saúde & Farmácia" (farmácias, drogarias, consultas, exames, clínicas, dentista, academia, bem estar, ótica)
     * "Casa & Pets" (pet shop, veterinário, utilidades domésticas, construção, móveis, contas de consumo, lavanderia)
     * "Lazer & Viagem" (cinema, ingressos, shows, hotéis, passagens, passeios, entretenimento, livraria)
     * "Serviços & Taxas" (seguros, tarifas, impostos, serviços profissionais, cartório, cursos, educação)
     * "Outros" (somente quando for totalmente impossível deduzir o contexto)
   - "merchant": um rótulo curto e limpo que represente o CONTEXTO específico do gasto ou o nome limpo do serviço/tipo de gasto (por exemplo: transforme "IFD*BRK COMERCIO" em "Delivery de Comida (iFood)", "PAG*PADARIASAOJOSE" em "Padaria e Confeitaria", "UBER *TRIP HELP.UBER" em "Corrida de Aplicativo (Uber)", "DROGASIL 1244" em "Farmácia e Medicamentos", "MERCADOLIVRE*2PRODUTOS" em "Compras Online (Mercado Livre)", "AUTO POSTO SHELL" em "Abastecimento e Combustível", "NETFLIX.COM" em "Streaming e Assinatura").
3. Nunca use hífens ou travessões dentro dos textos de "category" ou "merchant".
4. Formato exato de saída (array JSON):
[
  {
    "id": "1",
    "category": "Delivery & Restaurantes",
    "merchant": "Delivery de Comida (iFood)"
  }
]`

export async function analyzeInvoiceItemsWithGemini(
  items: InvoiceContextAnalysisInput[],
): Promise<InvoiceContextAnalysisOutput[]> {
  if (!items.length) return []

  const config = useRuntimeConfig()
  const apiKey = String(config.geminiApiKey || process.env.GEMINI_API_KEY || '').trim()
  const preferred = String(config.geminiModel || process.env.GEMINI_MODEL || 'gemini-3.8-flash').trim()

  if (!apiKey) {
    throw createError({
      statusCode: 500,
      statusMessage: 'GEMINI_API_KEY não configurada',
    })
  }

  const compactInput = items.map((item, idx) => ({
    id: String(item.id || idx + 1),
    description: item.description,
    amount: item.amount,
    installment: item.installment || null,
  }))

  const prompt = `${INVOICE_CONTEXT_PROMPT}\n\nItens da fatura:\n${JSON.stringify(compactInput)}`

  const genAI = new GoogleGenerativeAI(apiKey)
  const models = candidateModels(preferred)
  let text = ''
  let sawBusy = false
  let lastError = ''

  for (const modelName of models) {
    const model = genAI.getGenerativeModel({
      model: modelName,
      generationConfig: {
        temperature: 0.15,
        maxOutputTokens: 8192,
        responseMimeType: 'application/json',
      },
    })

    try {
      const result = await model.generateContent([{ text: prompt }])
      text = result.response.text().trim()
      if (text) break
    } catch (error) {
      const failure = modelFailure(error)
      lastError = error instanceof Error ? error.message : String(error)
      if (failure === 'fatal') {
        throw createError({
          statusCode: 502,
          statusMessage: `Falha ao consultar a API do Gemini: ${lastError}`,
        })
      }
      sawBusy = sawBusy || failure === 'busy'
    }
  }

  if (!text && sawBusy) {
    throw createError({
      statusCode: 503,
      statusMessage: 'O Gemini está sobrecarregado. Tente novamente em instantes.',
    })
  }

  if (!text) {
    throw createError({
      statusCode: 502,
      statusMessage: `Gemini não retornou conteúdo (${lastError || 'sem modelo disponível'})`,
    })
  }

  let parsed: unknown
  try {
    parsed = readModelJson(text)
  } catch {
    throw createError({
      statusCode: 502,
      statusMessage: 'Gemini devolveu um JSON inválido',
    })
  }

  const list = Array.isArray(parsed)
    ? parsed
    : parsed && typeof parsed === 'object' && Array.isArray((parsed as { items?: unknown[] }).items)
      ? (parsed as { items: unknown[] }).items
      : []

  return list
    .filter((entry): entry is Record<string, unknown> => Boolean(entry && typeof entry === 'object'))
    .map((entry) => ({
      id: String(entry.id ?? ''),
      category: String(entry.category ?? 'Outros').replace(/[-–—−]/g, ' ').replace(/\s{2,}/g, ' ').trim(),
      merchant: String(entry.merchant ?? 'Outros Gastos').replace(/[-–—−]/g, ' ').replace(/\s{2,}/g, ' ').trim(),
    }))
}
