import { useState } from 'react'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { useAction, useAsync } from '@/lib/hooks'
import { useAuth } from '@/lib/auth'
import { type Campaign, type CampaignInput, operationsApi } from '@/lib/operations'
import { formatDate } from '@/lib/format'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { Input, Textarea } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Alert, EmptyState, LoadingBlock } from '@/components/ui/feedback'
import { PageHeader } from '@/components/layout/page-header'
import { useToast } from '@/components/ui/toast'

const STATUS_TONE: Record<string, 'neutral' | 'accent' | 'success' | 'warning' | 'danger' | 'muted'> = {
  draft: 'muted',
  scheduled: 'accent',
  sending: 'warning',
  sent: 'success',
  failed: 'danger',
  cancelled: 'danger',
}

/** Statuses an admin can set from the console; the rest are set by the scheduler. */
const CAMPAIGN_STATUSES = ['draft', 'scheduled', 'sent', 'cancelled']

interface CampaignFormShape {
  name: string
  status: string
  message_template: string
  schedule_mode: string
  scheduled_at: string
  timezone: string
}

function toShape(campaign?: Campaign | null): CampaignFormShape {
  return {
    name: campaign?.name ?? '',
    status: campaign?.status ?? 'draft',
    message_template: campaign?.message_template ?? '',
    schedule_mode: campaign?.schedule_mode ?? 'now',
    scheduled_at: campaign?.scheduled_at ?? '',
    timezone: campaign?.timezone ?? 'Asia/Kolkata',
  }
}

/**
 * Broadcast campaigns and their delivery metrics. Reading needs
 * `view_campaigns`; creating, editing and deleting needs `manage_campaigns`.
 */
export function CampaignsPanel({ tenantId }: { tenantId: string }) {
  const { can } = useAuth()
  const toast = useToast()
  const action = useAction()
  const canManage = can('manage_campaigns')

  const [editing, setEditing] = useState<Campaign | null>(null)
  const [creating, setCreating] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null)

  const state = useAsync((signal) => operationsApi.campaigns(tenantId, signal), [tenantId])

  const campaigns = state.data?.campaigns ?? []
  const stats = state.data?.stats

  const submit = async (input: Omit<CampaignInput, 'audience_type' | 'segment' | 'template_type' | 'template_variables' | 'buttons' | 'list_items' | 'media_filename'>) => {
    if (editing) {
      // PUT replaces every column, so pass the fields the form does not own
      // straight through from the stored campaign.
      const body: CampaignInput = {
        ...input,
        audience_type: editing.audience_type,
        segment: editing.segment ?? null,
        template_type: editing.template_type,
        template_variables: editing.template_variables ?? {},
        buttons: editing.buttons ?? [],
        list_items: editing.list_items ?? [],
        media_filename: editing.media_filename ?? null,
      }
      const result = await action.run(() => operationsApi.updateCampaign(tenantId, editing.id, body))
      if (result) {
        toast.push('Campaign updated')
        setEditing(null)
        state.reload()
      }
      return
    }
    const result = await action.run(() => operationsApi.createCampaign(tenantId, { ...input, audience_type: 'all' }))
    if (result) {
      toast.push('Campaign created')
      setCreating(false)
      state.reload()
    }
  }

  const remove = async (campaign: Campaign) => {
    const result = await action.run(() => operationsApi.deleteCampaign(tenantId, campaign.id))
    if (result) {
      toast.push('Campaign deleted')
      setConfirmDelete(null)
      if (editing?.id === campaign.id) setEditing(null)
      state.reload()
    }
  }

  return (
    <div>
      <PageHeader
        title="Campaigns"
        description="Scheduled and sent broadcast messages, with delivery and reply metrics per campaign."
        actions={
          canManage && !creating && !editing && (
            <Button variant="primary" icon={<Plus className="h-4 w-4" />} onClick={() => setCreating(true)}>
              New campaign
            </Button>
          )
        }
        meta={
          stats && (
            <>
              <Badge tone={stats.active_campaigns ? 'accent' : 'muted'}>
                {stats.active_campaigns} active
              </Badge>
              <Badge tone="success">{stats.total_sent_24h} sent (24h)</Badge>
              <Badge tone="muted">{stats.delivery_rate}% delivered</Badge>
              <Badge tone="muted">{stats.reply_rate}% replied</Badge>
            </>
          )
        }
      />

      {(creating || editing) && (
        <CampaignForm
          initial={editing}
          busy={action.busy}
          error={action.error}
          onCancel={() => {
            setCreating(false)
            setEditing(null)
          }}
          onSubmit={submit}
        />
      )}

      {state.loading && <LoadingBlock label="Reading campaigns…" />}
      {state.error && (
        <Alert tone="danger" title="Could not read campaigns">
          {state.error}
        </Alert>
      )}

      {state.data && campaigns.length === 0 && !creating && !editing && (
        <Card>
          <EmptyState
            title="No campaigns yet"
            description="Create a broadcast here and it will be sent to the audience when its schedule fires."
            action={
              canManage && (
                <Button variant="subtle" icon={<Plus className="h-4 w-4" />} onClick={() => setCreating(true)}>
                  New campaign
                </Button>
              )
            }
          />
        </Card>
      )}

      {campaigns.length > 0 && (
        <Card>
          <CardBody className="divide-y divide-surface-line">
            {campaigns.map((campaign) => (
              <div key={campaign.id} className="flex flex-wrap items-center gap-3 py-3 first:pt-0 last:pb-0">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-100">
                    {campaign.name || `Campaign #${campaign.id}`}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-slate-500">
                    {campaign.audience_type} · {campaign.target_count} targeted
                    {campaign.schedule_mode === 'scheduled' && campaign.scheduled_at
                      ? ` · scheduled ${formatDate(campaign.scheduled_at)}`
                      : ''}
                    {campaign.created_at ? ` · created ${formatDate(campaign.created_at)}` : ''}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge tone={STATUS_TONE[campaign.status] ?? 'neutral'}>{campaign.status}</Badge>
                  <Badge tone="muted">{campaign.metrics?.sent ?? 0} sent</Badge>
                  <Badge tone="accent">{campaign.metrics?.replied ?? 0} replied</Badge>
                  {(campaign.metrics?.failed ?? 0) > 0 && (
                    <Badge tone="danger">{campaign.metrics?.failed} failed</Badge>
                  )}
                  {canManage && (
                    <>
                      <Button size="sm" variant="ghost" onClick={() => setEditing(campaign)}>
                        <Pencil className="h-3.5 w-3.5" /> Edit
                      </Button>
                      {confirmDelete === campaign.id ? (
                        <>
                          <Button
                            size="sm"
                            variant="danger"
                            loading={action.busy}
                            onClick={() => remove(campaign)}
                          >
                            Delete forever
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(null)}>
                            Cancel
                          </Button>
                        </>
                      ) : (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-rose-400 hover:text-rose-300"
                          onClick={() => setConfirmDelete(campaign.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" /> Delete
                        </Button>
                      )}
                    </>
                  )}
                </div>
              </div>
            ))}
          </CardBody>
        </Card>
      )}
    </div>
  )
}

function CampaignForm({
  initial,
  busy,
  error,
  onSubmit,
  onCancel,
}: {
  initial: Campaign | null
  busy: boolean
  error: string | null
  onSubmit: (input: {
    name: string
    status: string
    message_template: string
    schedule_mode: string
    scheduled_at?: string | null
    timezone?: string
  }) => void
  onCancel: () => void
}) {
  const [form, setForm] = useState<CampaignFormShape>(() => toShape(initial))
  const [touched, setTouched] = useState(false)

  const set = <K extends keyof CampaignFormShape>(key: K, value: CampaignFormShape[K]) =>
    setForm((f) => ({ ...f, [key]: value }))

  const nameMissing = touched && !form.name.trim()
  const whenMissing = touched && form.schedule_mode === 'scheduled' && !form.scheduled_at.trim()

  const submit = () => {
    setTouched(true)
    if (!form.name.trim()) return
    if (form.schedule_mode === 'scheduled' && !form.scheduled_at.trim()) return
    onSubmit({
      name: form.name.trim(),
      status: form.status,
      message_template: form.message_template.trim(),
      schedule_mode: form.schedule_mode,
      scheduled_at: form.schedule_mode === 'scheduled' ? form.scheduled_at.trim() : null,
      timezone: form.timezone.trim() || 'Asia/Kolkata',
    })
  }

  return (
    <Card className="mb-4">
      <CardHeader
        title={initial ? `Edit ${initial.name || `Campaign #${initial.id}`}` : 'New campaign'}
        description="The message body is broadcast to every distributor in the audience when the schedule fires."
      />
      <CardBody className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Name"
            value={form.name}
            error={nameMissing ? 'A name is required' : undefined}
            onChange={(e) => set('name', e.target.value)}
            placeholder="Diwali restock offer"
          />
          <Select label="Status" value={form.status} onChange={(e) => set('status', e.target.value)}>
            {CAMPAIGN_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
        </div>

        <Textarea
          label="Message"
          rows={4}
          value={form.message_template}
          onChange={(e) => set('message_template', e.target.value)}
          hint="Sent as-is. Use *bold* WhatsApp formatting; variables like {name} resolve at send time."
        />

        <div className="grid gap-4 sm:grid-cols-3">
          <Select label="Send" value={form.schedule_mode} onChange={(e) => set('schedule_mode', e.target.value)}>
            <option value="now">Immediately</option>
            <option value="scheduled">Scheduled</option>
          </Select>
          <Input
            label="Send at"
            value={form.scheduled_at}
            error={whenMissing ? 'Pick a date and time' : undefined}
            onChange={(e) => set('scheduled_at', e.target.value)}
            placeholder="2026-10-05 18:00:00"
            disabled={form.schedule_mode !== 'scheduled'}
          />
          <Input
            label="Timezone"
            value={form.timezone}
            onChange={(e) => set('timezone', e.target.value)}
            placeholder="Asia/Kolkata"
          />
        </div>

        {error && <Alert tone="danger" title="Could not save">{error}</Alert>}

        <div className="flex items-center gap-2">
          <Button variant="primary" loading={busy} onClick={submit}>
            {initial ? 'Save changes' : 'Create campaign'}
          </Button>
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </CardBody>
    </Card>
  )
}
