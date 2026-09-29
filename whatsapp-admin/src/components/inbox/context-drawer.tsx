import {
  Building2,
  IndianRupee,
  MapPin,
  RotateCcw,
  Wallet,
  X,
} from 'lucide-react'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'

import type { DistributorInfo } from '@/lib/types'

import {
  useDistributorLookup,
  useResetBotState,
} from '@/lib/hooks/useInbox'

/* ------------------------------------------------------------------ */
/* ROW                                                                */
/* ------------------------------------------------------------------ */

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value?: string | number | null
}) {
  return (
    <div className="flex items-start gap-3 py-2">
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-indigo-50 text-indigo-600">
        <Icon className="h-4 w-4" />
      </span>

      <div className="min-w-0">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">
          {label}
        </p>

        <p className="truncate text-sm font-medium">
          {value !== undefined &&
          value !== null &&
          value !== ''
            ? String(value)
            : '—'}
        </p>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* CONTEXT DRAWER                                                     */
/* ------------------------------------------------------------------ */

interface ContextDrawerProps {
  open: boolean
  onClose: () => void
  waId: string | null
}

export function ContextDrawer({
  open,
  onClose,
  waId,
}: ContextDrawerProps) {
  const { data, isLoading } =
    useDistributorLookup(waId)

  const resetBot = useResetBotState()

  return (
    <>
      {/* BACKDROP (mobile) */}
      {open && (
        <div
          className="absolute inset-0 z-30 bg-black/20 xl:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={cn(
          `
            absolute right-0 top-0 z-40 flex h-full w-80
            flex-col border-l bg-card shadow-xl
            transition-transform duration-300 ease-in-out
          `,
          open ? 'translate-x-0' : 'translate-x-full'
        )}
      >
        {/* HEADER */}

        <div className="flex items-center justify-between border-b px-4 py-3">
          <div>
            <h3 className="text-sm font-semibold">
              Context
            </h3>

            <p className="text-xs text-muted-foreground">
              {waId ?? 'No conversation'}
            </p>
          </div>

          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <ScrollArea className="min-h-0 flex-1 p-4">
          {isLoading && (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Loading CRM data...
            </p>
          )}

          {/* BOT CONTEXT */}

          {!isLoading && (
            <section className="mb-5 rounded-lg border border-emerald-200 bg-emerald-50/60 p-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-emerald-700">
                🤖 Bot State
              </p>

              <p className="text-sm text-emerald-900">
                {data?.viewing_product
                  ? `Was viewing: ${data.viewing_product}`
                  : (data?.bot_state ?? 'Idle — no active flow')}
              </p>

              <Button
                variant="outline"
                size="sm"
                disabled={!waId || resetBot.isPending}
                onClick={() =>
                  waId && resetBot.mutate(waId)
                }
                className="
                  mt-3 w-full gap-1.5 border-emerald-300 text-emerald-700
                  hover:bg-emerald-100 hover:text-emerald-800
                "
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Reset Bot State
              </Button>
            </section>
          )}

          {/* CRM DATA */}

          {!isLoading && (
            <section>
              <p className="mb-1 px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Distributor CRM
              </p>

              <InfoRow
                icon={Building2}
                label="Name"
                value={data?.name}
              />

              <InfoRow
                icon={MapPin}
                label="Region"
                value={data?.region}
              />

              <InfoRow
                icon={Wallet}
                label="Sales Tier"
                value={
                  data?.sales_volume_tier ?? data?.tier
                }
              />

              <InfoRow
                icon={IndianRupee}
                label="Last Order Value"
                value={
                  data?.last_order_value !== undefined
                    ? `₹ ${data.last_order_value}`
                    : undefined
                }
              />

              <InfoRow
                icon={IndianRupee}
                label="Outstanding Payments"
                value={
                  data?.outstanding_payments !==
                  undefined
                    ? `₹ ${data.outstanding_payments}`
                    : undefined
                }
              />
            </section>
          )}
        </ScrollArea>
      </aside>
    </>
  )
}

export default ContextDrawer
