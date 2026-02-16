import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { Dialog as DialogPrimitive } from '@base-ui/react/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Spinner } from '@/components/ui/spinner'
import { Alert } from '@/components/ui/alert'
import { aiClient } from '@/lib/connect-client'
import ReactMarkdown from 'react-markdown'
import { renderMermaid } from 'beautiful-mermaid'

interface RiskFinding {
  severity: string
  category: string
  description: string
}

interface RiskAssessmentModalProps {
  open: boolean
  onClose: () => void
  connectionId: string
  providerId: string
  sqlStatements: string[]
}

function getSeverityBadgeVariant(severity: string): 'destructive' | 'warning' | 'default' {
  switch (severity) {
    case 'high':
      return 'destructive'
    case 'moderate':
      return 'warning'
    default:
      return 'default'
  }
}

export function RiskAssessmentModal({
  open,
  onClose,
  connectionId,
  providerId,
  sqlStatements,
}: RiskAssessmentModalProps) {
  const [loading, setLoading] = useState(true)
  const [assessment, setAssessment] = useState<{
    overallRisk: string
    findings: RiskFinding[]
    dependencyGraph: string
  } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [graphSvg, setGraphSvg] = useState<string | null>(null)

  useEffect(() => {
    if (!open) {
      setLoading(true)
      setAssessment(null)
      setError(null)
      setGraphSvg(null)
      return
    }

    const assessRisk = async () => {

      try {
        const response = await aiClient.assessChangeRisk({
          connectionId,
          providerId,
          sqlStatements,
          schemas: [], // Use all cached schemas
        })

        if (response.error) {
          setError(response.error)
        } else {
          setAssessment({
            overallRisk: response.overallRisk,
            findings: response.findings,
            dependencyGraph: response.dependencyGraph,
          })
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to assess risk')
      } finally {
        setLoading(false)
      }
    }

    assessRisk()
  }, [open, connectionId, providerId, sqlStatements])

  useEffect(() => {
    if (!assessment?.dependencyGraph) {
      setGraphSvg(null)
      return
    }
    let cancelled = false
    renderMermaid(assessment.dependencyGraph, { transparent: true })
      .then((svg) => { if (!cancelled) setGraphSvg(svg) })
      .catch(() => { if (!cancelled) setGraphSvg(null) })
    return () => { cancelled = true }
  }, [assessment?.dependencyGraph])

  return (
    <DialogPrimitive.Root open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className="fixed inset-0 z-[60] bg-black/20" />
        <DialogPrimitive.Viewport className="fixed inset-0 z-[60] grid place-items-center p-4">
          <DialogPrimitive.Popup className="relative w-full max-w-4xl rounded-2xl border bg-white shadow-xl flex flex-col h-[80vh]">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
              <DialogPrimitive.Title className="text-lg font-semibold">
                Risk Assessment
              </DialogPrimitive.Title>
              <Button variant="ghost" size="icon-sm" onClick={onClose}>
                <X className="w-4 h-4" />
              </Button>
            </div>

            {/* Content */}
            <div className="flex-1 flex flex-col overflow-hidden min-h-0 p-6">
              {loading && (
                <div className="flex flex-col items-center justify-center h-full gap-3">
                  <Spinner className="size-8 text-gray-400" />
                  <p className="text-gray-600">Assessing changes...</p>
                </div>
              )}

              {error && (
                <div className="flex items-center justify-center h-full">
                  <Alert variant="error" className="max-w-md">
                    <p className="font-semibold">Assessment Failed</p>
                    <p className="text-sm mt-1">{error}</p>
                  </Alert>
                </div>
              )}

              {!loading && !error && assessment && (
                <div className="flex-1 min-h-0 overflow-auto">
                  {/* Findings */}
                  <div className="space-y-3">
                    {assessment.findings.map((finding, index) => (
                      <div key={`${finding.severity}-${finding.category}-${index}`} className="border rounded-lg p-4 space-y-2">
                        <div className="flex items-center gap-2">
                          <Badge variant={getSeverityBadgeVariant(finding.severity)}>
                            {finding.severity.toUpperCase()}
                          </Badge>
                          <span className="font-semibold">{finding.category}</span>
                        </div>
                        <ReactMarkdown
                          components={{
                            h2: ({ children }) => <h2 className="text-base font-semibold mt-2 mb-1 text-gray-900">{children}</h2>,
                            h3: ({ children }) => <h3 className="text-sm font-semibold mt-2 mb-1 text-gray-900">{children}</h3>,
                            p: ({ children }) => <p className="text-sm text-gray-700 mb-2">{children}</p>,
                            ul: ({ children }) => <ul className="list-disc list-inside text-sm text-gray-700 mb-2 space-y-1">{children}</ul>,
                            ol: ({ children }) => <ol className="list-decimal list-inside text-sm text-gray-700 mb-2 space-y-1">{children}</ol>,
                            li: ({ children }) => <li className="text-sm">{children}</li>,
                            code: ({ children }) => <code className="bg-gray-100 px-1 py-0.5 rounded text-xs font-mono">{children}</code>,
                            strong: ({ children }) => <strong className="font-semibold text-gray-900">{children}</strong>,
                          }}
                        >
                          {finding.description}
                        </ReactMarkdown>
                      </div>
                    ))}
                  </div>

                  {graphSvg && (
                    <div className="mt-4">
                      <h3 className="text-sm font-semibold text-gray-900 mb-2">Dependencies</h3>
                      <div
                        className="border rounded-lg p-4 flex justify-center [&_svg]:max-w-full [&_svg]:h-auto"
                        dangerouslySetInnerHTML={{ __html: graphSvg }}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          </DialogPrimitive.Popup>
        </DialogPrimitive.Viewport>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
