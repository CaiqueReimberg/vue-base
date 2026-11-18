import { and, eq, inArray } from 'drizzle-orm'
import { getRouterParam } from 'h3'
import { db } from '../../database'
import { invoiceAnalyses } from '../../database/schema'
import { notFound, requireAuthUser } from '../../utils/auth'
import { assertInvoiceAnalysisEnabled, getHouseholdVisibility } from '../../utils/household'

export default defineEventHandler(async (event) => {
  const { userId } = requireAuthUser(event)
  await assertInvoiceAnalysisEnabled(userId)
  const id = getRouterParam(event, 'id')!
  const visibility = await getHouseholdVisibility(userId)

  const [existing] = await db
    .select()
    .from(invoiceAnalyses)
    .where(and(eq(invoiceAnalyses.id, id), inArray(invoiceAnalyses.userId, visibility.memberIds)))
    .limit(1)

  if (!existing) {
    notFound('Fatura não encontrada')
  }

  await db.delete(invoiceAnalyses).where(eq(invoiceAnalyses.id, id))
  return { deleted: true }
})
