import { randomUUID } from 'node:crypto'
import { and, desc, eq, inArray, or } from 'drizzle-orm'
import { db } from '../database'
import { cards, categories, monthlyPlans, recurringPayments, transactions } from '../database/schema'
import {
  buildCyclesAroundReference,
  cycleContainingReference,
  formatReferenceMonth,
  parseReferenceMonth,
  referenceMonthMidUtc,
  resolveReferenceMonth,
  roundMoney,
  transactionInBillingCycle,
} from './billing'
import { getHouseholdVisibility } from './household'
import { findVisibleActiveRecurringsForMonth } from './recurring'

async function buildRecurringBillItems(userId: string, referenceMonth: string) {
  const recurrings = await findVisibleActiveRecurringsForMonth(userId, referenceMonth)
  const recurringIds = recurrings.map((r) => r.id)
  const catIds = Array.from(new Set(recurrings.map((r) => r.categoryId).filter(Boolean) as string[]))

  const [payments, catRows] = await Promise.all([
    recurringIds.length === 0
      ? Promise.resolve([])
      : db
          .select()
          .from(recurringPayments)
          .where(
            and(
              inArray(recurringPayments.recurringId, recurringIds),
              eq(recurringPayments.referenceMonth, referenceMonth)
            )
          ),
    catIds.length === 0
      ? Promise.resolve([])
      : db.select().from(categories).where(inArray(categories.id, catIds)),
  ])

  const paymentByRecurring = new Map(payments.map((p) => [p.recurringId, p]))
  const catMap = new Map(catRows.map((c) => [c.id, c.name]))

  return recurrings
    .filter((r) => r.transactionType === 'expense')
    .map((r) => {
      const payment = paymentByRecurring.get(r.id)
      return {
        id: r.id,
        name: r.name,
        value: Number(r.amount),
        dueDay: r.dueDay,
        paid: Boolean(payment),
        paidAt: payment ? new Date(payment.paidAt).toISOString() : null,
        paidByUserId: payment?.userId ?? null,
        category: r.categoryId ? catMap.get(r.categoryId) ?? null : null,
        ownerId: r.userId,
      }
    })
}

async function findVisibleCardsRaw(userId: string) {
  const visibility = await getHouseholdVisibility(userId)
  const conditions = [inArray(cards.userId, visibility.memberIds)]
  if (visibility.partnerIds.length > 0) {
    conditions.push(or(eq(cards.userId, userId), eq(cards.shareWithPartner, true))!)
  } else {
    conditions.push(eq(cards.userId, userId))
  }
  const rows = await db
    .select()
    .from(cards)
    .where(and(...conditions))

  return rows.map((c) => ({
    id: c.id,
    name: c.name,
    closingDay: c.closingDay,
    dueDay: c.dueDay,
    isActive: c.isActive,
    ownerId: c.userId,
  }))
}

async function sumCardCycleExpenses(
  cardId: string,
  ownerUserId: string,
  viewerUserId: string,
  periodStart: Date,
  periodEnd: Date
): Promise<number> {
  const conds = [
    eq(transactions.cardId, cardId),
    eq(transactions.userId, ownerUserId),
    eq(transactions.type, 'expense'),
  ]
  if (viewerUserId !== ownerUserId) {
    conds.push(eq(transactions.isShared, true))
  }

  const rows = await db
    .select()
    .from(transactions)
    .where(and(...conds))

  return rows
    .filter(
      (t) =>
        t.kind !== 'debt' &&
        transactionInBillingCycle(t.occurredAt, periodStart, periodEnd)
    )
    .reduce((sum, t) => sum + Number(t.amount), 0)
}

async function isCardInvoicePaid(
  cardId: string,
  ownerUserId: string,
  referenceMonth: string,
  viewerUserId: string
): Promise<boolean> {
  const conds = [
    eq(transactions.cardId, cardId),
    eq(transactions.userId, ownerUserId),
    eq(transactions.kind, 'invoice_payment'),
    eq(transactions.referenceMonth, referenceMonth),
  ]
  if (viewerUserId !== ownerUserId) {
    conds.push(eq(transactions.isShared, true))
  }

  const rows = await db
    .select({ id: transactions.id })
    .from(transactions)
    .where(and(...conds))
    .limit(1)

  return rows.length > 0
}

async function buildCardInvoiceItems(userId: string, referenceMonth: string) {
  const visibleCards = await findVisibleCardsRaw(userId)
  const refDate = referenceMonthMidUtc(referenceMonth)
  const items: Array<{
    cardId: string
    name: string
    invoiceValue: number
    closingDay: number
    dueDay: number
    paid: boolean
    ownerId: string
  }> = []

  for (const card of visibleCards) {
    if (!card.isActive) continue

    const cycles = buildCyclesAroundReference(
      card.closingDay,
      card.dueDay,
      2,
      2,
      refDate
    )
    const dueCycle =
      cycles.find((c) => formatReferenceMonth(c.dueDate) === referenceMonth) ??
      cycleContainingReference(refDate, card.closingDay, card.dueDay)

    if (formatReferenceMonth(dueCycle.dueDate) !== referenceMonth) {
      continue
    }

    const invoiceValue = await sumCardCycleExpenses(
      card.id,
      card.ownerId,
      userId,
      dueCycle.periodStart,
      dueCycle.periodEnd
    )

    const paid = await isCardInvoicePaid(card.id, card.ownerId, referenceMonth, userId)

    items.push({
      cardId: card.id,
      name: card.name,
      invoiceValue: roundMoney(invoiceValue),
      closingDay: card.closingDay,
      dueDay: dueCycle.dueDate.getUTCDate(),
      paid,
      ownerId: card.ownerId,
    })
  }

  return items
}

async function sumMonthlyIncome(userId: string, referenceMonth: string) {
  const visibility = await getHouseholdVisibility(userId)
  const { year, monthIndex } = parseReferenceMonth(referenceMonth)
  const monthStartMs = Date.UTC(year, monthIndex, 1, 0, 0, 0, 0)
  const monthEndMs = Date.UTC(year, monthIndex + 1, 0, 23, 59, 59, 999)

  const conds = [
    inArray(transactions.userId, visibility.memberIds),
    eq(transactions.type, 'income'),
  ]
  if (visibility.partnerIds.length > 0) {
    conds.push(
      or(
        eq(transactions.userId, userId),
        and(inArray(transactions.userId, visibility.partnerIds), eq(transactions.isShared, true))
      )!
    )
  } else {
    conds.push(eq(transactions.userId, userId))
  }

  const rows = await db
    .select()
    .from(transactions)
    .where(and(...conds))

  return rows
    .filter((t) => {
      if (t.referenceMonth === referenceMonth) return true
      if (!t.referenceMonth) {
        const ms = new Date(t.occurredAt).getTime()
        return ms >= monthStartMs && ms <= monthEndMs
      }
      return false
    })
    .reduce((sum, t) => sum + Number(t.amount), 0)
}

export async function getMonthlyCommitment(userId: string, month?: string) {
  const referenceMonth = resolveReferenceMonth(month)
  const [recurringItems, cardItems, monthlyIncome] = await Promise.all([
    buildRecurringBillItems(userId, referenceMonth),
    buildCardInvoiceItems(userId, referenceMonth),
    sumMonthlyIncome(userId, referenceMonth),
  ])

  const recurringTotal = recurringItems.reduce((s, i) => s + i.value, 0)
  const recurringPaid = recurringItems.filter((i) => i.paid).reduce((s, i) => s + i.value, 0)

  const cardTotal = cardItems.reduce((s, i) => s + i.invoiceValue, 0)
  const cardPaid = cardItems.filter((i) => i.paid).reduce((s, i) => s + i.invoiceValue, 0)

  const totalCommitted = recurringTotal + cardTotal
  const totalPaid = recurringPaid + cardPaid
  const remainingToPay = totalCommitted - totalPaid
  const freeBalance = monthlyIncome - totalCommitted

  return {
    month: referenceMonth,
    totalCommitted: roundMoney(totalCommitted),
    totalPaid: roundMoney(totalPaid),
    remainingToPay: roundMoney(remainingToPay),
    freeBalance: roundMoney(freeBalance),
    breakdown: {
      recurringBills: {
        total: roundMoney(recurringTotal),
        paid: roundMoney(recurringPaid),
        items: recurringItems,
      },
      cardInvoices: {
        total: roundMoney(cardTotal),
        paid: roundMoney(cardPaid),
        items: cardItems,
      },
    },
  }
}

export async function getAgenda(userId: string, month?: string) {
  const referenceMonth = resolveReferenceMonth(month)
  const [recurringItems, cardItems, visibleCards] = await Promise.all([
    buildRecurringBillItems(userId, referenceMonth),
    buildCardInvoiceItems(userId, referenceMonth),
    findVisibleCardsRaw(userId),
  ])

  const events: Array<{
    day: number
    type: 'bill_due' | 'invoice_close' | 'invoice_due'
    name: string
    value: number | null
    paid: boolean
    referenceId: string
    ownerId?: string
  }> = []

  for (const bill of recurringItems) {
    if (bill.dueDay == null) continue
    events.push({
      day: bill.dueDay,
      type: 'bill_due',
      name: bill.name,
      value: bill.value,
      paid: bill.paid,
      referenceId: bill.id,
      ownerId: bill.ownerId,
    })
  }

  const refDate = referenceMonthMidUtc(referenceMonth)
  for (const card of visibleCards) {
    const cycles = buildCyclesAroundReference(card.closingDay, card.dueDay, 3, 3, refDate)

    const closeCycle = cycles.find((c) => formatReferenceMonth(c.periodEnd) === referenceMonth)
    if (closeCycle) {
      const invoice = cardItems.find((i) => i.cardId === card.id)
      events.push({
        day: closeCycle.periodEnd.getUTCDate(),
        type: 'invoice_close',
        name: card.name,
        value: null,
        paid: invoice?.paid ?? false,
        referenceId: card.id,
        ownerId: card.ownerId,
      })
    }

    const dueCycle = cycles.find((c) => formatReferenceMonth(c.dueDate) === referenceMonth)
    if (dueCycle) {
      const invoice = cardItems.find((i) => i.cardId === card.id)
      events.push({
        day: dueCycle.dueDate.getUTCDate(),
        type: 'invoice_due',
        name: card.name,
        value: invoice?.invoiceValue ?? 0,
        paid: invoice?.paid ?? false,
        referenceId: card.id,
        ownerId: card.ownerId,
      })
    }
  }

  events.sort((a, b) => a.day - b.day || a.type.localeCompare(b.type))

  return { month: referenceMonth, events }
}

export async function getMonthlyPlan(userId: string, month?: string) {
  const referenceMonth = resolveReferenceMonth(month)
  const visibility = await getHouseholdVisibility(userId)

  const rows = await db
    .select()
    .from(monthlyPlans)
    .where(
      and(
        inArray(monthlyPlans.userId, visibility.memberIds),
        eq(monthlyPlans.referenceMonth, referenceMonth)
      )
    )
    .orderBy(desc(monthlyPlans.updatedAt))
    .limit(1)

  if (rows.length > 0) {
    const plan = rows[0]
    return {
      referenceMonth,
      monthlyIncome: roundMoney(Number(plan.monthlyIncome)),
      savingsGoal: roundMoney(Number(plan.savingsGoal)),
      savingsPaid: Boolean(plan.savingsPaidAt),
      savingsPaidAt: plan.savingsPaidAt ?? null,
      endOfMonthLeftover:
        plan.endOfMonthLeftover != null ? roundMoney(Number(plan.endOfMonthLeftover)) : null,
      closedAt: plan.closedAt ?? null,
      notes: plan.notes ?? null,
      isInherited: false,
    }
  }

  // Herda automaticamente a Renda Mensal e Meta de Guardar do último mês configurado pelo casal
  const latestRows = await db
    .select()
    .from(monthlyPlans)
    .where(inArray(monthlyPlans.userId, visibility.memberIds))
    .orderBy(desc(monthlyPlans.referenceMonth), desc(monthlyPlans.updatedAt))
    .limit(1)

  if (latestRows.length > 0) {
    const prev = latestRows[0]
    return {
      referenceMonth,
      monthlyIncome: roundMoney(Number(prev.monthlyIncome)),
      savingsGoal: roundMoney(Number(prev.savingsGoal)),
      savingsPaid: false,
      savingsPaidAt: null,
      endOfMonthLeftover: null,
      closedAt: null,
      notes: null,
      isInherited: true,
    }
  }

  return {
    referenceMonth,
    monthlyIncome: 0,
    savingsGoal: 0,
    savingsPaid: false,
    savingsPaidAt: null,
    endOfMonthLeftover: null,
    closedAt: null,
    notes: null,
    isInherited: false,
  }
}

export async function upsertMonthlyPlan(
  userId: string,
  payload: {
    referenceMonth?: string
    monthlyIncome?: number
    savingsGoal?: number
    savingsPaid?: boolean
    endOfMonthLeftover?: number | null
    closedAt?: string | null
    notes?: string | null
  }
) {
  const referenceMonth = resolveReferenceMonth(payload.referenceMonth)
  const visibility = await getHouseholdVisibility(userId)
  const now = new Date().toISOString()

  const existing = await db
    .select()
    .from(monthlyPlans)
    .where(
      and(
        inArray(monthlyPlans.userId, visibility.memberIds),
        eq(monthlyPlans.referenceMonth, referenceMonth)
      )
    )
    .orderBy(desc(monthlyPlans.updatedAt))
    .limit(1)

  if (existing.length > 0) {
    const current = existing[0]
    const nextIncome =
      payload.monthlyIncome !== undefined ? Number(payload.monthlyIncome) : Number(current.monthlyIncome)
    const nextSavings =
      payload.savingsGoal !== undefined ? Number(payload.savingsGoal) : Number(current.savingsGoal)
    const nextSavingsPaidAt =
      payload.savingsPaid !== undefined
        ? payload.savingsPaid
          ? current.savingsPaidAt ?? now
          : null
        : current.savingsPaidAt
    const nextLeftover =
      payload.endOfMonthLeftover !== undefined ? payload.endOfMonthLeftover : current.endOfMonthLeftover
    const nextClosedAt =
      payload.closedAt !== undefined
        ? payload.closedAt
        : payload.endOfMonthLeftover !== undefined
          ? payload.endOfMonthLeftover != null
            ? now
            : null
          : current.closedAt
    const nextNotes = payload.notes !== undefined ? payload.notes : current.notes

    await db
      .update(monthlyPlans)
      .set({
        monthlyIncome: roundMoney(nextIncome),
        savingsGoal: roundMoney(nextSavings),
        savingsPaidAt: nextSavingsPaidAt,
        endOfMonthLeftover: nextLeftover != null ? roundMoney(Number(nextLeftover)) : null,
        closedAt: nextClosedAt,
        notes: nextNotes,
        updatedAt: now,
      })
      .where(eq(monthlyPlans.id, current.id))

    return getMonthlyPlan(userId, referenceMonth)
  }

  const prevPlan = await getMonthlyPlan(userId, referenceMonth)
  const income =
    payload.monthlyIncome !== undefined ? Number(payload.monthlyIncome) : prevPlan.monthlyIncome
  const savings =
    payload.savingsGoal !== undefined ? Number(payload.savingsGoal) : prevPlan.savingsGoal
  const savingsPaidAt = payload.savingsPaid ? now : null
  const leftover =
    payload.endOfMonthLeftover !== undefined ? payload.endOfMonthLeftover : null
  const closedAt = leftover != null ? now : null

  await db.insert(monthlyPlans).values({
    id: randomUUID(),
    referenceMonth,
    monthlyIncome: roundMoney(income),
    savingsGoal: roundMoney(savings),
    savingsPaidAt,
    endOfMonthLeftover: leftover != null ? roundMoney(Number(leftover)) : null,
    closedAt,
    notes: payload.notes ?? null,
    userId,
    familyId: visibility.familyId,
    createdAt: now,
    updatedAt: now,
  })

  return getMonthlyPlan(userId, referenceMonth)
}

