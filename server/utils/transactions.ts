import { randomUUID } from 'node:crypto'
import { and, eq, inArray } from 'drizzle-orm'
import { db } from '../database'
import { accounts, cards, categories, debtPayments, transactions } from '../database/schema'
import { badRequest } from './auth'
import { assertUserBelongsToFamily, getPublicUsersMap } from './household'
import {
  findOneLinkableAccount,
  findOneLinkableCard,
  findOneVisibleCategory,
} from './resources'

export function getDebtStartMonth(row: {
  referenceMonth?: string | null
  occurredAt: string
}): string {
  if (row.referenceMonth && /^\d{4}-\d{2}$/.test(row.referenceMonth)) {
    return row.referenceMonth
  }
  return String(row.occurredAt).slice(0, 7)
}

export function getMonthsDiff(startYm: string, targetYm: string): number {
  const [sy, sm] = startYm.split('-').map(Number)
  const [ty, tm] = targetYm.split('-').map(Number)
  if (!sy || !sm || !ty || !tm) return 0
  return (ty - sy) * 12 + (tm - sm)
}

export function isDebtActiveInMonth(
  row: {
    kind?: string | null
    referenceMonth?: string | null
    occurredAt: string
    installmentTotal?: number | null
  },
  targetYm: string,
): boolean {
  if (row.kind !== 'debt') return row.referenceMonth === targetYm
  const startYm = getDebtStartMonth(row)
  const diff = getMonthsDiff(startYm, targetYm)
  const total = Math.max(Number(row.installmentTotal || 1), 1)
  return diff >= 0 && diff < total
}

export async function hydrateTransactions(
  rows: Array<typeof transactions.$inferSelect>,
  includeOwner = true,
  targetMonth?: string,
) {
  if (rows.length === 0) return []

  const accountIds = Array.from(new Set(rows.map((r) => r.accountId).filter(Boolean) as string[]))
  const cardIds = Array.from(new Set(rows.map((r) => r.cardId).filter(Boolean) as string[]))
  const categoryIds = Array.from(new Set(rows.map((r) => r.categoryId).filter(Boolean) as string[]))
  const debtIds = rows.filter((r) => r.kind === 'debt').map((r) => r.id)

  const [accRows, cardRows, catRows, debtPaymentRows] = await Promise.all([
    accountIds.length > 0
      ? db.select().from(accounts).where(inArray(accounts.id, accountIds))
      : Promise.resolve([]),
    cardIds.length > 0
      ? db.select().from(cards).where(inArray(cards.id, cardIds))
      : Promise.resolve([]),
    categoryIds.length > 0
      ? db.select().from(categories).where(inArray(categories.id, categoryIds))
      : Promise.resolve([]),
    debtIds.length > 0
      ? db.select().from(debtPayments).where(inArray(debtPayments.transactionId, debtIds))
      : Promise.resolve([]),
  ])

  const allReferencedUserIds = [
    ...rows.map((r) => r.userId),
    ...rows.map((r) => r.paidByUserId).filter(Boolean) as string[],
    ...debtPaymentRows.map((p) => p.userId),
  ]
  const usersMap = includeOwner
    ? await getPublicUsersMap(allReferencedUserIds)
    : new Map()

  const accMap = new Map(accRows.map((a) => [a.id, a]))
  const cardMap = new Map(cardRows.map((c) => [c.id, c]))
  const catMap = new Map(catRows.map((c) => [c.id, c]))

  const paymentsByDebt = new Map<string, Array<typeof debtPayments.$inferSelect>>()
  for (const p of debtPaymentRows) {
    const list = paymentsByDebt.get(p.transactionId) ?? []
    list.push(p)
    paymentsByDebt.set(p.transactionId, list)
  }

  return rows.map((r) => {
    const debtPaidList = paymentsByDebt.get(r.id) ?? []
    const paidMonths = debtPaidList.map((p) => p.referenceMonth)
    const paidByByMonth: Record<string, { id: string; email: string; name: string | null }> = {}
    for (const p of debtPaidList) {
      const payer = usersMap.get(p.userId)
      if (payer) {
        paidByByMonth[p.referenceMonth] = payer
      }
    }

    let status = r.status
    let paidAt = r.paidAt
    let installmentNumber = r.installmentNumber
    let paidBy =
      r.paidByUserId ? usersMap.get(r.paidByUserId) ?? null : r.paidAt ? usersMap.get(r.userId) ?? null : null

    if (r.kind === 'debt') {
      const startYm = getDebtStartMonth(r)
      const effectiveMonth =
        targetMonth && /^\d{4}-\d{2}$/.test(targetMonth) ? targetMonth : startYm
      const diff = getMonthsDiff(startYm, effectiveMonth)
      const total = Math.max(Number(r.installmentTotal || 1), 1)
      if (diff >= 0 && diff < total) {
        installmentNumber = diff + 1
      }

      if (targetMonth && /^\d{4}-\d{2}$/.test(targetMonth)) {
        const paymentInMonth = debtPaidList.find((p) => p.referenceMonth === targetMonth)
        status = paymentInMonth ? 'cleared' : 'pending'
        paidAt = paymentInMonth ? paymentInMonth.paidAt : null
        paidBy = paymentInMonth ? usersMap.get(paymentInMonth.userId) ?? null : null
      } else {
        paidBy = null
      }
    }

    return {
      ...r,
      amount: Number(r.amount),
      status,
      paidAt,
      paidBy,
      paidByByMonth,
      installmentNumber,
      paidMonths,
      account: r.accountId ? accMap.get(r.accountId) ?? null : null,
      card: r.cardId ? cardMap.get(r.cardId) ?? null : null,
      category: r.categoryId ? catMap.get(r.categoryId) ?? null : null,
      ...(includeOwner ? { owner: usersMap.get(r.userId) ?? null } : {}),
    }
  })
}

export interface CreateTxPayload {
  accountId?: string
  cardId?: string
  categoryId?: string
  familyId?: string
  amount: number
  description: string
  occurredAt: string
  dueDate?: string
  paidAt?: string
  referenceMonth?: string
  status?: string
  kind?: string
  installmentNumber?: number
  installmentTotal?: number
  isShared?: boolean
  notes?: string
}

export async function createTransactionByType(
  userId: string,
  dto: CreateTxPayload,
  type: 'expense' | 'income'
) {
  if (dto.kind === 'debt') {
    badRequest('Use POST /transactions/expense/debt para dívidas sem conta ou cartão')
  }

  if (dto.familyId) {
    await assertUserBelongsToFamily(userId, dto.familyId)
  }

  if (!dto.accountId && !dto.cardId) {
    badRequest('Informe accountId ou cardId na transação')
  }

  if (dto.accountId && dto.cardId) {
    badRequest('Informe apenas accountId ou cardId, não ambos')
  }

  if (type === 'income' && dto.cardId) {
    badRequest('Entradas não podem ser vinculadas a cartão')
  }

  if (dto.accountId) {
    await findOneLinkableAccount(userId, dto.accountId)
  }

  if (dto.cardId) {
    if (type !== 'expense') {
      badRequest('Somente gastos podem ser vinculados a cartão')
    }
    await findOneLinkableCard(userId, dto.cardId)
  }

  if (dto.categoryId) {
    const cat = await findOneVisibleCategory(userId, dto.categoryId)
    if (cat.type !== type) {
      badRequest('Tipo da categoria incompatível com a transação')
    }
  }

  const now = new Date().toISOString()
  const id = randomUUID()
  const row: typeof transactions.$inferInsert = {
    id,
    type,
    amount: Number(dto.amount),
    description: dto.description.trim(),
    occurredAt: new Date(dto.occurredAt).toISOString(),
    dueDate: dto.dueDate ? new Date(dto.dueDate).toISOString().slice(0, 10) : null,
    paidAt: dto.paidAt ? new Date(dto.paidAt).toISOString() : null,
    referenceMonth: dto.referenceMonth ?? null,
    status: dto.status ?? 'pending',
    kind: dto.kind ?? null,
    debtCategory: null,
    installmentNumber: dto.installmentNumber ?? null,
    installmentTotal: dto.installmentTotal ?? null,
    isShared: dto.isShared ?? false,
    notes: dto.notes ?? null,
    userId,
    accountId: dto.accountId ?? null,
    cardId: dto.cardId ?? null,
    categoryId: dto.categoryId ?? null,
    familyId: dto.familyId ?? null,
    createdAt: now,
    updatedAt: now,
  }

  await db.insert(transactions).values(row)
  const [saved] = await db.select().from(transactions).where(eq(transactions.id, id)).limit(1)
  const [hydrated] = await hydrateTransactions([saved], true)
  return hydrated
}
