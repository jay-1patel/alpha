/**
 * Tenant file uploads — FAQ / knowledge-base / brochure / new-release files.
 *
 * Uploads go up as base64 JSON (the backend already accepts that shape), which
 * keeps the single `api` wrapper as the only transport. Preview and download
 * need the bearer token, so they fetch a blob and hand back an object URL
 * rather than relying on a bare `<a href>` (which would be unauthenticated).
 */

import { api, getToken } from './api'

const base = (tenantId: string) => `/api/admin/tenants/${encodeURIComponent(tenantId)}`

export interface AdminFile {
  id: number
  name: string
  ext: string | null
  module: string
  size: number
  doc_id: number | null
  file_path: string | null
  url: string | null
  tenant_id: string | null
  created_at: string
}

export const FILE_MODULES = [
  { value: 'faq', label: 'FAQ', permission: 'upload_faq' },
  { value: 'kb', label: 'Knowledge base', permission: 'upload_kb' },
  { value: 'catalogue', label: 'Brochure', permission: 'upload_faq' },
  { value: 'new_arrival', label: 'New releases', permission: 'upload_faq' },
] as const

export function readAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(reader.error ?? new Error('Could not read the file'))
    reader.onload = () => {
      const result = String(reader.result ?? '')
      const comma = result.indexOf(',')
      resolve(comma >= 0 ? result.slice(comma + 1) : result)
    }
    reader.readAsDataURL(file)
  })
}

export const uploadsApi = {
  list: (tenantId: string, opts: { module?: string; search?: string } = {}, signal?: AbortSignal) => {
    const params = new URLSearchParams()
    if (opts.module) params.set('module', opts.module)
    if (opts.search) params.set('search', opts.search)
    const query = params.toString()
    return api
      .get<{ files: AdminFile[] }>(`${base(tenantId)}/files${query ? `?${query}` : ''}`, signal)
      .then((r) => r.files)
  },

  upload: async (tenantId: string, file: File, module: string) => {
    const content = await readAsBase64(file)
    return api.post<{ status: string; filename: string; chunks: number; size: number; file_url: string }>(
      `${base(tenantId)}/files/upload?module=${encodeURIComponent(module)}`,
      { filename: file.name, content, media_type: file.type || undefined },
    )
  },

  remove: (tenantId: string, filename: string) =>
    api.del<{ status: string; deleted_faq: number; deleted_kb: number }>(
      `${base(tenantId)}/files/${encodeURIComponent(filename)}`,
    ),

  /** Fetch the raw file with the bearer token; caller revokes the object URL. */
  blob: async (tenantId: string, filename: string, download = false): Promise<Blob> => {
    const token = getToken()
    const path = `${base(tenantId)}/files/${encodeURIComponent(filename)}/${download ? 'download' : 'preview'}`
    const res = await fetch(path, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    })
    if (!res.ok) throw new Error(`Could not fetch the file (${res.status})`)
    return res.blob()
  },
}

export function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

export function openBlob(blob: Blob) {
  const url = URL.createObjectURL(blob)
  window.open(url, '_blank', 'noopener')
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

export function formatBytes(bytes: number): string {
  if (!bytes) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const exp = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  const value = bytes / 1024 ** exp
  return `${value.toFixed(value >= 10 || exp === 0 ? 0 : 1)} ${units[exp]}`
}
