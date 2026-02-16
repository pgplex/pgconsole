import { Select, SelectTrigger, SelectValue, SelectPopup, SelectItem } from '../ui/select'

interface SchemaSelectorProps {
  value: string
  onChange: (value: string) => void
  schemas: string[]
  disabled?: boolean
}

export function SchemaSelector({ value, onChange, schemas, disabled }: SchemaSelectorProps) {
  return (
    <Select value={value} onValueChange={(v) => v && onChange(v)} disabled={disabled}>
      <SelectTrigger size="sm" className="w-full">
        <SelectValue>{(val: string | null) => val ?? 'Select schema'}</SelectValue>
      </SelectTrigger>
      <SelectPopup>
        {schemas.map((schema) => (
          <SelectItem key={schema} value={schema}>
            {schema}
          </SelectItem>
        ))}
      </SelectPopup>
    </Select>
  )
}
