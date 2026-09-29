import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'

import { http } from '@/lib/http'

export interface AdminFile {
  name: string
  module?: string
  size?: number
  uploaded_at?: string
}

export function useAdminFiles(module?: string, search?: string) {
  return useQuery<AdminFile[]>({
    queryKey: ['admin-files', module ?? 'all', search ?? ''],
    queryFn: async ({ signal }) => {
      const res = await http.get('/api/admin/files', {
        params: { module, search },
        signal,
      })
      return res.data?.files ?? res.data ?? []
    },
    staleTime: 30_000,
  })
}

/**
 * List of PDF files available as campaign document attachments,
 * combining the catalogue and new-arrival modules.
 */
export function useCampaignDocuments() {
  const catalogue = useAdminFiles('catalogue')
  const newArrival = useAdminFiles('new_arrival')

  const files = [
    ...(catalogue.data ?? []),
    ...(newArrival.data ?? []),
  ]

  // De-duplicate by name, keep PDFs first, fall back to any file.
  const seen = new Set<string>()
  const pdfs: string[] = []
  const others: string[] = []

  for (const f of files) {
    if (!f?.name || seen.has(f.name)) continue
    seen.add(f.name)
    const lower = f.name.toLowerCase()
    if (lower.endsWith('.pdf')) pdfs.push(f.name)
    else others.push(f.name)
  }

  const documents = [...pdfs, ...others]
  const loading = catalogue.isLoading || newArrival.isLoading
  const error = catalogue.error || newArrival.error

  return { documents, loading, error }
}

/* ------------------------------------------------------------------ */
/* KNOWLEDGE / FAQ FILES (Files tab)                                  */
/* ------------------------------------------------------------------ */

export interface KnowledgeFile {
  id: string
  fileName: string
  fileUrl: string
  module: string
  fileSize: number | null
  status: 'processed' | 'uploaded'
  uploadedAt: string
  isExternal: boolean
  showUrl: string
}

export function useKnowledgeFiles(enabled = true) {
  return useQuery<KnowledgeFile[]>({
    queryKey: ['knowledge-files'],
    enabled,
    queryFn: async ({ signal }) => {
      const res = await http.get('/api/admin/files', { signal })
      return (res.data?.files ?? []).map((f: any): KnowledgeFile => {
        const rawPath = f.file_path || ''
        const normalizedPath = rawPath
          .replace(/^.*?uploaded_files[\\/]/, '')
          .replace(/\\/g, '/')
        const baseUrl =
          `/uploaded_files/${normalizedPath}` || `/uploaded_files/${f.name}`
        const fileUrl = f.url || baseUrl
        const isExternal = /^https?:\/\//.test(fileUrl)

        return {
          id: String(f.id ?? f.name),
          fileName: f.name,
          fileUrl,
          module: f.module || 'kb',
          fileSize: f.size || null,
          status: f.doc_id ? 'processed' : 'uploaded',
          uploadedAt: f.created_at || new Date().toISOString(),
          isExternal,
          showUrl: f.url ? fileUrl : '-',
        }
      })
    },
    staleTime: 15_000,
  })
}

interface UploadFileInput {
  file: File
  module: string
  url?: string
  mediaType?: string
}

export function useUploadFile() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async ({ file, module, url, mediaType }: UploadFileInput) => {
      const form = new FormData()
      form.append('file', file)
      if (url) form.append('url', url)
      if (mediaType) form.append('media_type', mediaType)
      const res = await http.post(
        `/api/admin/files/upload?module=${encodeURIComponent(module)}`,
        form
      )
      return res.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['knowledge-files'] })
      qc.invalidateQueries({ queryKey: ['admin-files'] })
      qc.invalidateQueries({ queryKey: ['catalogues'] })
      toast.success('File uploaded')
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to upload file')
    },
  })
}

export function useDeleteFile() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (fileName: string) => {
      const res = await http.delete(`/api/admin/files/${encodeURIComponent(fileName)}`)
      return res.data
    },
    onSuccess: (_data, fileName) => {
      qc.setQueryData<KnowledgeFile[]>(['knowledge-files'], (prev) =>
        (prev ?? []).filter((f) => f.fileName !== fileName)
      )
      qc.invalidateQueries({ queryKey: ['admin-files'] })
      qc.invalidateQueries({ queryKey: ['catalogues'] })
      toast.success('File deleted')
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to delete file')
    },
  })
}
