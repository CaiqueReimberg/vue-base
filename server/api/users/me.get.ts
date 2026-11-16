import { requireAuthUser } from '../../utils/auth'
import { getUserProfileResponse } from '../../utils/household'

export default defineEventHandler(async (event) => {
  const { userId } = requireAuthUser(event)
  return getUserProfileResponse(userId)
})
