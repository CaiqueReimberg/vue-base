import { randomUUID } from 'node:crypto'
import { readBody } from 'h3'
import { db } from '../../database'
import { categories } from '../../database/schema'
import { badRequest, requireAuthUser } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  const { userId } = requireAuthUser(event)
  const body = await readBody<{ name?: string; type?: string }>(event)

  if (!body?.name?.trim() || !body?.type) {
    badRequest('Informe nome e tipo da categoria')
  }

  const now = new Date().toISOString()
  const id = randomUUID()
  const row: typeof categories.$inferInsert = {
    id,
    name: body.name.trim(),
    type: body.type,
    userId,
    createdAt: now,
    updatedAt: now,
  }

  await db.insert(categories).values(row)
  return row
})
