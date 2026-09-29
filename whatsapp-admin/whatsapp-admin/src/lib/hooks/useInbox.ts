import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import toast from 'react-hot-toast'

import { http } from '@/lib/http'
import { getCurrentUsername } from '@/lib/api'
import type {
  Agent,
  ChatMessage,
  Conversation,
  DistributorInfo,
} from '@/lib/types'

/* ------------------------------------------------------------------ */
/* QUEUE                                                              */
/* ------------------------------------------------------------------ */

export function useChatQueue() {
  return useQuery<Conversation[]>({
    queryKey: ['inbox', 'queue'],
    queryFn: async ({ signal }) => {
      const res = await http.get('/api/inbox/queue', { signal })
      const list: Conversation[] = res.data?.queue ?? res.data ?? []

      /* Urgent chats pinned to the top automatically */
      const rank = { urgent: 0, high: 1, normal: 2 } as const

      return [...list].sort((a, b) => {
        if ((a.priority ?? 'normal') !== (b.priority ?? 'normal')) {
          return rank[a.priority ?? 'normal'] - rank[b.priority ?? 'normal']
        }

        return (
          new Date(b.last_message_at ?? 0).getTime() -
          new Date(a.last_message_at ?? 0).getTime()
        )
      })
    },
    refetchInterval: 3000,
    staleTime: 0,
  })
}

/* ------------------------------------------------------------------ */
/* AGENTS                                                             */
/* ------------------------------------------------------------------ */

export function useAgents() {
  return useQuery<Agent[]>({
    queryKey: ['inbox', 'agents'],
    queryFn: async ({ signal }) => {
      const res = await http.get('/api/inbox/agents', { signal })
      return res.data?.agents ?? res.data ?? []
    },
    refetchInterval: 10000,
  })
}

export function useSetAgentStatus() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (status: string) => {
      const res = await http.put('/api/inbox/agents/status', {
        agent_id: getCurrentUsername() || 'current_admin',
        status,
      })
      return res.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inbox', 'agents'] })
    },
    onError: () => {
      /* Non-fatal: status is mirrored locally in zustand */
    },
  })
}

/* ------------------------------------------------------------------ */
/* ASSIGNMENT                                                         */
/* ------------------------------------------------------------------ */

export function useAssignConversation() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (wa_id: string) => {
      const res = await http.post('/api/inbox/assign', {
        wa_id,
        agent_id: getCurrentUsername() || 'current_admin',
      })
      return res.data
    },
    onSuccess: (_data, waId) => {
      qc.invalidateQueries({ queryKey: ['inbox', 'queue'] })
      toast.success(`Conversation ${waId} assigned to you`)
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to assign conversation')
    },
  })
}

/* ------------------------------------------------------------------ */
/* HANDOVER                                                           */
/* ------------------------------------------------------------------ */

export function useHandoverToggle() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async ({
      wa_id,
      mode,
    }: {
      wa_id: string
      mode: 'bot' | 'human'
    }) => {
      const res = await http.put(`/api/inbox/handover/${wa_id}`, { mode })
      return res.data
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['inbox', 'queue'] })
      toast.success(
        vars.mode === 'human'
          ? 'Human Mode ON — bot paused for this user'
          : 'Bot Active — bot resumed for this user'
      )
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to toggle handover')
    },
  })
}

/* ------------------------------------------------------------------ */
/* RESOLVE & CLOSE                                                    */
/* ------------------------------------------------------------------ */

export function useResolveHandoff() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (wa_id: string) => {
      const res = await http.post(`/api/inbox/resolve/${wa_id}`)
      return res.data
    },
    onSuccess: (_data, waId) => {
      qc.invalidateQueries({ queryKey: ['inbox', 'queue'] })
      qc.invalidateQueries({ queryKey: ['inbox', 'history', waId] })
      toast.success('Conversation resolved — bot resumed')
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to resolve conversation')
    },
  })
}

/* ------------------------------------------------------------------ */
/* CHAT HISTORY + SENDING                                             */
/* ------------------------------------------------------------------ */

export function useChatHistory(waId: string | null) {
  return useQuery<ChatMessage[]>({
    queryKey: ['inbox', 'history', waId],
    enabled: !!waId,
    queryFn: async ({ signal }) => {
      const res = await http.get(`/api/chat/history/${waId}`, { signal })
      return res.data?.messages ?? res.data ?? []
    },
    refetchInterval: 3000,
    staleTime: 0,
  })
}

export function useSendAgentMessage(waId: string | null) {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (payload: {
      text?: string
      file?: File | null
    }) => {
      let res

      if (payload.file) {
        const form = new FormData()
        form.append('wa_id', waId ?? '')
        form.append('file', payload.file)

        if (payload.text) form.append('caption', payload.text)

        res = await http.post('/api/chat/send', form)
      } else {
        res = await http.post('/api/chat/send', {
          wa_id: waId,
          message: payload.text,
          sender_type: 'agent',
          sender: getCurrentUsername() || 'agent',
        })
      }

      return res.data
    },
    onSuccess: () => {
      qc.invalidateQueries({
        queryKey: ['inbox', 'history', waId],
      })
      qc.invalidateQueries({ queryKey: ['inbox', 'queue'] })
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to send message')
    },
  })
}

/* ------------------------------------------------------------------ */
/* CONTEXT DRAWER                                                     */
/* ------------------------------------------------------------------ */

export function useDistributorLookup(waId: string | null) {
  return useQuery<DistributorInfo>({
    queryKey: ['inbox', 'distributor', waId],
    enabled: !!waId,
    queryFn: async ({ signal }) => {
      const res = await http.get(`/api/distributors/lookup/${waId}`, { signal })
      return res.data
    },
    staleTime: 15000,
  })
}

export function useResetBotState() {
  return useMutation({
    mutationFn: async (wa_id: string) => {
      const res = await http.post(`/api/inbox/reset-bot-state/${wa_id}`)
      return res.data
    },
    onSuccess: () => {
      toast.success('Bot state reset')
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to reset bot state')
    },
  })
}
