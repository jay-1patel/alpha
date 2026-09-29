'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Search, Plus, Pencil, Trash2, Upload, Package, FileText, Sparkles, IndianRupee, ImageIcon, X, Eye, Layers } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import {
  useProducts,
  useCatalogues,
  useSaveProduct,
  useDeleteProduct,
  useDeleteCatalogue,
  ProductVariant,
} from '@/lib/hooks/useProducts'
import { useUploadFile } from '@/lib/hooks/useFiles'
import { PublishStatusBar } from '@/components/dynamic-config/publish-status-bar'
import { useDynamicConfig, useBuildDraft, usePublishConfig } from '@/lib/hooks/useDynamicConfig'

interface Product {
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

interface CatalogueFile {
  id: string
  fileName: string
  fileUrl: string
  type: string
  uploadedAt: string
}

const emptyProduct = { name: '', description: '', price: '', MRP: '', moq: '', category: '', status: 'active' }
const emptyVariant = { label: '', price: '', sku: '' }

interface ProductPermissions {
  view_products?: boolean
  edit_delete_products?: boolean
  catalogue_new_arrival?: boolean
  delete_files?: boolean
  view_files?: boolean
  manage_operations?: boolean
}

interface ProductsTabProps {
  permissions?: ProductPermissions
}

export default function ProductsTab({ permissions = {} }: ProductsTabProps) {
  const canViewProducts = permissions.view_products === true
  const canEditProducts = permissions.edit_delete_products === true
  const canManageCatalogue = permissions.catalogue_new_arrival === true
  const canViewFiles = permissions.view_files === true
  const canDeleteFiles = permissions.delete_files === true
  const canPublish = permissions.manage_operations === true && canEditProducts

  const { data: products = [] } = useProducts(canViewProducts)
  const { data: catalogues = [] } = useCatalogues(canViewFiles)
  const { data: config, refetch: refetchConfig } = useDynamicConfig('products', canPublish)
  const buildDraft = useBuildDraft('products')
  const publishConfig = usePublishConfig('products')

  const [search, setSearch] = useState('')
  const [editProduct, setEditProduct] = useState<(Product & { _isNew?: boolean }) | null>(null)
  const [formData, setFormData] = useState(emptyProduct)
  const [variants, setVariants] = useState<ProductVariant[]>([])
  const [saving, setSaving] = useState(false)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [selectedImage, setSelectedImage] = useState<File | null>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const catalogueInputRef = useRef<HTMLInputElement>(null)
  const arrivalInputRef = useRef<HTMLInputElement>(null)

  const saveProduct = useSaveProduct()
  const deleteProduct = useDeleteProduct()
  const deleteCatalogue = useDeleteCatalogue()
  const uploadFile = useUploadFile()

  const filtered = products.filter(p => p.name.toLowerCase().includes(search.toLowerCase()) || p.category.toLowerCase().includes(search.toLowerCase()))

  const openNewProduct = () => {
    setFormData(emptyProduct)
    setVariants([])
    setImagePreview(null)
    setSelectedImage(null)
    setEditProduct({ id: '', name: '', description: '', price: null, MRP: null, moq: null, category: '', status: 'active', imageUrl: null, variants: [], createdAt: '', updatedAt: '', _isNew: true })
  }

  const openEditProduct = (product: Product) => {
    setFormData({
      name: product.name,
      description: product.description,
      price: product.price?.toString() || '',
      MRP: product.MRP?.toString() || '',
      moq: product.moq?.toString() || '',
      category: product.category,
      status: product.status,
    })
    setVariants(product.variants?.map(v => ({ label: v.label || '', price: v.price?.toString() || '', sku: v.sku || '' })) || [])
    setImagePreview(product.imageUrl)
    setSelectedImage(null)
    setEditProduct(product)
  }

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setSelectedImage(file)
    const reader = new FileReader()
    reader.onload = () => setImagePreview(reader.result as string)
    reader.readAsDataURL(file)
  }

  const removeImage = () => {
    setImagePreview(null)
    setSelectedImage(null)
    if (imageInputRef.current) imageInputRef.current.value = ''
  }

  const addVariant = () => setVariants(v => [...v, { ...emptyVariant }])
  const removeVariant = (idx: number) => setVariants(v => v.filter((_, i) => i !== idx))
  const updateVariant = (idx: number, field: keyof ProductVariant, value: string) => {
    setVariants(v => v.map((variant, i) => i === idx ? { ...variant, [field]: value } : variant))
  }

  const cleanVariants = (): ProductVariant[] =>
    variants
      .filter(v => v.label.trim() || v.price.trim() || v.sku.trim())
      .map(v => ({ label: v.label.trim(), price: v.price.trim(), sku: v.sku.trim() }))

  const handleSaveProduct = async () => {
    if (!formData.name.trim()) { toast.error('Product name is required'); return }
    setSaving(true)
    try {
      let imageUrl: string | undefined
      if (selectedImage) {
        const imgRes = await api.uploadImage(selectedImage)
        imageUrl = imgRes.url
      }
      saveProduct.mutate(
        {
          id: editProduct?._isNew ? null : editProduct?.id ?? null,
          name: formData.name,
          category: formData.category || 'general',
          description: formData.description,
          price: formData.price || '',
          mrp: formData.MRP || '',
          moq: formData.moq || '',
          imageUrl,
          status: formData.status,
          variants: cleanVariants(),
        },
        {
          onSuccess: () => {
            setEditProduct(null)
            setSaving(false)
            if (canPublish) {
              buildDraft.mutate()
            }
          },
          onError: (err: any) => {
            toast.error(err.message || 'Save failed')
            setSaving(false)
          },
        }
      )
    } catch (err: any) {
      toast.error(err.message || 'Save failed')
      setSaving(false)
    }
  }

  const handleDeleteProduct = async (id: string) => {
    deleteProduct.mutate(id, {
      onSuccess: () => {
        if (canPublish) buildDraft.mutate()
      },
    })
  }

  const handlePublish = () => {
    publishConfig.mutate()
  }

  const handleCatalogueUpload = async (type: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return
    const module = type === 'new_arrival' ? 'new_arrival' : 'catalogue'
    try {
      for (const file of Array.from(files)) {
        await uploadFile.mutateAsync({ file, module })
      }
      toast.success(`${files.length} file(s) uploaded`)
    } catch (err: any) {
      toast.error(err.message || 'Upload failed')
    } finally {
      if (e.target) e.target.value = ''
    }
  }

  const handleDeleteCatalogue = async (fileName: string, type: string) => {
    deleteCatalogue.mutate(fileName)
  }

  return (
    <div className="space-y-6">
      {/* Products Section */}
      {canViewProducts && (
        <Card className="shadow-lg border-border/60">
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="h-14 w-14 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/25 shrink-0">
                  <Package className="h-7 w-7 text-white" />
                </div>
                <div>
                  <CardTitle className="text-xl">Products &amp; Catalogue</CardTitle>
                  <CardDescription className="text-base">Manage your product listings and catalogue documents</CardDescription>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                  <Input placeholder="Search products..." className="pl-10 w-[220px] h-10" value={search} onChange={(e) => setSearch(e.target.value)} />
                </div>
                {canEditProducts && (
                  <Button onClick={openNewProduct} className="bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-700 hover:to-blue-700 text-white shadow-md shadow-blue-500/20 h-10">
                    <Plus className="h-5 w-5 mr-2" />
                    Add Product
                  </Button>
                )}
              </div>
            </div>
            {canPublish && (
              <div className="mt-4">
                <PublishStatusBar
                  hasDraft={config?.has_draft || false}
                  lastPublishedAt={config?.published?.generated_at || config?.published?.published_at}
                  isPublishing={publishConfig.isPending}
                  onPublish={handlePublish}
                />
              </div>
            )}
          </CardHeader>
          <CardContent>
            {filtered.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <div className="h-16 w-16 mx-auto mb-4 rounded-full bg-muted/50 flex items-center justify-center">
                  <Package className="h-8 w-8 opacity-40" />
                </div>
                <p className="text-lg">No products found.</p>
                <p className="text-sm mt-1">Add your first product to get started</p>
              </div>
            ) : (
              <div className="max-h-[500px] overflow-y-auto rounded-lg border">
                <div className="rounded-xl border shadow-sm overflow-hidden">
                  <Table>
                    <TableHeader className="bg-muted/40">
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="text-sm font-semibold uppercase tracking-wide text-muted-foreground py-4">Product</TableHead>
                        <TableHead className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Category</TableHead>
                        <TableHead className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Price</TableHead>
                        <TableHead className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">MRP</TableHead>
                        <TableHead className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">MOQ</TableHead>
                        <TableHead className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Variants</TableHead>
                        <TableHead className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Image</TableHead>
                        <TableHead className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Status</TableHead>
                        <TableHead className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Updated</TableHead>
                        {canEditProducts && (
                          <TableHead className="text-right text-sm font-semibold uppercase tracking-wide text-muted-foreground">Actions</TableHead>
                        )}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.map((product, idx) => (
                        <TableRow
                          key={product.id}
                          className={`transition-colors hover:bg-muted/40 ${idx % 2 === 0 ? 'bg-background' : 'bg-muted/10'}`}
                        >
                          <TableCell className="py-3">
                            <div>
                              <p className="font-semibold text-base text-foreground">{product.name}</p>
                              <p className="text-sm text-muted-foreground max-w-[240px] truncate">{product.description}</p>
                            </div>
                          </TableCell>

                          <TableCell>
                            <Badge variant="outline" className="text-xs font-medium rounded-full px-2.5 py-0.5 border-muted-foreground/30">
                              {product.category || '—'}
                            </Badge>
                          </TableCell>

                          <TableCell className="font-semibold text-base text-foreground">
                            {product.price ? (
                              <span className="flex items-center gap-0.5">
                                <IndianRupee className="h-3.5 w-3.5" />{product.price}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>

                          <TableCell className="text-base">
                            {product.MRP ? (
                              <span className="flex items-center gap-0.5 text-muted-foreground line-through decoration-1">
                                <IndianRupee className="h-3.5 w-3.5" />{product.MRP}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>

                          <TableCell>
                            {product.moq ? (
                              <Badge variant="secondary" className="font-mono text-sm rounded-md">
                                {product.moq} units
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground text-sm">—</span>
                            )}
                          </TableCell>

                          <TableCell>
                            {product.variants?.length ? (
                              <Badge variant="outline" className="gap-1">
                                <Layers className="h-3 w-3" />
                                {product.variants.length}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground text-sm">—</span>
                            )}
                          </TableCell>

                          <TableCell>
                            {product.imageUrl ? (
                              <div className="h-12 w-12 rounded-lg overflow-hidden border shadow-sm ring-1 ring-black/5 bg-muted">
                                <img
                                  src={product.imageUrl}
                                  alt={product.name}
                                  className="h-full w-full object-cover transition-transform hover:scale-110"
                                />
                              </div>
                            ) : (
                              <div className="h-12 w-12 rounded-lg border border-dashed flex items-center justify-center text-muted-foreground bg-muted/30">
                                <ImageIcon className="h-5 w-5" />
                              </div>
                            )}
                          </TableCell>

                          <TableCell>
                            <span
                              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${product.status === 'active'
                                  ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400'
                                  : 'bg-muted text-muted-foreground'
                                }`}
                            >
                              <span
                                className={`h-1.5 w-1.5 rounded-full ${product.status === 'active' ? 'bg-emerald-500' : 'bg-muted-foreground/50'
                                  }`}
                              />
                              {product.status}
                            </span>
                          </TableCell>

                          <TableCell className="text-sm text-muted-foreground">
                            {new Date(product.updatedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </TableCell>

                          {canEditProducts && (
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-500/10"
                                  onClick={() => openEditProduct(product)}
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Delete Product</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        Are you sure you want to delete &quot;{product.name}&quot;? This action cannot be undone.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                                      <AlertDialogAction onClick={() => handleDeleteProduct(product.id)}>
                                        Delete
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              </div>
                            </TableCell>
                          )}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Catalogue & New Arrivals Section */}
      {(canManageCatalogue || canViewProducts) && (
        <Card className="shadow-lg border-border/60">
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="h-14 w-14 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg shadow-amber-500/25 shrink-0">
                  <FileText className="h-7 w-7 text-white" />
                </div>
                <div>
                  <CardTitle className="text-xl">Catalogue &amp; New Arrivals</CardTitle>
                  <CardDescription className="text-base">Upload and manage product catalogues and new arrival documents</CardDescription>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {canManageCatalogue && (
                  <>
                    <input ref={arrivalInputRef} type="file" accept=".pdf" multiple className="hidden" onChange={(e) => handleCatalogueUpload('new_arrival', e)} />
                    <Button variant="outline" className="h-10" onClick={() => arrivalInputRef.current?.click()}>
                      <Sparkles className="h-5 w-5 mr-2" />New Arrival
                    </Button>
                    <input ref={catalogueInputRef} type="file" accept=".pdf" multiple className="hidden" onChange={(e) => handleCatalogueUpload('catalogue', e)} />
                    <Button className="h-10" onClick={() => catalogueInputRef.current?.click()}>
                      <Upload className="h-5 w-5 mr-2" />Upload Catalogue
                    </Button>
                  </>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {catalogues.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <div className="h-16 w-16 mx-auto mb-4 rounded-full bg-muted/50 flex items-center justify-center">
                  <FileText className="h-8 w-8 opacity-40" />
                </div>
                <p className="text-lg">No catalogues uploaded yet.</p>
                <p className="text-sm mt-1">Upload PDF catalogues to get started</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[300px] overflow-y-auto">
                {catalogues.map((cat) => (
                  <div key={cat.id} className="flex items-center justify-between p-4 rounded-xl border bg-gradient-to-r from-muted/30 to-muted/10 hover:from-muted/50 hover:to-muted/20 transition-all">
                    <div className="flex items-center gap-4">
                      <div className={cn('h-12 w-12 rounded-xl flex items-center justify-center', cat.type === 'catalogue' ? 'bg-blue-500/10' : 'bg-amber-500/10')}>
                        {cat.type === 'catalogue' ? <FileText className="h-6 w-6 text-blue-600" /> : <Sparkles className="h-6 w-6 text-amber-600" />}
                      </div>
                      <div>
                        <p className="text-base font-medium">{cat.fileName}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant={cat.type === 'catalogue' ? 'secondary' : 'default'} className={cat.type === 'new_arrival' ? 'bg-amber-500 hover:bg-amber-600' : ''}>
                            {cat.type === 'catalogue' ? 'Catalogue' : 'New Arrival'}
                          </Badge>
                          <span className="text-sm text-muted-foreground">{new Date(cat.uploadedAt).toLocaleDateString()}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-9 w-9">
                            <Eye className="h-4 w-4" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-3xl">
                          <DialogHeader>
                            <DialogTitle>File Preview</DialogTitle>
                            <DialogDescription>{cat.fileName}</DialogDescription>
                          </DialogHeader>
                          <div className="space-y-3">
                            <div className="grid grid-cols-2 gap-3 text-sm">
                              <div><span className="text-muted-foreground">Type:</span> <Badge variant={cat.type === 'catalogue' ? 'secondary' : 'default'} className={cat.type === 'new_arrival' ? 'bg-amber-500 hover:bg-amber-600' : ''}>{cat.type === 'catalogue' ? 'Catalogue' : 'New Arrival'}</Badge></div>
                              <div><span className="text-muted-foreground">Uploaded:</span> {new Date(cat.uploadedAt).toLocaleString()}</div>
                            </div>
                            <iframe
                              src={api.filePreviewUrl(cat.fileName)}
                              title={cat.fileName}
                              className="w-full h-[60vh] rounded-lg border bg-muted/30"
                            />
                            <div className="flex justify-end">
                              <Button variant="outline" size="sm" asChild>
                                <a href={api.fileDownloadUrl(cat.fileName)} target="_blank" rel="noopener noreferrer">
                                  Download
                                </a>
                              </Button>
                            </div>
                          </div>
                        </DialogContent>
                      </Dialog>
                      {canDeleteFiles && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-9 w-9 text-destructive hover:text-destructive">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Document</AlertDialogTitle>
                              <AlertDialogDescription>Are you sure you want to delete &quot;{cat.fileName}&quot;?</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDeleteCatalogue(cat.fileName, cat.type)}>Delete</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Product Add/Edit Dialog */}
      <Dialog open={!!editProduct} onOpenChange={(open) => { if (!open) { setEditProduct(null); setImagePreview(null); setSelectedImage(null); setVariants([]) } }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl">{editProduct?._isNew ? 'Add New Product' : 'Edit Product'}</DialogTitle>
            <DialogDescription className="text-base">
              {editProduct?._isNew ? 'Fill in the product details below.' : 'Update the product information.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-base">Product Name *</Label>
              <Input placeholder="e.g. Classic Peanut Chikki" value={formData.name} onChange={(e) => setFormData(f => ({ ...f, name: e.target.value }))} className="h-10" />
            </div>
            <div className="space-y-2">
              <Label className="text-base">Description</Label>
              <Textarea placeholder="Product description..." value={formData.description} onChange={(e) => setFormData(f => ({ ...f, description: e.target.value }))} rows={3} className="text-base" />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label className="text-base">Price (INR)</Label>
                <Input type="number" placeholder="0.00" value={formData.price} onChange={(e) => setFormData(f => ({ ...f, price: e.target.value }))} className="h-10" />
              </div>
              <div className="space-y-2">
                <Label className="text-base">MRP (INR)</Label>
                <Input type="number" placeholder="0.00" value={formData.MRP} onChange={(e) => setFormData(f => ({ ...f, MRP: e.target.value }))} className="h-10" />
              </div>
              <div className="space-y-2">
                <Label className="text-base">MOQ (units)</Label>
                <Input type="number" placeholder="e.g. 50" value={formData.moq} onChange={(e) => setFormData(f => ({ ...f, moq: e.target.value }))} className="h-10" />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-base">Category</Label>
              <Input placeholder="e.g. Chikki" value={formData.category} onChange={(e) => setFormData(f => ({ ...f, category: e.target.value }))} className="h-10" />
            </div>
            <div className="space-y-2">
              <Label className="text-base">Status</Label>
              <Select value={formData.status} onValueChange={(v) => setFormData(f => ({ ...f, status: v }))}>
                <SelectTrigger className="w-full h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-base">Variants</Label>
                <Button type="button" variant="outline" size="sm" onClick={addVariant}>
                  <Plus className="h-4 w-4 mr-1" /> Add variant
                </Button>
              </div>
              <div className="space-y-2">
                {variants.map((variant, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                    <Input
                      placeholder="Label e.g. 500g"
                      value={variant.label}
                      onChange={(e) => updateVariant(idx, 'label', e.target.value)}
                      className="col-span-5 h-9"
                    />
                    <Input
                      type="number"
                      placeholder="Price"
                      value={variant.price}
                      onChange={(e) => updateVariant(idx, 'price', e.target.value)}
                      className="col-span-3 h-9"
                    />
                    <Input
                      placeholder="SKU"
                      value={variant.sku}
                      onChange={(e) => updateVariant(idx, 'sku', e.target.value)}
                      className="col-span-3 h-9"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="col-span-1 h-9 w-9 text-destructive hover:bg-destructive/10"
                      onClick={() => removeVariant(idx)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                {variants.length === 0 && (
                  <p className="text-sm text-muted-foreground">No variants added. Use variants for size/weight options.</p>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-base">Product Image</Label>
              <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageSelect} />
              {imagePreview ? (
                <div className="relative group">
                  <div className="h-40 w-full rounded-lg overflow-hidden border bg-muted">
                    <img src={imagePreview} alt="Preview" className="h-full w-full object-contain" />
                  </div>
                  <Button variant="destructive" size="icon" className="absolute top-2 right-2 h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity" onClick={removeImage}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <button type="button" onClick={() => imageInputRef.current?.click()} className="flex flex-col items-center justify-center h-40 w-full rounded-lg border-2 border-dashed border-muted-foreground/25 hover:border-muted-foreground/50 hover:bg-muted/30 transition-colors cursor-pointer">
                  <Upload className="h-10 w-10 text-muted-foreground/50 mb-2" />
                  <span className="text-base text-muted-foreground">Click to upload image</span>
                  <span className="text-sm text-muted-foreground/60 mt-1">PNG, JPG, WEBP</span>
                </button>
              )}
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" className="h-10">Cancel</Button>
            </DialogClose>
            <Button onClick={handleSaveProduct} disabled={saving} className="h-10">
              {saving ? 'Saving...' : editProduct?._isNew ? 'Create Product' : 'Update Product'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
