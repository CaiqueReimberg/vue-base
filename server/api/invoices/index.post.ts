import { randomUUID } from 'node:crypto'
import { and, eq } from 'drizzle-orm'
import { readBody } from 'h3'
import { db } from '../../database'
import { invoiceAnalyses, recurringPayments, recurrings } from '../../database/schema'
import { badRequest, requireAuthUser } from '../../utils/auth'
import { roundMoney } from '../../utils/billing'
import {
  resolveInvoiceCardKey,
  resolveRecurringCardKey,
} from '../../utils/card-invoice-key'
import {
  assertInvoiceAnalysisEnabled,
  getHouseholdVisibility,
  getUserOrThrow,
} from '../../utils/household'
import { setRecurringMonthAmount } from '../../utils/recurring'

export default defineEventHandler(async (event) => {
  const { userId } = requireAuthUser(event)
  await assertInvoiceAnalysisEnabled(userId)
  const user = await getUserOrThrow(userId)

  const body = await readBody<{
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
  const isShared = body?.isShared !== false
  const targetCardKey = resolveInvoiceCardKey(cardName, user.name)

  // 1. Idempotência em invoice_analyses: 1 análise por cartão + mês para a mesma pessoa (userId)
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
    (row) => resolveInvoiceCardKey(row.cardName, user.name) === targetCardKey,
  )

  let savedAnalysisId: string
  let createdAt = now

  if (existingAnalysis) {
    savedAnalysisId = existingAnalysis.id
    createdAt = existingAnalysis.createdAt
    await db
      .update(invoiceAnalyses)
      .set({
        cardName,
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
  }

  // 2. Idempotência nas Contas do Mês (recurrings): 1 fatura daquele cartão por pessoa (userId)
  let syncedBillStatus: 'created' | 'updated' | 'already_paid' | 'none' = 'none'
  let syncedBillName: string | null = null

  if (body?.syncToMonthlyBill && totalAmount > 0) {
    const normalizedBillName = /^(fatura|cart[aã]o)\b/i.test(cardName)
      ? cardName
      : `Fatura ${cardName}`

    // Busca estritamente nas recorrências DESTA pessoa (userId), garantindo 1 fatura por cartão por pessoa
    const userRecurrings = await db
      .select()
      .from(recurrings)
      .where(
        and(
          eq(recurrings.userId, userId),
          eq(recurrings.isActive, true),
        ),
      )

    const matched = userRecurrings.find(
      (r) => resolveRecurringCardKey(r.name, user.name) === targetCardKey,
    )

    if (matched) {
      syncedBillName = matched.name
      const targetMonthStart = `${referenceMonth}-01`
      if (matched.startDate > targetMonthStart) {
        await db
          .update(recurrings)
          .set({ startDate: targetMonthStart, updatedAt: now })
          .where(eq(recurrings.id, matched.id))
      }

      const [existingPayment] = await db
        .select({ id: recurringPayments.id })
        .from(recurringPayments)
        .where(
          and(
            eq(recurringPayments.recurringId, matched.id),
            eq(recurringPayments.referenceMonth, referenceMonth),
          ),
        )
        .limit(1)

      if (existingPayment) {
        // Se a pessoa já deu baixa confirmando o valor pago no mês, não cria outra nem sobrescreve o recibo
        syncedBillStatus = 'already_paid'
      } else {
        await setRecurringMonthAmount(userId, matched.id, referenceMonth, totalAmount)
        syncedBillStatus = 'updated'
      }
    } else {
      const newRecurringId = randomUUID()
      syncedBillName = normalizedBillName
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
      syncedBillStatus = 'created'
    }
  }

  return {
    id: savedAnalysisId,
    cardName,
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
