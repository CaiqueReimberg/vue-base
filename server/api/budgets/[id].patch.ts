import { and, eq } from 'drizzle-orm'
import { getRouterParam, readBody } from 'h3'
import { db } from '../../database'
import { budgets } from '../../database/schema'
import { notFound, requireAuthUser } from '../../utils/auth'
import { hydrateBudgets, resolveBudgetScopeAndFamily } from '../../utils/budgets'

export default defineEventHandler(async (event) => {
  const { userId } = requireAuthUser(event)
  const id = getRouterParam(event, 'id')!
  const body = await readBody<{
    name?: string
    scope?: string
    audience?: string
    period?: string
    limitAmount?: number
    isActive?: boolean
    startDate?: string | null
    endDate?: string | null
    referenceMonth?: string | null
    categoryId?: string | null
    personId?: string | null
    familyId?: string | null
  }>(event)

  const [budget] = await db
    .select()
    .from(budgets)
    .where(and(eq(budgets.id, id), eq(budgets.ownerId, userId)))
    .limit(1)

  if (!budget) {
    notFound('Orçamento não encontrado')
  }

  const nextScope = body.scope ?? budget.scope
  const nextCategoryId = body.categoryId !== undefined ? body.categoryId : budget.categoryId
  const nextPersonId = body.personId !== undefined ? body.personId : budget.personId
  const nextFamilyId = body.familyId !== undefined ? body.familyId : budget.familyId

  const { categoryId, personId, familyId } = await resolveBudgetScopeAndFamily(
    userId,
    nextScope,
    nextCategoryId,
    nextPersonId,
    nextFamilyId
  )

  const updates: Partial<typeof budgets.$inferInsert> = {
    scope: nextScope,
    categoryId,
    personId,
    familyId,
    updatedAt: new Date().toISOString(),
  }

  if (body.name !== undefined) updates.name = body.name.trim()
  if (body.audience !== undefined) updates.audience = body.audience
  if (body.period !== undefined) updates.period = body.period
  if (body.limitAmount !== undefined) updates.limitAmount = Number(body.limitAmount)
  if (body.isActive !== undefined) updates.isActive = body.isActive
  if (body.startDate !== undefined) {
    updates.startDate = body.startDate ? new Date(body.startDate).toISOString().slice(0, 10) : null
  }
  if (body.endDate !== undefined) {
    updates.endDate = body.endDate ? new Date(body.endDate).toISOString().slice(0, 10) : null
  }
  if (body.referenceMonth !== undefined) updates.referenceMonth = body.referenceMonth ?? null

  await db.update(budgets).set(updates).where(eq(budgets.id, id))
  const [saved] = await db.select().from(budgets).where(eq(budgets.id, id)).limit(1)
  const [hydrated] = await hydrateBudgets([saved])
  return hydrated
})
