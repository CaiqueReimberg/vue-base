import { eq } from 'drizzle-orm'
import { db } from '../../../database'
import { families, users } from '../../../database/schema'
import { requireAuthUser } from '../../../utils/auth'
import { getUserOrThrow, getUserProfileResponse } from '../../../utils/household'

export default defineEventHandler(async (event) => {
  const { userId } = requireAuthUser(event)
  const me = await getUserOrThrow(userId)

  if (!me.familyId) {
    return getUserProfileResponse(userId)
  }

  const fid = me.familyId
  const now = new Date().toISOString()
  await db.update(users).set({ familyId: null, updatedAt: now }).where(eq(users.familyId, fid))
  await db.delete(families).where(eq(families.id, fid))

  return getUserProfileResponse(userId)
})
