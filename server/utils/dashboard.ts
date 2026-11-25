import { randomUUID } from 'node:crypto'
import { and, desc, eq, inArray, or } from 'drizzle-orm'
import { db } from '../database'
import {
  accounts,
  cardMonthlyInvoices,
  cards,
  categories,
  debtPayments,
  families,
  invoiceAnalyses,
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
import {
  getHouseholdVisibility,
  getPublicUsersMap,
  getSystemFeatureFlagsMap,
} from './household'
import { sumUserIncomesByMonths } from './incomes'
import { findVisibleActiveRecurringsForMonth } from './recurring'
import { mapAccountsWithEffectiveBalance } from './resources'
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

  const usersMap = await getPublicUsersMap([
    ...recurrings.map((r) => r.userId),
    ...payments.map((p) => p.userId),
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
        paidBy: payment ? usersMap.get(payment.userId) ?? null : null,
        owner: usersMap.get(r.userId) ?? null,
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
    shareWithPartner: Boolean(c.shareWithPartner),
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
  const visibility = await getHouseholdVisibility(userId)

  // Busca todos os cartões da família que são do usuário, compartilhados ou possuem fatura compartilhada no mês
  const allFamilyCards = await db
    .select()
    .from(cards)
    .where(and(inArray(cards.userId, visibility.memberIds), eq(cards.isActive, true)))

  if (allFamilyCards.length === 0) return []

  const cardIds = allFamilyCards.map((c) => c.id)

  const [monthInvoices, monthAnalyses] = await Promise.all([
    db
      .select()
      .from(cardMonthlyInvoices)
      .where(
        and(
          inArray(cardMonthlyInvoices.cardId, cardIds),
          eq(cardMonthlyInvoices.referenceMonth, referenceMonth),
        ),
      ),
    db
      .select({ id: invoiceAnalyses.id, cardId: invoiceAnalyses.cardId })
      .from(invoiceAnalyses)
      .where(
        and(
          inArray(invoiceAnalyses.cardId, cardIds),
          eq(invoiceAnalyses.referenceMonth, referenceMonth),
        ),
      ),
  ])

  const invByCard = new Map(monthInvoices.map((i) => [i.cardId, i]))
  const analysisByCard = new Map(
    monthAnalyses.filter((a) => a.cardId).map((a) => [a.cardId as string, a.id]),
  )

  const allUserIds = [
    ...allFamilyCards.map((c) => c.userId),
    ...monthInvoices.map((i) => i.paidByUserId).filter(Boolean) as string[],
  ]
  const usersMap = await getPublicUsersMap(allUserIds)
  const refDate = referenceMonthMidUtc(referenceMonth)

  const items: Array<{
    invoiceId: string | null
    cardId: string
    name: string
    invoiceValue: number
    closingDay: number
    dueDay: number
    paid: boolean
    paidAt: string | null
    paidByUserId: string | null
    paidBy: ReturnType<typeof usersMap.get> | null
    ownerId: string
    owner: ReturnType<typeof usersMap.get> | null
    isShared: boolean
    analysisId: string | null
  }> = []

  for (const card of allFamilyCards) {
    const monthlyInv = invByCard.get(card.id)

    if (monthlyInv) {
      const visibleToUser =
        card.userId === userId || Boolean(card.shareWithPartner) || Boolean(monthlyInv.isShared)
      if (!visibleToUser) continue

      const payerId = monthlyInv.paidByUserId || (monthlyInv.paidAt ? monthlyInv.userId : null)
      items.push({
        invoiceId: monthlyInv.id,
        cardId: card.id,
        name: card.name,
        invoiceValue: roundMoney(Number(monthlyInv.amount)),
        closingDay: card.closingDay,
        dueDay: monthlyInv.dueDay ?? card.dueDay,
        paid: Boolean(monthlyInv.paidAt),
        paidAt: monthlyInv.paidAt ?? null,
        paidByUserId: payerId,
        paidBy: payerId ? usersMap.get(payerId) ?? null : null,
        ownerId: card.userId,
        owner: usersMap.get(card.userId) ?? null,
        isShared: Boolean(monthlyInv.isShared || card.shareWithPartner),
        analysisId: analysisByCard.get(card.id) ?? null,
      })
      continue
    }

    // Fallback legado caso algum cartão antigo tenha lançamentos diretos na tabela transactions
    if (card.userId !== userId && !card.shareWithPartner) continue

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
      card.userId,
      userId,
      dueCycle.periodStart,
      dueCycle.periodEnd
    )

    if (invoiceValue <= 0) continue

    const paid = await isCardInvoicePaid(card.id, card.userId, referenceMonth, userId)

    items.push({
      invoiceId: null,
      cardId: card.id,
      name: card.name,
      invoiceValue: roundMoney(invoiceValue),
      closingDay: card.closingDay,
      dueDay: dueCycle.dueDate.getUTCDate(),
      paid,
      paidAt: null,
      paidByUserId: paid ? card.userId : null,
      paidBy: paid ? usersMap.get(card.userId) ?? null : null,
      ownerId: card.userId,
      owner: usersMap.get(card.userId) ?? null,
      isShared: Boolean(card.shareWithPartner),
      analysisId: analysisByCard.get(card.id) ?? null,
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

function recurringCountsForUserBudget(
  r: { ownerId: string; paid: boolean; paidByUserId?: string | null },
  targetUserId: string,
): boolean {
  if (!r.paid) {
    return r.ownerId === targetUserId
  }
  const payerId = r.paidByUserId || r.ownerId
  return payerId === targetUserId
}

async function buildDiscriminatedPersonOverview(
  targetUserId: string,
  referenceMonth: string,
) {
  const visibility = await getHouseholdVisibility(targetUserId)
  const hasPartner = visibility.partnerIds.length > 0

  const [plan, recItems, cardItems, ownAccountsRaw, txRows, usersMap] = await Promise.all([
    getMonthlyPlan(targetUserId, referenceMonth),
    buildRecurringBillItems(targetUserId, referenceMonth),
    buildCardInvoiceItems(targetUserId, referenceMonth),
    db
      .select()
      .from(accounts)
      .where(and(eq(accounts.userId, targetUserId), eq(accounts.isActive, true))),
    db
      .select()
      .from(transactions)
      .where(
        and(
          inArray(transactions.userId, visibility.memberIds),
          eq(transactions.type, 'expense'),
          hasPartner
            ? or(
                eq(transactions.userId, targetUserId),
                and(inArray(transactions.userId, visibility.partnerIds), eq(transactions.isShared, true)),
              )!
            : eq(transactions.userId, targetUserId),
        ),
      ),
    getPublicUsersMap([targetUserId]),
  ])

  const ownAccounts = await mapAccountsWithEffectiveBalance(ownAccountsRaw)
  const savedInAccounts = roundMoney(
    ownAccounts.reduce((s, a) => s + Number(a.balance || 0), 0),
  )

  const standaloneCandidates = txRows.filter(
    (t) => !t.cardId && expenseBelongsToMonth(t, referenceMonth),
  )
  const debtIds = standaloneCandidates.filter((t) => t.kind === 'debt').map((t) => t.id)
  const debtPaidRows =
    debtIds.length > 0
      ? await db
          .select()
          .from(debtPayments)
          .where(
            and(
              inArray(debtPayments.transactionId, debtIds),
              eq(debtPayments.referenceMonth, referenceMonth),
            ),
          )
      : []
  const debtPayerByTx = new Map(debtPaidRows.map((p) => [p.transactionId, p.userId]))

  const monthStandaloneForBudget = standaloneCandidates.filter((t) => {
    if (t.kind === 'debt') {
      const payerId = debtPayerByTx.get(t.id)
      if (!payerId) return t.userId === targetUserId
      return payerId === targetUserId
    }
    const isPaid = t.status === 'cleared' || t.status === 'paid' || Boolean(t.paidAt)
    if (!isPaid) return t.userId === targetUserId
    const payerId = t.paidByUserId || t.userId
    return payerId === targetUserId
  })

  const ownRecurringTotal = recItems
    .filter((r) => recurringCountsForUserBudget(r, targetUserId))
    .reduce((s, r) => s + r.value, 0)
  const ownCardTotal = cardItems
    .filter((c) => recurringCountsForUserBudget(c, targetUserId) && c.invoiceValue > 0)
    .reduce((s, c) => s + c.invoiceValue, 0)
  const ownStandaloneTotal = monthStandaloneForBudget.reduce((s, t) => s + Number(t.amount), 0)

  const ownBillsTotal = roundMoney(ownRecurringTotal + ownCardTotal + ownStandaloneTotal)
  const freeBalance = roundMoney(plan.monthlyIncome - ownBillsTotal - plan.savingsGoal)
  const person = usersMap.get(targetUserId)

  return {
    userId: targetUserId,
    name: person?.name || person?.email?.split('@')[0] || 'Par',
    email: person?.email || '',
    monthlyIncome: plan.monthlyIncome,
    individualBillsTotal: ownBillsTotal,
    sharedBillsHalf: 0,
    totalBillsShare: ownBillsTotal,
    savingsGoal: plan.savingsGoal,
    savingsPaid: plan.savingsPaid,
    freeBalance,
    savedInAccounts,
  }
}

export async function getMonthlyCommitment(userId: string, month?: string) {
  const referenceMonth = resolveReferenceMonth(month)
  const visibility = await getHouseholdVisibility(userId)

  const [recurringItems, cardItems, monthlyIncome] = await Promise.all([
    buildRecurringBillItems(userId, referenceMonth),
    buildCardInvoiceItems(userId, referenceMonth),
    sumMonthlyIncome(userId, referenceMonth),
  ])

  let shareOverview = false
  let partnerOverview: Awaited<ReturnType<typeof buildDiscriminatedPersonOverview>> | null = null

  if (visibility.familyId && visibility.partnerIds.length > 0) {
    const [fam] = await db
      .select({ shareOverview: families.shareOverview })
      .from(families)
      .where(eq(families.id, visibility.familyId))
      .limit(1)
    shareOverview = Boolean(fam?.shareOverview)
    if (shareOverview) {
      partnerOverview = await buildDiscriminatedPersonOverview(
        visibility.partnerIds[0],
        referenceMonth,
      )
    }
  }

  const ownRecurringItems = recurringItems.filter((i) => recurringCountsForUserBudget(i, userId))
  const ownCardItems = cardItems.filter((i) => recurringCountsForUserBudget(i, userId))

  const recurringTotal = ownRecurringItems.reduce((s, i) => s + i.value, 0)
  const recurringPaid = ownRecurringItems.filter((i) => i.paid).reduce((s, i) => s + i.value, 0)

  const cardTotal = ownCardItems.reduce((s, i) => s + i.invoiceValue, 0)
  const cardPaid = ownCardItems.filter((i) => i.paid).reduce((s, i) => s + i.invoiceValue, 0)

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
    shareOverview,
    partnerOverview,
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

  const debtPaymentByTx = new Map(debtPaymentsInMonth.map((p) => [p.transactionId, p]))
  const agendaUsersMap = await getPublicUsersMap([
    ...activeDebts.map((d) => d.userId),
    ...debtPaymentsInMonth.map((p) => p.userId),
  ])

  const events: Array<{
    day: number | null
    type: 'bill_due' | 'debt_due' | 'invoice_close' | 'invoice_due'
    name: string
    subtitle: string | null
    value: number | null
    paid: boolean
    paidBy?: { id: string; email: string; name: string | null } | null
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
      paidBy: bill.paidBy ?? null,
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
    const debtPayment = debtPaymentByTx.get(debt.id)

    events.push({
      day: dueDay,
      type: 'debt_due',
      name: debt.description,
      subtitle:
        total > 1
          ? `Financiamento / Parcela ${parcelNum} de ${total}`
          : 'Financiamento / Parcela única',
      value: roundMoney(Number(debt.amount)),
      paid: Boolean(debtPayment),
      paidBy: debtPayment ? agendaUsersMap.get(debtPayment.userId) ?? null : null,
      isShared: Boolean(debt.isShared),
      referenceId: debt.id,
      ownerId: debt.userId,
    })
  }

  // Faturas de cartão lançadas no mês (card_monthly_invoices)
  const cardItems = await buildCardInvoiceItems(userId, referenceMonth)
  for (const inv of cardItems) {
    if (inv.invoiceValue <= 0) continue
    events.push({
      day: inv.dueDay,
      type: 'invoice_due',
      name: `Fatura ${inv.name}`,
      subtitle: 'Fatura de cartão de crédito',
      value: inv.invoiceValue,
      paid: inv.paid,
      paidBy: inv.paidBy ?? null,
      isShared: Boolean(inv.isShared),
      referenceId: inv.cardId,
      ownerId: inv.ownerId,
    })
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

  const [rows, incomesMap] = await Promise.all([
    db
      .select()
      .from(monthlyPlans)
      .where(
        and(
          eq(monthlyPlans.userId, userId),
          eq(monthlyPlans.referenceMonth, referenceMonth)
        )
      )
      .orderBy(desc(monthlyPlans.updatedAt))
      .limit(1),
    sumUserIncomesByMonths(userId, [referenceMonth]),
  ])

  const incomesInfo = incomesMap.get(referenceMonth) ?? {
    total: 0,
    count: 0,
    fixedTotal: 0,
    variableTotal: 0,
  }

  if (rows.length > 0) {
    const plan = rows[0]
    const baseMonthlyIncome = roundMoney(Number(plan.monthlyIncome))
    return {
      referenceMonth,
      baseMonthlyIncome,
      incomesTotal: incomesInfo.total,
      incomesCount: incomesInfo.count,
      monthlyIncome: roundMoney(baseMonthlyIncome + incomesInfo.total),
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

  // Herda automaticamente a Renda Base e Meta de Guardar do último mês configurado por ESTA pessoa
  const latestRows = await db
    .select()
    .from(monthlyPlans)
    .where(eq(monthlyPlans.userId, userId))
    .orderBy(desc(monthlyPlans.referenceMonth), desc(monthlyPlans.updatedAt))
    .limit(1)

  if (latestRows.length > 0) {
    const prev = latestRows[0]
    const baseMonthlyIncome = roundMoney(Number(prev.monthlyIncome))
    return {
      referenceMonth,
      baseMonthlyIncome,
      incomesTotal: incomesInfo.total,
      incomesCount: incomesInfo.count,
      monthlyIncome: roundMoney(baseMonthlyIncome + incomesInfo.total),
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
    baseMonthlyIncome: 0,
    incomesTotal: incomesInfo.total,
    incomesCount: incomesInfo.count,
    monthlyIncome: roundMoney(incomesInfo.total),
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
        eq(monthlyPlans.userId, userId),
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
    payload.monthlyIncome !== undefined ? Number(payload.monthlyIncome) : prevPlan.baseMonthlyIncome
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
  const hasPartner = visibility.partnerIds.length > 0

  const [allPlans, expenseRows, commitments, incomesByMonth] = await Promise.all([
    db
      .select()
      .from(monthlyPlans)
      .where(eq(monthlyPlans.userId, userId))
      .orderBy(desc(monthlyPlans.referenceMonth), desc(monthlyPlans.updatedAt)),
    db
      .select()
      .from(transactions)
      .where(
        and(
          inArray(transactions.userId, visibility.memberIds),
          eq(transactions.type, 'expense'),
          hasPartner
            ? or(
                eq(transactions.userId, userId),
                and(inArray(transactions.userId, visibility.partnerIds), eq(transactions.isShared, true)),
              )!
            : eq(transactions.userId, userId),
        )
      ),
    Promise.all(list.map((m) => getMonthlyCommitment(userId, m))),
    sumUserIncomesByMonths(userId, list),
  ])

  const debtIds = expenseRows.filter((t) => t.kind === 'debt').map((t) => t.id)
  const debtPaidRows =
    debtIds.length > 0
      ? await db
          .select()
          .from(debtPayments)
          .where(inArray(debtPayments.transactionId, debtIds))
      : []

  const debtPayerByTxMonth = new Map(
    debtPaidRows.map((p) => [`${p.transactionId}:${p.referenceMonth}`, p.userId])
  )

  const planByMonth = new Map<string, (typeof allPlans)[number]>()
  for (const p of allPlans) {
    if (!planByMonth.has(p.referenceMonth)) planByMonth.set(p.referenceMonth, p)
  }
  const latestConfiguredPlan = allPlans[0] ?? null

  const standalone = expenseRows.filter((t) => !t.cardId)

  const result: MonthlyHistoryEntry[] = list.map((month, idx) => {
    const exactPlan = planByMonth.get(month)
    const monthStandalone = standalone.filter((t) => {
      if (!expenseBelongsToMonth(t, month)) return false
      if (t.kind === 'debt') {
        const payerId = debtPayerByTxMonth.get(`${t.id}:${month}`)
        return payerId ? payerId === userId : t.userId === userId
      }
      const isPaid = t.status === 'cleared' || t.status === 'paid' || Boolean(t.paidAt)
      if (!isPaid) return t.userId === userId
      const payerId = t.paidByUserId || t.userId
      return payerId === userId
    })

    const standaloneTotal = monthStandalone.reduce(
      (s, t) => s + Number(t.amount),
      0,
    )
    const debtsTotal = monthStandalone
      .filter((t) => t.kind === 'debt')
      .reduce((s, t) => s + Number(t.amount), 0)

    const standalonePaid = monthStandalone
      .filter((t) => {
        if (t.kind === 'debt') return debtPayerByTxMonth.has(`${t.id}:${month}`)
        return t.status === 'cleared' || t.status === 'paid' || Boolean(t.paidAt)
      })
      .reduce((s, t) => s + Number(t.amount), 0)

    const commitment = commitments[idx]
    const recItems = commitment.breakdown.recurringBills.items.filter((r) =>
      recurringCountsForUserBudget(r, userId),
    )
    const recurringTotal = roundMoney(
      recItems.reduce((s, r) => s + r.value, 0),
    )
    const recurringPaid = roundMoney(
      recItems.filter((r) => r.paid).reduce((s, r) => s + r.value, 0),
    )
    const cardsTotal = roundMoney(commitment.breakdown.cardInvoices.total)
    const cardsPaid = roundMoney(commitment.breakdown.cardInvoices.paid)
    const bills = roundMoney(recurringTotal + cardsTotal + standaloneTotal)
    const billsPaid = roundMoney(recurringPaid + cardsPaid + standalonePaid)
    const billsPending = roundMoney(Math.max(bills - billsPaid, 0))

    // Se o mês tem contas ou ganhos ativos mas ainda não teve um monthly_plan salvo diretamente nele,
    // usa a renda base / meta configurada no plano mais recente (igual a Home faz)
    const monthIncomesTotal = incomesByMonth.get(month)?.total ?? 0
    const fallbackPlan = !exactPlan && (bills > 0 || monthIncomesTotal > 0) ? latestConfiguredPlan : null
    const effectivePlan = exactPlan ?? fallbackPlan

    const baseIncome = effectivePlan ? roundMoney(Number(effectivePlan.monthlyIncome)) : 0
    const income = roundMoney(baseIncome + monthIncomesTotal)
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

