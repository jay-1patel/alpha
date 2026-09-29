import { cn } from '@/lib/utils'
import type {
  AgentStatus,
  Conversation,
} from '@/lib/types'

/* ------------------------------------------------------------------ */
/* AGENT STATUS DROPDOWN                                              */
/* ------------------------------------------------------------------ */

const STATUS_OPTIONS: {
  value: AgentStatus
  label: string
  emoji: string
  dot: string
}[] = [
  {
    value: 'online',
    label: 'Online',
    emoji: '🟢',
    dot: 'bg-green-500',
  },
  {
    value: 'away',
    label: 'Away',
    emoji: '🌙',
    dot: 'bg-amber-500',
  },
  {
    value: 'dnd',
    label: 'Do Not Disturb',
    emoji: '🔴',
    dot: 'bg-red-500',
  },
]

interface AgentStatusDropdownProps {
  status: AgentStatus
  onChange: (s: AgentStatus) => void
}

export function AgentStatusDropdown({
  status,
  onChange,
}: AgentStatusDropdownProps) {
  const current =
    STATUS_OPTIONS.find((o) => o.value === status) ??
    STATUS_OPTIONS[0]

  return (
    <div className="flex items-center gap-2">
      <span
        className={cn(
          'relative flex h-3 w-3',
          status === 'online' && 'animate-pulse'
        )}
      >
        <span
          className={cn(
            'h-3 w-3 rounded-full ring-2 ring-white',
            current.dot,
            status === 'online' &&
              'animate-ping absolute inline-flex opacity-75'
          )}
        />
        {status === 'online' && (
          <span className="relative inline-flex h-3 w-3 rounded-full bg-green-500" />
        )}
      </span>

      <select
        aria-label="Agent status"
        value={status}
        onChange={(e) =>
          onChange(e.target.value as AgentStatus)
        }
        className="
          cursor-pointer rounded-md border bg-card px-2 py-1.5
          text-sm font-medium outline-none transition-colors
          focus:ring-2 focus:ring-indigo-500
        "
      >
        {STATUS_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.emoji} {o.label}
          </option>
        ))}
      </select>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* HANDOVER TOGGLE                                                    */
/* ------------------------------------------------------------------ */

interface HandoverToggleProps {
  mode: 'bot' | 'human'
  disabled?: boolean
  onToggle: (mode: 'bot' | 'human') => void
}

export function HandoverToggle({
  mode,
  disabled,
  onToggle,
}: HandoverToggleProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onToggle(mode === 'bot' ? 'human' : 'bot')}
      className={cn(
        `
          inline-flex items-center gap-2 rounded-lg px-4 py-2
          text-sm font-bold shadow-sm transition-all
          disabled:cursor-not-allowed disabled:opacity-60
        `,
        mode === 'human'
          ? 'border-2 border-indigo-600 bg-indigo-600 text-white'
          : 'border-2 border-green-600 bg-green-600 text-white'
      )}
    >
      {mode === 'human' ? '👨‍💼 Human Mode' : 'Switch to Human'}
    </button>
  )
}

/* ------------------------------------------------------------------ */
/* TYPING INDICATOR                                                   */
/* ------------------------------------------------------------------ */

export function TypingIndicator({ label }: { label?: string }) {
  return (
    <div className="flex items-center gap-1.5 px-1 py-1">
      {[0, 150, 300].map((delay) => (
        <span
          key={delay}
          className="h-2 w-2 animate-bounce rounded-full bg-slate-400"
          style={{ animationDelay: `${delay}ms` }}
        />
      ))}

      {label && (
        <span className="ml-1 text-xs text-muted-foreground">
          {label}
        </span>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* MISC                                                               */
/* ------------------------------------------------------------------ */

export function conversationTitle(c: Conversation) {
  return c.name || c.wa_id
}
