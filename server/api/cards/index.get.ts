import { requireAuthUser } from '../../utils/auth'
import { assertFeatureFlagEnabled } from '../../utils/household'
import { findVisibleCardsByUser } from '../../utils/resources'

export default defineEventHandler(async (event) => {
  const { userId } = requireAuthUser(event)
  await assertFeatureFlagEnabled('cards', 'O módulo de Cartões')
  return findVisibleCardsByUser(userId)
})
