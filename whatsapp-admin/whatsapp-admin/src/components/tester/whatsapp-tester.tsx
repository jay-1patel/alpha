'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { format } from 'date-fns'
import axios from 'axios'
import { Send, Mic, Paperclip, Smile, Search, ArrowLeft, RefreshCw } from 'lucide-react'
import { API_BASE } from '@/lib/config'
import { useBranding } from '@/lib/hooks/useBranding'

/* -------------------------------------------------------------------------- */
/* TYPES                                                                      */
/* -------------------------------------------------------------------------- */

interface ButtonDef {
  id: string
  title: string
}

interface ListRow {
  id?: string
  title?: string
  description?: string
}

interface ListSection {
  title?: string
  rows?: ListRow[]
}

type OutMessage =
  | { type: 'text'; text: string }
  | { type: 'buttons'; text?: string; buttons?: ButtonDef[] | null }
  | { type: 'image'; media_url?: string; caption?: string }
  | {
      type: 'list'
      header?: string
      body?: string
      button_text?: string
      sections?: ListSection[]
    }

interface SimulatorResponse {
  messages?: OutMessage[]
  new_state?: string | null
  human_handover?: boolean
  user_type?: string
  status?: string
  error?: string | null
}

interface ChatMessage {
  id: string
  role: 'bot' | 'admin'
  text: string
  time: Date
  buttons?: ButtonDef[] | null
  listSections?: ListSection[] | null
  listButtonText?: string
  imageUrl?: string
  imageCaption?: string
  typing?: boolean
}

type UserType = 'b2b' | 'b2c' | 'auto'

const WA_ID = 'test-user-001'

/* -------------------------------------------------------------------------- */
/* HELPERS                                                                    */
/* -------------------------------------------------------------------------- */



function makeId(): string {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}

/**
 * Pixel-perfect WhatsApp tick component.
 * - Incoming: single gray tick (✓)
 * - Outgoing: double blue ticks (✓✓, text-blue-500)
 */
function Ticks({ read, own }: { read: boolean; own: boolean }) {
  if (own) {
    return (
      <span className="inline-flex items-center text-[11px] leading-none text-blue-500">
        <span aria-hidden>✓✓</span>
      </span>
    )
  }
  return (
    <span className="inline-flex items-center text-[11px] leading-none text-stone-500">
      <span aria-hidden>✓</span>
    </span>
  )
}

/* -------------------------------------------------------------------------- */
/* COMPONENT                                                                  */
/* -------------------------------------------------------------------------- */

export default function WhatsAppTester() {
  const { data: branding } = useBranding()
  const botName = branding?.bot_name || 'WhatsApp Bot'
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [inputText, setInputText] = useState('')
  const [sending, setSending] = useState(false)
  const [userType, setUserType] = useState<UserType>('auto')
  const [lastState, setLastState] = useState<string | null>(null)
  const [handover, setHandover] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, scrollToBottom])

  /**
   * Send a message to the local simulator, which drives the SAME pipeline as a
   * real WhatsApp connection (orchestrator -> B2B/B2C workflow -> capture).
   *   POST {API_BASE}/api/test-simulator
   *   Body: { wa_id, message, user_type }
   *   Returns: { messages: [{type: text|buttons|list, ...}], new_state, ... }
   */
  const callSimulator = useCallback(
    async (text: string): Promise<SimulatorResponse> => {
      const { data } = await axios.post(`${API_BASE}/api/test-simulator`, {
        wa_id: WA_ID,
        message: text,
        user_type: userType,
      })
      return data as SimulatorResponse
    },
    [userType]
  )

  const handleSend = useCallback(
    async (raw?: string) => {
      const text = (raw ?? inputText).trim()
      if (!text || sending) return

      const outgoing: ChatMessage = {
        id: makeId(),
        role: 'admin',
        text,
        time: new Date(),
      }
      setMessages((prev) => [...prev, outgoing])
      setInputText('')
      setSending(true)

      // Typing indicator (bot bubble on the left)
      const typingId = makeId()
      const typingMsg: ChatMessage = {
        id: typingId,
        role: 'bot',
        text: '',
        time: new Date(),
        typing: true,
      }
      setMessages((prev) => [...prev, typingMsg])

      try {
        const reply = await callSimulator(text)
        setMessages((prev) => prev.filter((m) => m.id !== typingId))

        setLastState(reply.new_state ?? null)
        setHandover(Boolean(reply.human_handover))

        const outs: OutMessage[] = Array.isArray(reply.messages) ? reply.messages : []
        if (outs.length === 0) {
          // Nothing sent (e.g. ignored because of human handover).
          const botMsg: ChatMessage = {
            id: makeId(),
            role: 'bot',
            text: reply.human_handover
              ? '🔔 Human handover is active — this message is being handled by an admin in the React UI (no bot reply).'
              : '🤖 (no outgoing message was produced)',
            time: new Date(),
          }
          setMessages((prev) => [...prev, botMsg])
          return
        }

        const newBots: ChatMessage[] = outs.map((m) => ({
          id: makeId(),
          role: 'bot',
          text:
            m.type === 'text'
              ? m.text
              : m.type === 'buttons'
              ? m.text || ''
              : m.type === 'image'
              ? m.caption || ''
              : m.header || m.body || '',
          time: new Date(),
          buttons: m.type === 'buttons' ? m.buttons || [] : null,
          listSections: m.type === 'list' ? m.sections || [] : null,
          listButtonText: m.type === 'list' ? m.button_text : undefined,
          imageUrl: m.type === 'image' ? m.media_url : undefined,
          imageCaption: m.type === 'image' ? m.caption : undefined,
        }))
        setMessages((prev) => [...prev, ...newBots])
      } catch (e: any) {
        setMessages((prev) => prev.filter((m) => m.id !== typingId))
        const errorMsg: ChatMessage = {
          id: makeId(),
          role: 'bot',
          text: `⚠️ Could not reach the simulator (${API_BASE}/api/test-simulator). Is the backend running? ${e?.message || ''}`,
          time: new Date(),
        }
        setMessages((prev) => [...prev, errorMsg])
      } finally {
        setSending(false)
      }
    },
    [inputText, sending, callSimulator]
  )

  const handleButtonClick = useCallback(
    (btn: ButtonDef) => {
      // Button click = send the button title as an outgoing bubble, then hit the API.
      handleSend(btn.title)
    },
    [handleSend]
  )

  const handleListSelect = useCallback(
    (row: ListRow) => {
      // A real WhatsApp list-reply sends the selected item's title as the message.
      handleSend(row.title || row.id || '')
    },
    [handleSend]
  )

  const handleReset = useCallback(async () => {
    try {
      await axios.post(`${API_BASE}/api/test-simulator/reset`, { wa_id: WA_ID })
    } catch {
      // Ignore reset failures; still clear the local view.
    }
    setMessages([])
    setLastState(null)
    setHandover(false)
  }, [])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleSend()
    }
  }

  const showMic = !inputText.trim()

  return (
    <div className="h-[calc(100vh-180px)] flex overflow-hidden rounded-lg border border-black/10 bg-[#eae6df] shadow-sm">
      {/* ──────────────────────────────────────────────────────────────── */}
      {/* LEFT SIDEBAR (300px)                                            */}
      {/* ──────────────────────────────────────────────────────────────── */}
      <div className="hidden md:flex w-[300px] shrink-0 flex-col border-r border-black/10 bg-white">
        {/* Sidebar header */}
        <div className="flex h-[60px] items-center justify-between bg-[#f0f2f5] px-4">
          <h1 className="text-base font-semibold text-stone-900">Chikki Bot</h1>
        </div>

        {/* Search bar */}
        <div className="border-b border-black/5 bg-[#f0f2f5] px-3 pb-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
            <input
              readOnly
              value={botName}
              className="h-9 w-full rounded-lg bg-white pl-9 pr-3 text-sm text-stone-700 outline-none ring-0"
            />
          </div>
        </div>

        {/* Single active chat */}
        <button
          type="button"
          className="flex w-full items-center gap-3 bg-[#f0f2f5] px-3 py-3 text-left hover:bg-[#f0f2f5]"
        >
          <div className="flex h-[49px] w-[49px] shrink-0 items-center justify-center rounded-full bg-emerald-600">
            <span className="text-lg font-medium text-white">B</span>
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between">
              <span className="truncate text-[15px] font-semibold text-stone-900">{botName}</span>
              {messages.length > 0 && (
                <span className="ml-2 text-xs text-stone-500">
                  {format(messages[messages.length - 1].time, 'hh:mm a')}
                </span>
              )}
            </div>
            <p className="truncate text-sm text-stone-500">
              {messages.length > 0
                ? messages[messages.length - 1].text || 'Typing…'
                : 'Local WhatsApp simulator'}
            </p>
          </div>
        </button>
      </div>

      {/* ──────────────────────────────────────────────────────────────── */}
      {/* RIGHT CHAT AREA                                                  */}
      {/* ──────────────────────────────────────────────────────────────── */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Chat header */}
        <div className="flex h-[60px] shrink-0 items-center gap-3 bg-[#f0f2f5] px-4">
          <button
            type="button"
            className="md:hidden text-stone-600"
            onClick={() => {}}
            aria-label="Back"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-600">
            <span className="text-sm font-medium text-white">B</span>
          </div>
          <div className="min-w-0">
            <p className="truncate text-base font-semibold text-stone-900">{botName}</p>
            <p className="text-sm text-emerald-600">online</p>
          </div>

          {/* State + handover indicator */}
          <div className="ml-2 hidden min-w-0 items-center gap-2 sm:flex">
            {lastState && (
              <span className="truncate rounded-full bg-stone-200 px-2.5 py-0.5 text-xs text-stone-600">
                {lastState}
              </span>
            )}
            {handover && (
              <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-700">
                Human handover
              </span>
            )}
          </div>

          {/* Persona selector */}
          <div className="ml-auto flex items-center gap-2">
            <label className="flex items-center gap-2 text-xs font-medium text-stone-500">
              <span className="hidden lg:inline">Persona</span>
              <select
                value={userType}
                onChange={(e) => setUserType(e.target.value as UserType)}
                className="h-9 rounded-lg border border-stone-300 bg-white px-2 text-sm text-stone-800 outline-none"
              >
                <option value="auto">Auto</option>
                <option value="b2b">B2B Distributor</option>
                <option value="b2c">B2C Customer</option>
              </select>
            </label>
            <button
              type="button"
              onClick={handleReset}
              title="Reset conversation (clear state & human handover)"
              className="flex h-9 items-center gap-1 rounded-lg border border-stone-300 bg-white px-2.5 text-xs font-medium text-stone-600 transition-colors hover:bg-stone-100"
            >
              <RefreshCw className="h-4 w-4" />
              <span className="hidden sm:inline">Reset</span>
            </button>
          </div>
        </div>

        {/* Chat background (subtle doodle overlay) */}
        <div className="relative min-h-0 flex-1 overflow-y-auto bg-[#efeae2] px-4 py-4">
          {/* Doodle overlay */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-[0.06]"
            style={{
              backgroundImage:
                'radial-gradient(circle at 1px 1px, #000 1px, transparent 0)',
              backgroundSize: '22px 22px',
            }}
          />

          {/* Messages */}
          <div className="relative space-y-1">
            {messages.map((msg) => {
              const isOwn = msg.role === 'admin'
              const showTime = !msg.typing

              if (msg.typing) {
                return (
                  <div key={msg.id} className="flex justify-start">
                    <div className="relative ml-2 mb-1 flex max-w-[65%] items-center rounded-lg bg-white px-4 py-2.5 shadow-sm">
                      <div className="absolute -left-[8px] top-0 h-2 w-2 rotate-45 bg-white" />
                      <div className="flex gap-1">
                        <span className="h-2 w-2 animate-bounce rounded-full bg-stone-400 [animation-delay:0ms]" />
                        <span className="h-2 w-2 animate-bounce rounded-full bg-stone-400 [animation-delay:150ms]" />
                        <span className="h-2 w-2 animate-bounce rounded-full bg-stone-400 [animation-delay:300ms]" />
                      </div>
                    </div>
                  </div>
                )
              }

              return (
                <div key={msg.id}>
                  <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
                    <div
                      className={`relative mb-1 max-w-[65%] rounded-lg px-2.5 py-1.5 shadow-sm ${
                        isOwn ? 'mr-2 bg-[#d9fdd3]' : 'ml-2 bg-white'
                      }`}
                    >
                      {isOwn ? (
                        <div className="absolute -right-[8px] top-0 h-2 w-2 rotate-45 bg-[#d9fdd3]" />
                      ) : (
                        <div className="absolute -left-[8px] top-0 h-2 w-2 rotate-45 bg-white" />
                      )}

                      <div className="flex flex-col">
                        {msg.imageUrl && (
                          <img
                            src={msg.imageUrl}
                            alt={msg.imageCaption || 'product image'}
                            loading="lazy"
                            className="mb-1.5 max-h-64 w-full rounded-md object-cover"
                            onError={(e) => {
                              ;(e.currentTarget as HTMLImageElement).style.display = 'none'
                            }}
                          />
                        )}
                        <div className="flex items-end gap-2 pl-0.5 pr-1">
                          {msg.text && (
                            <p className="text-[14.2px] leading-[19px] text-stone-800 whitespace-pre-wrap break-words">
                              {msg.text}
                            </p>
                          )}
                          {showTime && (
                            <span className="mb-0.5 flex items-center gap-1 text-[11px] text-stone-500">
                              {format(msg.time, 'hh:mm a')}
                              <Ticks read={true} own={isOwn} />
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Interactive buttons */}
                  {msg.buttons && msg.buttons.length > 0 && (
                    <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'} ml-2 mb-1 max-w-[65%] overflow-hidden rounded-lg bg-white shadow-sm`}>
                      <div className="flex w-full flex-col">
                        {msg.buttons.map((btn, idx) => (
                          <button
                            key={btn.id}
                            type="button"
                            onClick={() => handleButtonClick(btn)}
                            className={`px-4 py-2 text-[14.2px] font-medium text-[#00a884] transition-colors hover:bg-stone-50 ${
                              idx > 0 ? 'border-t border-stone-200' : ''
                            }`}
                          >
                            {btn.title}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* List menu (real WhatsApp list-menu style) */}
                  {msg.listSections && msg.listSections.length > 0 && (
                    <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'} ml-2 mb-1 max-w-[65%] overflow-hidden rounded-lg bg-white shadow-sm`}>
                      <div className="flex w-full flex-col">
                        {msg.listSections.map((section, si) => (
                          <div key={si}>
                            {section.title && (
                              <div className="px-4 pb-0.5 pt-2 text-[11px] font-semibold uppercase tracking-wide text-stone-400">
                                {section.title}
                              </div>
                            )}
                            {section.rows?.map((row, ri) => (
                              <button
                                key={`${si}-${ri}`}
                                type="button"
                                onClick={() => handleListSelect(row)}
                                className="flex w-full items-center justify-between gap-2 border-t border-stone-200 px-4 py-2.5 text-left transition-colors hover:bg-stone-50"
                              >
                                <span className="text-[14.2px] font-medium text-stone-800">
                                  {row.title}
                                </span>
                                {row.description && (
                                  <span className="truncate text-[12px] text-stone-400">
                                    {row.description}
                                  </span>
                                )}
                              </button>
                            ))}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Input area */}
        <div className="flex shrink-0 items-center gap-2 bg-[#f0f2f5] px-4 py-3">
          <button type="button" className="text-stone-500 hover:text-stone-700" aria-label="Emoji">
            <Smile className="h-6 w-6" />
          </button>
          <button
            type="button"
            className="text-stone-500 hover:text-stone-700"
            aria-label="Attachment"
          >
            <Paperclip className="h-6 w-6" />
          </button>

          <input
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message"
            className="h-11 flex-1 rounded-lg border-none bg-white px-3 py-2.5 text-[15px] text-stone-900 outline-none placeholder:text-stone-400"
          />

          {showMic ? (
            <button type="button" className="text-stone-500 hover:text-stone-700" aria-label="Mic">
              <Mic className="h-6 w-6" />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => handleSend()}
              disabled={sending}
              className="text-[#00a884] hover:text-[#008f6f] disabled:opacity-50"
              aria-label="Send"
            >
              <Send className="h-6 w-6" />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
