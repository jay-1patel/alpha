import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import toast from 'react-hot-toast'

import { http } from '@/lib/http'
import type {
  AudienceSegment,
  Campaign,
  CampaignMetrics,
  CampaignReply,
  CampaignsResponse,
} from '@/lib/types'

/* ------------------------------------------------------------------ */
/* LIST + STATS                                                       */
/* ------------------------------------------------------------------ */

export function useCampaigns() {
  return useQuery<CampaignsResponse>({
    queryKey: ['campaigns', 'list'],
    queryFn: async ({ signal }) => {
      const res = await http.get('/api/campaigns', { signal })

      return {
        campaigns: res.data?.campaigns ?? res.data ?? [],
        stats: res.data?.stats ?? {
          total_sent_24h: 0,
          delivery_rate: 0,
          reply_rate: 0,
          active_campaigns: 0,
        },
      }
    },
    staleTime: 5000,
  })
}

/* ------------------------------------------------------------------ */
/* AUDIENCE COUNT (live targeting preview)                            */
/* ------------------------------------------------------------------ */

export function useAudienceCount(segment: AudienceSegment | null) {
  return useQuery<number>({
    queryKey: ['campaigns', 'audience-count', segment],
    enabled: !!segment,
    queryFn: async ({ signal }) => {
      const res = await http.post(
        '/api/campaigns/audience/count',
        { segment },
        { signal }
      )
      return res.data?.count ?? 0
    },
    staleTime: 10000,
    placeholderData: (prev) => prev,
  })
}

/* ------------------------------------------------------------------ */
/* CREATE / DUPLICATE                                                 */
/* ------------------------------------------------------------------ */

export function useCreateCampaign(onDone?: () => void) {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (
      payload: Record<string, unknown> & { id?: number | string }
    ) => {
      /* If an id is present the builder is editing/duplicating */
      if (payload.id !== undefined && payload.id !== null && payload.id !== '') {
        const res = await http.put(`/api/campaigns/${payload.id}`, payload)
        return res.data
      }

      const res = await http.post('/api/campaigns', payload)
      return res.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['campaigns'] })
      toast.success('Campaign saved')
      onDone?.()
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to save campaign')
    },
  })
}

export function useDuplicateCampaign() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (id: number | string) => {
      const res = await http.post(`/api/campaigns/${id}/duplicate`)
      return res.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['campaigns', 'list'] })
      toast.success('Campaign duplicated as draft')
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to duplicate campaign')
    },
  })
}

export function useDeleteCampaign(onDone?: () => void) {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (id: number | string) => {
      const res = await http.delete(`/api/campaigns/${id}`)
      return res.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['campaigns', 'list'] })
      toast.success('Campaign deleted')
      onDone?.()
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to delete campaign')
    },
  })
}

/* ------------------------------------------------------------------ */
/* METRICS ("Live" view)                                              */
/* ------------------------------------------------------------------ */

/**
 * Polls aggressively ONLY while a campaign is actively sending.
 * refetchInterval receives the query data, so we can react to status.
 */
export function useCampaignMetrics(campaignId: number | string | null) {
  return useQuery<CampaignMetrics>({
    queryKey: ['campaigns', 'metrics', campaignId],
    enabled: !!campaignId,
    queryFn: async ({ signal }) => {
      const res = await http.get(`/api/campaigns/${campaignId}/metrics`, {
        signal,
      })
      return res.data
    },
    refetchInterval: (query) => {
      const data = query?.state?.data as CampaignMetrics | undefined

      return data?.status === 'sending' ? 3000 : false
    },
    staleTime: 0,
  })
}

/**
 * Replies tab — live list of distributors who replied. Polls every 5s
 * while mounted.
 */
export function useCampaignReplies(campaignId: number | string | null) {
  return useQuery<CampaignReply[]>({
    queryKey: ['campaigns', 'replies', campaignId],
    enabled: !!campaignId,
    queryFn: async ({ signal }) => {
      const res = await http.get(`/api/campaigns/${campaignId}/replies`, {
        signal,
      })
      return res.data?.replies ?? res.data ?? []
    },
    refetchInterval: 5000,
    staleTime: 0,
  })
}

/** Convenience re-export so pages can invalidate everything at once. */
export function useInvalidateCampaigns() {
  const qc = useQueryClient()
  return () => qc.invalidateQueries({ queryKey: ['campaigns'] })
}
