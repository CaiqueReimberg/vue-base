import { asc, eq } from 'drizzle-orm'
import { db } from '../../../database'
import { families, users } from '../../../database/schema'
import { requireAuthUser } from '../../../utils/auth'
import { getUserOrThrow } from '../../../utils/household'

export default defineEventHandler(async (event) => {
  const { userId } = requireAuthUser(event)
  const user = await getUserOrThrow(userId)

  if (!user.familyId) {
    return {
      persons: [
        {
          id: user.id,
          name: user.name ?? null,
          email: user.email,
        },
      ],
      family: null,
    }
  }

  const [fam] = await db
    .select()
    .from(families)
    .where(eq(families.id, user.familyId))
    .limit(1)

  const members = await db
    .select({ id: users.id, name: users.name, email: users.email })
    .from(users)
    .where(eq(users.familyId, user.familyId))
    .orderBy(asc(users.name), asc(users.email))

  return {
    persons: members.map((m) => ({
      id: m.id,
      name: m.name ?? null,
      email: m.email,
    })),
    family: fam ? { id: fam.id, name: fam.name } : null,
  }
})
