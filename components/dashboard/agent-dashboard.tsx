'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import ExecutionList from './execution-list'
import ExecutionMonitor from './execution-monitor'
import WorkflowBuilder from './workflow-builder'
import AgentStats from './agent-stats'

export default function AgentDashboard() {
  const [activeTab, setActiveTab] = useState('overview')
  const [selectedExecution, setSelectedExecution] = useState<string | null>(null)
  const [executions, setExecutions] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [refreshTick, setRefreshTick] = useState(0)
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [pollIntervalMs, setPollIntervalMs] = useState(10000)

  const triggerRefresh = useCallback(() => {
    setRefreshTick((prev) => prev + 1)
  }, [])

  const handleWorkflowStarted = useCallback((payload: { workflowId: string; executionIds: string[] }) => {
    const firstExecutionId = payload.executionIds[0]
    if (firstExecutionId) {
      setSelectedExecution(firstExecutionId)
    }
    setActiveTab('executions')
    triggerRefresh()
  }, [triggerRefresh])

  useEffect(() => {
    let active = true
    let inFlight = false
    let controller: AbortController | null = null
    let timeoutId: ReturnType<typeof setTimeout> | null = null

    const fetchExecutions = async () => {
      if (!active || inFlight) return
      inFlight = true
      setLoading(true)
      try {
        controller = new AbortController()
        timeoutId = setTimeout(() => controller?.abort(), 12000)

        const response = await fetch('/api/agents/executions', {
          cache: 'no-store',
          signal: controller.signal,
        })

        if (timeoutId) {
          clearTimeout(timeoutId)
          timeoutId = null
        }

        if (!response.ok) {
          throw new Error(`Executions API returned ${response.status}`)
        }

        const data = await response.json()
        if (data.success && data.executions && active) {
          // ensure dates are properly parsed since fetch returns string dates
          const parsed = data.executions.map((e: any) => ({
             ...e,
             createdAt: new Date(e.createdAt)
          }))
          setExecutions(parsed)
          setLastUpdatedAt(new Date())
        }
      } catch (error) {
        // AbortError is expected during route changes/HMR/unmount and should stay quiet.
        if (error instanceof Error && error.name === 'AbortError') {
          return
        }
        console.error('Failed to fetch live executions:', error)
      } finally {
        if (timeoutId) {
          clearTimeout(timeoutId)
          timeoutId = null
        }
        if (active) {
          setLoading(false)
        }
        inFlight = false
      }
    }
    
    // Fetch initial list
    fetchExecutions()
    
    const intervalId = setInterval(fetchExecutions, pollIntervalMs)
    
    return () => {
      active = false
      controller?.abort()
      if (timeoutId) {
        clearTimeout(timeoutId)
      }
      clearInterval(intervalId)
    }
  }, [refreshTick, pollIntervalMs])

  const totalExecutions = executions.length
  const successCount = executions.filter((e) => e.status === 'success').length
  const failedCount = executions.filter((e) => e.status === 'failed').length
  const successRate = totalExecutions > 0 ? ((successCount / totalExecutions) * 100).toFixed(1) : '0.0'
  const activeExecutions = executions.filter((e) => e.status === 'pending' || e.status === 'running').length

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-6 sm:px-6 lg:px-8">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Nexus-Agent</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Enterprise autonomous agent orchestration platform
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setSettingsOpen(true)}>
              Settings
            </Button>
            <Button size="sm" onClick={() => setActiveTab('workflows')}>+ New Execution</Button>
          </div>
        </div>
      </header>

      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Dashboard Settings</DialogTitle>
            <DialogDescription>
              Configure how frequently the dashboard polls for live execution updates.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="poll-interval">Polling Interval</Label>
            <Select
              value={String(pollIntervalMs)}
              onValueChange={(value) => setPollIntervalMs(Number(value))}
            >
              <SelectTrigger id="poll-interval">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="5000">5 seconds</SelectItem>
                <SelectItem value="10000">10 seconds</SelectItem>
                <SelectItem value="15000">15 seconds</SelectItem>
                <SelectItem value="30000">30 seconds</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setSettingsOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="executions">Executions</TabsTrigger>
            <TabsTrigger value="workflows">Workflows</TabsTrigger>
            <TabsTrigger value="details">Details</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            <AgentStats executions={executions} lastUpdatedAt={lastUpdatedAt} isLoading={loading} />
          </TabsContent>

          {/* Executions Tab */}
          <TabsContent value="executions" className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-3">
              <div className="lg:col-span-2">
                <Card className="p-6">
                  <div className="mb-6 flex items-center justify-between">
                    <h2 className="text-xl font-semibold text-foreground">Recent Executions</h2>
                    <Button variant="outline" size="sm" onClick={triggerRefresh}>
                      Refresh
                    </Button>
                  </div>
                  <ExecutionList
                    executions={executions}
                    selectedId={selectedExecution}
                    onSelect={setSelectedExecution}
                    isLoading={loading}
                  />
                </Card>
              </div>

              {/* Sidebar for selected execution */}
              <div>
                {selectedExecution ? (
                  <ExecutionMonitor executionId={selectedExecution} />
                ) : (
                  <Card className="p-6 text-center">
                    <p className="text-muted-foreground">
                      Select an execution to view details and audit logs
                    </p>
                  </Card>
                )}
              </div>
            </div>
          </TabsContent>

          {/* Workflows Tab */}
          <TabsContent value="workflows" className="space-y-6">
            <WorkflowBuilder onWorkflowStarted={handleWorkflowStarted} />
          </TabsContent>

          {/* Details Tab */}
          <TabsContent value="details" className="space-y-6">
            <Card className="p-6">
              <h2 className="mb-6 text-xl font-semibold text-foreground">System Status</h2>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-lg bg-muted p-4">
                  <p className="text-sm text-muted-foreground">Total Executions</p>
                  <p className="text-2xl font-bold text-foreground">{totalExecutions}</p>
                </div>
                <div className="rounded-lg bg-muted p-4">
                  <p className="text-sm text-muted-foreground">Success Rate</p>
                  <p className="text-2xl font-bold text-foreground">{successRate}%</p>
                </div>
                <div className="rounded-lg bg-muted p-4">
                  <p className="text-sm text-muted-foreground">Failed Executions</p>
                  <p className="text-2xl font-bold text-foreground">{failedCount}</p>
                </div>
                <div className="rounded-lg bg-muted p-4">
                  <p className="text-sm text-muted-foreground">Active Executions</p>
                  <p className="text-2xl font-bold text-foreground">{activeExecutions}</p>
                </div>
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}
