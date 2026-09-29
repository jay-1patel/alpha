'use client'

import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import type { ChangeEvent } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'
import {
  Send,
  Paperclip,
  MoreVertical,
  Trash2,
  UserCheck,
  FileText,
  Download,
  Hash,
  MessageCircle,
  Search,
  Circle,
  Loader2,
  X,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { api, getToken } from '@/lib/api'
import { downloadFile } from '@/lib/download'
import { wsUrl } from '@/lib/config'
import { useAdminChatUsers } from '@/lib/hooks/useAdminChat'

interface AdminUser {
  username: string
  chat_id: string
  last_message: { message: string; created_at: string; username?: string } | null
}

interface ChatMessage {
  id: number
  chat_id: string
  username: string
  text: string
  created_at: string
  attachment?: any
}

interface ChatTabProps {
  currentUsername: string
}

const API = '/api/admin'

const ALLOWED_ATTACH_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  'application/octet-stream',
]

const getMsgId = (m: any) => m?.id ?? m?.message_id ?? m?._id
const sameId = (a: any, b: any) => String(a) === String(b)
const normalizeMsg = (m: any) => ({
  ...m,
  id: getMsgId(m),
  text: m?.text ?? m?.message ?? '',
  timestamp: m?.timestamp ?? m?.created_at ?? null,
})

export default function ChatTab({ currentUsername }: ChatTabProps) {
  const { data: users = [], refetch: refetchUsers, isLoading: usersLoading } = useAdminChatUsers()
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null)
  const [messages, setMessages] = useState<any[]>([])
  const [onlineUsers, setOnlineUsers] = useState<string[]>([])
  const [inputText, setInputText] = useState('')
  const [connected, setConnected] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting')
  const [adminSearch, setAdminSearch] = useState('')
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [sending, setSending] = useState(false)
  const [menuMsgId, setMenuMsgId] = useState<number | null>(null)
  const [attachPreview, setAttachPreview] = useState<{ name: string; type: string; dataUrl: string } | null>(null)
  const [errorBox, setErrorBox] = useState<string | null>(null)

  const wsRef = useRef<WebSocket | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const selectedUserRef = useRef<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const chatClearedRef = useRef(new Set<string>())
  const token = useMemo(() => getToken(), [])

  const chatId = useMemo(() => selectedChatId || 'general', [selectedChatId])
  const recipientName = useMemo(() => {
    if (!selectedChatId) return 'General'
    const parts = selectedChatId.split('|')
    return parts.find(p => p !== currentUsername) || 'General'
  }, [selectedChatId, currentUsername])

  const filteredUsers = useMemo(() => {
    return users.filter(u =>
      u.username.toLowerCase().includes(adminSearch.toLowerCase())
    )
  }, [users, adminSearch])

  const scrollToBottom = useCallback((behavior: 'smooth' | 'instant' = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior })
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, scrollToBottom])

  useEffect(() => {
    selectedUserRef.current = selectedChatId
  }, [selectedChatId])

  const showError = useCallback((msg: string) => {
    setErrorBox(msg)
    setTimeout(() => setErrorBox(null), 4000)
  }, [])

  const fetchUsers = useCallback(async () => {
    try {
      await refetchUsers()
    } catch {
      showError('Failed to load chat users')
    }
  }, [refetchUsers, showError])

  useEffect(() => {
    fetchUsers()
  }, [fetchUsers])

  const removeMessageById = useCallback((id: any) => {
    setMessages((prev) => prev.filter((m) => !sameId(getMsgId(m), id)))
  }, [])

  const connect = useCallback(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      setConnected(true)
      setConnectionStatus('connected')
      return true
    }

    const url = `${wsUrl('/api/admin/chat/ws')}/${encodeURIComponent(currentUsername)}?token=${token || ''}&conn_id=chat`
    const ws = new WebSocket(url)
    wsRef.current = ws

    ws.onopen = () => {
      setConnected(true)
      setConnectionStatus('connected')
      const cid = selectedUserRef.current || 'general'
      if (!chatClearedRef.current.has(cid)) {
        ws.send(JSON.stringify({ type: 'load_history', chat_id: cid }))
      }
    }

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        if (data.type === 'history') {
          const currentCid = selectedUserRef.current || 'general'
          if (data.chat_id === currentCid && !chatClearedRef.current.has(data.chat_id)) {
            const normalized = (data.messages || []).map(normalizeMsg)
            setMessages(normalized)
            setTimeout(() => scrollToBottom('instant'), 50)
          }
          return
        }

        if (data.type === 'online_users') {
          setOnlineUsers(data.users || [])
          return
        }

        if (data.type === 'delete_message') {
          const id = data.message_id ?? data.id
          if (id != null) removeMessageById(id)
          return
        }

        if (data.type === 'message') {
          const incoming = normalizeMsg(data)
          const currentCid = selectedUserRef.current || 'general'
          if (incoming.chat_id === currentCid) {
            setMessages((prev) => {
              const exists = prev.some((m) => sameId(getMsgId(m), incoming.id))
              if (exists) return prev
              const filtered = prev.filter((m) => {
                const mid = String(getMsgId(m))
                if (!mid.startsWith('optimistic_')) return true
                const mc = m.chat_id || m.chatId || ''
                const mt = (m.text || m.message || '').trim()
                return !(mc === incoming.chat_id && mt === (incoming.text || '').trim())
              })
              return [...filtered, incoming]
            })
          }
          fetchUsers()
          return
        }
      } catch {
        // ignore malformed messages
      }
    }

    ws.onclose = () => {
      setConnected(false)
      setConnectionStatus('disconnected')
    }

    ws.onerror = () => {
      setConnectionStatus('disconnected')
    }

    return ws.readyState === WebSocket.OPEN
  }, [token, currentUsername, scrollToBottom, fetchUsers, removeMessageById, showError])

  useEffect(() => {
    if (!token) return
    const ws = connect()
    return () => {
      if (wsRef.current) {
        wsRef.current.close()
        wsRef.current = null
      }
    }
  }, [token, connect])

  const selectUser = useCallback(
    (username: string) => {
      const cid = username === currentUsername ? 'general' : `${[currentUsername, username].sort().join('|')}`
      setSelectedChatId(cid)
      setMessages([])
      setMenuMsgId(null)
      chatClearedRef.current.delete(cid)

      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'load_history', chat_id: cid }))
      }
    },
    [currentUsername]
  )

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const formatTime = (iso: string) => {
    if (!iso) return ''
    const d = new Date(iso)
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  const formatDateLabel = (iso: string) => {
    if (!iso) return ''
    const d = new Date(iso)
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)
    if (d.toDateString() === today.toDateString()) return 'Today'
    if (d.toDateString() === yesterday.toDateString()) return 'Yesterday'
    return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })
  }

  const groupedMessages = useMemo(() => {
    return messages.reduce((acc, msg) => {
      const label = formatDateLabel(msg.timestamp || msg.created_at)
      if (!acc.length || acc[acc.length - 1].label !== label) {
        acc.push({ label, messages: [] })
      }
      acc[acc.length - 1].messages.push(msg)
      return acc
    }, [] as { label: string; messages: any[] }[])
  }, [messages])

  const getAvatarColor = (name: string) => {
    const colors = ['#000000', '#333333', '#555555', '#777777', '#999999', '#bbbbbb', '#dddddd']
    let hash = 0
    for (let i = 0; i < (name?.length || 0); i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
    return colors[Math.abs(hash) % colors.length]
  }

  const getInitials = (name: string) => {
    const clean = name.replace(/\(.*?\)/, '').trim()
    return clean
      .split(' ')
      .map(w => w[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  const isOnline = (user: string) => onlineUsers.includes(user)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null
      if (target?.closest?.('.message-menu')) return
      if (target?.closest?.('.message-menu-btn')) return
      if (menuRef.current && !menuRef.current.contains(target)) setMenuMsgId(null)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const openAttach = () => fileInputRef.current?.click()

  const handleAttachChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const type = file.type || 'application/octet-stream'
    const ext = file.name.split('.').pop()?.toLowerCase() || ''
    const allowedExts = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'pdf', 'doc', 'docx', 'txt']
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf',
      'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain',
      'application/octet-stream']
    if (!allowedTypes.includes(type) && !allowedExts.includes(ext)) {
      showError('Invalid file type')
      e.target.value = ''
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = typeof reader.result === 'string' ? reader.result : ''
      setAttachPreview({ name: file.name, type: type === 'application/octet-stream' ? `application/${ext}` : type, dataUrl })
    }
    reader.onerror = () => showError('Could not read file')
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  const removeAttach = () => setAttachPreview(null)

  const sendMessage = useCallback(async () => {
    const text = inputText.trim()
    const hasAttach = Boolean(attachPreview)
    if (!text && !hasAttach) return
    if (!connected) {
      showError('Not connected')
      return
    }

    setSending(true)
    try {
      const cid = chatId
      const payload: any = { type: 'message', chat_id: cid }
      if (text) payload.text = text

      if (hasAttach && attachPreview) {
        try {
          const response = await fetch(attachPreview.dataUrl)
          const blob = await response.blob()
          const file = new File([blob], attachPreview.name, { type: attachPreview.type })
          const uploadRes = await api.uploadCatbox(file)
          payload.attachment = {
            name: attachPreview.name,
            type: attachPreview.type,
            url: uploadRes.url,
          }
        } catch {
          showError('Failed to upload attachment')
          setSending(false)
          return
        }
      }

      if (wsRef.current?.readyState === WebSocket.OPEN) {
        const optimistic: any = {
          ...payload,
          id: `optimistic_${Date.now()}_${Math.random()}`,
          username: currentUsername,
          timestamp: new Date().toISOString(),
        }
        setMessages((prev) => [...prev, optimistic])
        wsRef.current.send(JSON.stringify(payload))
        setInputText('')
        setAttachPreview(null)
        setMenuMsgId(null)
        inputRef.current?.focus()
      } else {
        showError('Connection lost. Try reconnecting.')
      }
    } finally {
      setSending(false)
    }
  }, [inputText, connected, chatId, attachPreview, currentUsername, showError])

  const deleteFromMe = (msg: any) => {
    const id = getMsgId(msg)
    if (id == null) return
    removeMessageById(id)
    setMenuMsgId(null)
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'delete_message',
        chat_id: chatId,
        message_id: id,
        scope: 'me',
      }))
    }
  }

  const deleteFromEveryone = (msg: any) => {
    const id = getMsgId(msg)
    if (id == null) return
    removeMessageById(id)
    setMenuMsgId(null)
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'delete_message',
        chat_id: chatId,
        message_id: id,
        scope: 'everyone',
      }))
    }
  }

  const toggleMenu = (msgId: number, e?: React.MouseEvent) => {
    e?.stopPropagation?.()
    setMenuMsgId((prev) => (sameId(prev, msgId) ? null : msgId))
  }

  if (usersLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-primary-500" />
      </div>
    )
  }

  return (
    <div className="h-[calc(100vh-180px)] flex rounded-lg border border-black/10 bg-white overflow-hidden">
      {/* Admin Sidebar */}
      <div
        className={cn(
          'border-r border-gray-200 flex flex-col bg-white shrink-0 transition-all duration-200',
          sidebarOpen ? 'w-64' : 'w-0 overflow-hidden lg:w-64 lg:overflow-visible'
        )}
      >
        <div className="p-3 border-b border-gray-200 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-base text-primary-500">Messages</h3>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 lg:hidden"
              onClick={() => setSidebarOpen(false)}
            >
              <MoreVertical className="h-4 w-4" />
            </Button>
          </div>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-500" />
            <Input
              placeholder="Search admins..."
              className="pl-8 h-8 text-sm bg-white border-gray-200 text-black placeholder:text-gray-400"
              value={adminSearch}
              onChange={(e) => setAdminSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-hidden">
          <ScrollArea className="h-full">
          <button
            onClick={() => setSelectedChatId(null)}
            className={cn(
              'w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-gray-100',
              !selectedChatId ? 'bg-gray-100' : ''
            )}
          >
            <div className="h-9 w-9 rounded-lg bg-primary-50 flex items-center justify-center shrink-0">
              <Hash className="h-4 w-4 text-primary-500" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-base font-medium text-black">General</p>
              <p className="text-sm text-gray-500 truncate">Team-wide channel</p>
            </div>
          </button>

          <Separator className="my-1 bg-gray-200" />

          <div className="px-3 py-2">
            <p className="text-sm font-semibold text-gray-500 uppercase tracking-wider">
              Direct Messages
            </p>
          </div>

          <div className="space-y-0.5 px-1">
            {filteredUsers.map((user) => (
              <button
                key={user.chat_id}
                onClick={() => selectUser(user.username)}
                className={cn(
                  'w-full flex items-center gap-3 px-2.5 py-2 rounded-lg text-left transition-colors hover:bg-gray-100',
                  selectedChatId === user.chat_id ? 'bg-gray-100' : ''
                )}
              >
                <div className="relative shrink-0">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="text-sm bg-gray-200 text-black">
                      {getInitials(user.username)}
                    </AvatarFallback>
                  </Avatar>
                  <div
                    className={cn(
                      'absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white',
                      isOnline(user.username) ? 'bg-primary-500' : 'bg-gray-300'
                    )}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-base font-medium text-black truncate">{user.username}</p>
                  <p className="text-sm text-gray-500 truncate">
                    {user.last_message
                      ? `${user.last_message.username === currentUsername ? 'You' : user.last_message.username}: ${user.last_message.message || ''}`
                      : 'No messages yet'}
                  </p>
                </div>
                {user.last_message && (
                  <span className="text-sm text-gray-400">{formatTime(user.last_message.created_at)}</span>
                )}
              </button>
            ))}
          </div>
          </ScrollArea>
        </div>

        <div className="p-3 border-t border-gray-200">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Circle className={cn('h-2 w-2', connected ? 'fill-primary-500 text-primary-500' : 'fill-gray-300 text-gray-300')} />
            <span>{connectionStatus === 'connected' ? 'Connected' : connectionStatus === 'connecting' ? 'Connecting…' : 'Disconnected'}</span>
          </div>
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col min-w-0 bg-white">
        <div className="flex items-center justify-between px-4 h-14 border-b border-gray-200 shrink-0">
          <div className="flex items-center gap-3">
            {!sidebarOpen && (
              <Button variant="ghost" size="icon" className="h-8 w-8 lg:hidden" onClick={() => setSidebarOpen(true)}>
                <MessageCircle className="h-4 w-4" />
              </Button>
            )}

            <div className="h-8 w-8 rounded-lg bg-primary-50 flex items-center justify-center">
              <Hash className="h-4 w-4 text-primary-500" />
            </div>
            <div>
              <p className="text-base font-semibold leading-tight text-black">{recipientName}</p>
              <p className="text-sm text-gray-500">
                {selectedChatId ? 'Direct message' : 'Team-wide channel'}
              </p>
            </div>
          </div>

          <div className={cn(
            'px-2.5 py-1 rounded-full text-sm border',
            connectionStatus === 'connected' ? 'border-primary-200 bg-primary-50 text-primary-700' :
              connectionStatus === 'connecting' ? 'border-gray-200 bg-gray-50 text-gray-600' :
                'border-red-200 bg-red-50 text-red-700'
          )}>
            <span className="inline-flex items-center gap-1.5">
              <span className={cn('h-1.5 w-1.5 rounded-full', connectionStatus === 'connected' ? 'bg-primary-500' : connectionStatus === 'connecting' ? 'bg-gray-400' : 'bg-red-500')} />
              {connectionStatus === 'connected' ? 'Connected' : connectionStatus === 'connecting' ? 'Connecting…' : 'Disconnected'}
            </span>
          </div>
        </div>

        <div className="flex-1 overflow-hidden">
          <ScrollArea className="h-full">
            <div ref={messagesEndRef} className="p-4 space-y-1">
              {messages.length === 0 && (
                <div className="text-center py-20 text-gray-400">
                  <MessageCircle className="h-10 w-10 mx-auto mb-3 opacity-40 text-primary-500" />
                  <p className="font-medium text-primary-500">No messages yet</p>
                  <p className="text-base mt-1 text-gray-600">
                    {selectedChatId ? `Start a conversation with ${recipientName}` : 'Start the team conversation!'}
                  </p>
                </div>
              )}

              {groupedMessages.map((group: { label: string; messages: any[] }) => (
                <div key={group.label}>
                  <div className="flex items-center justify-center my-4">
                    <span className="px-3 py-1 rounded-full bg-neutral-100 text-sm text-neutral-500 border border-black/5">
                      {group.label}
                    </span>
                  </div>

                  {group.messages.map((msg: any) => {
                    const isOwn = msg.username === currentUsername
                    const text = (msg.text ?? '').trim()
                    const hasAttach = !!msg.attachment

                    if (!text && !hasAttach) return null

                    return (
                      <div
                        key={msg.id}
                        className={cn(
                          'flex gap-3 py-2 px-2 rounded-lg hover:bg-neutral-50 group',
                          isOwn ? 'flex-row-reverse' : ''
                        )}
                      >
                        {!isOwn && (
                          <div
                            className="h-8 w-8 rounded-lg bg-gray-200 flex items-center justify-center shrink-0 text-sm font-medium text-black"
                            title={msg.username}
                          >
                            {getInitials(msg.username)}
                          </div>
                        )}

                        <div className={cn('flex flex-col', isOwn ? 'items-end' : 'items-start', 'max-w-[70%]')}>
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="text-sm font-medium text-primary-600">{msg.username}</span>
                            <span className="text-sm text-gray-400">{formatTime(msg.timestamp || msg.created_at)}</span>
                          </div>

                          <div
                            className={cn(
                              'relative rounded-xl px-3 py-2 text-base max-w-full pr-10',
                              isOwn ? 'bg-primary-500 text-white rounded-tr-sm' : 'bg-gray-100 text-black rounded-tl-sm'
                            )}
                          >
                            {!!text && <p className="break-words whitespace-pre-wrap">{text}</p>}

                            {msg.attachment && (
                              <div className="message-attachment mt-1">
                                {msg.attachment.type?.startsWith('image/') ? (
                                  <img
                                    src={msg.attachment.data || msg.attachment.url}
                                    alt={msg.attachment.name}
                                    className="message-image max-w-[200px] rounded border border-black/10"
                                  />
                                ) : (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.preventDefault()
                                      e.stopPropagation()
                                      downloadFile(
                                        msg.attachment.data || msg.attachment.url,
                                        msg.attachment.name
                                      )
                                    }}
                                    title="Download attachment"
                                    className="flex items-center gap-2 text-sm underline opacity-80 hover:opacity-100 cursor-pointer"
                                  >
                                    <FileText className="h-4 w-4 shrink-0" />
                                    <span className="truncate max-w-[200px]">{msg.attachment.name}</span>
                                    <Download className="h-3.5 w-3.5 shrink-0" />
                                  </button>
                                )}
                              </div>
                            )}

                            {isOwn && (
                              <div className="message-actions absolute right-1 top-1">
                                <button
                                  className="message-menu-btn h-7 w-7 rounded-md flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                  style={{ color: isOwn ? 'rgba(255,255,255,0.8)' : '#666666' }}
                                  onClick={(e) => toggleMenu(msg.id, e)}
                                >
                                  <MoreVertical className="h-4 w-4" />
                                </button>

                                {sameId(menuMsgId, msg.id) && (
                                  <div
                                    className="message-menu absolute right-0 top-8 z-50 w-40 rounded-md border border-black/10 bg-white shadow-lg"
                                    ref={menuRef}
                                    onMouseDown={(e) => e.stopPropagation()}
                                  >
                                    <button
                                      className="message-menu-item w-full text-left px-3 py-2 text-base hover:bg-neutral-50 text-black"
                                      onClick={() => deleteFromMe(msg)}
                                    >
                                      Delete from me
                                    </button>
                                    <button
                                      className="message-menu-item w-full text-left px-3 py-2 text-base hover:bg-neutral-50 text-black"
                                      onClick={() => deleteFromEveryone(msg)}
                                    >
                                      Delete from everyone
                                    </button>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>

                        {isOwn && (
                          <div
                            className="h-8 w-8 rounded-lg bg-primary-500 flex items-center justify-center shrink-0 text-sm font-medium text-white"
                            title={msg.username}
                          >
                            {getInitials(msg.username)}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              ))}
              <div ref={messagesEndRef} />
          </div>
          </ScrollArea>
        </div>

        {/* Input */}
        <div className="border-t border-gray-200 p-4 shrink-0 bg-white">
          {connectionStatus === 'disconnected' && (
            <div className="mb-2 flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              <AlertTriangle className="h-4 w-4" />
              <span>Connection lost.</span>
              <button onClick={connect} className="underline font-medium">Reconnect</button>
            </div>
          )}

          {errorBox && (
            <div className="mb-2 flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              <AlertTriangle className="h-4 w-4" />
              <span>{errorBox}</span>
            </div>
          )}

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="shrink-0 text-gray-600 hover:text-primary-500 hover:bg-primary-50"
              onClick={openAttach}
            >
              <Paperclip className="h-4 w-4" />
            </Button>

            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={handleAttachChange}
              accept="image/*,.pdf,.doc,.docx,.txt"
            />

            <Input
              placeholder={connected ? `Message ${recipientName}...` : 'Not connected'}
              className="flex-1 bg-white border-gray-200 text-black placeholder:text-gray-400"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={!connected}
            />

            <Button
              onClick={sendMessage}
              disabled={!connected || (!inputText.trim() && !attachPreview)}
              size="icon"
              className="shrink-0 bg-primary-500 text-white hover:bg-primary-600 disabled:bg-gray-300 disabled:text-gray-500"
            >
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>

          {attachPreview && (
            <div className="mt-2 flex items-center gap-2 rounded-md border border-gray-200 bg-gray-50 p-2">
              <span className="text-sm text-black truncate flex-1">{attachPreview.name}</span>
              {attachPreview.type?.startsWith('image/') && (
                <img
                  src={attachPreview.dataUrl}
                  alt={attachPreview.name}
                  className="h-10 w-10 rounded object-cover border border-gray-200"
                />
              )}
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-gray-600 hover:text-primary-500"
                onClick={removeAttach}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
