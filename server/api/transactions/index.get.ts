import { and, desc, eq, inArray, or, sql } from 'drizzle-orm'
import { getQuery } from 'h3'
import { db } from '../../database'
import { transactions } from '../../database/schema'
import { requireAuthUser } from '../../utils/auth'
import { getHouseholdVisibility } from '../../utils/household'
import { hydrateTransactions, isDebtActiveInMonth } from '../../utils/transactions'

export default defineEventHandler(async (event) => {
  const { userId } = requireAuthUser(event)
  const query = getQuery(event)

  const page = Math.max(Number(query.page ?? 1), 1)
  const limit = Math.max(Number(query.limit ?? 10), 1)
  const offset = (page - 1) * limit
  const targetReferenceMonth =
    typeof query.referenceMonth === 'string' && /^\d{4}-\d{2}$/.test(query.referenceMonth)
      ? query.referenceMonth
      : undefined
  const isDebtQuery = query.kind === 'debt'

  const visibility = await getHouseholdVisibility(userId)
  const conditions = [inArray(transactions.userId, visibility.memberIds)]

  if (typeof query.type === 'string' && query.type) {
    conditions.push(eq(transactions.type, query.type))
  }
  if (typeof query.kind === 'string' && query.kind) {
    conditions.push(eq(transactions.kind, query.kind))
  }
  if (targetReferenceMonth && !isDebtQuery) {
    conditions.push(eq(transactions.referenceMonth, targetReferenceMonth))
  }
  if (typeof query.accountId === 'string' && query.accountId) {
    conditions.push(eq(transactions.accountId, query.accountId))
  }
  if (typeof query.cardId === 'string' && query.cardId) {
    conditions.push(eq(transactions.cardId, query.cardId))
  }
  if (typeof query.categoryId === 'string' && query.categoryId) {
    conditions.push(eq(transactions.categoryId, query.categoryId))
  }
  if (typeof query.familyId === 'string' && query.familyId) {
    conditions.push(eq(transactions.familyId, query.familyId))
  }

  if (visibility.partnerIds.length > 0) {
    conditions.push(
      or(
        eq(transactions.userId, userId),
        and(inArray(transactions.userId, visibility.partnerIds), eq(transactions.isShared, true))
      )!
    )
  } else {
    conditions.push(eq(transactions.userId, userId))
  }

  const whereExpr = and(...conditions)

  if (isDebtQuery && targetReferenceMonth) {
    const allDebtRows = await db
      .select()
      .from(transactions)
      .where(whereExpr)
      .orderBy(desc(transactions.createdAt))

    const activeInMonth = allDebtRows.filter((row) =>
      isDebtActiveInMonth(row, targetReferenceMonth),
    )
    const total = activeInMonth.length
    const paginatedRows = activeInMonth.slice(offset, offset + limit)
    const data = await hydrateTransactions(paginatedRows, true, targetReferenceMonth)

    return {
      data,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    }
  }

  const [countRes] = await db
    .select({ total: sql<number>`COUNT(*)` })
    .from(transactions)
    .where(whereExpr)

  const total = Number(countRes?.total ?? 0)

  const rows = await db
    .select()
    .from(transactions)
    .where(whereExpr)
    .orderBy(desc(transactions.createdAt))
    .limit(limit)
    .offset(offset)

  const data = await hydrateTransactions(rows, true, targetReferenceMonth)

  return {
    data,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    },
  }
})
