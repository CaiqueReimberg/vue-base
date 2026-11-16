import { getRouterParam } from 'h3'
import { requireAuthUser } from '../../utils/auth'
import { getPublicUsersMap } from '../../utils/household'
import { findOneLinkableCard } from '../../utils/resources'

export default defineEventHandler(async (event) => {
  const { userId } = requireAuthUser(event)
  const id = getRouterParam(event, 'id')!
  const card = await findOneLinkableCard(userId, id)
  const usersMap = await getPublicUsersMap([card.userId])
  return {
    ...card,
    owner: usersMap.get(card.userId) ?? null,
  }
})
