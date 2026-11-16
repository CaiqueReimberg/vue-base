import { randomUUID } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { readBody } from 'h3'
import { db } from '../../database'
import { budgets } from '../../database/schema'
import { badRequest, requireAuthUser } from '../../utils/auth'
import { hydrateBudgets, resolveBudgetScopeAndFamily } from '../../utils/budgets'

export default defineEventHandler(async (event) => {
  const { userId } = requireAuthUser(event)
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

  if (!body?.name?.trim() || !body.scope || body.limitAmount === undefined) {
    badRequest('Informe nome, escopo e valor limite do orçamento')
  }

  const { categoryId, personId, familyId } = await resolveBudgetScopeAndFamily(
    userId,
    body.scope,
    body.categoryId,
    body.personId,
    body.familyId
  )

  const now = new Date().toISOString()
  const id = randomUUID()
  const row: typeof budgets.$inferInsert = {
    id,
    name: body.name.trim(),
    scope: body.scope,
    audience: body.audience ?? 'individual',
    period: body.period ?? 'monthly',
    limitAmount: Number(body.limitAmount),
    isActive: body.isActive ?? true,
    startDate: body.startDate ? new Date(body.startDate).toISOString().slice(0, 10) : null,
    endDate: body.endDate ? new Date(body.endDate).toISOString().slice(0, 10) : null,
    referenceMonth: body.referenceMonth ?? null,
    ownerId: userId,
    categoryId,
    personId,
    familyId,
    createdAt: now,
    updatedAt: now,
  }

  await db.insert(budgets).values(row)
  const [saved] = await db.select().from(budgets).where(eq(budgets.id, id)).limit(1)
  const [hydrated] = await hydrateBudgets([saved])
  return hydrated
})
