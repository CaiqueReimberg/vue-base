import { and, eq } from 'drizzle-orm'
import { getQuery, getRouterParam } from 'h3'
import { db } from '../../database'
import { incomeEntries } from '../../database/schema'
import { notFound, requireAuthUser } from '../../utils/auth'
import { shiftYearMonth } from '../../utils/incomes'

export default defineEventHandler(async (event) => {
  const { userId } = requireAuthUser(event)
  const id = getRouterParam(event, 'id')!
  const query = getQuery(event)
  const stopFromMonth =
    typeof query.stopFromMonth === 'string' && /^\d{4}-\d{2}$/.test(query.stopFromMonth)
      ? query.stopFromMonth
      : undefined

  const [existing] = await db
    .select()
    .from(incomeEntries)
    .where(and(eq(incomeEntries.id, id), eq(incomeEntries.userId, userId)))
    .limit(1)

  if (!existing) {
    notFound('Entrada não encontrada.')
  }

  if (existing.isRecurring && stopFromMonth && stopFromMonth > existing.referenceMonth) {
    const prevMonth = shiftYearMonth(stopFromMonth, -1)
    await db
      .update(incomeEntries)
      .set({
        endMonth: prevMonth,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(incomeEntries.id, id))
    return { stopped: true, endMonth: prevMonth }
  }

  await db.delete(incomeEntries).where(eq(incomeEntries.id, id))
  return { deleted: true }
})
