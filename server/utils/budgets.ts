import { and, eq, inArray } from 'drizzle-orm'
import { db } from '../database'
import { budgets, categories, families, transactions, users } from '../database/schema'
import { badRequest, notFound, toPublicUser } from './auth'
import {
  assertPersonInSameHousehold,
  assertUserBelongsToFamily,
  getHouseholdVisibility,
  getUserOrThrow,
} from './household'
import { findOneVisibleCategory } from './resources'

export async function hydrateBudgets(rows: Array<typeof budgets.$inferSelect>) {
  if (rows.length === 0) return []

  const userIds = Array.from(
    new Set(
      rows
        .flatMap((b) => [b.ownerId, b.personId])
        .filter(Boolean) as string[]
    )
  )
  const catIds = Array.from(new Set(rows.map((b) => b.categoryId).filter(Boolean) as string[]))
  const famIds = Array.from(new Set(rows.map((b) => b.familyId).filter(Boolean) as string[]))

  const [userRows, catRows, famRows] = await Promise.all([
    userIds.length > 0
      ? db
          .select({ id: users.id, email: users.email, name: users.name })
          .from(users)
          .where(inArray(users.id, userIds))
      : Promise.resolve([]),
    catIds.length > 0
      ? db
          .select({ id: categories.id, name: categories.name })
          .from(categories)
          .where(inArray(categories.id, catIds))
      : Promise.resolve([]),
    famIds.length > 0
      ? db
          .select({ id: families.id, name: families.name })
          .from(families)
          .where(inArray(families.id, famIds))
      : Promise.resolve([]),
  ])

  const userMap = new Map(userRows.map((u) => [u.id, u]))
  const catMap = new Map(catRows.map((c) => [c.id, c]))
  const famMap = new Map(famRows.map((f) => [f.id, f]))

  return rows.map((b) => {
    const owner = b.ownerId ? userMap.get(b.ownerId) : null
    const person = b.personId ? userMap.get(b.personId) : null
    const category = b.categoryId ? catMap.get(b.categoryId) : null
    const family = b.familyId ? famMap.get(b.familyId) : null

    return {
      id: b.id,
      name: b.name,
      scope: b.scope,
      audience: b.audience ?? 'individual',
      period: b.period,
      limitAmount: Number(b.limitAmount),
      isActive: b.isActive,
      startDate: b.startDate ? b.startDate.slice(0, 10) : null,
      endDate: b.endDate ? b.endDate.slice(0, 10) : null,
      referenceMonth: b.referenceMonth ?? null,
      createdAt: b.createdAt,
      updatedAt: b.updatedAt,
      owner: toPublicUser(owner),
      category: category ? { id: category.id, name: category.name } : null,
      person: person
        ? { id: person.id, name: person.name ?? null, email: person.email }
        : null,
      family: family ? { id: family.id, name: family.name } : null,
    }
  })
}

export async function resolveBudgetScopeAndFamily(
  userId: string,
  scope: string,
  categoryId?: string | null,
  personId?: string | null,
  familyId?: string | null
) {
  let resolvedCategoryId: string | null = null
  let resolvedPersonId: string | null = null

  if (scope === 'total') {
    if (categoryId || personId) {
      badRequest('Orçamento total não aceita categoryId ou personId')
    }
  } else if (scope === 'category') {
    if (!categoryId) {
      badRequest('Orçamento por categoria exige categoryId')
    }
    if (personId) {
      badRequest('Orçamento por categoria não aceita personId')
    }
    const cat = await findOneVisibleCategory(userId, categoryId)
    resolvedCategoryId = cat.id
  } else if (scope === 'person') {
    if (!personId) {
      badRequest('Orçamento por pessoa exige personId')
    }
    if (categoryId) {
      badRequest('Orçamento por pessoa não aceita categoryId')
    }
    await assertPersonInSameHousehold(userId, personId)
    const p = await getUserOrThrow(personId)
    resolvedPersonId = p.id
  } else {
    badRequest('Escopo de orçamento inválido')
  }

  let resolvedFamilyId: string | null = null
  if (familyId) {
    await assertUserBelongsToFamily(userId, familyId)
    if (resolvedPersonId) {
      const p = await getUserOrThrow(resolvedPersonId)
      if (p.familyId !== familyId) {
        badRequest('A pessoa selecionada precisa pertencer à família vinculada')
      }
    }
    resolvedFamilyId = familyId
  }

  return {
    categoryId: resolvedCategoryId,
    personId: resolvedPersonId,
    familyId: resolvedFamilyId,
  }
}

export async function findOneVisibleBudget(userId: string, budgetId: string) {
  const [budget] = await db.select().from(budgets).where(eq(budgets.id, budgetId)).limit(1)
  if (!budget) {
    notFound('Orçamento não encontrado')
  }

  const visibility = await getHouseholdVisibility(userId)
  const audience = budget.audience ?? 'individual'

  if (audience === 'individual' && budget.ownerId !== userId) {
    notFound('Orçamento não encontrado')
  }
  if (audience === 'shared' && !visibility.memberIds.includes(budget.ownerId)) {
    notFound('Orçamento não encontrado')
  }

  const [hydrated] = await hydrateBudgets([budget])
  return { raw: budget, hydrated }
}

function getPeriodRange(period: string, referenceDate: Date) {
  if (period === 'yearly') {
    const year = referenceDate.getFullYear()
    return {
      periodStart: new Date(year, 0, 1, 0, 0, 0, 0),
      periodEnd: new Date(year, 11, 31, 23, 59, 59, 999),
    }
  }
  const year = referenceDate.getFullYear()
  const month = referenceDate.getMonth()
  return {
    periodStart: new Date(year, month, 1, 0, 0, 0, 0),
    periodEnd: new Date(year, month + 1, 0, 23, 59, 59, 999),
  }
}

export async function getBudgetStatusByUser(
  userId: string,
  budgetId: string,
  query: { month?: number; year?: number }
) {
  const { raw: budget } = await findOneVisibleBudget(userId, budgetId)
  const visibility = await getHouseholdVisibility(userId)
  const audience = budget.audience ?? 'individual'

  if ((query.month && !query.year) || (!query.month && query.year)) {
    badRequest('Informe month e year juntos')
  }

  let referenceDate = new Date()
  if (budget.referenceMonth) {
    const [y, m] = budget.referenceMonth.split('-').map(Number)
    if (!y || !m || m < 1 || m > 12) {
      badRequest('referenceMonth inválido')
    }
    referenceDate = new Date(y, m - 1, 1)
  } else if (query.month && query.year) {
    referenceDate = new Date(query.year, query.month - 1, 1)
  }

  const { periodStart, periodEnd } = getPeriodRange(budget.period ?? 'monthly', referenceDate)
  const startBound = budget.startDate ? new Date(budget.startDate) : null
  const endBound = budget.endDate ? new Date(budget.endDate) : null

  const effectiveStart = startBound && startBound > periodStart ? startBound : periodStart
  const effectiveEnd = endBound && endBound < periodEnd ? endBound : periodEnd

  let spent = 0
  let sharedIncomeTotal = 0

  if (effectiveStart <= effectiveEnd) {
    if (budget.scope === 'person' && !budget.personId) {
      badRequest('Orçamento por pessoa sem pessoa vinculada')
    }
    if (budget.scope === 'category' && !budget.categoryId) {
      badRequest('Orçamento por categoria sem categoria vinculada')
    }

    const startMs = effectiveStart.getTime()
    const endMs = effectiveEnd.getTime()

    if (audience === 'shared') {
      const targetUserIds =
        budget.scope === 'person' ? [budget.personId!] : visibility.memberIds
      const txConds = [
        eq(transactions.isShared, true),
        inArray(transactions.userId, targetUserIds),
      ]
      if (budget.scope === 'category') {
        txConds.push(eq(transactions.categoryId, budget.categoryId!))
      }

      const rows = await db
        .select()
        .from(transactions)
        .where(and(...txConds))

      for (const tx of rows) {
        const ms = new Date(tx.occurredAt).getTime()
        if (ms >= startMs && ms <= endMs) {
          if (tx.type === 'expense') {
            spent += Number(tx.amount)
          } else if (tx.type === 'income') {
            sharedIncomeTotal += Number(tx.amount)
          }
        }
      }
    } else {
      const targetUserId = budget.scope === 'person' ? budget.personId : budget.ownerId
      if (!targetUserId) {
        badRequest('Orçamento sem pessoa/dono definido')
      }

      const txConds = [
        eq(transactions.type, 'expense'),
        eq(transactions.isShared, false),
        eq(transactions.userId, targetUserId),
      ]
      if (budget.scope === 'category') {
        txConds.push(eq(transactions.categoryId, budget.categoryId!))
      }

      const rows = await db
        .select()
        .from(transactions)
        .where(and(...txConds))

      for (const tx of rows) {
        const ms = new Date(tx.occurredAt).getTime()
        if (ms >= startMs && ms <= endMs) {
          spent += Number(tx.amount)
        }
      }
    }
  }

  const limitAmount = Number(budget.limitAmount)
  const remaining =
    audience === 'shared'
      ? limitAmount - spent + sharedIncomeTotal
      : limitAmount - spent
  const progress = limitAmount > 0 ? (spent / limitAmount) * 100 : 0

  return {
    budgetId: budget.id,
    name: budget.name,
    scope: budget.scope,
    audience,
    period: budget.period,
    limitAmount,
    spent,
    sharedIncomeTotal: audience === 'shared' ? sharedIncomeTotal : 0,
    remaining,
    progress,
    isExceeded: spent > limitAmount,
    periodStart: effectiveStart.toISOString(),
    periodEnd: effectiveEnd.toISOString(),
  }
}
