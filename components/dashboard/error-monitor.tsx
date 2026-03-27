'use client'

import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'

interface ErrorLog {
  id: string
  executionId: string
  error: string
  errorType: string
  retryCount: number
  status: 'resolved' | 'pending' | 'failed'
  timestamp: string
  details?: Record<string, any>
}

interface ErrorMonitorProps {
  limit?: number
}

const errorTypeConfig = {
  execution_error: { bg: 'bg-red-500/10', text: 'text-red-600', icon: '✕' },
  timeout_error: { bg: 'bg-orange-500/10', text: 'text-orange-600', icon: '⏱' },
  tool_error: { bg: 'bg-yellow-500/10', text: 'text-yellow-600', icon: '!' },
  circuit_breaker: { bg: 'bg-purple-500/10', text: 'text-purple-600', icon: '⚠' },
  retry_exhausted: { bg: 'bg-red-500/10', text: 'text-red-600', icon: '✕✕' },
}

export default function ErrorMonitor({ limit = 20 }: ErrorMonitorProps) {
  const [errors, setErrors] = useState<ErrorLog[]>([])
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<'all' | 'pending' | 'resolved'>('pending')

  useEffect(() => {
    fetchErrors()
    // Poll for new errors every 30 seconds
    const interval = setInterval(fetchErrors, 30000)
    return () => clearInterval(interval)
  }, [])

  const fetchErrors = async () => {
    setLoading(true)
    try {
      // In a real implementation, this would fetch from an API
      // For now, we'll use mock data
      const mockErrors: ErrorLog[] = [
        {
          id: 'err-001',
          executionId: 'exec-001',
          error: 'Tool execution timeout',
          errorType: 'timeout_error',
          retryCount: 2,
          status: 'pending',
          timestamp: new Date(Date.now() - 300000).toISOString(),
          details: { tool: 'web_search', timeout: 30 },
        },
        {
          id: 'err-002',
          executionId: 'exec-002',
          error: 'Circuit breaker open for API calls',
          errorType: 'circuit_breaker',
          retryCount: 0,
          status: 'pending',
          timestamp: new Date(Date.now() - 600000).toISOString(),
          details: { service: 'external_api', recoveryAt: '5 minutes' },
        },
      ]
      setErrors(mockErrors)
    } catch (error) {
      console.error('Failed to fetch errors:', error)
    } finally {
      setLoading(false)
    }
  }

  const filteredErrors = errors.filter((err) => {
    if (activeTab === 'all') return true
    return err.status === activeTab
  })

  const getErrorConfig = (errorType: string) => {
    return (
      (errorTypeConfig as any)[errorType] || {
        bg: 'bg-gray-500/10',
        text: 'text-gray-600',
        icon: '○',
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

  const errorStats = {
    total: errors.length,
    pending: errors.filter((e) => e.status === 'pending').length,
    resolved: errors.filter((e) => e.status === 'resolved').length,
    failed: errors.filter((e) => e.status === 'failed').length,
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Total Errors</p>
          <p className="text-2xl font-bold text-foreground">{errorStats.total}</p>
        </Card>
        <Card className="p-4 border-orange-500/20 bg-orange-500/5">
          <p className="text-xs text-orange-600">Pending</p>
          <p className="text-2xl font-bold text-orange-600">{errorStats.pending}</p>
        </Card>
        <Card className="p-4 border-green-500/20 bg-green-500/5">
          <p className="text-xs text-green-600">Resolved</p>
          <p className="text-2xl font-bold text-green-600">{errorStats.resolved}</p>
        </Card>
        <Card className="p-4 border-red-500/20 bg-red-500/5">
          <p className="text-xs text-red-600">Failed</p>
          <p className="text-2xl font-bold text-red-600">{errorStats.failed}</p>
        </Card>
      </div>

      {/* Error List */}
      <Card className="p-6">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">Recent Errors</h2>
          <Button onClick={fetchErrors} variant="outline" size="sm" disabled={loading}>
            {loading ? 'Loading...' : 'Refresh'}
          </Button>
        </div>

        {/* Tabs */}
        <div className="mb-6 flex border-b border-border">
          {['all', 'pending', 'resolved'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab as any)}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === tab
                  ? 'border-b-2 border-primary text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        {/* Error Items */}
        {filteredErrors.length === 0 ? (
          <div className="py-8 text-center">
            <p className="text-muted-foreground">No errors found</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredErrors.map((error) => {
              const config = getErrorConfig(error.errorType)

              return (
                <div
                  key={error.id}
                  className={`rounded-lg border p-4 transition-colors ${
                    error.status === 'pending'
                      ? 'border-orange-500/20 bg-orange-500/5'
                      : error.status === 'resolved'
                        ? 'border-green-500/20 bg-green-500/5'
                        : 'border-red-500/20 bg-red-500/5'
                  }`}
                >
                  <div className="mb-3 flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <Badge
                        variant="outline"
                        className={`${config.bg} ${config.text} border-0`}
                      >
                        {config.icon} {error.errorType}
                      </Badge>
                      <Badge
                        variant="outline"
                        className={
                          error.status === 'resolved'
                            ? 'bg-green-500/10 text-green-600'
                            : error.status === 'pending'
                              ? 'bg-orange-500/10 text-orange-600'
                              : 'bg-red-500/10 text-red-600'
                        }
                      >
                        {error.status}
                      </Badge>
                    </div>
                    <span className="text-xs text-muted-foreground">{formatTime(error.timestamp)}</span>
                  </div>

                  <p className="mb-2 text-sm font-medium text-foreground">{error.error}</p>

                  <div className="mb-3 flex items-center gap-4 text-xs text-muted-foreground">
                    <span>Execution: {error.executionId.slice(0, 8)}</span>
                    <span>Retries: {error.retryCount}/3</span>
                  </div>

                  {error.details && (
                    <details className="group">
                      <summary className="cursor-pointer text-xs font-medium text-muted-foreground hover:text-foreground">
                        Details
                      </summary>
                      <div className="mt-2 rounded bg-background/50 p-2">
                        <pre className="overflow-auto text-xs">
                          {JSON.stringify(error.details, null, 2)}
                        </pre>
                      </div>
                    </details>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </Card>
    </div>
  )
}
