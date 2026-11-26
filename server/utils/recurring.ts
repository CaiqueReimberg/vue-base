import { randomUUID } from 'node:crypto'
import { and, asc, desc, eq, inArray, or } from 'drizzle-orm'
import { db } from '../database'
import {
  accounts,
  cards,
  categories,
  recurringMonthOverrides,
  recurringPayments,
  recurrings,
} from '../database/schema'
import { badRequest, notFound } from './auth'
import { formatReferenceMonth, parseReferenceMonth, resolveReferenceMonth, roundMoney } from './billing'
import { getHouseholdVisibility, getPublicUsersMap } from './household'

function shiftMonthYm(ym: string, delta: number): string {
  const { year, monthIndex } = parseReferenceMonth(ym)
  return formatReferenceMonth(new Date(Date.UTC(year, monthIndex + delta, 1)))
}

function lastDayOfMonthIso(ym: string): string {
  const { year, monthIndex } = parseReferenceMonth(ym)
  return new Date(Date.UTC(year, monthIndex + 1, 0)).toISOString().slice(0, 10)
}

export async function hydrateRecurrings(
  rows: Array<typeof recurrings.$inferSelect>,
  includeOwner = true
) {
  if (rows.length === 0) return []

  const accountIds = Array.from(new Set(rows.map((r) => r.accountId).filter(Boolean) as string[]))
  const cardIds = Array.from(new Set(rows.map((r) => r.cardId).filter(Boolean) as string[]))
  const categoryIds = Array.from(new Set(rows.map((r) => r.categoryId).filter(Boolean) as string[]))

  const [accRows, cardRows, catRows, usersMap] = await Promise.all([
    accountIds.length > 0
      ? db.select().from(accounts).where(inArray(accounts.id, accountIds))
      : Promise.resolve([]),
    cardIds.length > 0
      ? db.select().from(cards).where(inArray(cards.id, cardIds))
      : Promise.resolve([]),
    categoryIds.length > 0
      ? db.select().from(categories).where(inArray(categories.id, categoryIds))
      : Promise.resolve([]),
    includeOwner
      ? getPublicUsersMap(rows.map((r) => r.userId))
      : Promise.resolve(new Map()),
  ])

  const accMap = new Map(accRows.map((a) => [a.id, a]))
  const cardMap = new Map(cardRows.map((c) => [c.id, c]))
  const catMap = new Map(catRows.map((c) => [c.id, c]))

  return rows.map((r) => ({
    ...r,
    amount: Number(r.amount),
    account: r.accountId ? accMap.get(r.accountId) ?? null : null,
    card: r.cardId ? cardMap.get(r.cardId) ?? null : null,
    category: r.categoryId ? catMap.get(r.categoryId) ?? null : null,
    ...(includeOwner ? { owner: usersMap.get(r.userId) ?? null } : {}),
  }))
}

export function recurringAppliesToMonth(
  recurring: typeof recurrings.$inferSelect,
  referenceMonth: string
): boolean {
  if (recurring.frequency === 'monthly') {
    return true
  }
  const start = new Date(recurring.startDate)
  return formatReferenceMonth(start) === referenceMonth
}

export async function findVisibleActiveRecurringsForMonth(
  userId: string,
  referenceMonth: string
) {
  const visibility = await getHouseholdVisibility(userId)
  const { year, monthIndex } = parseReferenceMonth(referenceMonth)
  const monthStartIso = new Date(Date.UTC(year, monthIndex, 1)).toISOString().slice(0, 10)
  const monthEndIso = new Date(Date.UTC(year, monthIndex + 1, 0, 23, 59, 59, 999))
    .toISOString()
    .slice(0, 10)

  const conditions = [
    eq(recurrings.isActive, true),
    inArray(recurrings.userId, visibility.memberIds),
  ]

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

  const rows = await db
    .select()
    .from(recurrings)
    .where(and(...conditions))
    .orderBy(asc(recurrings.dueDay), asc(recurrings.name))

  if (rows.length === 0) return []

  // Garante que qualquer recorrência já paga no mês de referência nunca desapareça do histórico daquele mês
  const monthPaidRows = await db
    .select({ recurringId: recurringPayments.recurringId })
    .from(recurringPayments)
    .where(
      and(
        inArray(
          recurringPayments.recurringId,
          rows.map((r) => r.id),
        ),
        eq(recurringPayments.referenceMonth, referenceMonth),
      ),
    )
  const paidIdsInMonth = new Set(monthPaidRows.map((p) => p.recurringId))

  return rows.filter((r) => {
    if (paidIdsInMonth.has(r.id)) return true
    const startYmd = new Date(r.startDate).toISOString().slice(0, 10)
    if (startYmd > monthEndIso) return false
    if (r.endDate) {
      const endYmd = new Date(r.endDate).toISOString().slice(0, 10)
      if (endYmd < monthStartIso) return false
    }
    return recurringAppliesToMonth(r, referenceMonth)
  })
}

export async function getMonthlyRecurringStatus(userId: string, month?: string) {
  const referenceMonth = resolveReferenceMonth(month)
  const { year, monthIndex } = parseReferenceMonth(referenceMonth)
  const monthStartIso = new Date(Date.UTC(year, monthIndex, 1)).toISOString().slice(0, 10)

  const [rows, ownAllRows] = await Promise.all([
    findVisibleActiveRecurringsForMonth(userId, referenceMonth),
    db
      .select()
      .from(recurrings)
      .where(
        and(
          eq(recurrings.userId, userId),
          eq(recurrings.isActive, true),
          eq(recurrings.transactionType, 'expense'),
        ),
      )
      .orderBy(desc(recurrings.updatedAt)),
  ])

  const hydrated = await hydrateRecurrings(rows, true)

  const recurringIds = rows.map((r) => r.id)
  const [payments, overrides] =
    recurringIds.length === 0
      ? [[], []]
      : await Promise.all([
          db
            .select()
            .from(recurringPayments)
            .where(
              and(
                inArray(recurringPayments.recurringId, recurringIds),
                eq(recurringPayments.referenceMonth, referenceMonth)
              )
            ),
          db
            .select()
            .from(recurringMonthOverrides)
            .where(
              and(
                inArray(recurringMonthOverrides.recurringId, recurringIds),
                eq(recurringMonthOverrides.referenceMonth, referenceMonth)
              )
            ),
        ])

  const paidUsersMap = await getPublicUsersMap(payments.map((p) => p.userId))
  const paymentByRecurring = new Map(payments.map((p) => [p.recurringId, p]))
  const overrideByRecurring = new Map(overrides.map((o) => [o.recurringId, Number(o.amount)]))

  const data = hydrated.map((r) => {
    const payment = paymentByRecurring.get(r.id)
    const overrideAmount = overrideByRecurring.get(r.id)
    return {
      ...r,
      baseAmount: Number(r.amount),
      amount: overrideAmount !== undefined ? overrideAmount : Number(r.amount),
      isMonthOverride: overrideAmount !== undefined,
      paid: Boolean(payment),
      paidAt: payment ? new Date(payment.paidAt).toISOString() : null,
      paidBy: payment ? paidUsersMap.get(payment.userId) ?? null : null,
    }
  })

  // Identifica contas fixas pausadas antes deste mês (e que ainda não foram retomadas em novo ciclo ativo)
  const activeNamesInOrAfterMonth = new Set(
    ownAllRows
      .filter((r) => {
        if (!r.endDate) return true
        const endYmd = new Date(r.endDate).toISOString().slice(0, 10)
        return endYmd >= monthStartIso
      })
      .map((r) => r.name.trim().toLowerCase()),
  )

  const seenPausedNames = new Set<string>()
  const pausedRaw = ownAllRows.filter((r) => {
    if (!r.endDate) return false
    const endYmd = new Date(r.endDate).toISOString().slice(0, 10)
    if (endYmd >= monthStartIso) return false
    const normName = r.name.trim().toLowerCase()
    if (activeNamesInOrAfterMonth.has(normName) || seenPausedNames.has(normName)) {
      return false
    }
    seenPausedNames.add(normName)
    return true
  })

  const hydratedPaused = await hydrateRecurrings(pausedRaw, true)
  const pausedData = hydratedPaused.map((r) => {
    const startYmd = new Date(r.startDate).toISOString().slice(0, 10)
    const endYmd = r.endDate ? new Date(r.endDate).toISOString().slice(0, 10) : null
    const pausedAfterMonth = endYmd && endYmd >= startYmd ? endYmd.slice(0, 7) : null
    return {
      ...r,
      baseAmount: Number(r.amount),
      amount: Number(r.amount),
      pausedAfterMonth,
    }
  })

  return { month: referenceMonth, data, pausedData }
}

export async function pauseRecurringFromMonth(
  userId: string,
  recurringId: string,
  fromMonth?: string,
) {
  const targetMonth = resolveReferenceMonth(fromMonth)
  const [rec] = await db
    .select()
    .from(recurrings)
    .where(and(eq(recurrings.id, recurringId), eq(recurrings.userId, userId)))
    .limit(1)

  if (!rec) {
    notFound('Conta fixa não encontrada')
  }

  // Verifica se já está paga no mês alvo: se estiver paga, encerra após o mês alvo; se não, encerra no mês anterior
  const [paidInTarget] = await db
    .select({ id: recurringPayments.id })
    .from(recurringPayments)
    .where(
      and(
        eq(recurringPayments.recurringId, recurringId),
        eq(recurringPayments.referenceMonth, targetMonth),
      ),
    )
    .limit(1)

  const lastActiveMonth = paidInTarget ? targetMonth : shiftMonthYm(targetMonth, -1)
  const nextEndDate = lastDayOfMonthIso(lastActiveMonth)
  const now = new Date().toISOString()

  await db
    .update(recurrings)
    .set({
      endDate: nextEndDate,
      isActive: true,
      updatedAt: now,
    })
    .where(eq(recurrings.id, recurringId))

  return {
    id: recurringId,
    endDate: nextEndDate,
    pausedFromMonth: paidInTarget ? shiftMonthYm(targetMonth, 1) : targetMonth,
    keptCurrentMonthPaid: Boolean(paidInTarget),
  }
}

export async function resumeRecurringFromMonth(
  userId: string,
  recurringId: string,
  fromMonth?: string,
) {
  const targetMonth = resolveReferenceMonth(fromMonth)
  const [rec] = await db
    .select()
    .from(recurrings)
    .where(and(eq(recurrings.id, recurringId), eq(recurrings.userId, userId)))
    .limit(1)

  if (!rec) {
    notFound('Conta fixa não encontrada')
  }

  const now = new Date().toISOString()
  const targetStartIso = `${targetMonth}-01`

  if (!rec.endDate) {
    const [hydrated] = await hydrateRecurrings([rec], true)
    return hydrated
  }

  const startYmd = new Date(rec.startDate).toISOString().slice(0, 10)
  const endYmd = new Date(rec.endDate).toISOString().slice(0, 10)

  // Se foi pausada no próprio mês em que nasceu (sem histórico anterior), verifica se não teve pagamentos
  if (endYmd < startYmd) {
    const [anyPayment] = await db
      .select({ id: recurringPayments.id })
      .from(recurringPayments)
      .where(eq(recurringPayments.recurringId, rec.id))
      .limit(1)

    if (!anyPayment) {
      await db
        .update(recurrings)
        .set({
          startDate: targetStartIso,
          endDate: null,
          isActive: true,
          updatedAt: now,
        })
        .where(eq(recurrings.id, rec.id))
      const [updated] = await db.select().from(recurrings).where(eq(recurrings.id, rec.id)).limit(1)
      const [hydrated] = await hydrateRecurrings([updated], true)
      return hydrated
    }
  }

  const endYm = endYmd.slice(0, 7)
  const immediateNextYm = shiftMonthYm(endYm, 1)

  // Sem meses de intervalo entre a pausa e a retomada: basta reabrir a mesma recorrência
  if (targetMonth <= immediateNextYm) {
    await db
      .update(recurrings)
      .set({
        endDate: null,
        isActive: true,
        updatedAt: now,
      })
      .where(eq(recurrings.id, rec.id))
    const [updated] = await db.select().from(recurrings).where(eq(recurrings.id, rec.id)).limit(1)
    const [hydrated] = await hydrateRecurrings([updated], true)
    return hydrated
  }

  // Houve meses pausados no meio: preserva o ciclo encerrado intacto no histórico e inicia novo ciclo a partir de targetMonth
  const newId = randomUUID()
  await db.insert(recurrings).values({
    id: newId,
    name: rec.name,
    kind: rec.kind,
    transactionType: rec.transactionType,
    frequency: rec.frequency,
    amount: Number(rec.amount),
    description: rec.description,
    dueDay: rec.dueDay,
    startDate: targetStartIso,
    endDate: null,
    isActive: true,
    isShared: rec.isShared,
    userId: rec.userId,
    accountId: rec.accountId,
    cardId: rec.cardId,
    categoryId: rec.categoryId,
    familyId: rec.familyId,
    createdAt: now,
    updatedAt: now,
  })

  const [created] = await db.select().from(recurrings).where(eq(recurrings.id, newId)).limit(1)
  const [hydrated] = await hydrateRecurrings([created], true)
  return hydrated
}

export async function findOneVisibleRecurring(userId: string, recurringId: string) {
  const visibility = await getHouseholdVisibility(userId)
  const [rec] = await db
    .select()
    .from(recurrings)
    .where(and(eq(recurrings.id, recurringId), inArray(recurrings.userId, visibility.memberIds)))
    .limit(1)

  if (!rec || (rec.userId !== userId && !rec.isShared)) {
    notFound('Recorrência não encontrada')
  }
  const [hydrated] = await hydrateRecurrings([rec], true)
  return hydrated
}

export async function setRecurringMonthAmount(
  userId: string,
  recurringId: string,
  referenceMonth: string,
  amount: number
) {
  if (!referenceMonth || !/^\d{4}-\d{2}$/.test(referenceMonth)) {
    badRequest('Informe referenceMonth no formato YYYY-MM')
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    badRequest('Informe um valor maior que zero')
  }

  await findOneVisibleRecurring(userId, recurringId)
  const rounded = roundMoney(amount)
  const now = new Date().toISOString()

  const [existing] = await db
    .select()
    .from(recurringMonthOverrides)
    .where(
      and(
        eq(recurringMonthOverrides.recurringId, recurringId),
        eq(recurringMonthOverrides.referenceMonth, referenceMonth)
      )
    )
    .limit(1)

  if (existing) {
    await db
      .update(recurringMonthOverrides)
      .set({ amount: rounded, updatedAt: now })
      .where(eq(recurringMonthOverrides.id, existing.id))
  } else {
    await db.insert(recurringMonthOverrides).values({
      id: randomUUID(),
      recurringId,
      referenceMonth,
      amount: rounded,
      updatedAt: now,
    })
  }

  return {
    recurringId,
    referenceMonth,
    amount: rounded,
  }
}
