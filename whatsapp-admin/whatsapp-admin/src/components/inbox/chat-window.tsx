import { useRef, useState } from 'react'
import {
  Bot,
  CheckCircle2,
  FileText,
  Info,
  Paperclip,
  Send,
  User,
} from 'lucide-react'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

import type {
  ChatMessage,
  Conversation,
} from '@/lib/types'

import {
  useChatHistory,
  useHandoverToggle,
  useResolveHandoff,
  useSendAgentMessage,
} from '@/lib/hooks/useInbox'

import {
  HandoverToggle,
  TypingIndicator,
} from './inbox-widgets'

import { QUICK_TEMPLATES } from '@/lib/templates'

/* ------------------------------------------------------------------ */
/* MESSAGE BUBBLE                                                     */
/* ------------------------------------------------------------------ */

function MessageBubble({ m }: { m: ChatMessage }) {
  const role = m.role ?? 'user'
  const isUser = role === 'user'
  const isAgent = role === 'agent' || role === 'system'

  const text = m.text ?? m.body ?? ''

  return (
    <div
      className={cn(
        'flex w-full',
        isUser ? 'justify-start' : 'justify-end'
      )}
    >
      <div
        className={cn(
          `
            flex max-w-[75%] items-start gap-2 rounded-2xl px-4 py-2.5
            text-sm shadow-sm
          `,
          isUser
            ? 'rounded-bl-sm bg-white text-slate-800 ring-1 ring-slate-200'
            : isAgent
              ? 'rounded-br-sm bg-indigo-600 text-white'
              : 'rounded-br-sm bg-emerald-600 text-white'
        )}
      >
        {!isUser && (
          <span className="mt-0.5 shrink-0 opacity-80">
            {isAgent ? (
              <User className="h-3.5 w-3.5" />
            ) : (
              <Bot className="h-3.5 w-3.5" />
            )}
          </span>
        )}

        <div className="min-w-0">
          {!!m.media_url && (
            <a
              href={m.media_url}
              target="_blank"
              rel="noreferrer"
              className="
                mb-1 flex items-center gap-1.5 rounded-lg bg-black/10 px-2 py-1
                text-xs font-medium underline-offset-2 hover:underline
              "
            >
              <FileText className="h-3.5 w-3.5" />
              {m.media_type || 'Attachment'}
            </a>
          )}

          {text && (
            <p className="whitespace-pre-wrap break-words">
              {text}
            </p>
          )}

          {(m.created_at || m.timestamp) && (
            <p
              className={cn(
                'mt-1 text-[10px]',
                isUser
                  ? 'text-slate-400'
                  : 'text-white/70'
              )}
            >
              {m.sender && !isUser
                ? `${m.sender} · `
                : ''}
              {new Date(
                m.created_at ?? m.timestamp ?? Date.now()
              ).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* CHAT WINDOW                                                        */
/* ------------------------------------------------------------------ */

interface ChatWindowProps {
  conversation: Conversation | null
  onOpenDrawer: () => void
}

export function ChatWindow({
  conversation,
  onOpenDrawer,
}: ChatWindowProps) {
  const [draft, setDraft] = useState('')

  const [pendingFile, setPendingFile] =
    useState<File | null>(null)

  const fileInputRef =
    useRef<HTMLInputElement>(null)

  const { data: messages, isLoading: loadingHistory } =
    useChatHistory(conversation?.wa_id ?? null)

  const sendMessage = useSendAgentMessage(
    conversation?.wa_id ?? null
  )

  const handover = useHandoverToggle()

  const resolveHandoff = useResolveHandoff()

  if (!conversation) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 bg-slate-50 text-muted-foreground">
        <Bot className="h-10 w-10 opacity-30" />

        <p className="text-sm">
          Select a conversation to start chatting
        </p>
      </div>
    )
  }

  /* -------------------------------------------------------------- */
  /* HANDLERS                                                       */
  /* -------------------------------------------------------------- */

  const handleSend = () => {
    const text = draft.trim()

    if (!text && !pendingFile) return

    sendMessage.mutate(
      { text: text || undefined, file: pendingFile },
      {
        onSuccess: () => {
          setDraft('')
          setPendingFile(null)

          if (fileInputRef.current) {
            fileInputRef.current.value = ''
          }
        },
      }
    )
  }

  const mode = conversation.handover_mode ?? 'bot'

  /* -------------------------------------------------------------- */
  /* RENDER                                                         */
  /* -------------------------------------------------------------- */

  return (
    <div className="flex h-full flex-col bg-slate-50">
      {/* HEADER */}

      <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-card px-4 py-3">
        <div className="min-w-0">
          <h3 className="truncate text-base font-semibold">
            {conversation.name || conversation.wa_id}
          </h3>

          <p className="truncate text-xs text-muted-foreground">
            {mode === 'human'
              ? 'You are replying as a human agent'
              : 'Bot is handling this conversation'}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <HandoverToggle
            mode={mode}
            disabled={handover.isPending}
            onToggle={(m) =>
              handover.mutate({
                wa_id: conversation.wa_id,
                mode: m,
              })
            }
          />

          {mode === 'human' && (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 border-emerald-600 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800"
              disabled={resolveHandoff.isPending}
              onClick={() =>
                resolveHandoff.mutate(conversation.wa_id)
              }
            >
              <CheckCircle2 className="h-4 w-4" />
              Resolved &amp; Close
            </Button>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={onOpenDrawer}
            className="gap-1.5"
          >
            <Info className="h-4 w-4" />
            Info
          </Button>
        </div>
      </div>

      {/* MESSAGES */}

      <ScrollArea className="min-h-0 flex-1 px-4 py-4">
        <div className="space-y-3">
          {loadingHistory && !messages && (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Loading messages...
            </p>
          )}

          {(messages ?? []).map((m, i) => (
            <MessageBubble key={m.id ?? i} m={m} />
          ))}

          {/* Typing indicator — only meaningful while the bot is
              actively handling the conversation. Once an agent takes
              over (human mode), the bot is no longer replying. */}
          {mode === 'bot' && (
            <TypingIndicator label="Bot is typing..." />
          )}
        </div>
      </ScrollArea>

      {/* COMPOSER */}

      <div className="border-t bg-card p-3">
        {pendingFile && (
          <div className="mb-2 flex items-center gap-2 rounded-md bg-indigo-50 px-3 py-1.5 text-xs text-indigo-700">
            <FileText className="h-3.5 w-3.5 shrink-0" />

            <span className="flex-1 truncate">
              {pendingFile.name}
            </span>

            <button
              type="button"
              onClick={() => {
                setPendingFile(null)

                if (fileInputRef.current) {
                  fileInputRef.current.value = ''
                }
              }}
              className="font-semibold hover:text-indigo-900"
            >
              Remove
            </button>
          </div>
        )}

        <div className="flex items-end gap-2">
          {/* QUICK TEMPLATES */}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                title="Quick templates"
                className="h-10 w-10 shrink-0"
              >
                ⚡
              </Button>
            </DropdownMenuTrigger>

            <DropdownMenuContent align="start" className="w-72">
              {QUICK_TEMPLATES.map((t) => (
                <DropdownMenuItem
                  key={t}
                  onClick={() => setDraft(t)}
                  className="text-xs leading-snug"
                >
                  {t}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* SEND MEDIA */}

          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,image/*,.doc,.docx,.xlsx"
            className="hidden"
            onChange={(e) =>
              setPendingFile(e.target.files?.[0] ?? null)
            }
          />

          <Button
            variant="outline"
            size="icon"
            title="Attach PDF / Catalog"
            className="h-10 w-10 shrink-0"
            onClick={() => fileInputRef.current?.click()}
          >
            <Paperclip className="h-4 w-4" />
          </Button>

          {/* TEXT INPUT */}

          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleSend()
              }
            }}
            rows={1}
            placeholder={
              mode === 'human'
                ? 'Type your reply...'
                : 'Switch to Human Mode to reply'
            }
            disabled={mode !== 'human'}
            className="
              max-h-32 min-h-[40px] flex-1 resize-none rounded-md border
              bg-background px-3 py-2 text-sm outline-none
              placeholder:text-muted-foreground
              focus:ring-2 focus:ring-indigo-500
              disabled:cursor-not-allowed disabled:opacity-60
            "
          />

          <Button
            size="icon"
            className="h-10 w-10 shrink-0 bg-indigo-600 hover:bg-indigo-700"
            disabled={
              sendMessage.isPending ||
              mode !== 'human' ||
              (!draft.trim() && !pendingFile)
            }
            onClick={handleSend}
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}

export default ChatWindow
