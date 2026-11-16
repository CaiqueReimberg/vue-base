import { and, asc, eq, inArray, isNull, or } from 'drizzle-orm'
import { getQuery } from 'h3'
import { db } from '../../database'
import { categories } from '../../database/schema'
import { requireAuthUser } from '../../utils/auth'
import { getHouseholdVisibility } from '../../utils/household'

export default defineEventHandler(async (event) => {
  const { userId } = requireAuthUser(event)
  const query = getQuery(event)
  const type = typeof query.type === 'string' && query.type ? query.type : undefined

  const visibility = await getHouseholdVisibility(userId)
  const ownerFilter = or(
    isNull(categories.userId),
    inArray(categories.userId, visibility.memberIds)
  )

  const whereClause = type ? and(ownerFilter, eq(categories.type, type)) : ownerFilter

  return db
    .select()
    .from(categories)
    .where(whereClause)
    .orderBy(asc(categories.name))
})
