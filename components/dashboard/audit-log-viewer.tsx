'use client'

import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface AuditLog {
  id: string
  executionId: string
  agentId: string
  action: string
  details: Record<string, any>
  createdAt: string
}

interface AuditLogViewerProps {
  executionId?: string
  limit?: number
}

const actionConfig = {
  execution_started: { bg: 'bg-blue-500/10', text: 'text-blue-600', icon: '▶' },
  execution_completed: { bg: 'bg-green-500/10', text: 'text-green-600', icon: '✓' },
  execution_error: { bg: 'bg-red-500/10', text: 'text-red-600', icon: '✕' },
  tool_executed: { bg: 'bg-purple-500/10', text: 'text-purple-600', icon: '⚙' },
  tool_error: { bg: 'bg-orange-500/10', text: 'text-orange-600', icon: '!' },
}

export default function AuditLogViewer({ executionId, limit = 50 }: AuditLogViewerProps) {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [filteredLogs, setFilteredLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterAction, setFilterAction] = useState('all')

  useEffect(() => {
    if (executionId) {
      fetchAuditLogs(executionId)
    }
  }, [executionId])

  useEffect(() => {
    filterLogs()
  }, [logs, searchQuery, filterAction])

  const fetchAuditLogs = async (execId: string) => {
    setLoading(true)
    try {
      const response = await fetch(
        `/api/agents/audit-logs?executionId=${execId}&limit=${limit}`
      )
      const data = await response.json()

      if (data.success && data.logs) {
        setLogs(data.logs)
      }
    } catch (error) {
      console.error('Failed to fetch audit logs:', error)
    } finally {
      setLoading(false)
    }
  }

  const filterLogs = () => {
    let filtered = logs

    if (filterAction !== 'all') {
      filtered = filtered.filter((log) => log.action === filterAction)
    }

    if (searchQuery) {
      filtered = filtered.filter(
        (log) =>
          log.action.includes(searchQuery) ||
          JSON.stringify(log.details).includes(searchQuery) ||
          log.agentId.includes(searchQuery)
      )
    }

    setFilteredLogs(filtered)
  }

  const getActionConfig = (action: string) => {
    return (
      (actionConfig as any)[action] || {
        bg: 'bg-gray-500/10',
        text: 'text-gray-600',
        icon: '◎',
      }
    )
  }

  const formatTime = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diff = now.getTime() - date.getTime()

    const seconds = Math.floor(diff / 1000)
    const minutes = Math.floor(seconds / 60)
    const hours = Math.floor(minutes / 60)
    const days = Math.floor(hours / 24)

    if (seconds < 60) return `${seconds}s ago`
    if (minutes < 60) return `${minutes}m ago`
    if (hours < 24) return `${hours}h ago`
    return `${days}d ago`
  }

  return (
    <Card className="p-6">
      <div className="mb-6 space-y-4">
        <h2 className="text-lg font-semibold text-foreground">Audit Logs</h2>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Input
            placeholder="Search logs..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="border-border sm:flex-1"
          />

          <Select value={filterAction} onValueChange={setFilterAction}>
            <SelectTrigger className="border-border sm:w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Actions</SelectItem>
              <SelectItem value="execution_started">Started</SelectItem>
              <SelectItem value="execution_completed">Completed</SelectItem>
              <SelectItem value="execution_error">Error</SelectItem>
              <SelectItem value="tool_executed">Tool Executed</SelectItem>
              <SelectItem value="tool_error">Tool Error</SelectItem>
            </SelectContent>
          </Select>

          <Button
            onClick={() => {
              if (executionId) {
                fetchAuditLogs(executionId)
              }
            }}
            variant="outline"
            size="sm"
          >
            Refresh
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="py-8 text-center">
          <p className="text-muted-foreground">Loading audit logs...</p>
        </div>
      ) : filteredLogs.length === 0 ? (
        <div className="py-8 text-center">
          <p className="text-muted-foreground">No audit logs found</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredLogs.map((log) => {
            const config = getActionConfig(log.action)

            return (
              <div
                key={log.id}
                className="rounded-lg border border-border bg-muted/30 p-4 transition-colors hover:bg-muted/50"
              >
                <div className="mb-3 flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <Badge
                      variant="outline"
                      className={`${config.bg} ${config.text} border-0`}
                    >
                      {config.icon} {log.action}
                    </Badge>
                    <span className="text-xs text-muted-foreground font-mono">
                      {log.agentId.slice(0, 8)}
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground">{formatTime(log.createdAt)}</span>
                </div>

                <div className="rounded bg-background/50 p-2">
                  <pre className="overflow-auto text-xs text-muted-foreground">
                    {JSON.stringify(log.details, null, 2)}
                  </pre>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </Card>
  )
}
