'use client'

import { useEffect, useState } from 'react'
import { Loader2, Palette, Rocket, Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { useDynamicConfig, useSaveDraftConfig, usePublishConfig } from '@/lib/hooks/useDynamicConfig'
import { DEFAULT_BRANDING, type BrandingConfig } from '@/lib/hooks/useBranding'
import { toast } from 'sonner'

export default function BrandingTab() {
  const { data, isLoading } = useDynamicConfig('branding')
  const saveDraft = useSaveDraftConfig('branding')
  const publish = usePublishConfig('branding')
  const [form, setForm] = useState<BrandingConfig>(DEFAULT_BRANDING)

  const published = (data?.published as Partial<BrandingConfig>) || {}

  useEffect(() => {
    if (data) {
      setForm({ ...DEFAULT_BRANDING, ...published })
    }
  }, [data?.published])

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const set = (key: keyof BrandingConfig) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => setForm((f) => ({ ...f, [key]: e.target.value }))

  const handleSave = () => {
    saveDraft.mutate(form as any)
  }

  const handlePublish = () => {
    saveDraft.mutate(form as any, {
      onSuccess: () => {
        publish.mutate(undefined, {
          onSuccess: () =>
            toast.success('Branding published', {
              description: 'The panel and bot now use the new branding.',
            }),
        })
      },
    })
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Branding</h1>
        <p className="text-sm text-muted-foreground">
          Company name, bot name, logo and about text used across the admin
          panel and the WhatsApp bot.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Palette className="h-4 w-4" />
            Brand Details
          </CardTitle>
          <CardDescription>
            Saved as a draft, then published to go live everywhere.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="brand-company" className="text-sm font-medium">
              Company Name
            </label>
            <Input
              id="brand-company"
              value={form.company_name}
              onChange={set('company_name')}
              placeholder="Acme Foods"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="brand-bot" className="text-sm font-medium">
              Bot Name
            </label>
            <Input
              id="brand-bot"
              value={form.bot_name}
              onChange={set('bot_name')}
              placeholder="Acme Bot"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="brand-logo" className="text-sm font-medium">
              Logo URL
            </label>
            <Input
              id="brand-logo"
              value={form.logo_url}
              onChange={set('logo_url')}
              placeholder="/my_logo.png or https://..."
            />
            <p className="text-xs text-muted-foreground">
              A public path or absolute URL. Leave blank to hide the logo.
            </p>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="brand-tagline" className="text-sm font-medium">
              Panel Tagline
            </label>
            <Input
              id="brand-tagline"
              value={form.tagline}
              onChange={set('tagline')}
              placeholder="WhatsApp Bot Management"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="brand-about" className="text-sm font-medium">
              About Text (bot reply)
            </label>
            <Textarea
              id="brand-about"
              value={form.about_text}
              onChange={set('about_text')}
              placeholder="We are a premium snacks manufacturer. You can review our company policies with your sales representative."
              rows={4}
            />
            <p className="text-xs text-muted-foreground">
              Sent by the bot when a distributor asks about the company
              ("About" menu item).
            </p>
          </div>

          <div className="flex items-center gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              disabled={saveDraft.isPending}
              onClick={handleSave}
            >
              {saveDraft.isPending ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-1.5 h-4 w-4" />
              )}
              Save Draft
            </Button>
            <Button
              size="sm"
              disabled={saveDraft.isPending || publish.isPending}
              onClick={handlePublish}
            >
              {publish.isPending ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : (
                <Rocket className="mr-1.5 h-4 w-4" />
              )}
              Publish
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
