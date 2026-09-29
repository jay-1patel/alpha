import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'

import { http } from '@/lib/http'

export interface Product {
  id: string
  name: string
  slug?: string
  description: string
  short_description?: string
  price: number | null
  MRP: number | null
  moq: number | null
  stock_quantity: number | null
  unit?: string
  category: string
  tags?: string[]
  sort_order?: number | null
  lead_time_days?: number | null
  variants?: Variant[]
  bulk_discount_tiers?: BulkDiscountTier[]
  imageUrl: string | null
  status: 'active' | 'inactive'
  createdAt: string
  updatedAt: string
}

export interface Variant {
  label?: string
  price?: number | string
  sku?: string
}

export interface BulkDiscountTier {
  min_qty?: number | string
  discount_pct?: number | string
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
    slug: p.slug || '',
    description: p.description || '',
    short_description: p.short_description || '',
    price: p.price ? parseFloat(p.price) : null,
    MRP: p.mrp ? parseFloat(p.mrp) : null,
    moq: p.moq ? parseInt(p.moq) : null,
    stock_quantity: p.stock_quantity != null && p.stock_quantity !== ''
      ? parseInt(p.stock_quantity)
      : null,
    unit: p.unit || '',
    category: p.category || '',
    tags: Array.isArray(p.tags) ? p.tags : [],
    sort_order: p.sort_order != null ? parseInt(p.sort_order) : null,
    lead_time_days: p.lead_time_days != null ? parseInt(p.lead_time_days) : null,
    variants: Array.isArray(p.variants_json)
      ? p.variants_json.map((v: any) => ({
          label: v.label ?? '',
          price: v.price ?? '',
          sku: v.sku ?? '',
        }))
      : [],
    bulk_discount_tiers: Array.isArray(p.bulk_discount_tiers)
      ? p.bulk_discount_tiers.map((t: any) => ({
          min_qty: t.min_qty ?? t.qty ?? '',
          discount_pct: t.discount_pct ?? t.discount ?? '',
        }))
      : [],
    imageUrl: p.media_url || null,
    status: p.is_active ? 'active' : 'inactive',
    createdAt: p.created_at || '',
    updatedAt: p.updated_at || p.created_at || '',
  }
}

export function useProducts(enabled = true) {
  return useQuery<Product[]>({
    queryKey: PRODUCTS_KEY,
    enabled,
    queryFn: async ({ signal }) => {
      const res = await http.get('/api/admin/products', { signal })
      return (res.data?.products ?? []).map(mapProduct)
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
  short_description?: string
  price: string
  mrp: string
  moq: string
  stock_quantity?: string
  unit?: string
  tags?: string
  sort_order?: string
  lead_time_days?: string
  variants_json?: string
  bulk_discount_tiers?: string
  imageUrl?: string | null
}

function buildProductForm(payload: ProductPayload): FormData {
  const form = new FormData()
  form.append('name', payload.name)
  form.append('category', payload.category)
  form.append('description', payload.description)
  if (payload.short_description) form.append('short_description', payload.short_description)
  form.append('price', payload.price)
  form.append('mrp', payload.mrp)
  form.append('moq', payload.moq)
  if (payload.stock_quantity) form.append('stock_quantity', payload.stock_quantity)
  if (payload.unit) form.append('unit', payload.unit)
  if (payload.tags) form.append('tags', payload.tags)
  if (payload.sort_order) form.append('sort_order', payload.sort_order)
  if (payload.lead_time_days) form.append('lead_time_days', payload.lead_time_days)
  if (payload.variants_json) form.append('variants_json', payload.variants_json)
  if (payload.bulk_discount_tiers) form.append('bulk_discount_tiers', payload.bulk_discount_tiers)
  if (payload.imageUrl) form.append('media_url', payload.imageUrl)
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
    onSuccess: (_data, id) => {
      qc.setQueryData<Product[]>(PRODUCTS_KEY, (prev) =>
        (prev ?? []).filter((p) => p.id !== id)
      )
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
