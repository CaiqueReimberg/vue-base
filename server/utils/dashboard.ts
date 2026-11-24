import { randomUUID } from 'node:crypto'
import { and, desc, eq, inArray, or } from 'drizzle-orm'
import { db } from '../database'
import {
  cards,
  categories,
  debtPayments,
  monthlyPlans,
  recurringMonthOverrides,
  recurringPayments,
  transactions,
} from '../database/schema'
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
import { getHouseholdVisibility, getSystemFeatureFlagsMap } from './household'
import { findVisibleActiveRecurringsForMonth } from './recurring'
import { getDebtStartMonth, getMonthsDiff, isDebtActiveInMonth } from './transactions'

async function buildRecurringBillItems(userId: string, referenceMonth: string) {
  const recurrings = await findVisibleActiveRecurringsForMonth(userId, referenceMonth)
  const recurringIds = recurrings.map((r) => r.id)
  const catIds = Array.from(new Set(recurrings.map((r) => r.categoryId).filter(Boolean) as string[]))

  const [payments, overrides, catRows] = await Promise.all([
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
    recurringIds.length === 0
      ? Promise.resolve([])
      : db
          .select()
          .from(recurringMonthOverrides)
          .where(
            and(
              inArray(recurringMonthOverrides.recurringId, recurringIds),
              eq(recurringMonthOverrides.referenceMonth, referenceMonth)
            )
          ),
    catIds.length === 0
      ? Promise.resolve([])
      : db.select().from(categories).where(inArray(categories.id, catIds)),
  ])

  const paymentByRecurring = new Map(payments.map((p) => [p.recurringId, p]))
  const overrideByRecurring = new Map(overrides.map((o) => [o.recurringId, Number(o.amount)]))
  const catMap = new Map(catRows.map((c) => [c.id, c.name]))

  return recurrings
    .filter((r) => r.transactionType === 'expense')
    .map((r) => {
      const payment = paymentByRecurring.get(r.id)
      const overrideVal = overrideByRecurring.get(r.id)
      return {
        id: r.id,
        name: r.name,
        value: overrideVal !== undefined ? overrideVal : Number(r.amount),
        baseValue: Number(r.amount),
        isMonthOverride: overrideVal !== undefined,
        dueDay: r.dueDay,
        paid: Boolean(payment),
        paidAt: payment ? new Date(payment.paidAt).toISOString() : null,
        paidByUserId: payment?.userId ?? null,
        category: r.categoryId ? catMap.get(r.categoryId) ?? null : null,
        isShared: Boolean(r.isShared),
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
  const visibility = await getHouseholdVisibility(userId)

  const [recurringItems, systemFlags, debtRows] = await Promise.all([
    buildRecurringBillItems(userId, referenceMonth),
    getSystemFeatureFlagsMap(),
    db
      .select()
      .from(transactions)
      .where(
        and(
          inArray(transactions.userId, visibility.memberIds),
          eq(transactions.type, 'expense'),
          eq(transactions.kind, 'debt'),
          visibility.partnerIds.length > 0
            ? or(
                eq(transactions.userId, userId),
                and(inArray(transactions.userId, visibility.partnerIds), eq(transactions.isShared, true)),
              )!
            : eq(transactions.userId, userId),
        ),
      ),
  ])

  const activeDebts = debtRows.filter((d) => isDebtActiveInMonth(d, referenceMonth))
  const activeDebtIds = activeDebts.map((d) => d.id)
  const debtPaymentsInMonth =
    activeDebtIds.length > 0
      ? await db
          .select()
          .from(debtPayments)
          .where(
            and(
              inArray(debtPayments.transactionId, activeDebtIds),
              eq(debtPayments.referenceMonth, referenceMonth),
            ),
          )
      : []

  const paidDebtIds = new Set(debtPaymentsInMonth.map((p) => p.transactionId))

  const events: Array<{
    day: number | null
    type: 'bill_due' | 'debt_due' | 'invoice_close' | 'invoice_due'
    name: string
    subtitle: string | null
    value: number | null
    paid: boolean
    isShared: boolean
    referenceId: string
    ownerId?: string
  }> = []

  for (const bill of recurringItems) {
    events.push({
      day: bill.dueDay ?? null,
      type: 'bill_due',
      name: bill.name,
      subtitle: bill.category ? `Conta fixa · ${bill.category}` : 'Conta fixa mensal',
      value: bill.value,
      paid: bill.paid,
      isShared: Boolean(bill.isShared),
      referenceId: bill.id,
      ownerId: bill.ownerId,
    })
  }

  for (const debt of activeDebts) {
    const startYm = getDebtStartMonth(debt)
    const diff = getMonthsDiff(startYm, referenceMonth)
    const total = Math.max(Number(debt.installmentTotal || 1), 1)
    const parcelNum = diff >= 0 && diff < total ? diff + 1 : 1
    const dueDay = debt.dueDate
      ? new Date(debt.dueDate).getUTCDate()
      : debt.occurredAt
        ? new Date(debt.occurredAt).getUTCDate()
        : null

    events.push({
      day: dueDay,
      type: 'debt_due',
      name: debt.description,
      subtitle:
        total > 1
          ? `Financiamento / Parcela ${parcelNum} de ${total}`
          : 'Financiamento / Parcela única',
      value: roundMoney(Number(debt.amount)),
      paid: paidDebtIds.has(debt.id),
      isShared: Boolean(debt.isShared),
      referenceId: debt.id,
      ownerId: debt.userId,
    })
  }

  // Somente exibe cartões manuais legados se o módulo "cards" estiver habilitado nas feature flags
  if (systemFlags.cards !== false) {
    const [cardItems, visibleCards] = await Promise.all([
      buildCardInvoiceItems(userId, referenceMonth),
      findVisibleCardsRaw(userId),
    ])

    const refDate = referenceMonthMidUtc(referenceMonth)
    for (const card of visibleCards) {
      if (!card.isActive) continue
      const cycles = buildCyclesAroundReference(card.closingDay, card.dueDay, 3, 3, refDate)

      const closeCycle = cycles.find((c) => formatReferenceMonth(c.periodEnd) === referenceMonth)
      if (closeCycle) {
        const invoice = cardItems.find((i) => i.cardId === card.id)
        events.push({
          day: closeCycle.periodEnd.getUTCDate(),
          type: 'invoice_close',
          name: card.name,
          subtitle: 'Fechamento da fatura',
          value: null,
          paid: invoice?.paid ?? false,
          isShared: true,
          referenceId: card.id,
          ownerId: card.ownerId,
        })
      }

      const dueCycle = cycles.find((c) => formatReferenceMonth(c.dueDate) === referenceMonth)
      if (dueCycle) {
        const invoice = cardItems.find((i) => i.cardId === card.id)
        if ((invoice?.invoiceValue ?? 0) > 0) {
          events.push({
            day: dueCycle.dueDate.getUTCDate(),
            type: 'invoice_due',
            name: `Fatura ${card.name}`,
            subtitle: 'Vencimento da fatura',
            value: invoice?.invoiceValue ?? 0,
            paid: invoice?.paid ?? false,
            isShared: true,
            referenceId: card.id,
            ownerId: card.ownerId,
          })
        }
      }
    }
  }

  events.sort((a, b) => {
    if (a.day == null && b.day == null) return a.name.localeCompare(b.name)
    if (a.day == null) return 1
    if (b.day == null) return -1
    return a.day - b.day || a.name.localeCompare(b.name)
  })

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

export interface MonthlyHistoryEntry {
  month: string
  hasPlan: boolean
  isInheritedPlan: boolean
  hasActivity: boolean
  income: number
  bills: number
  billsPaid: number
  billsPending: number
  recurringTotal: number
  debtsTotal: number
  cardsTotal: number
  savingsGoal: number
  savingsPaid: boolean
  saved: number
  free: number
  leftover: number | null
}

function shiftMonth(ym: string, delta: number): string {
  const { year, monthIndex } = parseReferenceMonth(ym)
  return formatReferenceMonth(new Date(Date.UTC(year, monthIndex + delta, 1)))
}

function expenseBelongsToMonth(
  t: { kind: string | null; referenceMonth: string | null; occurredAt: string; installmentTotal: number | null },
  ym: string
): boolean {
  if (t.kind === 'debt') return isDebtActiveInMonth(t, ym)
  if (t.referenceMonth) return t.referenceMonth === ym
  return String(t.occurredAt).slice(0, 7) === ym
}

/**
 * Histórico dos últimos N meses (do mais antigo ao mais recente, terminando em `endMonth`).
 * "bills" segue a mesma regra do card "Contas do mês": fixas + faturas + gastos avulsos fora do cartão.
 * Meses sem plano próprio não herdam renda/meta de outros meses (hasPlan = false).
 */
export async function getMonthlyHistory(
  userId: string,
  months = 6,
  endMonth?: string
): Promise<{ months: MonthlyHistoryEntry[] }> {
  const count = Math.min(Math.max(Math.floor(months) || 6, 1), 24)
  const last = resolveReferenceMonth(endMonth)
  const list = Array.from({ length: count }, (_, i) => shiftMonth(last, i - (count - 1)))

  const visibility = await getHouseholdVisibility(userId)

  const [allPlans, expenseRows, commitments] = await Promise.all([
    db
      .select()
      .from(monthlyPlans)
      .where(inArray(monthlyPlans.userId, visibility.memberIds))
      .orderBy(desc(monthlyPlans.referenceMonth), desc(monthlyPlans.updatedAt)),
    db
      .select()
      .from(transactions)
      .where(
        and(
          inArray(transactions.userId, visibility.memberIds),
          eq(transactions.type, 'expense'),
          visibility.partnerIds.length > 0
            ? or(
                eq(transactions.userId, userId),
                and(inArray(transactions.userId, visibility.partnerIds), eq(transactions.isShared, true))
              )!
            : eq(transactions.userId, userId)
        )
      ),
    Promise.all(list.map((m) => getMonthlyCommitment(userId, m))),
  ])

  const debtIds = expenseRows.filter((t) => t.kind === 'debt').map((t) => t.id)
  const debtPaidRows =
    debtIds.length > 0
      ? await db
          .select()
          .from(debtPayments)
          .where(inArray(debtPayments.transactionId, debtIds))
      : []

  const debtPaidSet = new Set(
    debtPaidRows.map((p) => `${p.transactionId}:${p.referenceMonth}`)
  )

  const planByMonth = new Map<string, (typeof allPlans)[number]>()
  for (const p of allPlans) {
    if (!planByMonth.has(p.referenceMonth)) planByMonth.set(p.referenceMonth, p)
  }
  const latestConfiguredPlan = allPlans[0] ?? null

  const standalone = expenseRows.filter((t) => !t.cardId)

  const result: MonthlyHistoryEntry[] = list.map((month, idx) => {
    const exactPlan = planByMonth.get(month)
    const monthStandalone = standalone.filter((t) => expenseBelongsToMonth(t, month))

    const standaloneTotal = monthStandalone.reduce((s, t) => s + Number(t.amount), 0)
    const debtsTotal = monthStandalone
      .filter((t) => t.kind === 'debt')
      .reduce((s, t) => s + Number(t.amount), 0)

    const standalonePaid = monthStandalone
      .filter((t) => {
        if (t.kind === 'debt') return debtPaidSet.has(`${t.id}:${month}`)
        return t.status === 'cleared' || t.status === 'paid' || Boolean(t.paidAt)
      })
      .reduce((s, t) => s + Number(t.amount), 0)

    const commitment = commitments[idx]
    const recurringTotal = roundMoney(commitment.breakdown.recurringBills.total)
    const cardsTotal = roundMoney(commitment.breakdown.cardInvoices.total)
    const bills = roundMoney(commitment.totalCommitted + standaloneTotal)
    const billsPaid = roundMoney(commitment.totalPaid + standalonePaid)
    const billsPending = roundMoney(Math.max(bills - billsPaid, 0))

    // Se o mês tem contas ativas mas ainda não teve um monthly_plan salvo diretamente nele,
    // usa a renda/meta configurada no plano mais recente (igual a Home faz)
    const fallbackPlan = !exactPlan && bills > 0 ? latestConfiguredPlan : null
    const effectivePlan = exactPlan ?? fallbackPlan

    const income = effectivePlan ? roundMoney(Number(effectivePlan.monthlyIncome)) : 0
    const savingsGoal = effectivePlan ? roundMoney(Number(effectivePlan.savingsGoal)) : 0
    const savingsPaid = Boolean(exactPlan?.savingsPaidAt)
    const leftover =
      exactPlan?.endOfMonthLeftover != null
        ? roundMoney(Number(exactPlan.endOfMonthLeftover))
        : null
    const saved = roundMoney((savingsPaid ? savingsGoal : 0) + (leftover != null ? leftover : 0))
    const hasActivity = Boolean(exactPlan) || bills > 0 || income > 0

    return {
      month,
      hasPlan: Boolean(exactPlan),
      isInheritedPlan: !exactPlan && Boolean(fallbackPlan),
      hasActivity,
      income,
      bills,
      billsPaid,
      billsPending,
      recurringTotal,
      debtsTotal: roundMoney(debtsTotal),
      cardsTotal,
      savingsGoal,
      savingsPaid,
      saved,
      free: roundMoney(income - bills - savingsGoal),
      leftover,
    }
  })

  return { months: result }
}

