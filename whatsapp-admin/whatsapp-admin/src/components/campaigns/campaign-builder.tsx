import { useMemo, useState } from 'react'
import { format } from 'date-fns'
import {
  ChevronLeft,
  ChevronRight,
  FileText,
  Loader2,
  X,
} from 'lucide-react'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type {
  AudienceSegment,
  Campaign,
  TemplateType,
} from '@/lib/types'
import {
  useAudienceCount,
  useCreateCampaign,
} from '@/lib/hooks/useCampaigns'
import { useCampaignDocuments } from '@/lib/hooks/useFiles'

/* ------------------------------------------------------------------ */
/* CONSTANTS                                                          */
/* ------------------------------------------------------------------ */

const REGIONS = ['All', 'North', 'South', 'East', 'West']
const TIERS = ['Gold', 'Silver', 'Bronze']
const PRODUCT_INTERESTS = [
  'Peanut Chikki',
  'Millet Chikki',
  'Sesame Chikki',
  'Dry Fruit Chikki',
]

const TEMPLATE_TYPES: {
  value: TemplateType
  label: string
  hint: string
}[] = [
  {
    value: 'plain_text',
    label: 'Plain Text',
    hint: 'Simple broadcast message',
  },
  {
    value: 'interactive_button',
    label: 'Interactive Button',
    hint: 'Message with up to 3 quick-reply buttons',
  },
  {
    value: 'interactive_list',
    label: 'Interactive List',
    hint: 'Message with a selectable list of options',
  },
  {
    value: 'document',
    label: 'Document (PDF Catalog)',
    hint: 'Send a PDF with a caption',
  },
]

const VARIABLE_FIELDS = [
  {
    key: 'distributor_name',
    label: '{{distributor_name}}',
    sample: 'Ravi Traders',
  },
  {
    key: 'region',
    label: '{{region}}',
    sample: 'North',
  },
]

const TIMEZONES = [
  'Asia/Kolkata',
  'Asia/Dubai',
  'Asia/Singapore',
  'UTC',
]

const STEPS = ['Audience', 'Template', 'Schedule']

/* ------------------------------------------------------------------ */
/* MULTI-SELECT CHIP GROUP                                            */
/* ------------------------------------------------------------------ */

function ChipMultiSelect({
  title,
  options,
  selected,
  onToggle,
}: {
  title: string
  options: string[]
  selected: string[]
  onToggle: (v: string) => void
}) {
  return (
    <div>
      <Label className="mb-1.5 block text-xs uppercase tracking-wide text-muted-foreground">
        {title}
      </Label>

      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => {
          const active = selected.includes(o)

          return (
            <button
              key={o}
              type="button"
              onClick={() => onToggle(o)}
              className={cn(
                `
                  rounded-full border px-3 py-1 text-xs font-medium
                  transition-colors
                `,
                active
                  ? 'border-sky-600 bg-sky-600 text-white'
                  : 'bg-card text-muted-foreground hover:bg-accent'
              )}
            >
              {o}
            </button>
          )
        })}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* WHATSAPP PREVIEW PHONE                                             */
/* ------------------------------------------------------------------ */

function renderTemplate(
  template: string,
  vars: Record<string, string>
) {
  return template.replace(
    /\{\{(\w+)\}\}/g,
    (_m, key) => vars[key] || `{{${key}}}`
  )
}

function WhatsAppPreview({
  templateType,
  message,
  buttons,
  listItems,
  mediaName,
}: {
  templateType: TemplateType
  message: string
  buttons: { label: string; value: string }[]
  listItems: { title: string; description?: string }[]
  mediaName?: string | null
}) {
  return (
    <div className="mx-auto w-full max-w-[300px] overflow-hidden rounded-[2rem] border-[6px] border-slate-800 bg-[#e5ddd5] shadow-xl">
      {/* WHATSAPP HEADER */}
      <div className="flex items-center gap-2 bg-[#075e54] px-4 py-2.5">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/90 text-xs font-bold text-[#075e54]">
          T
        </span>

        <div>
          <p className="text-xs font-semibold text-white">
            TrooGood
          </p>

          <p className="text-[10px] text-emerald-100">
            Business Account
          </p>
        </div>
      </div>

      {/* CHAT BODY */}
      <div className="min-h-[280px] space-y-2 p-3">
        <div className="ml-auto w-fit max-w-[85%] rounded-lg rounded-tr-none bg-[#dcf8c6] p-2.5 shadow-sm">
          {!!mediaName && templateType === 'document' && (
            <div className="mb-1.5 flex items-center gap-2 rounded-md bg-black/10 px-2 py-1.5">
              <FileText className="h-4 w-4" />

              <span className="max-w-[150px] truncate text-xs font-medium">
                {mediaName}
              </span>
            </div>
          )}

          <p className="whitespace-pre-wrap break-words text-xs leading-relaxed text-slate-800">
            {message || 'Your message preview appears here...'}
          </p>

          {/* INTERACTIVE BUTTONS */}

          {templateType === 'interactive_button' &&
            buttons.filter((b) => b.label.trim()).length > 0 && (
              <div className="mt-2 space-y-1 border-t border-black/10 pt-1.5">
                {buttons
                  .filter((b) => b.label.trim())
                  .map((b, i) => (
                    <button
                      key={i}
                      className="
                        w-full rounded-md py-1.5 text-center text-xs
                        font-semibold text-[#128c7e]
                      "
                    >
                      {b.label}
                    </button>
                  ))}
              </div>
            )}

          {/* INTERACTIVE LIST */}

          {templateType === 'interactive_list' &&
            listItems.filter((l) => l.title.trim()).length > 0 && (
              <div className="mt-2 divide-y divide-black/10 border-t border-black/10 pt-1">
                {listItems
                  .filter((l) => l.title.trim())
                  .map((l, i) => (
                    <div key={i} className="py-1.5">
                      <p className="text-xs font-semibold text-slate-800">
                        {l.title}
                      </p>

                      {l.description && (
                        <p className="text-[10px] text-slate-500">
                          {l.description}
                        </p>
                      )}
                    </div>
                  ))}
              </div>
            )}

          <p className="mt-1 text-right text-[9px] text-slate-400">
            {format(new Date(), 'h:mm a')} ✓✓
          </p>
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* CAMPAIGN BUILDER MODAL                                             */
/* ------------------------------------------------------------------ */

interface CampaignBuilderProps {
  open: boolean
  onClose: () => void
  initial?: Campaign | null
}

export function CampaignBuilder({
  open,
  onClose,
  initial,
}: CampaignBuilderProps) {
  const [step, setStep] = useState(0)

  /* STEP 1 — AUDIENCE */

  const [audienceType, setAudienceType] =
    useState<'all' | 'segment'>(
      initial?.audience_type ?? 'all'
    )

  const [regions, setRegions] = useState<string[]>(
    initial?.segment?.regions ?? []
  )

  const [tiers, setTiers] = useState<string[]>(
    initial?.segment?.tiers ?? []
  )

  const [interests, setInterests] = useState<string[]>(
    initial?.segment?.product_interests ?? []
  )

  /* STEP 2 — TEMPLATE */

  const [name, setName] = useState(initial?.name ?? '')

  const [templateType, setTemplateType] =
    useState<TemplateType>(
      initial?.template_type ?? 'plain_text'
    )

  const [message, setMessage] = useState(
    initial?.message_template ??
      "Hi {{distributor_name}}! 🎉 New festive offer for our {{region}} partners — flat 15% off on bulk orders this week."
  )

  const [variables, setVariables] = useState<
    Record<string, string>
  >({
    distributor_name: 'Ravi Traders',
    region: 'North',
  })

  const [buttons, setButtons] = useState([
    { label: 'Order Now', value: 'order_now' },
    { label: 'View Catalog', value: 'view_catalog' },
    { label: '', value: '' },
  ])

  const [listItems, setListItems] = useState([
    {
      title: 'Peanut Chikki 16g',
      description: '₹5 per unit · MOQ 100',
    },
    {
      title: 'Millet Chikki 32g',
      description: '₹12 per unit · MOQ 50',
    },
  ])

  const [mediaName, setMediaName] = useState(
    initial?.media_filename ?? ''
  )

  /* Available PDF documents for the Document template */
  const { documents: documentFiles, loading: documentsLoading } =
    useCampaignDocuments()

  /* Whether the user is typing a filename manually instead of picking
     one from the available document list. */
  const [docManualMode, setDocManualMode] = useState(false)

  /* STEP 3 — SCHEDULE */

  const [scheduleMode, setScheduleMode] =
    useState<'now' | 'later'>(
      initial?.schedule_mode ?? 'now'
    )

  const [scheduledAt, setScheduledAt] = useState(
    initial?.scheduled_at?.slice(0, 16) ?? ''
  )

  const [timezone, setTimezone] = useState(
    initial?.timezone ?? 'Asia/Kolkata'
  )

  /* -------------------------------------------------------------- */
  /* AUDIENCE COUNT                                                 */
  /* -------------------------------------------------------------- */

  const segment: AudienceSegment | null = useMemo(() => {
    if (audienceType === 'all') return null

    return {
      regions,
      tiers,
      product_interests: interests,
    }
  }, [audienceType, regions, tiers, interests])

  const { data: count, isFetching: counting } =
    useAudienceCount(segment)

  const createCampaign = useCreateCampaign(onClose)

  if (!open) return null

  /* -------------------------------------------------------------- */
  /* VALIDATION                                                     */
  /* -------------------------------------------------------------- */

  const canNext =
    step === 0
      ? audienceType === 'all' ||
        regions.length + tiers.length + interests.length > 0
      : step === 1
        ? !!name.trim() && !!message.trim()
        : scheduleMode === 'now' || !!scheduledAt

  /* -------------------------------------------------------------- */
  /* SAVE                                                           */
  /* -------------------------------------------------------------- */

  const handleSave = () => {
    createCampaign.mutate({
      id: initial?.id,
      name: name.trim(),
      status:
        scheduleMode === 'later' ? 'scheduled' : 'draft',
      audience_type: audienceType,
      segment:
        audienceType === 'all'
          ? null
          : {
              regions,
              tiers,
              product_interests: interests,
            },
      template_type: templateType,
      message_template: message,
      template_variables: variables,
      buttons:
        templateType === 'interactive_button'
          ? buttons.filter((b) => b.label.trim())
          : [],
      list_items:
        templateType === 'interactive_list'
          ? listItems.filter((l) => l.title.trim())
          : [],
      media_filename:
        templateType === 'document'
          ? mediaName.trim() || null
          : null,
      schedule_mode: scheduleMode,
      scheduled_at:
        scheduleMode === 'later' && scheduledAt
          ? new Date(scheduledAt).toISOString()
          : null,
      timezone,
    })
  }

  /* -------------------------------------------------------------- */
  /* RENDER                                                         */
  /* -------------------------------------------------------------- */

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="flex h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-background shadow-2xl">
        {/* HEADER */}

        <div className="flex items-center justify-between border-b px-6 py-4">
          <div>
            <h2 className="text-lg font-bold">
              {initial ? 'Edit Campaign' : 'New Campaign'}
            </h2>

            <p className="text-sm text-muted-foreground">
              Step {step + 1} of 3 · {STEPS[step]}
            </p>
          </div>

          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* STEP INDICATOR */}

        <div className="flex items-center gap-2 border-b bg-slate-50 px-6 py-3">
          {STEPS.map((label, i) => (
            <div key={label} className="flex items-center gap-2">
              <span
                className={cn(
                  `
                    flex h-6 w-6 items-center justify-center rounded-full
                    text-xs font-bold
                  `,
                  i === step
                    ? 'bg-sky-600 text-white'
                    : i < step
                      ? 'bg-green-500 text-white'
                      : 'bg-slate-200 text-slate-500'
                )}
              >
                {i + 1}
              </span>

              <span
                className={cn(
                  'text-sm font-medium',
                  i === step
                    ? 'text-foreground'
                    : 'text-muted-foreground'
                )}
              >
                {label}
              </span>

              {i < STEPS.length - 1 && (
                <ChevronRight className="h-4 w-4 text-slate-300" />
              )}
            </div>
          ))}
        </div>

        {/* BODY */}

        <div className="min-h-0 flex-1 overflow-y-auto p-6">
          {/* ------------------------------------------------ */}
          {/* STEP 1 — AUDIENCE TARGETING                     */}
          {/* ------------------------------------------------ */}

          {step === 0 && (
            <div className="mx-auto max-w-2xl space-y-6">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {(
                  [
                    {
                      value: 'all',
                      title: 'All Distributors',
                      desc: 'Everyone in the network',
                    },
                    {
                      value: 'segment',
                      title: 'Specific Segment',
                      desc: 'Filter by region, tier, interest',
                    },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setAudienceType(opt.value)}
                    className={cn(
                      `
                        rounded-xl border-2 p-4 text-left transition-all
                      `,
                      audienceType === opt.value
                        ? 'border-sky-600 bg-sky-50 ring-1 ring-sky-300'
                        : 'hover:border-slate-300'
                    )}
                  >
                    <p className="font-semibold">
                      {opt.title}
                    </p>

                    <p className="mt-0.5 text-sm text-muted-foreground">
                      {opt.desc}
                    </p>
                  </button>
                ))}
              </div>

              {audienceType === 'segment' && (
                <div className="space-y-5 rounded-xl border p-4">
                  <ChipMultiSelect
                    title="Region"
                    options={REGIONS}
                    selected={regions}
                    onToggle={(v) =>
                      setRegions((prev) => {
                        if (v === 'All') {
                          return prev.includes('All') ? [] : ['All']
                        }
                        const next = prev.filter((x) => x !== 'All' && x !== v)
                        if (!prev.includes(v)) next.push(v)
                        return next
                      })
                    }
                  />

                  <ChipMultiSelect
                    title="Sales Volume Tier"
                    options={TIERS}
                    selected={tiers}
                    onToggle={(v) =>
                      setTiers((prev) =>
                        prev.includes(v)
                          ? prev.filter((x) => x !== v)
                          : [...prev, v]
                      )
                    }
                  />

                  <ChipMultiSelect
                    title="Product Interest"
                    options={PRODUCT_INTERESTS}
                    selected={interests}
                    onToggle={(v) =>
                      setInterests((prev) =>
                        prev.includes(v)
                          ? prev.filter((x) => x !== v)
                          : [...prev, v]
                      )
                    }
                  />
                </div>
              )}

              {/* DYNAMIC COUNT */}

              <div className="flex items-center justify-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                {counting ? (
                  <Loader2 className="h-4 w-4 animate-spin text-amber-600" />
                ) : (
                  <span>🔥</span>
                )}

                <p className="text-sm font-semibold text-amber-800">
                  This campaign will target{' '}
                  {audienceType === 'all'
                    ? (count ?? '…')
                    : (count ?? '…')}{' '}
                  distributor{(count ?? 0) === 1 ? '' : 's'}
                </p>
              </div>
            </div>
          )}

          {/* ------------------------------------------------ */}
          {/* STEP 2 — MESSAGE TEMPLATE BUILDER               */}
          {/* ------------------------------------------------ */}

          {step === 1 && (
            <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_320px]">
              <div className="space-y-5">
                <div>
                  <Label htmlFor="camp-name">Campaign Name</Label>

                  <Input
                    id="camp-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Diwali Bulk Discount 2026"
                    className="mt-1.5"
                  />
                </div>

                <div>
                  <Label className="mb-1.5 block">Template Type</Label>

                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {TEMPLATE_TYPES.map((t) => (
                      <button
                        key={t.value}
                        type="button"
                        onClick={() => setTemplateType(t.value)}
                        className={cn(
                          'rounded-lg border p-3 text-left transition-all',
                          templateType === t.value
                            ? 'border-sky-600 bg-sky-50 ring-1 ring-sky-300'
                            : 'hover:border-slate-300'
                        )}
                      >
                        <p className="text-sm font-semibold">
                          {t.label}
                        </p>

                        <p className="text-xs text-muted-foreground">
                          {t.hint}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <Label htmlFor="camp-msg">Message Body</Label>

                  <Textarea
                    id="camp-msg"
                    rows={5}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    className="mt-1.5"
                  />
                </div>

                {/* TYPE-SPECIFIC BUILDERS */}

                {templateType === 'interactive_button' && (
                  <div className="space-y-2 rounded-lg border p-3">
                    <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                      Quick Reply Buttons (max 3)
                    </Label>

                    {buttons.slice(0, 3).map((b, i) => (
                      <Input
                        key={i}
                        value={b.label}
                        onChange={(e) =>
                          setButtons((prev) => {
                            const next = [...prev]
                            next[i] = {
                              ...next[i],
                              label: e.target.value,
                              value: e.target.value
                                .toLowerCase()
                                .replace(/\s+/g, '_'),
                            }

                            return next
                          })
                        }
                        placeholder={`Button ${i + 1} label`}
                      />
                    ))}
                  </div>
                )}

                {templateType === 'interactive_list' && (
                  <div className="space-y-2 rounded-lg border p-3">
                    <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                      List Options
                    </Label>

                    {listItems.map((l, i) => (
                      <div key={i} className="flex gap-2">
                        <Input
                          value={l.title}
                          onChange={(e) =>
                            setListItems((prev) => {
                              const next = [...prev]
                              next[i] = {
                                ...next[i],
                                title: e.target.value,
                              }

                              return next
                            })
                          }
                          placeholder={`Item ${i + 1} title`}
                        />

                        <Input
                          value={l.description ?? ''}
                          onChange={(e) =>
                            setListItems((prev) => {
                              const next = [...prev]
                              next[i] = {
                                ...next[i],
                                description: e.target.value,
                              }

                              return next
                            })
                          }
                          placeholder="Description (optional)"
                        />
                      </div>
                    ))}

                    {listItems.length < 10 && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setListItems((prev) => [
                            ...prev,
                            { title: '', description: '' },
                          ])
                        }
                      >
                        + Add item
                      </Button>
                    )}
                  </div>
                )}

                {templateType === 'document' && (
                  <div>
                    <Label htmlFor="camp-media">
                      Document (PDF Catalog)
                    </Label>

                    {documentsLoading ? (
                      <p className="mt-1.5 flex items-center gap-2 text-xs text-muted-foreground">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        Loading available documents...
                      </p>
                    ) : documentFiles.length > 0 && !docManualMode ? (
                      <>
                        <Select
                          value={documentFiles.includes(mediaName) ? mediaName : '__none__'}
                          onValueChange={(val) => {
                            if (val === '__manual__') {
                              setDocManualMode(true)
                              return
                            }
                            setMediaName(val)
                          }}
                        >
                          <SelectTrigger id="camp-media" className="mt-1.5 w-full">
                            <SelectValue
                              placeholder="Select a document from the Files module"
                            />
                          </SelectTrigger>
                          <SelectContent>
                            {documentFiles.map((f) => (
                              <SelectItem key={f} value={f}>
                                {f}
                              </SelectItem>
                            ))}
                            <SelectItem value="__manual__">
                              Type a filename manually…
                            </SelectItem>
                          </SelectContent>
                        </Select>

                        <div className="mt-1.5 flex flex-wrap items-center gap-2">
                          <span className="text-xs text-muted-foreground">
                            Documents available from the Files module
                            (catalogue / new arrivals).
                          </span>
                        </div>
                      </>
                    ) : (
                      <Input
                        id="camp-media"
                        value={mediaName}
                        onChange={(e) => setMediaName(e.target.value)}
                        placeholder="troogood-catalog-2026.pdf"
                        className="mt-1.5"
                      />
                    )}

                    {(documentFiles.length > 0 || docManualMode) && (
                      <button
                        type="button"
                        onClick={() => {
                          setDocManualMode((v) => !v)
                          setMediaName('')
                        }}
                        className="mt-1.5 text-xs font-medium text-sky-600 hover:underline"
                      >
                        {docManualMode ? '← Pick from uploaded documents' : 'Or type a filename manually…'}
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* PREVIEW PANE */}

              <div className="lg:sticky lg:top-0 lg:self-start">
                <p className="mb-2 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Live Preview
                </p>

                <WhatsAppPreview
                  templateType={templateType}
                  message={renderTemplate(message, variables)}
                  buttons={buttons}
                  listItems={listItems}
                  mediaName={mediaName}
                />
              </div>
            </div>
          )}

          {/* ------------------------------------------------ */}
          {/* STEP 3 — SCHEDULING                             */}
          {/* ------------------------------------------------ */}

          {step === 2 && (
            <div className="mx-auto max-w-xl space-y-6">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {(
                  [
                    {
                      value: 'now',
                      title: '🚀 Send Now',
                      desc: 'Start broadcasting immediately',
                    },
                    {
                      value: 'later',
                      title: '🕒 Schedule for Later',
                      desc: 'Pick a date & time',
                    },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() =>
                      setScheduleMode(opt.value)
                    }
                    className={cn(
                      'rounded-xl border-2 p-4 text-left transition-all',
                      scheduleMode === opt.value
                        ? 'border-sky-600 bg-sky-50 ring-1 ring-sky-300'
                        : 'hover:border-slate-300'
                    )}
                  >
                    <p className="font-semibold">{opt.title}</p>

                    <p className="mt-0.5 text-sm text-muted-foreground">
                      {opt.desc}
                    </p>
                  </button>
                ))}
              </div>

              {scheduleMode === 'later' && (
                <>
                  <div>
                    <Label htmlFor="sched-at">
                      Date & Time
                    </Label>

                    <Input
                      id="sched-at"
                      type="datetime-local"
                      value={scheduledAt}
                      onChange={(e) =>
                        setScheduledAt(e.target.value)
                      }
                      min={format(new Date(), "yyyy-MM-dd'T'HH:mm")}
                      className="mt-1.5"
                    />
                  </div>

                  <div>
                    <Label htmlFor="sched-tz">Timezone</Label>

                    <select
                      id="sched-tz"
                      value={timezone}
                      onChange={(e) => setTimezone(e.target.value)}
                      className="
                        mt-1.5 w-full cursor-pointer rounded-md border
                        bg-card px-3 py-2 text-sm outline-none
                        focus:ring-2 focus:ring-sky-500
                      "
                    >
                      {TIMEZONES.map((tz) => (
                        <option key={tz} value={tz}>
                          {tz}
                        </option>
                      ))}
                    </select>

                    <p className="mt-1 text-xs text-muted-foreground">
                      Distributors receive the message at this local
                      server time — important for pan-India sends.
                    </p>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* FOOTER */}

        <div className="flex items-center justify-between border-t bg-slate-50 px-6 py-4">
          <Button
            variant="outline"
            disabled={step === 0}
            onClick={() => setStep((s) => s - 1)}
            className="gap-1.5"
          >
            <ChevronLeft className="h-4 w-4" />
            Back
          </Button>

          {step < 2 ? (
            <Button
              disabled={!canNext}
              onClick={() => setStep((s) => s + 1)}
              className="gap-1.5 bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-700 hover:to-blue-700"
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              disabled={!canNext || createCampaign.isPending}
              onClick={handleSave}
              className="gap-1.5 bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-700 hover:to-blue-700"
            >
              {createCampaign.isPending && (
                <Loader2 className="h-4 w-4 animate-spin" />
              )}
              {scheduleMode === 'later'
                ? 'Schedule Campaign'
                : 'Save & Launch'}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

export default CampaignBuilder
