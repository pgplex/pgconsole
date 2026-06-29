import { ElTabGroup, ElTabList, ElTabPanels } from '@tailwindplus/elements/react'
import { CheckmarkIcon } from '../icons/checkmark-icon'
import { RobotIcon } from '../icons/robot-icon'
import { ShieldExclamationIcon } from '../icons/shield-exclamation-icon'
import { TerminalIcon } from '../icons/terminal-icon'
import { User2Icon } from '../icons/user-2-icon'

const tabClassName =
  'flex items-center gap-2 rounded-full px-4 py-1 text-mist-600 transition aria-selected:bg-white aria-selected:text-mist-950 aria-selected:shadow-sm dark:text-mist-400 dark:aria-selected:bg-white/15 dark:aria-selected:text-white'

export function HeroDemo() {
  return (
    <ElTabGroup className="flex w-full flex-col items-center gap-8">
      <ElTabList className="inline-flex items-center gap-1 rounded-full bg-mist-950/5 p-1 text-sm/7 font-medium inset-ring-1 inset-ring-black/5 dark:bg-white/5 dark:inset-ring-white/10">
        <button type="button" className={tabClassName}>
          <User2Icon className="size-4" /> Human
        </button>
        <button type="button" className={tabClassName}>
          <RobotIcon className="size-4" /> Agent
        </button>
      </ElTabList>

      <ElTabPanels className="w-full">
        <div>
          <img
            src="/sql-editor-overview.webp"
            alt="pgconsole SQL editor"
            className="rounded-lg ring-1 ring-black/10"
            width={2880}
            height={1800}
          />
        </div>
        <div hidden>
          <AgentDemo />
        </div>
      </ElTabPanels>
    </ElTabGroup>
  )
}

function AgentDemo() {
  return (
    <div className="overflow-hidden rounded-lg bg-white text-left ring-1 ring-black/10 dark:bg-mist-900 dark:ring-white/10">
      {/* Window chrome */}
      <div className="flex items-center gap-2 border-b border-black/5 px-4 py-3 text-sm/6 dark:border-white/10">
        <TerminalIcon className="size-4 text-mist-500" />
        <span className="font-medium text-mist-950 dark:text-white">pgconsole MCP server</span>
        <span className="ml-auto flex items-center gap-1.5 text-mist-500">
          <span className="size-1.5 rounded-full bg-[#0A64C8]" />
          connected
        </span>
      </div>

      <div className="grid lg:grid-cols-5">
        {/* Conversation */}
        <div className="flex flex-col gap-5 border-b border-black/5 p-5 lg:col-span-2 lg:border-r lg:border-b-0 dark:border-white/10">
          <div className="flex items-start gap-3">
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-mist-950/5 text-mist-600 dark:bg-white/10 dark:text-mist-300">
              <User2Icon className="size-3.5" />
            </span>
            <p className="text-sm/6 text-mist-950 dark:text-white">
              Which orders are stuck in processing this week?
            </p>
          </div>
          <div className="flex items-start gap-3">
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-mist-950 text-white dark:bg-white dark:text-mist-950">
              <RobotIcon className="size-3.5" />
            </span>
            <p className="text-sm/6 text-mist-600 dark:text-mist-300">
              I queried the <span className="font-medium text-mist-950 dark:text-white">prod-analytics</span>{' '}
              connection through pgconsole. 142 orders have been in <code className="rounded bg-mist-950/5 px-1 py-0.5 font-mono text-xs text-mist-950 dark:bg-white/10 dark:text-white">processing</code>{' '}
              for over 24h — all from the EU region.
            </p>
          </div>
        </div>

        {/* MCP tool calls */}
        <div className="flex flex-col gap-3 p-5 font-mono text-xs/5 lg:col-span-3">
          <ToolCall name="list_connections" args="" result="prod-analytics · read, explain" />
          <ToolCall name="list_objects" args='schema: "public"' result="orders, customers, shipments" />
          <ToolCall name="describe_table" args='table: "public.orders"' result="14 columns · status, region, created_at" />
          <ToolCall
            name="query"
            args="SELECT count(*) … WHERE status = 'processing'"
            result="142 rows · capped at 1,000"
          />
        </div>
      </div>

      {/* Governance footer */}
      <div className="flex items-center gap-2 border-t border-black/5 px-5 py-3 text-xs/5 text-mist-500 dark:border-white/10">
        <ShieldExclamationIcon className="size-4 shrink-0" />
        <span>
          Every tool call runs through the same{' '}
          <a
            href="https://docs.pgconsole.com/features/database-access-control"
            target="_blank"
            className="text-mist-700 underline underline-offset-2 hover:text-mist-950 dark:text-mist-300 dark:hover:text-white"
          >
            IAM permissions
          </a>{' '}
          and{' '}
          <a
            href="https://docs.pgconsole.com/features/audit-log"
            target="_blank"
            className="text-mist-700 underline underline-offset-2 hover:text-mist-950 dark:text-mist-300 dark:hover:text-white"
          >
            audit log
          </a>{' '}
          as the console.
        </span>
      </div>
    </div>
  )
}

function ToolCall({ name, args, result }: { name: string; args: string; result: string }) {
  return (
    <div className="flex items-start gap-2">
      <CheckmarkIcon className="mt-0.5 size-3.5 shrink-0 text-mist-400" />
      <div className="min-w-0">
        <span className="text-mist-950 dark:text-white">{name}</span>
        {args && <span className="text-mist-500">({args})</span>}
        <div className="truncate text-mist-500">→ {result}</div>
      </div>
    </div>
  )
}
