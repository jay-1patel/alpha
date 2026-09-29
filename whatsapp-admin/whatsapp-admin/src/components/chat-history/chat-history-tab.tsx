'use client'

import { useMemo, useState } from 'react'

import {
  Bot,
  Calendar,
  Clock,
  MessageSquare,
  PanelLeftClose,
  PanelLeftOpen,
  Phone,
  Search,
  User,
  X,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import { useChatHistory } from '@/lib/hooks/useChatHistory'

interface ChatHistory {
  id: string
  wid: string
  phoneNumber: string
  senderName: string
  message: string
  response: string
  createdAt: string
}

interface SenderGroup {
  key: string
  name: string
  phone: string
  messages: ChatHistory[]
  lastAt: string
}

/* ── Filter presets ─────────────────────────────────────────────── */

type PresetKey = '7d' | '30d' | '90d' | '1y' | '2y' | '3y' | 'all' | 'custom'

const PRESETS: { key: PresetKey; label: string; days?: number }[] = [
  { key: '7d', label: 'Last 7 days', days: 7 },
  { key: '30d', label: 'Last 30 days', days: 30 },
  { key: '90d', label: 'Last 90 days', days: 90 },
  { key: '1y', label: 'Last 1 year', days: 365 },
  { key: '2y', label: 'Last 2 years', days: 730 },
  { key: '3y', label: 'Last 3 years', days: 1095 },
  { key: 'all', label: 'All time', days: 1095 },
  { key: 'custom', label: 'Custom range' },
]

function presetLabel(preset: PresetKey, from?: string, to?: string) {
  if (preset === 'custom' && from && to) {
    return `${from} to ${to}`
  }
  return PRESETS.find((p) => p.key === preset)?.label ?? 'Filter'
}

/* ── Helpers ────────────────────────────────────────────────────── */

function groupBySender(items: ChatHistory[]): SenderGroup[] {
  const map = new Map<string, SenderGroup>()

  for (const h of items) {
    const key = h.phoneNumber || h.wid || h.id

    if (!map.has(key)) {
      map.set(key, {
        key,
        name: h.senderName || 'Unknown',
        phone: h.phoneNumber || h.wid,
        messages: [],
        lastAt: h.createdAt,
      })
    }

    const g = map.get(key)!
    g.messages.push(h)

    if (h.createdAt > g.lastAt) {
      g.lastAt = h.createdAt
    }
  }

  return Array.from(map.values()).sort(
    (a, b) => b.lastAt.localeCompare(a.lastAt)
  )
}

function formatDateTime(dateStr: string) {
  if (!dateStr) return '-'
  const d = new Date(dateStr)
  if (Number.isNaN(d.getTime())) return '-'
  return d.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatTime(dateStr: string) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

function getInitials(name: string) {
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

/* ── Component ──────────────────────────────────────────────────── */

export default function ChatHistoryTab() {
  const [search, setSearch] = useState('')
  const [selectedKey, setSelectedKey] = useState<string | null>(null)

  /* Filter state */
  const [preset, setPreset] = useState<PresetKey>('30d')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [filterOpen, setFilterOpen] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(true)

  const presetDays = PRESETS.find((x) => x.key === preset)?.days

  const { data: histories = [] } = useChatHistory({
    preset,
    customFrom,
    customTo,
    presetDays,
  })

  const groups = useMemo(() => {
    const filtered = histories.filter((h) => {
      const q = search.toLowerCase()
      return (
        h.senderName.toLowerCase().includes(q) ||
        h.phoneNumber.includes(q) ||
        h.message.toLowerCase().includes(q) ||
        h.response.toLowerCase().includes(q)
      )
    })
    return groupBySender(filtered)
  }, [histories, search])

  const selectedGroup =
    groups.find((g) => g.key === selectedKey) ?? null

  const applyCustom = () => {
    if (customFrom && customTo) {
      setPreset('custom')
      setFilterOpen(false)
    }
  }

  return (
    <div className="flex h-[calc(100vh-8rem)] overflow-hidden rounded-2xl border bg-card shadow-lg">

      {/* ── LEFT PANEL ──────────────────────────────────────────── */}

      <div
        className={cn(
          'flex flex-col border-r bg-card shrink-0 transition-all duration-200',
          sidebarOpen ? 'w-[80%] sm:w-[280px]' : 'w-0 overflow-hidden sm:w-[280px] sm:overflow-visible'
        )}
      >

        {/* Header */}
        <div className="space-y-3 border-b p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-purple-600">
                <MessageSquare className="h-4 w-4 text-white" />
              </div>
              <div>
                <h3 className="text-base font-semibold">
                  Chat History
                </h3>
                <p className="text-xs text-muted-foreground">
                  {groups.length} conversation
                  {groups.length !== 1 && 's'}
                </p>
              </div>
            </div>

            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 sm:hidden"
              onClick={() => setSidebarOpen(false)}
            >
              <PanelLeftClose className="h-4 w-4" />
            </Button>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search name or phone..."
              className="h-9 pl-9 text-sm"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setSelectedKey(null)
              }}
            />
          </div>

          {/* Filter button + dropdown */}
          <div className="relative">
            <Button
              variant="outline"
              size="sm"
              className="h-8 w-full justify-between text-xs"
              onClick={() => setFilterOpen((o) => !o)}
            >
              <span className="flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5" />
                {presetLabel(preset, customFrom, customTo)}
              </span>
              {preset !== '30d' && (
                <X
                  className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground"
                  onClick={(e) => {
                    e.stopPropagation()
                    setPreset('30d')
                    setCustomFrom('')
                    setCustomTo('')
                  }}
                />
              )}
            </Button>

            {filterOpen && (
              <div className="absolute left-0 top-full z-50 mt-1 w-full rounded-xl border bg-card p-1.5 shadow-lg">
                {PRESETS.map((p) => (
                  <button
                    key={p.key}
                    type="button"
                    onClick={() => {
                      if (p.key === 'custom') {
                        setPreset('custom')
                      } else {
                        setPreset(p.key)
                        setCustomFrom('')
                        setCustomTo('')
                        setFilterOpen(false)
                      }
                    }}
                    className={cn(
                      'flex w-full items-center rounded-lg px-3 py-2 text-left text-sm transition-colors',
                      preset === p.key && p.key !== 'custom'
                        ? 'bg-violet-500/10 font-medium text-foreground'
                        : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                    )}
                  >
                    {p.label}
                  </button>
                ))}

                {/* Custom range inputs */}
                {preset === 'custom' && (
                  <div className="mt-1 border-t px-3 py-2.5">
                    <p className="mb-2 text-xs font-medium text-muted-foreground">
                      Select date range
                    </p>
                    <div className="flex items-center gap-2">
                      <Input
                        type="date"
                        value={customFrom}
                        onChange={(e) =>
                          setCustomFrom(e.target.value)
                        }
                        className="h-8 flex-1 text-xs"
                      />
                      <span className="shrink-0 text-xs text-muted-foreground">
                        to
                      </span>
                      <Input
                        type="date"
                        value={customTo}
                        onChange={(e) =>
                          setCustomTo(e.target.value)
                        }
                        className="h-8 flex-1 text-xs"
                      />
                    </div>
                    <Button
                      size="sm"
                      className="mt-2 h-7 w-full text-xs"
                      disabled={!customFrom || !customTo}
                      onClick={applyCustom}
                    >
                      Apply
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Sender list */}
        <div className="min-h-0 flex-1 overflow-hidden">
          <ScrollArea className="h-full">
          {groups.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-4 py-16 text-center">
              <MessageSquare className="mb-3 h-10 w-10 text-muted-foreground/30" />
              <p className="text-sm font-medium text-muted-foreground">
                No conversations found
              </p>
            </div>
          ) : (
            <div className="p-1.5">
              {groups.map((g) => {
                const active = g.key === selectedGroup?.key
                const lastMsg =
                  g.messages[g.messages.length - 1]

                return (
                  <button
                    key={g.key}
                    type="button"
                    onClick={() => setSelectedKey(g.key)}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors',
                      active
                        ? 'bg-gradient-to-r from-violet-500/10 to-purple-500/10 ring-1 ring-violet-500/20'
                        : 'hover:bg-muted/50'
                    )}
                  >
                    <div className="relative shrink-0">
                      <div
                        className={cn(
                          'flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold',
                          active
                            ? 'bg-gradient-to-br from-violet-500 to-purple-600 text-white'
                            : 'bg-muted text-muted-foreground'
                        )}
                      >
                        {getInitials(g.name)}
                      </div>
                      <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-background bg-emerald-500" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p
                          className={cn(
                            'truncate text-sm font-semibold',
                            active && 'text-foreground'
                          )}
                        >
                          {g.name}
                        </p>
                        <span className="shrink-0 text-[10px] text-muted-foreground">
                          {formatTime(g.lastAt)}
                        </span>
                      </div>

                      <div className="mt-0.5 flex items-center gap-1.5">
                        <Phone className="h-3 w-3 shrink-0 text-muted-foreground/60" />
                        <span className="truncate text-xs text-muted-foreground">
                          {g.phone}
                        </span>
                      </div>

                      <p className="mt-0.5 truncate text-xs text-muted-foreground/70">
                        {lastMsg?.message ||
                          'No messages'}
                      </p>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </ScrollArea>
        </div>
      </div>

      {/* ── RIGHT PANEL ─────────────────────────────────────────── */}

      <div className="flex flex-1 flex-col">
        {selectedGroup ? (
          <>
            {/* Contact header */}
            <div className="flex items-center gap-3 border-b px-5 py-3">
              {!sidebarOpen && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 sm:hidden"
                  onClick={() => setSidebarOpen(true)}
                >
                  <PanelLeftOpen className="h-4 w-4" />
                </Button>
              )}
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-purple-600 text-sm font-semibold text-white">
                {getInitials(selectedGroup.name)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">
                  {selectedGroup.name}
                </p>
                <div className="flex items-center gap-1.5">
                  <Phone className="h-3 w-3 text-muted-foreground/60" />
                  <span className="text-xs text-muted-foreground">
                    {selectedGroup.phone}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    &middot; {selectedGroup.messages.length} message
                    {selectedGroup.messages.length !== 1 && 's'}
                  </span>
                </div>
              </div>
            </div>

            {/* Messages */}
            <div className="min-h-0 flex-1 overflow-hidden">
              <ScrollArea className="h-full px-5 py-4">
              <div className="space-y-5">
                {selectedGroup.messages.map((h) => (
                  <div key={h.id} className="space-y-2">
                    {/* User message */}
                    <div className="flex justify-start">
                      <div className="flex max-w-[80%] items-start gap-2">
                        <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-500/10">
                          <User className="h-3.5 w-3.5 text-blue-600" />
                        </div>
                        <div>
                          <div className="rounded-xl rounded-tl-sm border border-blue-500/10 bg-blue-500/[0.06] px-3.5 py-2.5">
                            <p className="whitespace-pre-wrap break-words text-sm leading-6 text-foreground">
                              {h.message || (
                                <span className="italic text-muted-foreground">
                                  Empty message
                                </span>
                              )}
                            </p>
                          </div>
                          <p className="mt-1 flex items-center gap-1 text-[10px] text-muted-foreground/60">
                            <Clock className="h-3 w-3" />
                            {formatDateTime(h.createdAt)}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Bot response */}
                    <div className="flex justify-end">
                      <div className="flex max-w-[80%] flex-row-reverse items-start gap-2">
                        <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-500/10">
                          <Bot className="h-3.5 w-3.5 text-emerald-600" />
                        </div>
                        <div>
                          {h.response ? (
                            <div className="rounded-xl rounded-tr-sm border border-emerald-500/10 bg-emerald-500/[0.06] px-3.5 py-2.5">
                              <p className="whitespace-pre-wrap break-words text-sm leading-6 text-foreground/90">
                                {h.response}
                              </p>
                            </div>
                          ) : (
                            <div className="rounded-xl rounded-tr-sm border border-dashed bg-muted/20 px-3.5 py-2.5">
                              <span className="text-xs italic text-muted-foreground">
                                No response
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
            </div>
          </>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center text-center">
            {!sidebarOpen && (
              <Button
                variant="ghost"
                size="icon"
                className="mb-3 h-9 w-9 sm:hidden"
                onClick={() => setSidebarOpen(true)}
              >
                <PanelLeftOpen className="h-5 w-5" />
              </Button>
            )}
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-primary/10 bg-primary/10">
              <MessageSquare className="h-7 w-7 text-primary" />
            </div>
            <h3 className="text-lg font-semibold text-foreground">
              Select a conversation
            </h3>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              Choose a sender from the left panel to view
              their full chat history.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
