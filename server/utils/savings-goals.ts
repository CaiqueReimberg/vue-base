import { and, desc, eq, inArray, or } from 'drizzle-orm'
import { db } from '../database'
import { accounts, savingsContributions, savingsGoals } from '../database/schema'
import { notFound } from './auth'
import { roundMoney } from './billing'
import { getHouseholdVisibility } from './household'
import { findVisibleAccountsByUser, netFlowsByAccountIds } from './resources'

type GoalRow = typeof savingsGoals.$inferSelect

export interface LinkedAccountRef {
  id: string
  name: string
  bankName: string | null
  balance: number
}

export interface SavingsGoalDto {
  id: string
  name: string
  targetAmount: number
  targetDate: string | null
  isShared: boolean
  archived: boolean
  ownerId: string
  accountId: string | null
  linkedAccount: LinkedAccountRef | null
  saved: number
  remaining: number
  percent: number
  completed: boolean
  monthsLeft: number | null
  monthlyNeeded: number | null
  contributions: Array<{
    id: string
    amount: number
    contributedAt: string
    note: string | null
    userId: string
  }>
}

async function visibleGoalRows(userId: string): Promise<GoalRow[]> {
  const visibility = await getHouseholdVisibility(userId)
  const cond =
    visibility.partnerIds.length > 0
      ? or(
          eq(savingsGoals.userId, userId),
          and(inArray(savingsGoals.userId, visibility.partnerIds), eq(savingsGoals.isShared, true)),
        )!
      : eq(savingsGoals.userId, userId)
  return db.select().from(savingsGoals).where(cond).orderBy(desc(savingsGoals.createdAt))
}

function monthsUntil(targetDate: string, from = new Date()): number {
  const t = new Date(targetDate)
  return (t.getFullYear() - from.getFullYear()) * 12 + (t.getMonth() - from.getMonth())
}

export async function applyGoalAccountDelta(
  userId: string,
  accountId: string,
  delta: number,
): Promise<void> {
  if (!accountId || !Number.isFinite(delta) || delta === 0) return

  const visibility = await getHouseholdVisibility(userId)
  const [account] = await db
    .select()
    .from(accounts)
    .where(and(eq(accounts.id, accountId), inArray(accounts.userId, visibility.memberIds)))
    .limit(1)

  if (!account || (account.userId !== userId && !account.shareWithPartner)) {
    return
  }

  const netMap = await netFlowsByAccountIds([accountId])
  const net = netMap.get(accountId) ?? 0
  const currentEffectiveBalance = Number(account.initialBalance) + net
  const nextBalance = Math.max(0, roundMoney(currentEffectiveBalance + delta))

  await db
    .update(accounts)
    .set({
      initialBalance: roundMoney(nextBalance - net),
      balance: nextBalance,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(accounts.id, accountId))
}

export async function listSavingsGoals(userId: string): Promise<SavingsGoalDto[]> {
  const goals = await visibleGoalRows(userId)
  if (goals.length === 0) return []

  const [contribs, visibleAccounts] = await Promise.all([
    db
      .select()
      .from(savingsContributions)
      .where(
        inArray(
          savingsContributions.goalId,
          goals.map((g) => g.id),
        ),
      )
      .orderBy(desc(savingsContributions.contributedAt)),
    findVisibleAccountsByUser(userId),
  ])

  const accountById = new Map(visibleAccounts.map((a) => [a.id, a]))

  return goals.map((g) => {
    const items = contribs.filter((c) => c.goalId === g.id)
    const linkedAcc = g.accountId ? accountById.get(g.accountId) ?? null : null

    const contribsSum = roundMoney(items.reduce((s, c) => s + Number(c.amount), 0))
    // Quando a meta está conectada a um CDB/Conta, o saldo guardado reflete automaticamente o saldo real da conta!
    const saved = linkedAcc ? roundMoney(Math.max(0, Number(linkedAcc.balance))) : Math.max(0, contribsSum)

    const target = Number(g.targetAmount)
    const remaining = roundMoney(Math.max(target - saved, 0))
    const percent = target > 0 ? Math.min(Math.round((saved / target) * 1000) / 10, 100) : 0
    const completed = target > 0 && saved >= target

    let monthsLeft: number | null = null
    let monthlyNeeded: number | null = null
    if (g.targetDate && !completed) {
      monthsLeft = Math.max(monthsUntil(g.targetDate), 0)
      monthlyNeeded = roundMoney(remaining / Math.max(monthsLeft, 1))
    }

    return {
      id: g.id,
      name: g.name,
      targetAmount: roundMoney(target),
      targetDate: g.targetDate ?? null,
      isShared: Boolean(g.isShared),
      archived: Boolean(g.archivedAt),
      ownerId: g.userId,
      accountId: linkedAcc ? linkedAcc.id : null,
      linkedAccount: linkedAcc
        ? {
            id: linkedAcc.id,
            name: linkedAcc.name,
            bankName: linkedAcc.bankName ?? null,
            balance: roundMoney(Number(linkedAcc.balance)),
          }
        : null,
      saved,
      remaining,
      percent,
      completed,
      monthsLeft,
      monthlyNeeded,
      contributions: items.map((c) => ({
        id: c.id,
        amount: roundMoney(Number(c.amount)),
        contributedAt: c.contributedAt,
        note: c.note ?? null,
        userId: c.userId,
      })),
    }
  })
}

/** Meta visível ao usuário (própria ou compartilhada pelo par). */
export async function getVisibleGoalOrThrow(userId: string, goalId: string): Promise<GoalRow> {
  const goals = await visibleGoalRows(userId)
  const goal = goals.find((g) => g.id === goalId)
  if (!goal) notFound('Meta não encontrada')
  return goal
}

/** Meta que o usuário é dono (editar/excluir). */
export async function getOwnedGoalOrThrow(userId: string, goalId: string): Promise<GoalRow> {
  const [goal] = await db
    .select()
    .from(savingsGoals)
    .where(and(eq(savingsGoals.id, goalId), eq(savingsGoals.userId, userId)))
    .limit(1)
  if (!goal) notFound('Meta não encontrada')
  return goal
}
