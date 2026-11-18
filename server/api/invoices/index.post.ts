import { randomUUID } from 'node:crypto'
import { and, eq, inArray } from 'drizzle-orm'
import { readBody } from 'h3'
import { db } from '../../database'
import { invoiceAnalyses, recurrings } from '../../database/schema'
import { badRequest, requireAuthUser } from '../../utils/auth'
import { roundMoney } from '../../utils/billing'
import { assertInvoiceAnalysisEnabled, getHouseholdVisibility } from '../../utils/household'
import { setRecurringMonthAmount } from '../../utils/recurring'

export default defineEventHandler(async (event) => {
  const { userId } = requireAuthUser(event)
  await assertInvoiceAnalysisEnabled(userId)
  const body = await readBody<{
    cardName?: string
    referenceMonth?: string
    items?: Array<{
      id: string
      date: string
      description: string
      amount: number
      category: string
      installment?: string | null
    }>
    isShared?: boolean
    syncToMonthlyBill?: boolean
    dueDay?: number
  }>(event)

  const cardName = (body?.cardName || '').trim()
  const referenceMonth = (body?.referenceMonth || '').trim()
  const items = Array.isArray(body?.items) ? body.items : []

  if (!cardName) {
    badRequest('Informe o nome do cartão/fatura')
  }
  if (!/^\d{4}-\d{2}$/.test(referenceMonth)) {
    badRequest('Informe referenceMonth no formato YYYY-MM')
  }
  if (items.length === 0) {
    badRequest('A fatura precisa ter pelo menos 1 item')
  }

  const totalAmount = roundMoney(
    items.reduce((sum, item) => sum + (Number(item.amount) || 0), 0),
  )

  const visibility = await getHouseholdVisibility(userId)
  const now = new Date().toISOString()
  const id = randomUUID()
  const isShared = body?.isShared !== false

  await db.insert(invoiceAnalyses).values({
    id,
    cardName,
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

  // Se o usuário marcou para sincronizar o valor total nas Contas a Pagar do Mês:
  if (body?.syncToMonthlyBill && totalAmount > 0) {
    const normalizedBillName = cardName.toLowerCase().startsWith('fatura')
      ? cardName
      : `Fatura ${cardName}`

    const existingRecurrings = await db
      .select()
      .from(recurrings)
      .where(
        and(
          eq(recurrings.isActive, true),
          inArray(recurrings.userId, visibility.memberIds),
        ),
      )

    const matched = existingRecurrings.find(
      (r) =>
        r.name.toLowerCase() === normalizedBillName.toLowerCase() ||
        r.name.toLowerCase() === cardName.toLowerCase(),
    )

    if (matched) {
      await setRecurringMonthAmount(userId, matched.id, referenceMonth, totalAmount)
    } else {
      const newRecurringId = randomUUID()
      await db.insert(recurrings).values({
        id: newRecurringId,
        name: normalizedBillName,
        kind: 'fixed_bill',
        transactionType: 'expense',
        frequency: 'monthly',
        amount: totalAmount,
        dueDay: body?.dueDay && body.dueDay >= 1 && body.dueDay <= 31 ? Number(body.dueDay) : 10,
        startDate: `${referenceMonth}-01`,
        isActive: true,
        isShared,
        userId,
        familyId: visibility.familyId,
        createdAt: now,
        updatedAt: now,
      })
      await setRecurringMonthAmount(userId, newRecurringId, referenceMonth, totalAmount)
    }
  }

  return {
    id,
    cardName,
    referenceMonth,
    totalAmount,
    itemsCount: items.length,
    items,
    isShared,
    createdAt: now,
  }
})
