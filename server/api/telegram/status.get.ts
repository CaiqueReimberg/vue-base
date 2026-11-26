import { requireAuthUser } from '../../utils/auth'
import { assertTelegramFeatureEnabled } from '../../utils/household'
import { getUserTelegramSessionStatus } from '../../utils/telegram'

export default defineEventHandler(async (event) => {
  const { userId } = requireAuthUser(event)
  await assertTelegramFeatureEnabled(userId)
  return getUserTelegramSessionStatus(userId)
})
