import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'

import { http } from '@/lib/http'

export interface Admin {
  username: string
  role: string
  email?: string | null
  permissions?: Record<string, boolean>
}

const KEY = ['admins']

export function useAdmins() {
  return useQuery<Admin[]>({
    queryKey: KEY,
    queryFn: async ({ signal }) => {
      const res = await http.get('/api/auth/admins', { signal })
      return res.data?.admins ?? res.data ?? []
    },
    staleTime: 15_000,
  })
}

interface CreateAdminPayload {
  username: string
  password: string
  role?: string
  permissions?: Record<string, boolean>
  email?: string
}

export function useCreateAdmin() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: CreateAdminPayload) => {
      const res = await http.post('/api/auth/create', payload)
      return res.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY })
      toast.success('Admin created')
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to create admin')
    },
  })
}

export function useUpdateAdmin() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      username,
      data,
    }: {
      username: string
      data: { role?: string; permissions?: Record<string, boolean>; email?: string }
    }) => {
      const res = await http.patch(`/api/auth/admins/${encodeURIComponent(username)}`, data)
      return res.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY })
      toast.success('Admin updated')
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to update admin')
    },
  })
}

export function useDeleteAdmin() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (username: string) => {
      const res = await http.delete(`/api/auth/admins/${encodeURIComponent(username)}`)
      return res.data
    },
    onSuccess: (_data, username) => {
      qc.setQueryData<Admin[]>(KEY, (prev) =>
        (prev ?? []).filter((a) => a.username !== username)
      )
      toast.success('Admin deleted')
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to delete admin')
    },
  })
}

/**
 * Reset a sub-admin's password. Requires the manage_admins permission.
 */
export function useResetAdminPassword() {
  return useMutation({
    mutationFn: async ({
      username,
      newPassword,
    }: {
      username: string
      newPassword: string
    }) => {
      const res = await http.post(
        `/api/auth/admins/${encodeURIComponent(username)}/reset-password`,
        { new_password: newPassword }
      )
      return res.data
    },
    onSuccess: () => {
      toast.success('Password reset')
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to reset password')
    },
  })
}
