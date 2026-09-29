'use client'

import { useMemo, useState } from 'react'

import {
  Edit,
  ListTree,
  Loader2,
  Plus,
  Search,
  Trash2,
} from 'lucide-react'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

import type { MenuActionType, MenuItem } from '@/lib/types'
import {
  useCreateMenu,
  useDeleteMenu,
  useMenus,
  useUpdateMenu,
  parentOptions,
} from '@/lib/hooks/useMenus'

/* ------------------------------------------------------------------ */
/* PRESENTATION HELPERS                                                */
/* ------------------------------------------------------------------ */

const ACTION_STYLE: Record<string, string> = {
  text: 'bg-sky-50 text-sky-700 ring-sky-200',
  rag: 'bg-violet-50 text-violet-700 ring-violet-200',
  menu: 'bg-amber-50 text-amber-700 ring-amber-200',
}

function ActionBadge({ type }: { type: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1',
        ACTION_STYLE[type] ?? 'bg-slate-100 text-slate-600 ring-slate-200'
      )}
    >
      {type}
    </span>
  )
}

const EMPTY_FORM = {
  title: '',
  payload: '',
  action_type: 'text' as MenuActionType,
  action_data: '',
  parent_id: '' as string,
  menu_type: 'main',
  section: 'General',
  sort_order: 0,
}

type FormData = typeof EMPTY_FORM

/* ------------------------------------------------------------------ */
/* MENU FORM (create / edit dialog)                                    */
/* ------------------------------------------------------------------ */

function MenuForm({
  initial,
  menuItems,
  onClose,
}: {
  initial?: MenuItem | null
  menuItems: MenuItem[]
  onClose: () => void
}) {
  const [form, setForm] = useState<FormData>(() =>
    initial
      ? {
          title: initial.title,
          payload: initial.payload,
          action_type: initial.action_type,
          action_data: initial.action_data ?? '',
          parent_id: initial.parent_id ? String(initial.parent_id) : '',
          menu_type: initial.menu_type,
          section: initial.section ?? 'General',
          sort_order: initial.sort_order ?? 0,
        }
      : { ...EMPTY_FORM }
  )

  const create = useCreateMenu(onClose)
  const update = useUpdateMenu(onClose)
  const isEdit = !!initial?.id

  const set = (field: string, value: unknown) =>
    setForm((f) => ({ ...f, [field]: value }))

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.title.trim() || !form.payload.trim()) return

    const payloadObj = {
      title: form.title.trim(),
      payload: form.payload.trim(),
      action_type: form.action_type,
      action_data: form.action_data.trim(),
      parent_id: form.parent_id ? Number(form.parent_id) : null,
      menu_type: form.menu_type.trim() || 'main',
      section: form.section.trim() || 'General',
      sort_order: Number(form.sort_order) || 0,
    }

    if (isEdit) {
      update.mutate(payloadObj)
    } else {
      create.mutate(payloadObj)
    }
  }

  const parents = parentOptions(menuItems).filter(
    (m) => !isEdit || m.payload !== initial?.payload
  )

  const saving = create.isPending || update.isPending

  return (
    <form onSubmit={submit} className="grid gap-4">
      <div className="grid gap-2">
        <Label htmlFor="menu-title">Title</Label>
        <Input
          id="menu-title"
          value={form.title}
          maxLength={24}
          placeholder="e.g. Our Products"
          onChange={(e) => set('title', e.target.value)}
          required
        />
        <p className="text-xs text-muted-foreground">
          Max 24 characters (WhatsApp limit).
        </p>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="menu-payload">Payload / ID</Label>
        <Input
          id="menu-payload"
          value={form.payload}
          disabled={isEdit}
          placeholder="e.g. menu_001"
          onChange={(e) => set('payload', e.target.value)}
          required
        />
        <p className="text-xs text-muted-foreground">
          {isEdit
            ? 'Payload cannot be changed after creation.'
            : 'Unique identifier returned when the user taps this item.'}
        </p>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="menu-action-type">Action Type</Label>
        <Select
          value={form.action_type}
          onValueChange={(v) => set('action_type', v as MenuActionType)}
        >
          <SelectTrigger id="menu-action-type">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="text">Text — show a static message</SelectItem>
            <SelectItem value="rag">RAG — search knowledge base</SelectItem>
            <SelectItem value="menu">Menu — show sub-menu options</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="menu-action-data">
          {form.action_type === 'menu'
            ? 'Sub-menu parent (optional)'
            : 'Action Data'}
        </Label>
        {form.action_type === 'menu' ? (
          <Select
            value={form.parent_id}
            onValueChange={(v) => set('parent_id', v)}
          >
            <SelectTrigger id="menu-action-data">
              <SelectValue placeholder="None (top-level menu)" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">None (top-level menu)</SelectItem>
              {parents.map((m) => (
                <SelectItem key={m.id} value={String(m.id)}>
                  {m.title} ({m.payload})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <Textarea
            id="menu-action-data"
            value={form.action_data}
            placeholder={
              form.action_type === 'rag'
                ? 'Collection name or JSON config, e.g. products'
                : 'The text to display when this item is tapped'
            }
            onChange={(e) => set('action_data', e.target.value)}
          />
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-2">
          <Label htmlFor="menu-type">Menu Type</Label>
          <Select
            value={form.menu_type}
            onValueChange={(v) => set('menu_type', v)}
          >
            <SelectTrigger id="menu-type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="main">main</SelectItem>
              <SelectItem value="kb">kb</SelectItem>
              <SelectItem value="faq">faq</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="menu-section">Section</Label>
          <Input
            id="menu-section"
            value={form.section}
            placeholder="e.g. General"
            onChange={(e) => set('section', e.target.value)}
          />
        </div>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="menu-sort">Sort Order</Label>
        <Input
          id="menu-sort"
          type="number"
          value={form.sort_order}
          onChange={(e) => set('sort_order', e.target.value)}
        />
      </div>

      <DialogFooter>
        <Button
          type="button"
          variant="ghost"
          onClick={onClose}
          disabled={saving}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={saving}>
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {isEdit ? 'Save Changes' : 'Create Menu Item'}
        </Button>
      </DialogFooter>
    </form>
  )
}

/* ------------------------------------------------------------------ */
/* MAIN TAB                                                           */
/* ------------------------------------------------------------------ */

export default function MenuManagerTab() {
  const [q, setQ] = useState('')
  const [actionFilter, setActionFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<MenuItem | null>(null)
  const [deleting, setDeleting] = useState<MenuItem | null>(null)

  const { data, isLoading, isError } = useMenus()
  const deleteMenu = useDeleteMenu()

  const items = data?.menus ?? []

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase()
    return items.filter((m) => {
      if (actionFilter !== 'all' && m.action_type !== actionFilter) return false
      if (typeFilter !== 'all' && m.menu_type !== typeFilter) return false
      if (term) {
        const hay = `${m.title} ${m.payload} ${m.section ?? ''}`.toLowerCase()
        if (!hay.includes(term)) return false
      }
      return true
    })
  }, [items, q, actionFilter, typeFilter])

  const menuTypes = useMemo(
    () => Array.from(new Set(items.map((m) => m.menu_type))).sort(),
    [items]
  )

  const parentLabel = (m: MenuItem) => {
    if (!m.parent_id) return '—'
    const p = items.find((x) => x.id === m.parent_id)
    return p ? `${p.title} (${p.payload})` : `#${m.parent_id}`
  }

  const openCreate = () => {
    setEditing(null)
    setDialogOpen(true)
  }

  const openEdit = (m: MenuItem) => {
    setEditing(m)
    setDialogOpen(true)
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Menu Manager
          </h1>
          <p className="text-sm text-muted-foreground">
            Manage the dynamic WhatsApp menus — main menu, sub-menus and
            knowledge-base options.
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Add Menu Item
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="text-muted-foreground absolute top-2.5 left-3 h-4 w-4" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by title, payload or section…"
            className="pl-9"
          />
        </div>
        <Select value={actionFilter} onValueChange={setActionFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All actions</SelectItem>
            <SelectItem value="text">Text</SelectItem>
            <SelectItem value="rag">RAG</SelectItem>
            <SelectItem value="menu">Menu</SelectItem>
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            {menuTypes.map((t) => (
              <SelectItem key={t} value={t}>
                {t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : isError ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-6 text-center text-sm text-destructive">
          Failed to load menu items. Check that you have the Files permission.
        </div>
      ) : (
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[40px]">#</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Payload</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Menu Type</TableHead>
                <TableHead>Parent</TableHead>
                <TableHead>Sort</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="py-10 text-center text-sm text-muted-foreground">
                    <ListTree className="mx-auto mb-2 h-8 w-8 opacity-40" />
                    No menu items found. Click “Add Menu Item” to create one.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="text-muted-foreground text-xs">
                      {m.id}
                    </TableCell>
                    <TableCell className="font-medium">
                      {m.title}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {m.payload}
                    </TableCell>
                    <TableCell>
                      <ActionBadge type={m.action_type} />
                    </TableCell>
                    <TableCell className="text-xs">
                      {m.menu_type}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {parentLabel(m)}
                    </TableCell>
                    <TableCell className="text-xs">
                      {m.sort_order}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={m.is_active ? 'default' : 'secondary'}
                      >
                        {m.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEdit(m)}
                          title="Edit"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => setDeleting(m)}
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Create / Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editing ? 'Edit Menu Item' : 'Add Menu Item'}
            </DialogTitle>
            <DialogDescription>
              {editing
                ? `Editing "${editing.title}" (${editing.payload})`
                : 'Create a new dynamic menu item for the WhatsApp bot.'}
            </DialogDescription>
          </DialogHeader>
          <MenuForm
            key={editing?.id ?? 'new'}
            initial={editing}
            menuItems={items}
            onClose={() => setDialogOpen(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog
        open={!!deleting}
        onOpenChange={(open) => !open && setDeleting(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete menu item?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete “
              {deleting?.title}” ({deleting?.payload}). This action cannot
              be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={() => {
                if (deleting) deleteMenu.mutate(deleting.payload)
                setDeleting(null)
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
