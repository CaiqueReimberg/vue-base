import { request } from './client'

export interface LoginPayload {
  email: string
  password: string
}

/** API retorna access_token */
export interface LoginResponse {
  access_token: string
}

export const authApi = {
  login(payload: LoginPayload): Promise<LoginResponse> {
    return request<LoginResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  },
}
