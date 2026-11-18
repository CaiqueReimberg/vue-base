import { db } from '../../../database'
import { featureFlags } from '../../../database/schema'
import { requireAuthUser } from '../../../utils/auth'
import { assertAdminUser, DEFAULT_FEATURE_FLAGS } from '../../../utils/household'

export default defineEventHandler(async (event) => {
  const { userId } = requireAuthUser(event)
  await assertAdminUser(userId)

  const rows = await db.select().from(featureFlags)
  const dbMap = new Map(rows.map((r) => [r.key, r]))

  return DEFAULT_FEATURE_FLAGS.map((def) => {
    const row = dbMap.get(def.key)
    return {
      key: def.key,
      label: row?.label || def.label,
      description: row?.description || def.description,
      enabled: row ? Boolean(row.enabled) : def.enabled,
      updatedAt: row?.updatedAt || new Date().toISOString(),
    }
  })
})
