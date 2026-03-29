'use client'

import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'

interface Execution {
  id: string
  agentType: string
  status: 'pending' | 'running' | 'success' | 'failed'
  progress: number
  createdAt: Date
  result?: any
}

interface ExecutionListProps {
  executions: Execution[]
  selectedId: string | null
  onSelect: (id: string) => void
  isLoading?: boolean
}

const statusConfig = {
  pending: { bg: 'bg-yellow-500/10', text: 'text-yellow-600', label: 'Pending' },
  running: { bg: 'bg-blue-500/10', text: 'text-blue-600', label: 'Running' },
  success: { bg: 'bg-green-500/10', text: 'text-green-600', label: 'Success' },
  failed: { bg: 'bg-red-500/10', text: 'text-red-600', label: 'Failed' },
}

export default function ExecutionList({
  executions,
  selectedId,
  onSelect,
}: ExecutionListProps) {
  const formatTime = (date: Date) => {
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const minutes = Math.floor(diff / 60000)
    if (minutes < 1) return 'just now'
    if (minutes < 60) return `${minutes}m ago`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours}h ago`
    return date.toLocaleDateString()
  }

  return (
    <div className="space-y-3">
      {executions.length === 0 ? (
        <div className="py-12 text-center">
          <p className="text-muted-foreground">No executions yet</p>
        </div>
      ) : (
        executions.map((execution) => {
          const config = statusConfig[execution.status as keyof typeof statusConfig]
          const isSelected = selectedId === execution.id

          return (
            <div
              key={execution.id}
              onClick={() => onSelect(execution.id)}
              className={`cursor-pointer rounded-lg border transition-all ${
                isSelected
                  ? 'border-primary bg-primary/5'
                  : 'border-border bg-card hover:border-primary/50'
              }`}
            >
              <div className="p-4">
                <div className="mb-3 flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <h3 className="font-semibold text-foreground">{execution.id}</h3>
                      <Badge
                        variant="outline"
                        className={`${config.bg} ${config.text} border-0`}
                      >
                        {config.label}
                      </Badge>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Agent: <span className="capitalize">{execution.agentType}</span>
                    </p>
                  </div>
                  <p className="text-xs text-muted-foreground">{formatTime(execution.createdAt)}</p>
                </div>

                {execution.status === 'running' && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Progress</span>
                      <span className="font-medium text-foreground">{execution.progress}%</span>
                    </div>
                    <Progress value={execution.progress} className="h-1.5" />
                  </div>
                )}

                {execution.result && (
                  <div className="mt-3">
                    <p className="text-xs text-muted-foreground">
                      {typeof execution.result === 'string'
                        ? execution.result
                        : JSON.stringify(execution.result).substring(0, 100)}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )
        })
      )}
    </div>
  )
}
