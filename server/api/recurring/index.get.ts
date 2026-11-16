import { and, desc, eq, inArray, or, sql } from 'drizzle-orm'
import { getQuery } from 'h3'
import { db } from '../../database'
import { recurrings } from '../../database/schema'
import { requireAuthUser } from '../../utils/auth'
import { getHouseholdVisibility } from '../../utils/household'
import { hydrateRecurrings } from '../../utils/recurring'

export default defineEventHandler(async (event) => {
  const { userId } = requireAuthUser(event)
  const query = getQuery(event)

  const page = Math.max(Number(query.page ?? 1), 1)
  const limit = Math.max(Number(query.limit ?? 10), 1)
  const offset = (page - 1) * limit

  const visibility = await getHouseholdVisibility(userId)
  const conditions = [inArray(recurrings.userId, visibility.memberIds)]

  if (typeof query.kind === 'string' && query.kind) {
    conditions.push(eq(recurrings.kind, query.kind))
  }
  if (query.isActive !== undefined) {
    conditions.push(eq(recurrings.isActive, query.isActive === 'true'))
  }
  if (query.isShared !== undefined) {
    conditions.push(eq(recurrings.isShared, query.isShared === 'true'))
  }
  if (typeof query.familyId === 'string' && query.familyId) {
    conditions.push(eq(recurrings.familyId, query.familyId))
  }

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

  const whereExpr = and(...conditions)
  const [countRes] = await db
    .select({ total: sql<number>`COUNT(*)` })
    .from(recurrings)
    .where(whereExpr)

  const total = Number(countRes?.total ?? 0)
  const rows = await db
    .select()
    .from(recurrings)
    .where(whereExpr)
    .orderBy(desc(recurrings.createdAt))
    .limit(limit)
    .offset(offset)

  const data = await hydrateRecurrings(rows, true)

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
