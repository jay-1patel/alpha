import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import toast from 'react-hot-toast'

import { http } from '@/lib/http'
import type { ComplaintsResponse, Complaint } from '@/lib/types'

/* ------------------------------------------------------------------ */
/* LIST                                                               */
/* ------------------------------------------------------------------ */

export function useComplaints(filters?: {
  status?: string
  waId?: string
}) {
  return useQuery<ComplaintsResponse>({
    queryKey: ['complaints', 'list', filters],
    queryFn: async ({ signal }) => {
      const params = new URLSearchParams()
      if (filters?.status) params.set('status', filters.status)
      if (filters?.waId) params.set('wa_id', filters.waId)
      const qs = params.toString()
      const res = await http.get(`/api/complaints${qs ? `?${qs}` : ''}`, { signal })
      return res.data
    },
    staleTime: 5000,
    refetchInterval: 15000,
  })
}

/* ------------------------------------------------------------------ */
/* UPDATE (status / assignee / priority)                              */
/* ------------------------------------------------------------------ */

export function useUpdateComplaint(onDone?: () => void) {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async ({
      ticket_id,
      ...payload
    }: {
      ticket_id: string
      status?: string
      assigned_to?: string
      priority?: string
    }) => {
      const res = await http.put(`/api/complaints/${ticket_id}`, payload)
      return res.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['complaints'] })
      toast.success('Complaint updated')
      onDone?.()
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to update complaint')
    },
  })
}

/* ------------------------------------------------------------------ */
/* RESOLVE                                                            */
/* ------------------------------------------------------------------ */

export function useResolveComplaint() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (ticket_id: string) => {
      const res = await http.post(`/api/complaints/${ticket_id}/resolve`)
      return res.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['complaints'] })
      toast.success('Complaint marked as resolved 🎉')
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to resolve complaint')
    },
  })
}

/* ------------------------------------------------------------------ */
/* REPLY TO CUSTOMER                                                   */
/* ------------------------------------------------------------------ */

export function useReplyComplaint() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async ({
      ticket_id,
      message,
      status,
    }: {
      ticket_id: string
      message: string
      status?: string
    }) => {
      const res = await http.post(`/api/complaints/${ticket_id}/reply`, {
        message,
        ...(status ? { status } : {}),
      })
      return res.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['complaints'] })
      toast.success('Reply sent to customer ✉️')
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to send reply')
    },
  })
}

/* ------------------------------------------------------------------ */
/* DELETE                                                             */
/* ------------------------------------------------------------------ */

export function useDeleteComplaint() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (ticket_id: string) => {
      const res = await http.delete(`/api/complaints/${ticket_id}`)
      return res.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['complaints'] })
      toast.success('Complaint deleted')
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to delete complaint')
    },
  })
}

export type { Complaint }