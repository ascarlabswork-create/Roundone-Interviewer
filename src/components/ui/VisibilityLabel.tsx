import { Badge } from './primitives.tsx'

export function VisibilityLabel({
  visibility,
  topic,
  className,
}: {
  visibility: 'public' | 'private'
  topic: string
  className?: string
}) {
  return (
    <div className={className ?? 'flex flex-wrap items-center gap-2'}>
      <Badge tone={visibility === 'public' ? 'blue' : 'navy'} className="tracking-wide">
        {visibility === 'public' ? 'PUBLIC' : 'PRIVATE'}
      </Badge>
      <span className="text-sm font-medium text-slate-700">{topic}</span>
    </div>
  )
}
