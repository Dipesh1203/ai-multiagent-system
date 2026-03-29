'use client'

import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

interface Execution {
  id: string
  agentType: string
  status: 'pending' | 'running' | 'success' | 'failed'
  progress: number
  createdAt: Date
  result?: unknown
}

interface AgentStatsProps {
  executions: Execution[]
  lastUpdatedAt: Date | null
  isLoading: boolean
}

export default function AgentStats({ executions, lastUpdatedAt, isLoading }: AgentStatsProps) {
  const total = executions.length
  const successCount = executions.filter((e) => e.status === 'success').length
  const failedCount = executions.filter((e) => e.status === 'failed').length
  const runningCount = executions.filter((e) => e.status === 'running' || e.status === 'pending').length
  const successRate = total > 0 ? ((successCount / total) * 100).toFixed(1) : '0.0'
  const averageProgress =
    total > 0
      ? Math.round(executions.reduce((sum, execution) => sum + (execution.progress ?? 0), 0) / total)
      : 0

  const perAgentMap = executions.reduce(
    (acc, execution) => {
      const key = execution.agentType || 'unknown'
      if (!acc[key]) {
        acc[key] = { name: key, executions: 0, successCount: 0, avgProgressTotal: 0 }
      }
      acc[key].executions += 1
      if (execution.status === 'success') acc[key].successCount += 1
      acc[key].avgProgressTotal += execution.progress ?? 0
      return acc
    },
    {} as Record<string, { name: string; executions: number; successCount: number; avgProgressTotal: number }>
  )

  const agentStats = Object.values(perAgentMap)
    .map((agent) => ({
      name: agent.name,
      executions: agent.executions,
      successRate: agent.executions > 0 ? ((agent.successCount / agent.executions) * 100).toFixed(1) : '0.0',
      avgProgress: agent.executions > 0 ? Math.round(agent.avgProgressTotal / agent.executions) : 0,
    }))
    .sort((a, b) => b.executions - a.executions)

  const recentActivity = [...executions]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 6)

  const formatRelativeTime = (date: Date) => {
    const now = Date.now()
    const deltaMs = now - new Date(date).getTime()
    const mins = Math.floor(deltaMs / 60000)
    if (mins < 1) return 'just now'
    if (mins < 60) return `${mins}m ago`
    const hours = Math.floor(mins / 60)
    if (hours < 24) return `${hours}h ago`
    return new Date(date).toLocaleDateString()
  }

  const lastSync = lastUpdatedAt ? `Updated ${formatRelativeTime(lastUpdatedAt)}` : 'Waiting for first sync'

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-6">
          <p className="text-sm text-muted-foreground">Total Executions</p>
          <p className="text-2xl font-bold text-foreground">{total}</p>
          <p className="text-xs text-muted-foreground">Last 20 records from live poll</p>
        </Card>

        <Card className="p-6">
          <p className="text-sm text-muted-foreground">Success Rate</p>
          <p className="text-2xl font-bold text-foreground">{successRate}%</p>
          <p className="text-xs text-muted-foreground">{successCount} success / {failedCount} failed</p>
        </Card>

        <Card className="p-6">
          <p className="text-sm text-muted-foreground">In Progress</p>
          <p className="text-2xl font-bold text-foreground">{runningCount}</p>
          <p className="text-xs text-muted-foreground">Average progress {averageProgress}%</p>
        </Card>

        <Card className="p-6">
          <p className="text-sm text-muted-foreground">Live Sync</p>
          <p className="text-2xl font-bold text-foreground">{isLoading ? 'Syncing...' : 'Online'}</p>
          <p className="text-xs text-muted-foreground">{lastSync}</p>
        </Card>
      </div>

      <Card className="p-6">
        <h2 className="mb-4 text-lg font-semibold text-foreground">Agent Type Performance</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="px-4 py-3 text-left text-muted-foreground">Agent Type</th>
                <th className="px-4 py-3 text-right text-muted-foreground">Executions</th>
                <th className="px-4 py-3 text-right text-muted-foreground">Success Rate</th>
                <th className="px-4 py-3 text-right text-muted-foreground">Avg Progress</th>
              </tr>
            </thead>
            <tbody>
              {agentStats.length === 0 && (
                <tr>
                  <td className="px-4 py-4 text-sm text-muted-foreground" colSpan={4}>
                    No execution data available yet.
                  </td>
                </tr>
              )}
              {agentStats.map((agent) => (
                <tr
                  key={agent.name}
                  className="border-b border-border transition-colors hover:bg-muted/50"
                >
                  <td className="px-4 py-3 font-medium capitalize text-foreground">{agent.name}</td>
                  <td className="px-4 py-3 text-right text-foreground">{agent.executions}</td>
                  <td className="px-4 py-3 text-right">
                    <Badge
                      variant="outline"
                      className={
                        Number(agent.successRate) >= 90
                          ? 'bg-green-500/10 text-green-600'
                          : 'bg-yellow-500/10 text-yellow-600'
                      }
                    >
                      {agent.successRate}%
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right text-foreground">{agent.avgProgress}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="mb-4 text-lg font-semibold text-foreground">Recent Activity</h2>
        <div className="space-y-3">
          {recentActivity.length === 0 && (
            <div className="rounded-lg bg-muted/50 p-3">
              <p className="text-sm text-muted-foreground">No activity yet. Run a workflow to populate this feed.</p>
            </div>
          )}
          {recentActivity.map((item) => (
            <div key={item.id} className="flex items-center gap-4 rounded-lg bg-muted/50 p-3">
              <div
                className={`h-2 w-2 rounded-full ${
                  item.status === 'success'
                    ? 'bg-green-500'
                    : item.status === 'failed'
                      ? 'bg-red-500'
                      : 'bg-blue-500'
                }`}
              />
              <div className="flex-1">
                <p className="text-sm text-foreground">{item.agentType || 'agent'} execution {item.status}</p>
                <p className="text-xs text-muted-foreground">{formatRelativeTime(item.createdAt)}</p>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}
