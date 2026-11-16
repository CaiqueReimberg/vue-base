import { randomUUID } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { readBody } from 'h3'
import { db } from '../../../database'
import { families, users } from '../../../database/schema'
import { badRequest, conflict, notFound, requireAuthUser } from '../../../utils/auth'
import { getUserOrThrow, getUserProfileResponse } from '../../../utils/household'

export default defineEventHandler(async (event) => {
  const { userId } = requireAuthUser(event)
  const body = await readBody<{ partnerEmail?: string }>(event)
  const email = body?.partnerEmail?.trim().toLowerCase()

  if (!email) {
    badRequest('Informe o e-mail da outra pessoa')
  }

  const [partner] = await db.select().from(users).where(eq(users.email, email)).limit(1)
  if (!partner) {
    notFound('Nenhum usuário encontrado com esse e-mail')
  }

  if (partner.id === userId) {
    badRequest('Informe o e-mail da outra pessoa')
  }

  const me = await getUserOrThrow(userId)

  if (me.familyId && partner.familyId && me.familyId === partner.familyId) {
    return getUserProfileResponse(userId)
  }

  const loadMembers = async (fid: string | null) => {
    if (!fid) return []
    return db.select().from(users).where(eq(users.familyId, fid))
  }

  const mMembers = await loadMembers(me.familyId)
  const pMembers = await loadMembers(partner.familyId)

  const myOthers = mMembers.filter((u) => u.id !== me.id)
  if (myOthers.length >= 1 && !myOthers.every((u) => u.id === partner.id)) {
    conflict('Você já está vinculado a outra pessoa.')
  }

  const partnerOthers = pMembers.filter((u) => u.id !== partner.id)
  if (partnerOthers.length >= 1 && !partnerOthers.every((u) => u.id === me.id)) {
    conflict('Este e-mail já está vinculado a outra pessoa.')
  }

  const now = new Date().toISOString()
  const newFamilyId = randomUUID()
  await db.insert(families).values({
    id: newFamilyId,
    name: 'Família',
    createdAt: now,
    updatedAt: now,
  })

  const oldIds = new Set<string>()
  if (me.familyId) oldIds.add(me.familyId)
  if (partner.familyId) oldIds.add(partner.familyId)

  await db.update(users).set({ familyId: newFamilyId, updatedAt: now }).where(eq(users.id, me.id))
  await db.update(users).set({ familyId: newFamilyId, updatedAt: now }).where(eq(users.id, partner.id))

  for (const fid of oldIds) {
    const remaining = await db.select({ id: users.id }).from(users).where(eq(users.familyId, fid))
    if (remaining.length === 0) {
      await db.delete(families).where(eq(families.id, fid))
    }
  }

  return getUserProfileResponse(userId)
})
