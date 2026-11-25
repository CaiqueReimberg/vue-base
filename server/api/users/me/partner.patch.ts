import { eq } from 'drizzle-orm'
import { readBody } from 'h3'
import { db } from '../../../database'
import { families } from '../../../database/schema'
import { badRequest, requireAuthUser } from '../../../utils/auth'
import { getUserOrThrow, getUserProfileResponse } from '../../../utils/household'

export default defineEventHandler(async (event) => {
  const { userId } = requireAuthUser(event)
  const user = await getUserOrThrow(userId)

  if (!user.familyId) {
    badRequest('Você ainda não possui vínculo com outra pessoa.')
  }

  const body = await readBody<{ shareOverview?: boolean }>(event)
  if (typeof body?.shareOverview !== 'boolean') {
    badRequest('Informe shareOverview (boolean).')
  }

  const now = new Date().toISOString()
  await db
    .update(families)
    .set({
      shareOverview: body.shareOverview,
      updatedAt: now,
    })
    .where(eq(families.id, user.familyId))

  return getUserProfileResponse(userId)
})
