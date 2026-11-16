import { eq, inArray } from 'drizzle-orm'
import { db } from '../database'
import { families, users } from '../database/schema'
import { badRequest, notFound, type PublicUser, toPublicUser } from './auth'

export async function getUserOrThrow(userId: string) {
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1)
  if (!user) {
    notFound(`Usuário não encontrado`)
  }
  return user
}

export async function getHouseholdVisibility(userId: string): Promise<{
  familyId: string | null
  memberIds: string[]
  partnerIds: string[]
}> {
  const user = await getUserOrThrow(userId)
  const familyId = user.familyId ?? null
  if (!familyId) {
    return { familyId: null, memberIds: [userId], partnerIds: [] }
  }

  const members = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.familyId, familyId))

  const memberIds = members.map((m) => m.id)
  if (!memberIds.includes(userId)) {
    memberIds.push(userId)
  }
  const partnerIds = memberIds.filter((id) => id !== userId)

  return {
    familyId,
    memberIds,
    partnerIds,
  }
}

export async function assertUserBelongsToFamily(userId: string, familyId: string) {
  const user = await getUserOrThrow(userId)
  if (!user.familyId || user.familyId !== familyId) {
    badRequest('Família inválida ou você não pertence a ela')
  }
}

export async function assertPersonInSameHousehold(ownerId: string, personId: string) {
  if (ownerId === personId) return
  const owner = await getUserOrThrow(ownerId)
  const person = await getUserOrThrow(personId)
  if (!owner.familyId || !person.familyId || owner.familyId !== person.familyId) {
    badRequest('A pessoa deve ser você ou um membro da mesma família')
  }
}

export async function getPublicUsersMap(userIds: string[]): Promise<Map<string, PublicUser>> {
  const map = new Map<string, PublicUser>()
  const uniqueIds = Array.from(new Set(userIds.filter(Boolean)))
  if (uniqueIds.length === 0) return map

  const rows = await db
    .select({ id: users.id, email: users.email, name: users.name })
    .from(users)
    .where(inArray(users.id, uniqueIds))

  for (const r of rows) {
    const pub = toPublicUser(r)
    if (pub) map.set(r.id, pub)
  }
  return map
}

export async function getUserProfileResponse(userId: string) {
  const user = await getUserOrThrow(userId)

  let familyObj: { id: string; name: string } | null = null
  let partnerObj: { id: string; email: string; name: string | null } | null = null

  if (user.familyId) {
    const [fam] = await db
      .select()
      .from(families)
      .where(eq(families.id, user.familyId))
      .limit(1)
    if (fam) {
      familyObj = { id: fam.id, name: fam.name }
      const members = await db
        .select({ id: users.id, email: users.email, name: users.name })
        .from(users)
        .where(eq(users.familyId, fam.id))
      const other = members.find((m) => m.id !== userId)
      if (other) {
        partnerObj = {
          id: other.id,
          email: other.email,
          name: other.name ?? null,
        }
      }
    }
  }

  return {
    id: user.id,
    email: user.email,
    name: user.name ?? null,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    family: familyObj,
    partner: partnerObj,
  }
}
