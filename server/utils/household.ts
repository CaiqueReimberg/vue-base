import { eq, inArray } from 'drizzle-orm'
import { db } from '../database'
import { families, featureFlags, users } from '../database/schema'
import { badRequest, notFound, type PublicUser, toPublicUser } from './auth'

export const DEFAULT_FEATURE_FLAGS: Array<{
  key: string
  label: string
  description: string
  enabled: boolean
}> = [
  {
    key: 'accounts',
    label: 'Dinheiro Guardado (CDBs)',
    description: 'Controle de contas, reservas e CDBs',
    enabled: true,
  },
  {
    key: 'invoices',
    label: 'Análise de Faturas (IA)',
    description: 'Destrinchador de faturas OFX e CSV com Gemini (também exige permissão no usuário)',
    enabled: true,
  },
  {
    key: 'monthly_control',
    label: 'Contas Fixas',
    description: 'Gestão de contas fixas e recorrentes do mês',
    enabled: true,
  },
  {
    key: 'debts',
    label: 'Dívidas & Parcelas',
    description: 'Controle de financiamentos e compras parceladas',
    enabled: true,
  },
  {
    key: 'cards',
    label: 'Cartões de Crédito',
    description: 'Cadastro manual de limites e cartões (módulo legado)',
    enabled: false,
  },
  {
    key: 'agenda',
    label: 'Agenda de Vencimentos',
    description: 'Calendário de vencimentos do mês',
    enabled: true,
  },
]

export async function getSystemFeatureFlagsMap(): Promise<Record<string, boolean>> {
  const map: Record<string, boolean> = {}
  for (const def of DEFAULT_FEATURE_FLAGS) {
    map[def.key] = def.enabled
  }
  try {
    const rows = await db.select().from(featureFlags)
    for (const r of rows) {
      map[r.key] = Boolean(r.enabled)
    }
  } catch {
    // Se a tabela ainda não existir no SQLite local, usa os defaults
  }
  return map
}

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

  const features = await getSystemFeatureFlagsMap()

  return {
    id: user.id,
    email: user.email,
    name: user.name ?? null,
    invoiceAnalysisEnabled: Boolean(user.invoiceAnalysisEnabled),
    isAdmin: Boolean(user.isAdmin),
    features,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    family: familyObj,
    partner: partnerObj,
  }
}

export async function assertFeatureFlagEnabled(key: string, label = 'Este módulo') {
  const features = await getSystemFeatureFlagsMap()
  if (features[key] === false) {
    throw createError({
      statusCode: 403,
      statusMessage: `${label} está bloqueado no momento.`,
      data: { message: `${label} está bloqueado no momento.` },
    })
  }
}

export async function assertInvoiceAnalysisEnabled(userId: string) {
  await assertFeatureFlagEnabled('invoices', 'O módulo de Análise de Faturas')
  const user = await getUserOrThrow(userId)
  if (!user.invoiceAnalysisEnabled && !user.isAdmin) {
    throw createError({
      statusCode: 403,
      statusMessage: 'A funcionalidade de Análise de Faturas não está habilitada para este usuário.',
      data: { message: 'A funcionalidade de Análise de Faturas não está habilitada para este usuário.' },
    })
  }
  return user
}

export async function assertAdminUser(userId: string) {
  const user = await getUserOrThrow(userId)
  if (!user.isAdmin) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Acesso restrito a administradores.',
      data: { message: 'Acesso restrito a administradores.' },
    })
  }
  return user
}
