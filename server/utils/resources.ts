import { and, desc, eq, inArray, isNull, or, sql } from 'drizzle-orm'
import { db } from '../database'
import { accounts, cards, categories, transactions } from '../database/schema'
import { notFound } from './auth'
import { getHouseholdVisibility, getPublicUsersMap } from './household'

export async function netFlowsByAccountIds(accountIds: string[]): Promise<Map<string, number>> {
  const map = new Map<string, number>()
  if (accountIds.length === 0) return map

  const rows = await db
    .select({
      accountId: transactions.accountId,
      net: sql<number>`COALESCE(SUM(CASE WHEN ${transactions.type} = 'income' THEN ${transactions.amount} WHEN ${transactions.type} = 'expense' THEN -${transactions.amount} ELSE 0 END), 0)`,
    })
    .from(transactions)
    .where(inArray(transactions.accountId, accountIds))
    .groupBy(transactions.accountId)

  for (const row of rows) {
    if (row.accountId) {
      map.set(row.accountId, Number(row.net ?? 0))
    }
  }
  return map
}

export async function mapAccountsWithEffectiveBalance(rows: Array<typeof accounts.$inferSelect>) {
  const ids = rows.map((a) => a.id)
  const netById = await netFlowsByAccountIds(ids)
  const usersMap = await getPublicUsersMap(rows.map((a) => a.userId))

  return rows.map((a) => {
    const net = netById.get(a.id) ?? 0
    return {
      ...a,
      balance: Number(a.initialBalance) + net,
      owner: usersMap.get(a.userId) ?? null,
    }
  })
}

export async function findVisibleAccountsByUser(
  userId: string,
  filters?: { type?: string; isActive?: boolean }
) {
  const visibility = await getHouseholdVisibility(userId)

  const conditions = [inArray(accounts.userId, visibility.memberIds)]
  if (filters?.type) {
    conditions.push(eq(accounts.type, filters.type))
  }
  if (filters?.isActive !== undefined) {
    conditions.push(eq(accounts.isActive, filters.isActive))
  }

  if (visibility.partnerIds.length > 0) {
    conditions.push(or(eq(accounts.userId, userId), eq(accounts.shareWithPartner, true))!)
  } else {
    conditions.push(eq(accounts.userId, userId))
  }

  const rows = await db
    .select()
    .from(accounts)
    .where(and(...conditions))
    .orderBy(desc(accounts.createdAt))

  return mapAccountsWithEffectiveBalance(rows)
}

export async function findOneLinkableAccount(userId: string, accountId: string) {
  const visibility = await getHouseholdVisibility(userId)
  const [account] = await db
    .select()
    .from(accounts)
    .where(and(eq(accounts.id, accountId), inArray(accounts.userId, visibility.memberIds)))
    .limit(1)

  if (!account || (account.userId !== userId && !account.shareWithPartner)) {
    notFound(`Conta com ID ${accountId} não encontrada`)
  }
  return account
}

export async function findVisibleCardsByUser(userId: string) {
  const visibility = await getHouseholdVisibility(userId)
  const conditions = [inArray(cards.userId, visibility.memberIds)]

  if (visibility.partnerIds.length > 0) {
    conditions.push(or(eq(cards.userId, userId), eq(cards.shareWithPartner, true))!)
  } else {
    conditions.push(eq(cards.userId, userId))
  }

  const rows = await db
    .select()
    .from(cards)
    .where(and(...conditions))
    .orderBy(desc(cards.createdAt))

  const usersMap = await getPublicUsersMap(rows.map((c) => c.userId))
  return rows.map((c) => ({
    ...c,
    owner: usersMap.get(c.userId) ?? null,
  }))
}

export async function findOneLinkableCard(userId: string, cardId: string) {
  const visibility = await getHouseholdVisibility(userId)
  const [card] = await db
    .select()
    .from(cards)
    .where(and(eq(cards.id, cardId), inArray(cards.userId, visibility.memberIds)))
    .limit(1)

  if (!card || (card.userId !== userId && !card.shareWithPartner)) {
    notFound(`Cartão com ID ${cardId} não encontrado`)
  }
  return card
}

export async function findOneVisibleCategory(userId: string, categoryId: string) {
  const visibility = await getHouseholdVisibility(userId)
  const [cat] = await db
    .select()
    .from(categories)
    .where(
      and(
        eq(categories.id, categoryId),
        or(isNull(categories.userId), inArray(categories.userId, visibility.memberIds))
      )
    )
    .limit(1)

  if (!cat) {
    notFound('Categoria não encontrada')
  }
  return cat
}
