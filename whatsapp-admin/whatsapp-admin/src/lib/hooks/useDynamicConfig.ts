import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { toast } from 'sonner'

export type DynamicScope =
  | 'products'
  | 'b2c_menu'
  | 'b2b_menu'
  | 'price_list'
  | 'schemes'
  | 'campaigns'
  | 'faq'
  | 'admin_settings'
  | 'branding'

const DYNAMIC_CONFIG_KEY = ['dynamic-config']

function scopeKey(scope: DynamicScope) {
  return [...DYNAMIC_CONFIG_KEY, scope]
}

export function useDynamicConfig(scope: DynamicScope, enabled = true) {
  return useQuery({
    queryKey: scopeKey(scope),
    enabled,
    queryFn: async () => {
      const res = await api.get(`/api/admin/dynamic/${scope}`)
      return res as {
        scope: string
        published: any
        draft: any
        has_draft: boolean
      }
    },
    staleTime: 0,
  })
}

export function useSaveDraftConfig(scope: DynamicScope) {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (snapshot: any) => {
      const res = await api.put(`/api/admin/dynamic/${scope}`, { snapshot })
      return res as { ok: boolean; scope: string; has_draft: boolean }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: scopeKey(scope) })
      toast.success('Draft saved', { description: 'Your changes are staged but not yet live.' })
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Save failed')
    },
  })
}

export function useBuildDraft(scope: DynamicScope) {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async () => {
      const res = await api.post(`/api/admin/dynamic/${scope}/build-draft`)
      return res as { ok: boolean; scope: string; has_draft: boolean }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: scopeKey(scope) })
      toast.success('Draft updated', { description: 'A new draft snapshot is ready to publish.' })
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to update draft')
    },
  })
}

export function usePublishConfig(scope: DynamicScope) {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async () => {
      const res = await api.post(`/api/admin/dynamic/${scope}/publish`)
      return res as { ok: boolean; scope: string; published: boolean }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: scopeKey(scope) })
      toast.success('Published', { description: 'Changes are now live for the bot.' })
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Publish failed')
    },
  })
}

export function usePublishHistory(scope: DynamicScope, limit = 20) {
  return useQuery({
    queryKey: [...scopeKey(scope), 'history'],
    queryFn: async () => {
      const res = await api.get(`/api/admin/dynamic/${scope}/history?limit=${limit}`)
      return (res as { history: any[] }).history
    },
    enabled: false,
  })
}
