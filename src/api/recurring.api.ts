import type { RecurringCreateInput } from '@/types/recurring'
import { request } from './client'

export const recurringApi = {
  create(data: RecurringCreateInput): Promise<unknown> {
    return request('/recurring', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },
}
