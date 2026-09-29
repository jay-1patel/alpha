import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import toast from 'react-hot-toast'

import { http } from '@/lib/http'
import type {
  MenuActionType,
  MenuItem,
  MenusResponse,
} from '@/lib/types'

/* ------------------------------------------------------------------ */
/* LIST                                                               */
/* ------------------------------------------------------------------ */

export interface MenuFilters {
  menu_type?: string
  section?: string
  active_only?: boolean
  action_type?: string
}

export function useMenus(filters?: MenuFilters) {
  return useQuery<MenusResponse>({
    queryKey: ['menus', 'list', filters],
    queryFn: async ({ signal }) => {
      const params = new URLSearchParams()

      if (filters?.menu_type) params.set('menu_type', filters.menu_type)
      if (filters?.section) params.set('section', filters.section)
      if (filters?.action_type) params.set('action_type', filters.action_type)
      if (filters?.active_only !== undefined) {
        params.set('active_only', String(filters.active_only))
      }

      const qs = params.toString()
      const res = await http.get(`/api/admin/menus${qs ? `?${qs}` : ''}`, {
        signal,
      })
      return res.data
    },
    staleTime: 5000,
  })
}

/* ------------------------------------------------------------------ */
/* CREATE                                                             */
/* ------------------------------------------------------------------ */

export interface MenuPayload {
  title: string
  payload: string
  action_type: MenuActionType
  action_data: string
  parent_id?: number | null
  menu_type?: string
  section?: string
  sort_order?: number
}

export function useCreateMenu(onDone?: () => void) {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (payload: MenuPayload) => {
      const res = await http.post('/api/admin/menus', payload)
      return res.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['menus'] })
      toast.success('Menu item created')
      onDone?.()
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to create menu item')
    },
  })
}

/* ------------------------------------------------------------------ */
/* UPDATE                                                             */
/* ------------------------------------------------------------------ */

export function useUpdateMenu(onDone?: () => void) {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async ({
      payload,
      ...updates
    }: MenuPayload & { payload: string }) => {
      const res = await http.put(`/api/admin/menus/${encodeURIComponent(payload)}`, updates)
      return res.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['menus'] })
      toast.success('Menu item updated')
      onDone?.()
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to update menu item')
    },
  })
}

/* ------------------------------------------------------------------ */
/* DELETE                                                             */
/* ------------------------------------------------------------------ */

export function useDeleteMenu() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (payload: string) => {
      const res = await http.delete(`/api/admin/menus/${encodeURIComponent(payload)}`)
      return res.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['menus'] })
      toast.success('Menu item deleted')
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to delete menu item')
    },
  })
}

/* ------------------------------------------------------------------ */
/* SELECTORS                                                          */
/* ------------------------------------------------------------------ */

export function parentOptions(items: MenuItem[]): MenuItem[] {
  return items.filter((m) => m.menu_type === 'main' || m.parent_id === null)
}

export function findMenuByPayload(items: MenuItem[], payload: string) {
  return items.find((m) => m.payload === payload)
}
