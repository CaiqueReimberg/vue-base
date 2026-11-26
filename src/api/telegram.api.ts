import { request } from './client'

export interface TelegramDueReminderItem {
  id: string
  name: string
  categoryLabel: string
  amount: number
  dueDate: string
  dueDay: number
  dueMonth: number
  daysUntilDue: number
  isShared: boolean
  isOwn: boolean
  ownerName: string | null
}

export interface TelegramDueDigest {
  referenceDate: string
  overdue: TelegramDueReminderItem[]
  dueToday: TelegramDueReminderItem[]
  upcoming: TelegramDueReminderItem[]
  coupleItems: TelegramDueReminderItem[]
  totalOwnCount: number
  totalOwnAmount: number
  totalAllCount: number
}

export interface TelegramLogEntry {
  id: string
  kind: 'cron' | 'test' | 'welcome' | string
  referenceDate: string
  itemsCount: number
  status: 'sent' | 'skipped' | 'failed' | string
  summary: string | null
  errorMessage: string | null
  createdAt: string
}

export interface TelegramSessionStatus {
  botConfigured: boolean
  botUsername: string | null
  botName: string | null
  cronSecretConfigured: boolean
  webhook: {
    active: boolean
    url: string | null
    lastErrorMessage: string | null
  } | null
  connection: {
    connected: boolean
    chatIdMasked: string | null
    username: string | null
    linkedAt: string | null
    pendingToken: string | null
    pendingLinkUrl: string | null
    pendingExpiresAt: string | null
  }
  preferences: {
    notifyEnabled: boolean
    daysBefore: number
    notifyOverdue: boolean
    includeCouple: boolean
    lastSentDate: string | null
  }
  preview: TelegramDueDigest
  logs: TelegramLogEntry[]
}

export interface TelegramConnectResponse {
  deepLink: string
  botUsername: string
  botName: string
  token: string
  startCommand: string
  expiresAt: string
}

export const telegramApi = {
  getStatus(): Promise<TelegramSessionStatus> {
    return request<TelegramSessionStatus>('/telegram/status')
  },

  startConnect(): Promise<TelegramConnectResponse> {
    return request<TelegramConnectResponse>('/telegram/connect', {
      method: 'POST',
    })
  },

  verifyConnection(): Promise<TelegramSessionStatus> {
    return request<TelegramSessionStatus>('/telegram/verify', {
      method: 'POST',
    })
  },

  disconnect(): Promise<TelegramSessionStatus> {
    return request<TelegramSessionStatus>('/telegram/disconnect', {
      method: 'DELETE',
    })
  },

  updatePreferences(payload: {
    notifyEnabled?: boolean
    daysBefore?: number
    notifyOverdue?: boolean
    includeCouple?: boolean
  }): Promise<TelegramSessionStatus> {
    return request<TelegramSessionStatus>('/telegram/preferences', {
      method: 'PATCH',
      body: JSON.stringify(payload),
    })
  },

  sendTest(): Promise<TelegramSessionStatus> {
    return request<TelegramSessionStatus>('/telegram/test', {
      method: 'POST',
    })
  },

  syncWebhook(): Promise<TelegramSessionStatus> {
    return request<TelegramSessionStatus>('/telegram/webhook_sync', {
      method: 'POST',
    })
  },
}
