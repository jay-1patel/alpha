import { useQuery } from '@tanstack/react-query'

import { http } from '@/lib/http'

export interface AdminUser {
  username: string
  chat_id: string
  last_message: { message: string; created_at: string; username?: string } | null
}

/**
 * List of admin chat users + their last message. The chat tab keeps
 * the online users and message stream on the WebSocket; this hook only
 * supplies the user list for the sidebar.
 */
export function useAdminChatUsers() {
  return useQuery<AdminUser[]>({
    queryKey: ['admin-chat', 'users'],
    queryFn: async ({ signal }) => {
      const res = await http.get('/api/admin/chat/users', { signal })
      return res.data?.users ?? []
    },
    staleTime: 10_000,
  })
}
