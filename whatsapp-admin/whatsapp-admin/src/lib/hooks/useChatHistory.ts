import { useQuery } from '@tanstack/react-query'
import toast from 'react-hot-toast'

import { http } from '@/lib/http'

export interface ChatHistoryEntry {
  id: string
  wid: string
  phoneNumber: string
  senderName: string
  message: string
  response: string
  createdAt: string
}

interface HistoryParams {
  preset: string
  customFrom?: string
  customTo?: string
  search?: string
  presetDays?: number
}

/**
 * Read-only chat history, filtered by a date preset (or custom range)
 * and an optional search term. React Query handles caching, so changing
 * the filter re-fetches only when the key actually changes.
 */
export function useChatHistory(params: HistoryParams) {
  return useQuery<ChatHistoryEntry[]>({
    queryKey: ['chat-history', params],
    queryFn: async ({ signal }) => {
      const qs = new URLSearchParams()

      if (params.preset === 'custom' && params.customFrom && params.customTo) {
        qs.set('from_date', params.customFrom)
        qs.set('to_date', params.customTo)
      } else {
        qs.set('days', String(params.presetDays ?? 30))
      }

      if (params.search) qs.set('search', params.search)

      const res = await http.get(`/api/admin/chat-history?${qs.toString()}`, {
        signal,
      })

      return (res.data?.history ?? []).map((h: any) => ({
        id: String(h.id),
        wid: h.wa_id || '',
        phoneNumber: h.wa_id || '',
        senderName: h.sender_name || h.wa_id || 'Unknown',
        message: h.message || '',
        response: h.response || '',
        createdAt: h.created_at || '',
      }))
    },
    // Avoid refetch storms while typing a search term.
    staleTime: 30_000,
    throwOnError: (err) => {
      toast.error((err as Error)?.message || 'Failed to load chat history')
      return false
    },
  })
}
