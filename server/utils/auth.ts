import type { H3Event } from 'h3'
import { createError, getCookie, getHeader } from 'h3'
import jwt from 'jsonwebtoken'

export type PublicUser = {
  id: string
  email: string
  name: string | null
}

export function toPublicUser(
  user: { id: string; email: string; name?: string | null } | undefined | null
): PublicUser | null {
  if (!user) return null
  return {
    id: user.id,
    email: user.email,
    name: user.name ?? null,
  }
}

export function signJwt(payload: { sub: string; email: string }): string {
  const config = useRuntimeConfig()
  const secret = config.jwtSecret || process.env.JWT_SECRET || 'dualpact-super-secret-jwt-key-dev'
  return jwt.sign(payload, secret, { expiresIn: '30d' })
}

export function requireAuthUser(event: H3Event): { userId: string; email: string } {
  const authHeader = getHeader(event, 'authorization') || getHeader(event, 'Authorization')
  const cookieToken = getCookie(event, 'auth_token')
  const rawToken =
    authHeader && authHeader.startsWith('Bearer ')
      ? authHeader.slice(7).trim()
      : cookieToken?.trim()

  if (!rawToken) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Não autorizado',
      data: { message: 'Não autorizado' },
    })
  }

  const token = rawToken
  const config = useRuntimeConfig()
  const secret = config.jwtSecret || process.env.JWT_SECRET || 'dualpact-super-secret-jwt-key-dev'

  try {
    const decoded = jwt.verify(token, secret) as { sub: string; email: string }
    if (!decoded?.sub) {
      throw new Error('Token inválido')
    }
    return { userId: decoded.sub, email: decoded.email }
  } catch {
    throw createError({
      statusCode: 401,
      statusMessage: 'Sessão expirada ou token inválido',
      data: { message: 'Sessão expirada ou token inválido' },
    })
  }
}

export function badRequest(message: string): never {
  throw createError({
    statusCode: 400,
    statusMessage: message,
    data: { message },
  })
}

export function notFound(message: string): never {
  throw createError({
    statusCode: 404,
    statusMessage: message,
    data: { message },
  })
}

export function conflict(message: string): never {
  throw createError({
    statusCode: 409,
    statusMessage: message,
    data: { message },
  })
}
