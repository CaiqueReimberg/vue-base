import bcrypt from 'bcryptjs'
import { eq } from 'drizzle-orm'
import { readBody } from 'h3'
import { db } from '../../database'
import { users } from '../../database/schema'
import { conflict, requireAuthUser } from '../../utils/auth'
import { getUserOrThrow, getUserProfileResponse } from '../../utils/household'

export default defineEventHandler(async (event) => {
  const { userId } = requireAuthUser(event)
  const body = await readBody<{
    email?: string
    name?: string
    password?: string
    soloMode?: boolean
    onboardingCompleted?: boolean
  }>(event)
  const user = await getUserOrThrow(userId)

  const now = new Date().toISOString()
  const updates: Partial<typeof users.$inferInsert> = {
    updatedAt: now,
  }

  if (body?.email !== undefined) {
    const nextEmail = body.email.trim().toLowerCase()
    if (nextEmail && nextEmail !== user.email) {
      const [existing] = await db
        .select()
        .from(users)
        .where(eq(users.email, nextEmail))
        .limit(1)
      if (existing) {
        conflict('Email já está em uso')
      }
      updates.email = nextEmail
    }
  }

  if (body?.name !== undefined) {
    updates.name = body.name.trim() || null
  }

  if (body?.password) {
    updates.password = await bcrypt.hash(body.password, 10)
  }

  if (typeof body?.soloMode === 'boolean') {
    updates.soloMode = body.soloMode
  }

  if (typeof body?.onboardingCompleted === 'boolean') {
    updates.onboardingCompletedAt = body.onboardingCompleted ? now : null
  }

  await db.update(users).set(updates).where(eq(users.id, userId))

  return getUserProfileResponse(userId)
})
