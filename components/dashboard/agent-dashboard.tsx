'use client'

import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import ExecutionList from './execution-list'
import ExecutionMonitor from './execution-monitor'
import WorkflowBuilder from './workflow-builder'
import AgentStats from './agent-stats'

export default function AgentDashboard() {
  const [activeTab, setActiveTab] = useState('overview')
  const [selectedExecution, setSelectedExecution] = useState<string | null>(null)
  const [executions, setExecutions] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    // In a real app, this would fetch from the database
    // For now, we'll use placeholder data
    setExecutions([
      {
        id: 'exec-001',
        agentType: 'research',
        status: 'running',
        progress: 65,
        createdAt: new Date(),
        result: null,
      },
      {
        id: 'exec-002',
        agentType: 'analysis',
        status: 'success',
        progress: 100,
        createdAt: new Date(Date.now() - 3600000),
        result: { summary: 'Analysis completed successfully' },
      },
    ])
  }, [])

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
            <Button variant="outline" size="sm">
              Settings
            </Button>
            <Button size="sm">+ New Execution</Button>
          </div>
        </div>
      </header>

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
            <AgentStats />
          </TabsContent>

          {/* Executions Tab */}
          <TabsContent value="executions" className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-3">
              <div className="lg:col-span-2">
                <Card className="p-6">
                  <div className="mb-6 flex items-center justify-between">
                    <h2 className="text-xl font-semibold text-foreground">Recent Executions</h2>
                    <Button variant="outline" size="sm">
                      Refresh
                    </Button>
                  </div>
                  <ExecutionList
                    executions={executions}
                    selectedId={selectedExecution}
                    onSelect={setSelectedExecution}
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
            <WorkflowBuilder />
          </TabsContent>

          {/* Details Tab */}
          <TabsContent value="details" className="space-y-6">
            <Card className="p-6">
              <h2 className="mb-6 text-xl font-semibold text-foreground">System Status</h2>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-lg bg-muted p-4">
                  <p className="text-sm text-muted-foreground">Total Executions</p>
                  <p className="text-2xl font-bold text-foreground">1,234</p>
                </div>
                <div className="rounded-lg bg-muted p-4">
                  <p className="text-sm text-muted-foreground">Success Rate</p>
                  <p className="text-2xl font-bold text-foreground">98.5%</p>
                </div>
                <div className="rounded-lg bg-muted p-4">
                  <p className="text-sm text-muted-foreground">Avg Execution Time</p>
                  <p className="text-2xl font-bold text-foreground">2.4s</p>
                </div>
                <div className="rounded-lg bg-muted p-4">
                  <p className="text-sm text-muted-foreground">Active Workflows</p>
                  <p className="text-2xl font-bold text-foreground">12</p>
                </div>
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}
