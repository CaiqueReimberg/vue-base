import { randomUUID } from 'node:crypto'
import { and, eq } from 'drizzle-orm'
import { readBody } from 'h3'
import { db } from '../../database'
import { cards, invoiceAnalyses } from '../../database/schema'
import { badRequest, notFound, requireAuthUser } from '../../utils/auth'
import { roundMoney } from '../../utils/billing'
import {
  findOrCreateUserCard,
  upsertCardMonthlyInvoice,
} from '../../utils/card-invoices'
import { resolveInvoiceCardKey } from '../../utils/card-invoice-key'
import {
  assertInvoiceAnalysisEnabled,
  getHouseholdVisibility,
  getUserOrThrow,
} from '../../utils/household'

export default defineEventHandler(async (event) => {
  const { userId } = requireAuthUser(event)
  await assertInvoiceAnalysisEnabled(userId)
  const user = await getUserOrThrow(userId)

  const body = await readBody<{
    cardId?: string
    cardName?: string
    referenceMonth?: string
    items?: Array<{
      id: string
      date: string
      description: string
      merchant?: string
      amount: number
      category: string
      installment?: string | null
    }>
    isShared?: boolean
    syncToMonthlyBill?: boolean
    dueDay?: number
  }>(event)

  const referenceMonth = (body?.referenceMonth || '').trim()
  const items = Array.isArray(body?.items) ? body.items : []

  if (!/^\d{4}-\d{2}$/.test(referenceMonth)) {
    badRequest('Informe referenceMonth no formato YYYY-MM')
  }
  if (items.length === 0) {
    badRequest('A fatura precisa ter pelo menos 1 item')
  }

  const isShared = Boolean(body?.isShared)

  // 1. Resolve ou cria o Cartão do usuário (idempotente por pessoa)
  let card: typeof cards.$inferSelect
  if (body?.cardId?.trim()) {
    const [found] = await db
      .select()
      .from(cards)
      .where(and(eq(cards.id, body.cardId.trim()), eq(cards.userId, userId)))
      .limit(1)
    if (!found) {
      notFound('Cartão selecionado não encontrado.')
    }
    card = found
  } else {
    const rawName = (body?.cardName || '').trim()
    if (!rawName) {
      badRequest('Selecione ou informe o cartão da fatura.')
    }
    const resolved = await findOrCreateUserCard(userId, {
      name: rawName,
      dueDay: body?.dueDay,
      shareWithPartner: isShared,
    })
    const [found] = await db.select().from(cards).where(eq(cards.id, resolved.id)).limit(1)
    card = found
  }

  const totalAmount = roundMoney(
    items.reduce((sum, item) => sum + (Number(item.amount) || 0), 0),
  )

  const visibility = await getHouseholdVisibility(userId)
  const now = new Date().toISOString()
  const targetCardKey = resolveInvoiceCardKey(card.name, user.name)

  // 2. Idempotência em invoice_analyses: 1 análise por card_id + reference_month
  const existingMonthAnalyses = await db
    .select()
    .from(invoiceAnalyses)
    .where(
      and(
        eq(invoiceAnalyses.userId, userId),
        eq(invoiceAnalyses.referenceMonth, referenceMonth),
      ),
    )

  const existingAnalysis = existingMonthAnalyses.find(
    (row) =>
      row.cardId === card.id ||
      resolveInvoiceCardKey(row.cardName, user.name) === targetCardKey,
  )

  let savedAnalysisId: string
  let createdAt = now

  if (existingAnalysis) {
    savedAnalysisId = existingAnalysis.id
    createdAt = existingAnalysis.createdAt
    await db
      .update(invoiceAnalyses)
      .set({
        cardId: card.id,
        cardName: card.name,
        totalAmount,
        itemsCount: items.length,
        itemsJson: JSON.stringify(items),
        isShared,
        familyId: visibility.familyId,
        updatedAt: now,
      })
      .where(eq(invoiceAnalyses.id, existingAnalysis.id))
  } else {
    savedAnalysisId = randomUUID()
    await db.insert(invoiceAnalyses).values({
      id: savedAnalysisId,
      cardId: card.id,
      cardName: card.name,
      referenceMonth,
      totalAmount,
      itemsCount: items.length,
      itemsJson: JSON.stringify(items),
      isShared,
      userId,
      familyId: visibility.familyId,
      createdAt: now,
      updatedAt: now,
    })
  }

  // 3. Idempotência real na Fatura do Mês (card_monthly_invoices: UNIQUE(card_id, reference_month))
  let syncedBillStatus: 'created' | 'updated' | 'already_paid' | 'none' = 'none'
  const syncedBillName = `Fatura ${card.name}`

  if (body?.syncToMonthlyBill !== false && totalAmount > 0) {
    const syncRes = await upsertCardMonthlyInvoice(userId, card.id, {
      referenceMonth,
      amount: totalAmount,
      dueDay: body?.dueDay ?? card.dueDay,
      isShared,
    })
    syncedBillStatus = syncRes.status
  }

  return {
    id: savedAnalysisId,
    cardId: card.id,
    cardName: card.name,
    referenceMonth,
    totalAmount,
    itemsCount: items.length,
    items,
    isShared,
    syncedBillStatus,
    syncedBillName,
    createdAt,
    updatedAt: now,
  }
})
