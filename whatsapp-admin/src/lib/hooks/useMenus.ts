import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'

import { http } from '@/lib/http'

import type { MenuData, MenuItemRow, MenuSettings } from '@/lib/types'

const MENUS_KEY = ['menus', 'list']
const MENU_KEY = (key: string) => ['menus', key]

export function useMenus() {
  return useQuery({
    queryKey: MENUS_KEY,
    queryFn: async ({ signal }) => {
      const res = await http.get('/api/admin/menus', { signal })
      return (res.data as any).menus as { menu_key: string; items: MenuItemRow[] }[]
    },
    staleTime: 10_000,
  })
}

export function useMenuDetail(menuKey: string) {
  return useQuery({
    queryKey: MENU_KEY(menuKey),
    queryFn: async ({ signal }) => {
      const res = await http.get(`/api/admin/menus/${menuKey}`, { signal })
      return res.data as unknown as MenuData
    },
    staleTime: 10_000,
  })
}

export function useUpdateMenuItem(menuKey: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ itemId, fields }: { itemId: string; fields: Partial<MenuItemRow> }) => {
      // If id is changing, the backend needs it in the body to know the new key
      const body = { ...fields }
      await http.put(`/api/admin/menus/${menuKey}/${itemId}`, body)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: MENUS_KEY })
      qc.invalidateQueries({ queryKey: MENU_KEY(menuKey) })
      toast.success('Menu item updated')
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to update menu item')
    },
  })
}

export function useUpdateMenuSettings(menuKey: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (settings: Partial<MenuSettings>) => {
      await http.put(`/api/admin/menus/${menuKey}/settings`, settings)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: MENUS_KEY })
      qc.invalidateQueries({ queryKey: MENU_KEY(menuKey) })
      toast.success('Menu settings saved')
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to save menu settings')
    },
  })
}

export function useResetMenu(menuKey: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      await http.post(`/api/admin/menus/${menuKey}/reset`)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: MENUS_KEY })
      qc.invalidateQueries({ queryKey: MENU_KEY(menuKey) })
      toast.success('Menu reset to defaults')
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to reset menu')
    },
  })
}
