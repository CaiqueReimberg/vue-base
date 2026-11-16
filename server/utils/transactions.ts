import { randomUUID } from 'node:crypto'
import { eq, inArray } from 'drizzle-orm'
import { db } from '../database'
import { accounts, cards, categories, transactions } from '../database/schema'
import { badRequest } from './auth'
import { assertUserBelongsToFamily, getPublicUsersMap } from './household'
import {
  findOneLinkableAccount,
  findOneLinkableCard,
  findOneVisibleCategory,
} from './resources'

export async function hydrateTransactions(
  rows: Array<typeof transactions.$inferSelect>,
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
