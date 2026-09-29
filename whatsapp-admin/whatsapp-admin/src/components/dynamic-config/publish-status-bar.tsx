import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Loader2, Rocket, Save } from 'lucide-react'
import { cn } from '@/lib/utils'

interface PublishStatusBarProps {
  hasDraft: boolean
  lastPublishedAt?: string
  isPublishing?: boolean
  isSaving?: boolean
  onPublish: () => void
  onSave?: () => void
  className?: string
}

export function PublishStatusBar({
  hasDraft,
  lastPublishedAt,
  isPublishing,
  isSaving,
  onPublish,
  onSave,
  className,
}: PublishStatusBarProps) {
  return (
    <Card className={cn('border-dashed', className)}>
      <CardHeader className="py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CardTitle className="text-base">Publishing</CardTitle>
            {hasDraft ? (
              <Badge variant="secondary" className="bg-amber-100 text-amber-700 hover:bg-amber-100">
                Unpublished draft
              </Badge>
            ) : (
              <Badge variant="outline" className="text-emerald-600 border-emerald-200">
                Live
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            {onSave && (
              <Button
                variant="outline"
                size="sm"
                disabled={isSaving}
                onClick={onSave}
              >
                {isSaving ? (
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-1.5 h-4 w-4" />
                )}
                Save draft
              </Button>
            )}
            <Button
              size="sm"
              disabled={!hasDraft || isPublishing}
              onClick={onPublish}
            >
              {isPublishing ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : (
                <Rocket className="mr-1.5 h-4 w-4" />
              )}
              Publish
            </Button>
          </div>
        </div>
        {lastPublishedAt && (
          <CardDescription className="text-xs mt-1">
            Last published: {new Date(lastPublishedAt).toLocaleString()}
          </CardDescription>
        )}
      </CardHeader>
    </Card>
  )
}
