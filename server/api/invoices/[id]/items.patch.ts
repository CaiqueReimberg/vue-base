import { and, eq, inArray } from 'drizzle-orm'
import { getRouterParam, readBody } from 'h3'
import { db } from '../../../database'
import { invoiceAnalyses } from '../../../database/schema'
import { badRequest, notFound, requireAuthUser } from '../../../utils/auth'
import { assertInvoiceAnalysisEnabled, getHouseholdVisibility } from '../../../utils/household'

export default defineEventHandler(async (event) => {
  const { userId } = requireAuthUser(event)
  await assertInvoiceAnalysisEnabled(userId)
  const id = getRouterParam(event, 'id')
  if (!id) {
    badRequest('ID da fatura obrigatório')
  }

  const body = await readBody<{
    items?: Array<{
      id: string
      date: string
      description: string
      merchant: string
      amount: number
      category: string
      installment?: string | null
    }>
  }>(event)

  const items = Array.isArray(body?.items) ? body.items : []
  if (items.length === 0) {
    badRequest('A fatura precisa ter pelo menos 1 item')
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

  const now = new Date().toISOString()
  await db
    .update(invoiceAnalyses)
    .set({
      itemsJson: JSON.stringify(items),
      itemsCount: items.length,
      updatedAt: now,
    })
    .where(eq(invoiceAnalyses.id, id))

  return {
    id: existing.id,
    cardName: existing.cardName,
    referenceMonth: existing.referenceMonth,
    totalAmount: existing.totalAmount,
    itemsCount: items.length,
    items,
    isShared: existing.isShared,
    createdAt: existing.createdAt,
    updatedAt: now,
  }
})
