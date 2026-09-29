import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'

import { http } from '@/lib/http'

export interface ProductVariant {
  label: string
  price?: string
  sku?: string
}

export interface Product {
  id: string
  name: string
  description: string
  price: number | null
  MRP: number | null
  moq: number | null
  category: string
  imageUrl: string | null
  status: string
  variants: ProductVariant[]
  createdAt: string
  updatedAt: string
}

export interface CatalogueFile {
  id: string
  fileName: string
  fileUrl: string
  type: 'catalogue' | 'new_arrival'
  uploadedAt: string
}

const PRODUCTS_KEY = ['products', 'list']
const CATALOGUES_KEY = ['catalogues']

function mapProduct(p: any): Product {
  return {
    id: String(p.id),
    name: p.name,
    description: p.description || '',
    price: p.price ? parseFloat(p.price) : null,
    MRP: p.mrp ? parseFloat(p.mrp) : null,
    moq: p.moq ? parseInt(p.moq) : null,
    category: p.category || '',
    imageUrl: p.media_url || null,
    status: p.is_active ? 'active' : 'inactive',
    variants: Array.isArray(p.variants_json) ? p.variants_json : [],
    createdAt: p.created_at || '',
    updatedAt: p.updated_at || p.created_at || '',
  }
}

export function useProducts(enabled = true) {
  return useQuery<Product[]>({
    queryKey: PRODUCTS_KEY,
    enabled,
    queryFn: async ({ signal }) => {
      const res = await http.get('/catalog/products/list', { signal })
      return (res.data?.items ?? []).map(mapProduct)
    },
    staleTime: 30_000,
  })
}

export function useCatalogues(enabled = true) {
  return useQuery<CatalogueFile[]>({
    queryKey: CATALOGUES_KEY,
    enabled,
    queryFn: async ({ signal }) => {
      const [catRes, newArrRes] = await Promise.all([
        http.get('/api/admin/files', { params: { module: 'catalogue' }, signal }),
        http.get('/api/admin/files', { params: { module: 'new_arrival' }, signal }),
      ])

      const toCatalogue = (f: any, type: 'catalogue' | 'new_arrival'): CatalogueFile => ({
        id: String(f.id ?? f.name),
        fileName: f.name,
        fileUrl: `/api/admin/files/${encodeURIComponent(f.name)}/preview`,
        type,
        uploadedAt: f.created_at || '',
      })

      return [
        ...(newArrRes.data?.files ?? []).map((f: any) => toCatalogue(f, 'new_arrival')),
        ...(catRes.data?.files ?? []).map((f: any) => toCatalogue(f, 'catalogue')),
      ]
    },
    staleTime: 30_000,
  })
}

interface ProductPayload {
  id?: string | null
  name: string
  category: string
  description: string
  price: string
  mrp: string
  moq: string
  imageUrl?: string | null
  status: string
  variants: ProductVariant[]
}

function appendIfValue(form: FormData, key: string, value: string | null | undefined) {
  if (value !== undefined && value !== null) {
    form.append(key, value)
  }
}

function buildProductForm(payload: ProductPayload): FormData {
  const form = new FormData()
  form.append('name', payload.name)
  form.append('category', payload.category || 'general')
  form.append('description', payload.description)
  form.append('price', payload.price)
  form.append('mrp', payload.mrp)
  form.append('moq', payload.moq)
  form.append('is_active', payload.status === 'active' ? 'true' : 'false')
  form.append('variants_json', JSON.stringify(payload.variants || []))
  appendIfValue(form, 'media_url', payload.imageUrl)
  return form
}

export function useSaveProduct() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: ProductPayload) => {
      if (payload.id) {
        const res = await http.put(
          `/catalog/products/update/${payload.id}`,
          buildProductForm(payload)
        )
        return res.data
      }
      const res = await http.post('/catalog/products/add', buildProductForm(payload))
      return res.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: PRODUCTS_KEY })
      toast.success('Product saved')
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to save product')
    },
  })
}

export function useDeleteProduct() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await http.delete(`/catalog/products/delete/${id}?hard=true`)
      return res.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: PRODUCTS_KEY })
      toast.success('Product deleted')
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to delete product')
    },
  })
}

export function useDeleteCatalogue() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (fileName: string) => {
      const res = await http.delete(`/api/admin/files/${encodeURIComponent(fileName)}`)
      return res.data
    },
    onSuccess: (_data, fileName) => {
      qc.setQueryData<CatalogueFile[]>(CATALOGUES_KEY, (prev) =>
        (prev ?? []).filter((f) => f.fileName !== fileName)
      )
      toast.success('File deleted')
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to delete file')
    },
  })
}
