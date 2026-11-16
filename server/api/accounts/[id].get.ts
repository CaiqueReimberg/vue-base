import { getRouterParam } from 'h3'
import { requireAuthUser } from '../../utils/auth'
import { findOneLinkableAccount, mapAccountsWithEffectiveBalance } from '../../utils/resources'

export default defineEventHandler(async (event) => {
  const { userId } = requireAuthUser(event)
  const id = getRouterParam(event, 'id')!
  const account = await findOneLinkableAccount(userId, id)
  const [mapped] = await mapAccountsWithEffectiveBalance([account])
  return mapped
})
