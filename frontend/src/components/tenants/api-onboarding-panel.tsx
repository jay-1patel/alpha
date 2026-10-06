import { useState } from 'react'
import { KeyRound, Plus } from 'lucide-react'
import { apiOnboarding, type ApiOnboardingRequest, type ApiOnboardingStatus, type ApiOnboardingType } from '@/lib/api-onboarding'
import { useAsync, useAction } from '@/lib/hooks'
import { formatDate } from '@/lib/format'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { Input, Textarea } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Alert, EmptyState, LoadingBlock } from '@/components/ui/feedback'
import { PageHeader } from '@/components/layout/page-header'
import { useToast } from '@/components/ui/toast'

const STATUS_TONE: Record<ApiOnboardingStatus, 'warning' | 'success' | 'danger'> = {
  pending: 'warning',
  approved: 'success',
  rejected: 'danger',
}

const API_LABEL: Record<ApiOnboardingType, string> = {
  payment_api: 'Payment API',
  order_api: 'Order API',
}

export function ApiOnboardingPanel() {
  const state = useAsync((signal) => apiOnboarding.mine(signal), [])
  const action = useAction()
  const toast = useToast()
  const [creating, setCreating] = useState(false)
  const [apiType, setApiType] = useState<ApiOnboardingType>('payment_api')
  const [provider, setProvider] = useState('')
  const [environment, setEnvironment] = useState<'sandbox' | 'production'>('sandbox')
  const [purpose, setPurpose] = useState('')

  const requests = state.data ?? []
  const hasOpenOrApprovedRequest = (type: ApiOnboardingType) =>
    requests.some((request) => request.api_type === type && request.status !== 'rejected')
  const canRequestAnother = (['payment_api', 'order_api'] as ApiOnboardingType[]).some(
    (type) => !hasOpenOrApprovedRequest(type),
  )
  const submit = async () => {
    const result = await action.run(() =>
      apiOnboarding.create({
        api_type: apiType,
        provider: provider.trim(),
        environment,
        purpose: purpose.trim(),
      }),
    )
    if (result) {
      toast.push(`${API_LABEL[result.api_type]} request submitted`)
      setCreating(false)
      setProvider('')
      setPurpose('')
      state.reload()
    }
  }

  return (
    <div>
      <PageHeader
        title="API access"
        description="Request access for an external Payment API or Order API. A superadmin reviews each request."
        actions={!creating && canRequestAnother && <Button variant="primary" icon={<Plus className="h-4 w-4" />} onClick={() => {
          const firstAvailable = (['payment_api', 'order_api'] as ApiOnboardingType[]).find((type) => !hasOpenOrApprovedRequest(type))
          if (firstAvailable) setApiType(firstAvailable)
          setCreating(true)
        }}>New request</Button>}
      />

      <Alert tone="warning" title="Do not enter credentials" className="mb-4">
        This request form must not contain API keys, passwords, tokens, or other secrets. Approval grants eligibility only; credentials are configured separately before live API traffic is enabled.
      </Alert>

      {creating && (
        <Card className="mb-4">
          <CardHeader title="Request API access" description="Provide the integration type and intended use. No credentials are needed here." />
          <CardBody className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Select label="API type" value={apiType} onChange={(event) => setApiType(event.target.value as ApiOnboardingType)}>
                <option value="payment_api" disabled={hasOpenOrApprovedRequest('payment_api')}>Payment API{hasOpenOrApprovedRequest('payment_api') ? ' — request already open' : ''}</option>
                <option value="order_api" disabled={hasOpenOrApprovedRequest('order_api')}>Order API{hasOpenOrApprovedRequest('order_api') ? ' — request already open' : ''}</option>
              </Select>
              <Select label="Environment requested" value={environment} onChange={(event) => setEnvironment(event.target.value as 'sandbox' | 'production')}>
                <option value="sandbox">Sandbox / test</option>
                <option value="production">Production</option>
              </Select>
            </div>
            <Input
              label="Provider (optional)"
              value={provider}
              maxLength={100}
              onChange={(event) => setProvider(event.target.value)}
              hint="Name the API provider if you already know it. Do not paste a key or secret."
            />
            <Textarea
              label="Business purpose"
              rows={4}
              value={purpose}
              maxLength={2000}
              onChange={(event) => setPurpose(event.target.value)}
              hint="Explain what your tenant needs to use this API for (10–2,000 characters). Do not include credentials."
            />
            {action.error && <Alert tone="danger" title="Could not submit request">{action.error}</Alert>}
            <div className="flex gap-2">
              <Button variant="primary" loading={action.busy} disabled={purpose.trim().length < 10} onClick={submit}>Submit request</Button>
              <Button variant="ghost" onClick={() => setCreating(false)}>Cancel</Button>
            </div>
          </CardBody>
        </Card>
      )}

      {state.loading && <LoadingBlock label="Loading API requests…" />}
      {state.error && <Alert tone="danger" title="Could not load API requests">{state.error}</Alert>}
      {requests.length === 0 && !state.loading && (
        <Card><EmptyState title="No API requests" description="When you request Payment API or Order API access, its review status will appear here." /></Card>
      )}
      {requests.length > 0 && (
        <div className="space-y-3">
          {requests.map((request) => <RequestCard key={request.id} request={request} />)}
        </div>
      )}
    </div>
  )
}

function RequestCard({ request }: { request: ApiOnboardingRequest }) {
  return (
    <Card>
      <CardHeader
        title={API_LABEL[request.api_type]}
        description={`Submitted ${formatDate(request.created_at)}${request.provider ? ` · ${request.provider}` : ''} · ${request.environment}`}
        icon={<KeyRound className="h-4 w-4" />}
        actions={<Badge tone={STATUS_TONE[request.status]}>{request.status}</Badge>}
      />
      <CardBody className="space-y-3">
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-300">{request.purpose}</p>
        {request.status === 'approved' ? (
          <Alert tone="success" title={request.eligible ? 'Eligible — setup required' : 'Approved — setup required'}>
            Approved by {request.reviewer_username || 'a superadmin'}{request.decided_at ? ` on ${formatDate(request.decided_at)}` : ''}. Configure credentials through the secure setup process before enabling live traffic.
          </Alert>
        ) : request.status === 'rejected' ? (
          <Alert tone="danger" title="Request rejected">
            {request.decision_note || 'No additional note was provided.'}
          </Alert>
        ) : (
          <Alert tone="info" title="Awaiting superadmin review">This request is not yet eligible for use.</Alert>
        )}
      </CardBody>
    </Card>
  )
}
