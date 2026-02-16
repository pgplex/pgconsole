import type { FunctionArgument } from '@/lib/sql/parse-function-args'

interface FunctionArgumentListProps {
  arguments: FunctionArgument[]
}

export function FunctionArgumentList({ arguments: args }: FunctionArgumentListProps) {
  if (args.length === 0) {
    return <span className="text-sm text-gray-500">No arguments</span>
  }

  return (
    <div className="flex flex-col gap-0.5">
      {args.map((arg, index) => (
        <div
          key={arg.name || `arg_${index}`}
          className="flex items-center gap-1.5 text-sm"
        >
          <span className="font-medium text-gray-700">
            {arg.name || `$${index + 1}`}
          </span>
          <span className="px-1.5 py-0.5 bg-gray-100 rounded text-gray-600">{arg.type}</span>
          {arg.mode && <span className="text-gray-400">({arg.mode})</span>}
          {arg.defaultValue && (
            <span className="text-gray-400">= {arg.defaultValue}</span>
          )}
        </div>
      ))}
    </div>
  )
}
