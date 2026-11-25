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

export function personShortName(person: PublicOwner | null | undefined): string {
  if (!person) return ''
  const trimmed = person.name?.trim()
  if (trimmed) {
    return trimmed.split(/\s+/)[0] || trimmed
  }
  return person.email?.split('@')[0] || person.email || ''
}

export function payerBadgeLabel(paidBy: PublicOwner | null | undefined): string | null {
  const short = personShortName(paidBy)
  return short ? `Pago por ${short}` : null
}
