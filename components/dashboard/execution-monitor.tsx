'use client'

import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Spinner } from '@/components/ui/spinner'

interface ExecutionMonitorProps {
  executionId: string
}

interface AuditLog {
  id: string
  action: string
  details: Record<string, any>
  createdAt: string
}

export default function ExecutionMonitor({ executionId }: ExecutionMonitorProps) {
  const [status, setStatus] = useState<'loading' | 'success' | 'failed'>('loading')
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([])
  const [executionData, setExecutionData] = useState<any>(null)

  useEffect(() => {
    // Simulate loading execution details
    setTimeout(() => {
      setExecutionData({
        id: executionId,
        status: 'running',
        agentType: 'research',
        progress: 65,
        startTime: new Date(Date.now() - 5000),
        estimatedTime: 15,
      })

      setAuditLogs([
        {
          id: '1',
          action: 'execution_started',
          details: { agentType: 'research', timestamp: new Date().toISOString() },
          createdAt: new Date(Date.now() - 5000).toISOString(),
        },
        {
          id: '2',
          action: 'tool_executed',
          details: { toolName: 'web_search', status: 'success' },
          createdAt: new Date(Date.now() - 3000).toISOString(),
        },
        {
          id: '3',
          action: 'processing',
          details: { stage: 'analysis', progress: 65 },
          createdAt: new Date().toISOString(),
        },
      ])

      setStatus('success')
    }, 500)
  }, [executionId])

  if (status === 'loading') {
    return (
      <Card className="flex items-center justify-center p-6">
        <Spinner className="h-6 w-6" />
      </Card>
    )
  }

  return (
    <Card className="overflow-hidden">
      <Tabs defaultValue="details" className="w-full">
        <TabsList className="w-full rounded-none border-b border-border">
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="logs">Audit Log</TabsTrigger>
        </TabsList>

        <TabsContent value="details" className="space-y-4 p-4">
          {executionData && (
            <>
              <div>
                <p className="text-xs text-muted-foreground">Execution ID</p>
                <p className="font-mono text-sm text-foreground">{executionData.id}</p>
              </div>

              <div>
                <p className="text-xs text-muted-foreground">Status</p>
                <Badge className="mt-1" variant="outline">
                  {executionData.status}
                </Badge>
              </div>

              <div>
                <p className="text-xs text-muted-foreground">Agent Type</p>
                <p className="capitalize text-foreground">{executionData.agentType}</p>
              </div>

              <div>
                <p className="text-xs text-muted-foreground">Progress</p>
                <div className="mt-2 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">{executionData.progress}%</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary transition-all"
                      style={{ width: `${executionData.progress}%` }}
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2 pt-4">
                <div className="text-xs text-muted-foreground">
                  Started {new Date(executionData.startTime).toLocaleTimeString()}
                </div>
              </div>

              <Button className="w-full" variant="outline" size="sm">
                Download Report
              </Button>
            </>
          )}
        </TabsContent>

        <TabsContent value="logs" className="p-4">
          <div className="space-y-3">
            {auditLogs.map((log) => (
              <div key={log.id} className="rounded-lg border border-border bg-muted/50 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-xs font-semibold text-foreground">{log.action}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(log.createdAt).toLocaleTimeString()}
                  </p>
                </div>
                <div className="text-xs text-muted-foreground">
                  <pre className="overflow-auto rounded bg-background p-2 text-xs">
                    {JSON.stringify(log.details, null, 2)}
                  </pre>
                </div>
              </div>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </Card>
  )
}
