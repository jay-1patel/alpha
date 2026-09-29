import { useEffect, useState } from 'react'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Menu,
  Settings,
  RotateCcw,
  Save,
  GripVertical,
  Eye,
  EyeOff,
  Loader2,
  ChevronDown,
  ChevronUp,
  MessageSquare,
  AlertCircle,
} from 'lucide-react'

import { http } from '@/lib/http'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
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

import {
  useMenuDetail,
  useUpdateMenuItem,
  useUpdateMenuSettings,
  useResetMenu,
} from '@/lib/hooks/useMenus'

import type { MenuItemRow, MenuSettings } from '@/lib/types'

/* -------------------------------------------------------------------------- */
/* HELPERS                                                                    */
/* -------------------------------------------------------------------------- */

const MENU_KEY = 'kb_main'

/* -------------------------------------------------------------------------- */
/* SETTINGS DIALOG                                                            */
/* -------------------------------------------------------------------------- */

function SettingsDialog({
  open,
  onOpenChange,
  settings,
  onSave,
  saving,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  settings: MenuSettings | null
  onSave: (s: Partial<MenuSettings>) => void
  saving: boolean
}) {
  const [form, setForm] = useState<MenuSettings>({
    header: '',
    body: '',
    button_text: '',
  })

  useEffect(() => {
    if (open) {
      setForm({
        header: settings?.header ?? '',
        body: settings?.body ?? '',
        button_text: settings?.button_text ?? '',
      })
    }
  }, [open, settings])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Menu Settings
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Greeting Header</Label>
            <Input
              value={form.header}
              onChange={(e) => setForm((p) => ({ ...p, header: e.target.value }))}
              placeholder="Hi there! Welcome to Leeway Softtech"
            />
            <p className="text-xs text-muted-foreground">
              Personalized greeting shown above the menu list.
            </p>
          </div>

          <div className="space-y-2">
            <Label>Menu Body</Label>
            <Input
              value={form.body}
              onChange={(e) => setForm((p) => ({ ...p, body: e.target.value }))}
              placeholder="What would you like to explore today?"
            />
            <p className="text-xs text-muted-foreground">
              Short prompt text below the header.
            </p>
          </div>

          <div className="space-y-2">
            <Label>Button Text</Label>
            <Input
              value={form.button_text}
              onChange={(e) => setForm((p) => ({ ...p, button_text: e.target.value }))}
              placeholder="Show Options"
            />
            <p className="text-xs text-muted-foreground">
              Label on the list-menu button users tap to open the menu.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={saving} onClick={() => onSave(form)}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Settings
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/* -------------------------------------------------------------------------- */
/* EDIT ITEM DIALOG                                                           */
/* -------------------------------------------------------------------------- */

function EditItemDialog({
  open,
  onOpenChange,
  item,
  onSave,
  saving,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  item: MenuItemRow | null
  onSave: (itemId: string, fields: Partial<MenuItemRow>) => void
  saving: boolean
}) {
  const [form, setForm] = useState<Partial<MenuItemRow>>({})

  useEffect(() => {
    if (open) setForm(item ? { ...item } : {})
  }, [open, item])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Menu className="h-4 w-4" />
            Edit Menu Item
          </DialogTitle>
        </DialogHeader>

        {item && (
          <div className="space-y-4 py-2">
                            <div className="space-y-2">
                              <Label>Item ID</Label>
                              <Input
                                value={form.item_id ?? ''}
                                onChange={(e) => setForm((p) => ({ ...p, item_id: e.target.value }))}
                                placeholder="e.g. menu_products"
                              />
              <p className="text-xs text-muted-foreground">
                Unique key the bot uses to route actions. Changing this updates the routing behavior.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Title</Label>
                <Input
                  value={form.title ?? ''}
                  onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Icon</Label>
                <Input
                  value={form.icon ?? ''}
                  onChange={(e) => setForm((p) => ({ ...p, icon: e.target.value }))}
                  placeholder="e.g. 🛍️"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <Input
                value={form.description ?? ''}
                onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Section</Label>
                <Input
                  value={form.section ?? ''}
                  onChange={(e) => setForm((p) => ({ ...p, section: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Sort Order</Label>
                <Input
                  type="number"
                  min={0}
                  value={form.sort_order ?? 0}
                  onChange={(e) => setForm((p) => ({ ...p, sort_order: parseInt(e.target.value) || 0 }))}
                />
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
                          <Button disabled={saving} onClick={() => item && onSave(item.item_id, form)}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/* -------------------------------------------------------------------------- */
/* MAIN TAB COMPONENT                                                         */
/* -------------------------------------------------------------------------- */

export default function MenusTab() {
  const { data: menuData, isLoading, isError, error } = useMenuDetail(MENU_KEY)

  const updateItem = useUpdateMenuItem(MENU_KEY)
  const updateSettings = useUpdateMenuSettings(MENU_KEY)
  const resetMenu = useResetMenu(MENU_KEY)
  const qc = useQueryClient()

  const [editingItem, setEditingItem] = useState<MenuItemRow | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false)
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({})
  const [previewOpen, setPreviewOpen] = useState(false)

  const items = menuData?.items ?? []
  const settings = menuData?.settings ?? null
  const hasItems = items.length > 0

  // Group items by section
  const sections: Record<string, MenuItemRow[]> = {}
  for (const item of items) {
    const s = item.section || 'General'
    if (!sections[s]) sections[s] = []
    sections[s].push(item)
  }

  // Sort items within each section by sort_order
  for (const s of Object.keys(sections)) {
    sections[s].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
  }

  const sectionNames = Object.keys(sections)

  const toggleSection = (name: string) => {
    setExpandedSections((prev) => ({ ...prev, [name]: !(prev[name] ?? true) }))
  }

  const handleToggleActive = (item: MenuItemRow) => {
    updateItem.mutate({ itemId: item.item_id, fields: { is_active: !item.is_active } })
  }

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (isError) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-2">
        <AlertCircle className="h-8 w-8 text-destructive" />
        <p className="text-sm font-medium text-foreground">Failed to load menu data</p>
        <p className="text-xs text-muted-foreground">{typeof error === 'string' ? error : (error?.message || 'Unknown error')}</p>
        <Button variant="outline" size="sm" onClick={() => qc.invalidateQueries({ queryKey: ['menus', MENU_KEY] })}>
          Retry
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-5 text-base">
      {/* HEADER */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Menu Editor</h2>
          <p className="text-sm text-muted-foreground">
            Manage the WhatsApp menu shown to all users (B2C, B2B, KB).
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setSettingsOpen(true)}>
            <Settings className="mr-1.5 h-4 w-4" />
            Settings
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="text-destructive hover:bg-destructive/10"
            onClick={() => setResetConfirmOpen(true)}
          >
            <RotateCcw className="mr-1.5 h-4 w-4" />
            Reset
          </Button>
        </div>
      </div>

      {/* WHATSAPP PREVIEW */}
      <div className="rounded-lg border bg-[#ECE5DD] p-4">
        <div className="mb-3 flex items-center gap-2 text-sm font-medium text-gray-600">
          <MessageSquare className="h-4 w-4" />
          WhatsApp Preview
        </div>

        {/* Chat bubble */}
        <div className="mx-auto max-w-sm space-y-3">
          {/* Bot greeting message */}
          <div className="rounded-lg bg-white p-3 shadow-sm">
            <p className="text-sm text-gray-800">
              {settings?.header || 'Hi there! 👋 Welcome to Leeway Softtech'}
            </p>
            <p className="mt-1 text-sm text-gray-800">
              {settings?.body || 'What would you like to explore today?'}
            </p>
          </div>

          {/* List menu button */}
          <div className="flex justify-end">
            <button
              onClick={() => setPreviewOpen((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-blue-500 bg-white px-4 py-2 text-sm font-medium text-blue-600 shadow-sm transition-colors hover:bg-blue-50"
            >
              <Menu className="h-4 w-4" />
              {settings?.button_text || 'Show Options'}
            </button>
          </div>

          {/* Expanded menu */}
          {previewOpen && (
            <div className="rounded-lg bg-white p-3 shadow-sm">
              {hasItems ? (
                <>
                  <p className="mb-2 text-xs font-medium text-gray-400">— Menu —</p>
                  {sectionNames.map((sectionName) => {
                    const activeItems = sections[sectionName].filter((i) => i.is_active)
                    if (activeItems.length === 0) return null
                    return (
                      <div key={sectionName} className="mb-2 last:mb-0">
                        <p className="mb-1 text-xs font-semibold text-gray-500">{sectionName}</p>
                        {activeItems.map((item) => (
                          <div
                            key={item.item_id}
                            className="flex items-center gap-2 rounded px-2 py-1 text-sm text-gray-800 hover:bg-gray-100"
                          >
                            <span className="text-base">{item.icon}</span>
                            <span>{item.title}</span>
                          </div>
                        ))}
                      </div>
                    )
                  })}
                </>
              ) : (
                <p className="text-sm text-muted-foreground">No menu items loaded. Check API connection or reset menu to defaults.</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* SECTIONS */}
      {sectionNames.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center">
          <Menu className="mb-3 h-10 w-10 text-muted-foreground/50" />
          <p className="text-base font-medium">No menu items found</p>
          <p className="text-sm text-muted-foreground">
            The code defaults will be used. Add items via the Settings or database.
          </p>
        </div>
      ) : (
        sectionNames.map((sectionName) => {
          const collapsed = expandedSections[sectionName] === false
          return (
            <div key={sectionName} className="rounded-lg border overflow-hidden">
              <button
                className="flex w-full items-center justify-between bg-muted/30 px-4 py-3 text-left text-sm font-medium"
                onClick={() => toggleSection(sectionName)}
              >
                <span className="flex items-center gap-2">
                  {collapsed ? (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronUp className="h-4 w-4 text-muted-foreground" />
                  )}
                  {sectionName}
                  <span className="ml-1 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                    {sections[sectionName].length}
                  </span>
                </span>
              </button>

              {!collapsed && (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10" />
                      <TableHead>Icon</TableHead>
                      <TableHead>Item</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="w-16 text-center">Order</TableHead>
                      <TableHead className="w-20 text-center">Active</TableHead>
                      <TableHead className="w-20" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sections[sectionName].map((item) => (
                          <TableRow key={item.item_id}>
                            <TableCell className="text-muted-foreground">
                              <GripVertical className="h-4 w-4" />
                            </TableCell>
                            <TableCell className="text-lg">{item.icon}</TableCell>
                            <TableCell>
                              <div className="font-medium">{item.title || item.item_id}</div>
                              <code className="text-xs text-muted-foreground">{item.item_id}</code>
                            </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {item.description}
                        </TableCell>
                        <TableCell className="text-center text-sm text-muted-foreground">
                          {item.sort_order}
                        </TableCell>
                        <TableCell className="text-center">
                          <button
                            onClick={() => handleToggleActive(item)}
                            className={`inline-flex h-7 w-7 items-center justify-center rounded-md transition-colors ${
                              item.is_active
                                ? 'bg-green-100 text-green-700 hover:bg-green-200'
                                : 'bg-red-100 text-red-700 hover:bg-red-200'
                            }`}
                            title={item.is_active ? 'Deactivate' : 'Activate'}
                          >
                            {item.is_active ? (
                              <Eye className="h-4 w-4" />
                            ) : (
                              <EyeOff className="h-4 w-4" />
                            )}
                          </button>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setEditingItem(item)}
                          >
                            Edit
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          )
        })
      )}

      {/* DIALOGS */}
      <EditItemDialog
        open={!!editingItem}
        onOpenChange={(v) => !v && setEditingItem(null)}
        item={editingItem}
        onSave={(itemId, fields) => {
          updateItem.mutate(
            { itemId, fields },
            { onSuccess: () => setEditingItem(null) }
          )
        }}
        saving={updateItem.isPending}
      />

      <SettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        settings={settings}
        onSave={(s) => {
          updateSettings.mutate(s, { onSuccess: () => setSettingsOpen(false) })
        }}
        saving={updateSettings.isPending}
      />

      <AlertDialog open={resetConfirmOpen} onOpenChange={setResetConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset Menu to Defaults?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove all customizations and restore the code defaults.
              You can edit again afterwards.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => resetMenu.mutate()}
            >
              {resetMenu.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Reset Menu
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
