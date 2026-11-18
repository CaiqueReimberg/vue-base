import { desc } from 'drizzle-orm'
import { getQuery } from 'h3'
import { db } from '../../../database'
import { users } from '../../../database/schema'
import { requireAuthUser } from '../../../utils/auth'
import { assertAdminUser } from '../../../utils/household'

export default defineEventHandler(async (event) => {
  const { userId } = requireAuthUser(event)
  await assertAdminUser(userId)

  const query = getQuery(event)
  const page = Math.max(1, Number(query.page) || 1)
  const pageSize = Math.min(50, Math.max(1, Number(query.pageSize) || 10))
  const search = typeof query.search === 'string' ? query.search.trim().toLowerCase() : ''

  const allUsers = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      familyId: users.familyId,
      invoiceAnalysisEnabled: users.invoiceAnalysisEnabled,
      isAdmin: users.isAdmin,
      createdAt: users.createdAt,
      updatedAt: users.updatedAt,
    })
    .from(users)
    .orderBy(desc(users.createdAt))

  const filtered = search
    ? allUsers.filter(
        (u) =>
          u.email.toLowerCase().includes(search) ||
          (u.name && u.name.toLowerCase().includes(search)),
      )
    : allUsers

  const total = filtered.length
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const safePage = Math.min(page, totalPages)
  const start = (safePage - 1) * pageSize
  const paginated = filtered.slice(start, start + pageSize)

  return {
    items: paginated.map((u) => ({
      id: u.id,
      email: u.email,
      name: u.name ?? null,
      hasPartner: Boolean(u.familyId),
      invoiceAnalysisEnabled: Boolean(u.invoiceAnalysisEnabled),
      isAdmin: Boolean(u.isAdmin),
      createdAt: u.createdAt,
      updatedAt: u.updatedAt,
    })),
    page: safePage,
    pageSize,
    total,
    totalPages,
  }
})
