import { eq } from 'drizzle-orm'
import { getRouterParam, readBody } from 'h3'
import { db } from '../../../database'
import { featureFlags } from '../../../database/schema'
import { badRequest, notFound, requireAuthUser } from '../../../utils/auth'
import { assertAdminUser, DEFAULT_FEATURE_FLAGS } from '../../../utils/household'

export default defineEventHandler(async (event) => {
  const { userId } = requireAuthUser(event)
  await assertAdminUser(userId)

  const key = getRouterParam(event, 'key')
  if (!key) {
    badRequest('Chave da funcionalidade obrigatória')
  }

  const def = DEFAULT_FEATURE_FLAGS.find((f) => f.key === key)
  if (!def) {
    notFound('Funcionalidade não encontrada')
  }

  const body = await readBody<{ enabled?: boolean }>(event)
  if (typeof body?.enabled !== 'boolean') {
    badRequest('Informe o campo booleano enabled')
  }

  const now = new Date().toISOString()
  const [existing] = await db
    .select()
    .from(featureFlags)
    .where(eq(featureFlags.key, key))
    .limit(1)

  if (existing) {
    await db
      .update(featureFlags)
      .set({
        enabled: body.enabled,
        updatedAt: now,
      })
      .where(eq(featureFlags.key, key))
  } else {
    await db.insert(featureFlags).values({
      key: def.key,
      label: def.label,
      description: def.description,
      enabled: body.enabled,
      updatedAt: now,
    })
  }

  return {
    key: def.key,
    label: existing?.label || def.label,
    description: existing?.description || def.description,
    enabled: body.enabled,
    updatedAt: now,
  }
})
