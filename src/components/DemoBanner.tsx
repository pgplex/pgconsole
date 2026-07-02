import { FlaskConical, ArrowRight } from 'lucide-react'

export function DemoBanner() {
  return (
    <div className="flex h-10 items-center justify-center gap-2 bg-[#2f63f0] text-sm font-medium text-white">
      <FlaskConical size={14} />
      <span>Demo Mode - </span>
      <a
        href="https://docs.pgconsole.com/getting-started/quickstart"
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 underline underline-offset-2 hover:opacity-90"
      >
        Specify --config to connect to your database
        <ArrowRight size={14} />
      </a>
    </div>
  )
}
