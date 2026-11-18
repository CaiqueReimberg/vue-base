import { and, desc, eq, inArray, or } from 'drizzle-orm'
import { getQuery } from 'h3'
import { db } from '../../database'
import { invoiceAnalyses } from '../../database/schema'
import { requireAuthUser } from '../../utils/auth'
import {
  assertInvoiceAnalysisEnabled,
  getHouseholdVisibility,
  getPublicUsersMap,
} from '../../utils/household'

export default defineEventHandler(async (event) => {
  const { userId } = requireAuthUser(event)
  await assertInvoiceAnalysisEnabled(userId)
  const query = getQuery(event)
  const month = typeof query.month === 'string' && query.month ? query.month : undefined

  const visibility = await getHouseholdVisibility(userId)
  const conditions = [inArray(invoiceAnalyses.userId, visibility.memberIds)]

  if (month) {
    conditions.push(eq(invoiceAnalyses.referenceMonth, month))
  }

  if (visibility.partnerIds.length > 0) {
    conditions.push(
      or(
        eq(invoiceAnalyses.userId, userId),
        and(inArray(invoiceAnalyses.userId, visibility.partnerIds), eq(invoiceAnalyses.isShared, true))
      )!
    )
  } else {
    conditions.push(eq(invoiceAnalyses.userId, userId))
  }

  const rows = await db
    .select()
    .from(invoiceAnalyses)
    .where(and(...conditions))
    .orderBy(desc(invoiceAnalyses.referenceMonth), desc(invoiceAnalyses.updatedAt))

  const usersMap = await getPublicUsersMap(rows.map((r) => r.userId))

  return rows.map((row) => {
    let parsedItems = []
    try {
      parsedItems = JSON.parse(row.itemsJson)
    } catch {
      parsedItems = []
    }
    return {
      id: row.id,
      cardName: row.cardName,
      referenceMonth: row.referenceMonth,
      totalAmount: Number(row.totalAmount),
      itemsCount: Number(row.itemsCount),
      items: parsedItems,
      isShared: Boolean(row.isShared),
      owner: usersMap.get(row.userId) ?? null,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }
  })
})
