import type { PublicOwner } from '@/types/owner'

/** Rótulo curto para exibir quem é o dono (quando não é o usuário logado). */
export function ownerBadgeLabel(
  owner: PublicOwner | null | undefined,
  currentUserId: string | null,
): string | null {
  if (!owner || !currentUserId || owner.id === currentUserId) return null
  return owner.name?.trim() || owner.email
}

export function isMyResource(
  owner: PublicOwner | null | undefined,
  currentUserId: string | null,
): boolean {
  if (!currentUserId) return true
  if (!owner) return true
  return owner.id === currentUserId
}
