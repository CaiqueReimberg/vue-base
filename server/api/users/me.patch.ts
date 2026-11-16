import bcrypt from 'bcryptjs'
import { eq } from 'drizzle-orm'
import { readBody } from 'h3'
import { db } from '../../database'
import { users } from '../../database/schema'
import { conflict, requireAuthUser } from '../../utils/auth'
import { getUserOrThrow, getUserProfileResponse } from '../../utils/household'

export default defineEventHandler(async (event) => {
  const { userId } = requireAuthUser(event)
  const body = await readBody<{ email?: string; name?: string; password?: string }>(event)
  const user = await getUserOrThrow(userId)

  const updates: Partial<typeof users.$inferInsert> = {
    updatedAt: new Date().toISOString(),
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

  await db.update(users).set(updates).where(eq(users.id, userId))

  return getUserProfileResponse(userId)
})
