import { readBody } from 'h3'
import { badRequest, requireAuthUser } from '../../utils/auth'
import {
  analyzeInvoiceItemsWithGemini,
  type InvoiceContextAnalysisInput,
} from '../../utils/gemini'
import { assertInvoiceAnalysisEnabled } from '../../utils/household'

export default defineEventHandler(async (event) => {
  const { userId } = requireAuthUser(event)
  await assertInvoiceAnalysisEnabled(userId)

  const body = await readBody<{
    items?: InvoiceContextAnalysisInput[]
  }>(event)

  const items = Array.isArray(body?.items) ? body.items : []
  if (items.length === 0) {
    badRequest('Envie pelo menos 1 item da fatura para análise.')
  }

  // Se a fatura tiver muitas linhas repetidas, deduplicamos por descrição para economizar tokens e acelerar a resposta do Gemini
  const uniqueByDescription = new Map<string, InvoiceContextAnalysisInput>()
  for (const item of items) {
    const key = (item.description || '').trim().toUpperCase()
    if (!key) continue
    if (!uniqueByDescription.has(key)) {
      uniqueByDescription.set(key, {
        id: String(uniqueByDescription.size + 1),
        date: item.date || '',
        description: item.description,
        amount: Number(item.amount) || 0,
        installment: item.installment ?? null,
      })
    }
  }

  const uniqueList = Array.from(uniqueByDescription.values())
  const analyzedUnique = await analyzeInvoiceItemsWithGemini(uniqueList)

  const resultByUniqueId = new Map(analyzedUnique.map((entry) => [entry.id, entry]))
  const resultByDescKey = new Map<string, { category: string; merchant: string }>()

  for (const [descKey, uniqueItem] of uniqueByDescription.entries()) {
    const matched = resultByUniqueId.get(uniqueItem.id)
    if (matched) {
      resultByDescKey.set(descKey, {
        category: matched.category,
        merchant: matched.merchant,
      })
    }
  }

  const enrichedItems = items.map((item) => {
    const key = (item.description || '').trim().toUpperCase()
    const aiMatch = resultByDescKey.get(key)
    return {
      ...item,
      category: aiMatch?.category || (item as { category?: string }).category || 'Outros',
      merchant: aiMatch?.merchant || (item as { merchant?: string }).merchant || item.description,
    }
  })

  return {
    items: enrichedItems,
  }
})
