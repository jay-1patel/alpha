'use client'

import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { ListTree, RotateCcw, Save, Eye, ArrowUp, ArrowDown } from 'lucide-react'

/* -------------------------------------------------------------------------- */
/* Types                                                                      */
/* -------------------------------------------------------------------------- */

interface MenuItemRow {
  menu_key: string
  item_id: string
  title: string
  description: string
  section: string
  icon: string
  sort_order: number
  is_active: number
}

interface MenuSettings {
  header?: string
  body?: string
  footer?: string
  button_text?: string
}

const MENU_KEYS = [
  { key: 'kb_main', label: 'KB Main Menu' },
  { key: 'b2c_main', label: 'B2C Main Menu' },
  { key: 'b2b_main', label: 'B2B Main Menu' },
  { key: 'b2b_orders', label: 'B2B Orders Sub-menu' },
  { key: 'b2b_products', label: 'B2B Products Sub-menu' },
  { key: 'b2b_finance', label: 'B2B Finance Sub-menu' },
  { key: 'b2b_support', label: 'B2B Support Sub-menu' },
]

const WHATSAPP_LIMITS = { rows: 10, sections: 3, title: 24, desc: 72 }

function truncate(text: string, limit: number): string {
  if (!text) return ''
  return text.length <= limit ? text : text.slice(0, limit - 1).trimEnd() + '…'
}

/* -------------------------------------------------------------------------- */
/* Component                                                                  */
/* -------------------------------------------------------------------------- */

export default function MenuEditorTab() {
  const [menuKey, setMenuKey] = useState('kb_main')
  const [items, setItems] = useState<MenuItemRow[]>([])
  const [settings, setSettings] = useState<MenuSettings>({})
  const [loading, setLoading] = useState(false)
  const [dirty, setDirty] = useState<Record<string, boolean>>({})

  useEffect(() => {
    void loadMenu(menuKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [menuKey])

  async function loadMenu(key: string) {
    setLoading(true)
    try {
      const data = await api.get(`/api/admin/menus/${key}`)
      setItems(data.items || [])
      setSettings(data.settings || {})
      setDirty({})
    } catch (e: any) {
      toast.error(e.message || 'Failed to load menu')
    } finally {
      setLoading(false)
    }
  }

  function updateItem(itemId: string, patch: Partial<MenuItemRow>) {
    setItems((prev) =>
      prev.map((it) => (it.item_id === itemId ? { ...it, ...patch } : it))
    )
    setDirty((d) => ({ ...d, [itemId]: true }))
  }

  function move(index: number, dir: -1 | 1) {
    const next = [...items]
    const target = index + dir
    if (target < 0 || target >= next.length) return
    ;[next[index], next[target]] = [next[target], next[index]]
    setItems(next.map((it, i) => ({ ...it, sort_order: i })))
    setDirty((d) => {
      const nd = { ...d }
      next.forEach((it) => (nd[it.item_id] = true))
      return nd
    })
  }

  async function saveItem(item: MenuItemRow) {
    try {
      await api.put(
        `/api/admin/menus/${menuKey}/${item.item_id}`,
        {
          title: item.title,
          description: item.description,
          section: item.section,
          icon: item.icon,
          sort_order: item.sort_order,
          is_active: item.is_active ? 1 : 0,
        }
      )
      toast.success(`Saved "${item.item_id}"`)
      setDirty((d) => {
        const nd = { ...d }
        delete nd[item.item_id]
        return nd
      })
    } catch (e: any) {
      toast.error(e.message || 'Save failed')
    }
  }

  async function saveAll() {
    for (const item of items) {
      // eslint-disable-next-line no-await-in-loop
      await api.put(
        `/api/admin/menus/${menuKey}/${item.item_id}`,
        {
          title: item.title,
          description: item.description,
          section: item.section,
          icon: item.icon,
          sort_order: item.sort_order,
          is_active: item.is_active ? 1 : 0,
        }
      )
    }
    setDirty({})
    toast.success('Menu saved — live on next message')
  }

  async function resetMenu() {
    if (!confirm(`Reset "${menuKey}" to code defaults? All overrides will be removed.`)) return
    try {
      await api.post(`/api/admin/menus/${menuKey}/reset`)
      toast.success('Menu reset to defaults')
      void loadMenu(menuKey)
    } catch (e: any) {
      toast.error(e.message || 'Reset failed')
    }
  }

  async function saveSettings() {
    try {
      await api.put(`/api/admin/menus/${menuKey}/settings`, settings)
      toast.success('Menu style saved')
    } catch (e: any) {
      toast.error(e.message || 'Save failed')
    }
  }

  /* ---- derived preview data ---- */
  const activeItems = items.filter((it) => it.is_active)
  const sections: { title: string; rows: { title: string; description: string }[] }[] = []
  for (const it of activeItems) {
    const sec = truncate(it.section || 'General', WHATSAPP_LIMITS.sections && 24)
    let s = sections.find((x) => x.title === sec)
    if (!s) {
      s = { title: sec, rows: [] }
      sections.push(s)
    }
    s.rows.push({
      title: truncate(`${it.icon ? it.icon + ' ' : ''}${it.title}`, WHATSAPP_LIMITS.title),
      description: truncate(it.description, WHATSAPP_LIMITS.desc) || 'Tap to select',
    })
  }
  const overRows = activeItems.length > WHATSAPP_LIMITS.rows
  const overSections = sections.length > WHATSAPP_LIMITS.sections

  /* ---------------------------------------------------------------- */

  return (
    <div className="flex h-full flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ListTree className="h-5 w-5" />
          <h1 className="text-lg font-semibold">Menu Editor</h1>
        </div>
        <div className="flex items-center gap-2">
          <select
            className="rounded-md border bg-background px-3 py-2 text-sm"
            value={menuKey}
            onChange={(e) => setMenuKey(e.target.value)}
          >
            {MENU_KEYS.map((m) => (
              <option key={m.key} value={m.key}>
                {m.label}
              </option>
            ))}
          </select>
          <Button variant="outline" size="sm" onClick={() => void resetMenu()}>
            <RotateCcw className="mr-1 h-4 w-4" /> Reset
          </Button>
          <Button size="sm" onClick={() => void saveAll()} disabled={loading}>
            <Save className="mr-1 h-4 w-4" /> Save All
          </Button>
        </div>
      </div>

      <div className="grid flex-1 grid-cols-1 gap-4 overflow-hidden lg:grid-cols-2">
        {/* Items list */}
        <Card className="flex flex-col overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">
              Items ({activeItems.length}/{WHATSAPP_LIMITS.rows} active)
              {overRows && (
                <span className="ml-2 text-red-500">
                  Over WhatsApp 10-row limit — extra rows are truncated on send
                </span>
              )}
              {overSections && (
                <span className="ml-2 text-amber-500">
                  Over 3 sections — extras merge into “More”
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <Separator />
          <ScrollArea className="flex-1">
            <CardContent className="space-y-3 pt-3">
              {loading && <p className="text-sm text-muted-foreground">Loading…</p>}
              {!loading && items.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No overrides yet — this menu currently uses the code defaults. Edit an
                  item title in the deployed bot? Add overrides via individual item edits
                  after they exist, or reset any time.
                </p>
              )}
              {!loading && items.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  Tip: overrides are created the first time you save an item. Since
                  defaults are code-defined, seed them by saving each item below after
                  the backend seeds defaults.
                </p>
              )}
              {items.map((item, idx) => (
                <div
                  key={item.item_id}
                  className="rounded-lg border p-3 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <code className="text-xs font-semibold text-muted-foreground">
                      {item.item_id}
                    </code>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => move(idx, -1)}>
                        <ArrowUp className="h-3 w-3" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => move(idx, 1)}>
                        <ArrowDown className="h-3 w-3" />
                      </Button>
                      <label className="ml-2 flex items-center gap-1 text-xs">
                        <input
                          type="checkbox"
                          checked={!!item.is_active}
                          onChange={(e) => updateItem(item.item_id, { is_active: e.target.checked ? 1 : 0 })}
                        />
                        Active
                      </label>
                      <Button
                        size="sm"
                        variant={dirty[item.item_id] ? 'default' : 'outline'}
                        className="ml-2 h-7 px-2 text-xs"
                        onClick={() => void saveItem(item)}
                      >
                        Save
                      </Button>
                    </div>
                  </div>
                  <div className="grid grid-cols-[70px_1fr] gap-2">
                    <Input
                      value={item.icon || ''}
                      placeholder="🛍️"
                      className="h-8 text-center"
                      onChange={(e) => updateItem(item.item_id, { icon: e.target.value })}
                    />
                    <Input
                      value={item.title}
                      placeholder="Title (max 24 chars)"
                      className="h-8"
                      onChange={(e) => updateItem(item.item_id, { title: e.target.value })}
                    />
                  </div>
                  <Input
                    value={item.description || ''}
                    placeholder="Description (max 72 chars)"
                    className="h-8"
                    onChange={(e) => updateItem(item.item_id, { description: e.target.value })}
                  />
                  <Input
                    value={item.section || ''}
                    placeholder="Section e.g. 🛍️ Products"
                    className="h-8"
                    onChange={(e) => updateItem(item.item_id, { section: e.target.value })}
                  />
                </div>
              ))}
            </CardContent>
          </ScrollArea>
        </Card>

        {/* Right column: style + preview */}
        <div className="flex flex-col gap-4 overflow-hidden">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Menu Style (header / body / button)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="grid gap-2">
                <Label className="text-xs">Header</Label>
                <Input
                  className="h-8"
                  value={settings.header || ''}
                  onChange={(e) => setSettings((s) => ({ ...s, header: e.target.value }))}
                />
                <Label className="text-xs">Body</Label>
                <Input
                  className="h-8"
                  value={settings.body || ''}
                  onChange={(e) => setSettings((s) => ({ ...s, body: e.target.value }))}
                />
                <Label className="text-xs">Button Text</Label>
                <Input
                  className="h-8"
                  value={settings.button_text || ''}
                  onChange={(e) => setSettings((s) => ({ ...s, button_text: e.target.value }))}
                />
              </div>
              <Button size="sm" onClick={() => void saveSettings()}>
                <Save className="mr-1 h-4 w-4" /> Save Style
              </Button>
            </CardContent>
          </Card>

          <Card className="flex flex-1 flex-col overflow-hidden">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-1 text-sm">
                <Eye className="h-4 w-4" /> WhatsApp Preview
              </CardTitle>
            </CardHeader>
            <Separator />
            <CardContent className="flex-1 overflow-auto pt-3">
              <div className="mx-auto max-w-sm rounded-2xl border bg-muted/40 p-3 shadow-sm">
                <p className="text-xs font-semibold">{settings.header || 'Header'}</p>
                <p className="mt-1 text-xs text-muted-foreground">{settings.body || 'Body'}</p>
                <div className="mt-2 space-y-2">
                  {sections.map((sec) => (
                    <div key={sec.title}>
                      <p className="text-[10px] font-bold uppercase text-muted-foreground">
                        {sec.title}
                      </p>
                      <div className="mt-1 space-y-1">
                        {sec.rows.map((r, i) => (
                          <div
                            key={`${sec.title}-${i}`}
                            className="rounded-md border bg-background px-2 py-1.5"
                          >
                            <p className="text-xs font-medium">{r.title}</p>
                            <p className="text-[10px] text-muted-foreground">{r.description}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                  {activeItems.length === 0 && (
                    <p className="text-xs text-muted-foreground">
                      Preview shows saved overrides. With none saved, the bot uses code defaults.
                    </p>
                  )}
                </div>
                <p className="mt-2 text-center text-[10px] font-semibold text-primary">
                  {settings.button_text || 'Main Menu'} ▾
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
