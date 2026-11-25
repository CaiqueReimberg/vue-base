import { request } from './client'

export interface UserProfile {
  id: string
  email: string
  name: string | null
  isPremium: boolean
  invoiceAnalysisEnabled: boolean
  isAdmin: boolean
  soloMode?: boolean
  onboardingCompletedAt?: string | null
  features?: Record<string, boolean>
  createdAt: string
  updatedAt: string
  family: { id: string; name: string } | null
  partner: { id: string; email: string; name: string | null } | null
}

export interface SystemFeatureFlagItem {
  key: string
  label: string
  description: string
  enabled: boolean
  updatedAt: string
}

export interface AdminUserItem {
  id: string
  email: string
  name: string | null
  hasPartner: boolean
  isPremium: boolean
  invoiceAnalysisEnabled: boolean
  isAdmin: boolean
  createdAt: string
  updatedAt: string
}

export interface AdminUsersPaginatedResponse {
  items: AdminUserItem[]
  page: number
  pageSize: number
  total: number
  totalPages: number
}

export interface UpdateMePayload {
  email?: string
  name?: string
  password?: string
  soloMode?: boolean
  onboardingCompleted?: boolean
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

  listAdminUsers(params?: {
    page?: number
    pageSize?: number
    search?: string
  }): Promise<AdminUsersPaginatedResponse> {
    const qs = new URLSearchParams()
    if (params?.page) qs.set('page', String(params.page))
    if (params?.pageSize) qs.set('pageSize', String(params.pageSize))
    if (params?.search) qs.set('search', params.search)
    const query = qs.toString() ? `?${qs.toString()}` : ''
    return request<AdminUsersPaginatedResponse>(`/admin/users${query}`)
  },

  updateAdminUserFlags(
    userId: string,
    payload: { isPremium?: boolean; invoiceAnalysisEnabled?: boolean; isAdmin?: boolean },
  ): Promise<AdminUserItem> {
    return request<AdminUserItem>(`/admin/users/${userId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    })
  },

  listSystemFeatures(): Promise<SystemFeatureFlagItem[]> {
    return request<SystemFeatureFlagItem[]>('/admin/features')
  },

  updateSystemFeature(key: string, enabled: boolean): Promise<SystemFeatureFlagItem> {
    return request<SystemFeatureFlagItem>(`/admin/features/${key}`, {
      method: 'PATCH',
      body: JSON.stringify({ enabled }),
    })
  },
}
