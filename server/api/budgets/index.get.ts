import { and, desc, eq, inArray, or, sql } from 'drizzle-orm'
import { getQuery } from 'h3'
import { db } from '../../database'
import { budgets } from '../../database/schema'
import { requireAuthUser } from '../../utils/auth'
import { hydrateBudgets } from '../../utils/budgets'
import { getHouseholdVisibility } from '../../utils/household'

export default defineEventHandler(async (event) => {
  const { userId } = requireAuthUser(event)
  const query = getQuery(event)

  const page = Math.max(Number(query.page ?? 1), 1)
  const limit = Math.max(Number(query.limit ?? 10), 1)
  const offset = (page - 1) * limit

  const visibility = await getHouseholdVisibility(userId)

  const conditions = [
    or(
      and(eq(budgets.ownerId, userId), eq(budgets.audience, 'individual')),
      and(eq(budgets.audience, 'shared'), inArray(budgets.ownerId, visibility.memberIds))
    )!,
  ]

  if (typeof query.scope === 'string' && query.scope) {
    conditions.push(eq(budgets.scope, query.scope))
  }
  if (typeof query.period === 'string' && query.period) {
    conditions.push(eq(budgets.period, query.period))
  }
  if (query.isActive !== undefined) {
    conditions.push(eq(budgets.isActive, query.isActive === 'true'))
  }
  if (typeof query.referenceMonth === 'string' && query.referenceMonth) {
    conditions.push(eq(budgets.referenceMonth, query.referenceMonth))
  }
  if (typeof query.audience === 'string' && query.audience) {
    conditions.push(eq(budgets.audience, query.audience))
  }

  const whereExpr = and(...conditions)
  const [countRes] = await db
    .select({ total: sql<number>`COUNT(*)` })
    .from(budgets)
    .where(whereExpr)

  const total = Number(countRes?.total ?? 0)
  const rows = await db
    .select()
    .from(budgets)
    .where(whereExpr)
    .orderBy(desc(budgets.referenceMonth), desc(budgets.createdAt))
    .limit(limit)
    .offset(offset)

  const data = await hydrateBudgets(rows)

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
