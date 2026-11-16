import { and, asc, eq, inArray, or } from 'drizzle-orm'
import { db } from '../database'
import { accounts, cards, categories, recurringPayments, recurrings } from '../database/schema'
import { notFound } from './auth'
import { formatReferenceMonth, parseReferenceMonth, resolveReferenceMonth } from './billing'
import { getHouseholdVisibility, getPublicUsersMap } from './household'

export async function hydrateRecurrings(
  rows: Array<typeof recurrings.$inferSelect>,
  includeOwner = true
) {
  if (rows.length === 0) return []

  const accountIds = Array.from(new Set(rows.map((r) => r.accountId).filter(Boolean) as string[]))
  const cardIds = Array.from(new Set(rows.map((r) => r.cardId).filter(Boolean) as string[]))
  const categoryIds = Array.from(new Set(rows.map((r) => r.categoryId).filter(Boolean) as string[]))

  const [accRows, cardRows, catRows, usersMap] = await Promise.all([
    accountIds.length > 0
      ? db.select().from(accounts).where(inArray(accounts.id, accountIds))
      : Promise.resolve([]),
    cardIds.length > 0
      ? db.select().from(cards).where(inArray(cards.id, cardIds))
      : Promise.resolve([]),
    categoryIds.length > 0
      ? db.select().from(categories).where(inArray(categories.id, categoryIds))
      : Promise.resolve([]),
    includeOwner
      ? getPublicUsersMap(rows.map((r) => r.userId))
      : Promise.resolve(new Map()),
  ])

  const accMap = new Map(accRows.map((a) => [a.id, a]))
  const cardMap = new Map(cardRows.map((c) => [c.id, c]))
  const catMap = new Map(catRows.map((c) => [c.id, c]))

  return rows.map((r) => ({
    ...r,
    amount: Number(r.amount),
    account: r.accountId ? accMap.get(r.accountId) ?? null : null,
    card: r.cardId ? cardMap.get(r.cardId) ?? null : null,
    category: r.categoryId ? catMap.get(r.categoryId) ?? null : null,
    ...(includeOwner ? { owner: usersMap.get(r.userId) ?? null } : {}),
  }))
}

export function recurringAppliesToMonth(
  recurring: typeof recurrings.$inferSelect,
  referenceMonth: string
): boolean {
  if (recurring.frequency === 'monthly') {
    return true
  }
  const start = new Date(recurring.startDate)
  return formatReferenceMonth(start) === referenceMonth
}

export async function findVisibleActiveRecurringsForMonth(
  userId: string,
  referenceMonth: string
) {
  const visibility = await getHouseholdVisibility(userId)
  const { year, monthIndex } = parseReferenceMonth(referenceMonth)
  const monthStartIso = new Date(Date.UTC(year, monthIndex, 1)).toISOString().slice(0, 10)
  const monthEndIso = new Date(Date.UTC(year, monthIndex + 1, 0, 23, 59, 59, 999))
    .toISOString()
    .slice(0, 10)

  const conditions = [
    eq(recurrings.isActive, true),
    inArray(recurrings.userId, visibility.memberIds),
  ]

  if (visibility.partnerIds.length > 0) {
    conditions.push(
      or(
        eq(recurrings.userId, userId),
        and(inArray(recurrings.userId, visibility.partnerIds), eq(recurrings.isShared, true))
      )!
    )
  } else {
    conditions.push(eq(recurrings.userId, userId))
  }

  const rows = await db
    .select()
    .from(recurrings)
    .where(and(...conditions))
    .orderBy(asc(recurrings.dueDay), asc(recurrings.name))

  return rows.filter((r) => {
    const startYmd = new Date(r.startDate).toISOString().slice(0, 10)
    if (startYmd > monthEndIso) return false
    if (r.endDate) {
      const endYmd = new Date(r.endDate).toISOString().slice(0, 10)
      if (endYmd < monthStartIso) return false
    }
    return recurringAppliesToMonth(r, referenceMonth)
  })
}

export async function getMonthlyRecurringStatus(userId: string, month?: string) {
  const referenceMonth = resolveReferenceMonth(month)
  const rows = await findVisibleActiveRecurringsForMonth(userId, referenceMonth)
  const hydrated = await hydrateRecurrings(rows, true)

  const recurringIds = rows.map((r) => r.id)
  const payments =
    recurringIds.length === 0
      ? []
      : await db
          .select()
          .from(recurringPayments)
          .where(
            and(
              inArray(recurringPayments.recurringId, recurringIds),
              eq(recurringPayments.referenceMonth, referenceMonth)
            )
          )

  const paidUsersMap = await getPublicUsersMap(payments.map((p) => p.userId))
  const paymentByRecurring = new Map(payments.map((p) => [p.recurringId, p]))

  const data = hydrated.map((r) => {
    const payment = paymentByRecurring.get(r.id)
    return {
      ...r,
      paid: Boolean(payment),
      paidAt: payment ? new Date(payment.paidAt).toISOString() : null,
      paidBy: payment ? paidUsersMap.get(payment.userId) ?? null : null,
    }
  })

  return { month: referenceMonth, data }
}

export async function findOneVisibleRecurring(userId: string, recurringId: string) {
  const visibility = await getHouseholdVisibility(userId)
  const [rec] = await db
    .select()
    .from(recurrings)
    .where(and(eq(recurrings.id, recurringId), inArray(recurrings.userId, visibility.memberIds)))
    .limit(1)

  if (!rec || (rec.userId !== userId && !rec.isShared)) {
    notFound('Recorrência não encontrada')
  }
  const [hydrated] = await hydrateRecurrings([rec], true)
  return hydrated
}
