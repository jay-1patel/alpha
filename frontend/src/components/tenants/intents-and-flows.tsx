import { GitBranch, Workflow } from 'lucide-react'
import { useResolved } from './hooks'
import { FEATURE_LABELS } from '@/lib/verticals'
import type { FeatureFlag, FlowSpec, IntentSpec } from '@/lib/types'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, LoadingBlock } from '@/components/ui/feedback'
import { PageHeader } from '@/components/layout/page-header'

const STEP_TONES: Record<string, 'accent' | 'success' | 'warning' | 'neutral' | 'danger'> = {
  ask: 'accent',
  choice: 'accent',
  confirm: 'warning',
  say: 'neutral',
  save_lead: 'success',
  notify: 'success',
  handoff: 'danger',
  book_appointment: 'success',
  create_ticket: 'success',
}

export function IntentsAndFlows({ tenantId }: { tenantId: string }) {
  const { data, error, loading } = useResolved(tenantId)

  if (loading) return <LoadingBlock label="Loading intents and flows…" />
  if (error || !data) {
    return (
      <Alert tone="danger" title="Could not load intents">
        {error ?? 'Unknown error'}
      </Alert>
    )
  }

  const active = data.active_intents ?? []
  const inactive = data.inactive_intents ?? []
  const flows = data.flows ?? []

  return (
    <div>
      <PageHeader
        title="Intents and flows"
        description="An intent only wins when its feature flag is on — that is the gate that makes 'place order' unreachable for a tenant that does not sell online. Flows are data too: the runner has no per-tenant code."
        meta={
          <>
            <Badge tone="success">{active.length} active intents</Badge>
            <Badge tone="muted">{inactive.length} gated off</Badge>
            <Badge tone="accent">{flows.length} live flows</Badge>
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Active intents" description="What the classifier can route to right now." icon={<GitBranch className="h-4 w-4" />} />
          <CardBody className="space-y-2">
            {active.map((intent) => (
              <IntentRow key={intent.name} intent={intent} />
            ))}
            {!active.length && <p className="text-xs text-slate-500">No active intents in this profile.</p>}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Gated off" description="Defined, but unreachable while their feature flag is off." />
          <CardBody className="space-y-2">
            {inactive.map((intent) => (
              <IntentRow key={intent.name} intent={intent} muted />
            ))}
            {!inactive.length && <p className="text-xs text-slate-500">Nothing is gated off.</p>}
          </CardBody>
        </Card>
      </div>

      <div className="mt-4 space-y-4">
        {flows.map((flow) => (
          <FlowCard key={flow.name} flow={flow} />
        ))}
        {!flows.length && (
          <Card>
            <CardBody>
              <p className="text-xs text-slate-500">No flows are active for this tenant.</p>
            </CardBody>
          </Card>
        )}
      </div>
    </div>
  )
}

function IntentRow({ intent, muted }: { intent: IntentSpec; muted?: boolean }) {
  return (
    <div className={`rounded-lg p-3 ring-1 ring-inset ${muted ? 'bg-surface-panel ring-surface-line/60' : 'bg-surface-panel ring-surface-line'}`}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-slate-100">{intent.name}</span>
        {intent.flow && <Badge tone="accent">→ {intent.flow}</Badge>}
        {intent.requires_feature && (
          <Badge tone={muted ? 'danger' : 'neutral'}>
            requires {FEATURE_LABELS[intent.requires_feature as FeatureFlag]?.label ?? intent.requires_feature}
          </Badge>
        )}
        {!intent.enabled && <Badge tone="muted">disabled</Badge>}
      </div>
      {intent.keywords?.length ? (
        <p className="mt-1.5 text-xs leading-relaxed text-slate-500">
          {intent.keywords.slice(0, 14).join(' · ')}
        </p>
      ) : null}
      {intent.examples?.length ? (
        <p className="mt-1 text-xs italic leading-relaxed text-slate-600">“{intent.examples[0]}”</p>
      ) : null}
    </div>
  )
}

function FlowCard({ flow }: { flow: FlowSpec }) {
  return (
    <Card>
      <CardHeader
        title={flow.name}
        description={flow.description || flow.start_message}
        icon={<Workflow className="h-4 w-4" />}
        actions={
          flow.requires_feature ? (
            <Badge tone="accent">
              needs {FEATURE_LABELS[flow.requires_feature as FeatureFlag]?.label ?? flow.requires_feature}
            </Badge>
          ) : undefined
        }
      />
      <CardBody>
        <ol className="space-y-2">
          {flow.steps.map((step, index) => (
            <li key={step.id} className="flex gap-3">
              <div className="flex flex-col items-center">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-surface-line text-2xs text-slate-400">
                  {index + 1}
                </span>
                {index < flow.steps.length - 1 && <span className="w-px flex-1 bg-surface-line" />}
              </div>
              <div className="min-w-0 flex-1 pb-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={STEP_TONES[step.type] ?? 'neutral'}>{step.type.replace(/_/g, ' ')}</Badge>
                  <code className="font-mono text-xs text-slate-500">{step.id}</code>
                  {step.key && <span className="text-xs text-slate-500">→ {step.key}</span>}
                  {step.validate && <span className="text-xs text-accent-700">validate: {step.validate}</span>}
                </div>
                {step.prompt && <p className="mt-1 text-xs leading-relaxed text-slate-300">{step.prompt}</p>}
                {step.message && <p className="mt-1 text-xs leading-relaxed text-slate-400">{step.message}</p>}
                {step.options?.length ? (
                  <p className="mt-1 text-xs text-slate-500">Options: {step.options.join(' · ')}</p>
                ) : null}
                {step.collect_keys?.length ? (
                  <p className="mt-1 text-xs text-slate-500">Collects: {step.collect_keys.join(', ')}</p>
                ) : null}
                {step.next && <p className="mt-1 text-xs text-slate-600">then {step.next}</p>}
                {Object.entries(step.on ?? {}).map(([answer, target]) => (
                  <p key={answer} className="mt-1 text-xs text-slate-600">
                    if “{answer}” → {target}
                  </p>
                ))}
              </div>
            </li>
          ))}
        </ol>
      </CardBody>
    </Card>
  )
}
