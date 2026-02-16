import { ArrowRight } from 'lucide-react'

interface BannerProps {
  text: string
  link?: string
  color?: string
}

const DEFAULT_COLOR = '#2563eb'

export function Banner({ text, link, color = DEFAULT_COLOR }: BannerProps) {
  const style = { backgroundColor: color }

  if (link) {
    return (
      <a
        href={link}
        target="_blank"
        rel="noopener noreferrer"
        className="flex h-10 items-center justify-center gap-1.5 text-sm font-medium text-white hover:opacity-90"
        style={style}
      >
        {text}
        <ArrowRight size={14} />
      </a>
    )
  }

  return (
    <div
      className="flex h-10 items-center justify-center text-sm font-medium text-white"
      style={style}
    >
      {text}
    </div>
  )
}
