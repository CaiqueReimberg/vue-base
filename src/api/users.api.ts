import { request } from './client'

export interface UserProfile {
  id: string
  email: string
  name: string | null
  createdAt: string
  updatedAt: string
  family: { id: string; name: string } | null
  partner: { id: string; email: string; name: string | null } | null
}

export interface UpdateMePayload {
  email?: string
  name?: string
  password?: string
}

export const usersApi = {
  getMe(): Promise<UserProfile> {
    return request<UserProfile>('/users/me')
  },

  updateMe(payload: UpdateMePayload): Promise<UserProfile> {
    return request<UserProfile>('/users/me', {
      method: 'PATCH',
      body: JSON.stringify(payload),
    })
  },

  linkPartner(partnerEmail: string): Promise<UserProfile> {
    return request<UserProfile>('/users/me/partner', {
      method: 'POST',
      body: JSON.stringify({ partnerEmail }),
    })
  },

  unlinkPartner(): Promise<UserProfile> {
    return request<UserProfile>('/users/me/partner', { method: 'DELETE' })
  },
}
