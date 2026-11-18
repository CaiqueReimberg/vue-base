import { and, eq, inArray } from 'drizzle-orm'
import { getRouterParam } from 'h3'
import { db } from '../../../database'
import { invoiceAnalyses } from '../../../database/schema'
import { badRequest, notFound, requireAuthUser } from '../../../utils/auth'
import { analyzeInvoiceItemsWithGemini } from '../../../utils/gemini'
import { assertInvoiceAnalysisEnabled, getHouseholdVisibility } from '../../../utils/household'

export default defineEventHandler(async (event) => {
  const { userId } = requireAuthUser(event)
  await assertInvoiceAnalysisEnabled(userId)
  const id = getRouterParam(event, 'id')
  if (!id) {
    badRequest('ID da fatura obrigatório')
  }

  const visibility = await getHouseholdVisibility(userId)

  const [existing] = await db
    .select()
    .from(invoiceAnalyses)
    .where(
      and(
        eq(invoiceAnalyses.id, id),
        inArray(invoiceAnalyses.userId, visibility.memberIds),
      ),
    )

  if (!existing) {
    notFound('Análise de fatura não encontrada')
  }

  let items: Array<{
    id: string
    date: string
    description: string
    merchant: string
    amount: number
    category: string
    installment?: string | null
  }> = []

  try {
    items = JSON.parse(existing.itemsJson)
  } catch {
    badRequest('Itens da fatura inválidos')
  }

  const uniqueByDescription = new Map<
    string,
    { id: string; date: string; description: string; amount: number; installment?: string | null }
  >()
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

  const analyzedUnique = await analyzeInvoiceItemsWithGemini(
    Array.from(uniqueByDescription.values()),
  )
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

  const updatedItems = items.map((item) => {
    const key = (item.description || '').trim().toUpperCase()
    const aiMatch = resultByDescKey.get(key)
    return {
      ...item,
      category: aiMatch?.category || item.category || 'Outros',
      merchant: aiMatch?.merchant || item.merchant || item.description,
    }
  })

  const now = new Date().toISOString()
  await db
    .update(invoiceAnalyses)
    .set({
      itemsJson: JSON.stringify(updatedItems),
      updatedAt: now,
    })
    .where(eq(invoiceAnalyses.id, id))

  return {
    id: existing.id,
    cardName: existing.cardName,
    referenceMonth: existing.referenceMonth,
    totalAmount: existing.totalAmount,
    itemsCount: updatedItems.length,
    items: updatedItems,
    isShared: existing.isShared,
    createdAt: existing.createdAt,
    updatedAt: now,
  }
})
