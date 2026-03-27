'use client'

import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

interface StatCard {
  label: string
  value: string | number
  subtext?: string
  trend?: 'up' | 'down' | 'neutral'
}

export default function AgentStats() {
  const stats: StatCard[] = [
    {
      label: 'Total Executions',
      value: '1,234',
      subtext: '+12% this week',
      trend: 'up',
    },
    {
      label: 'Success Rate',
      value: '98.5%',
      subtext: 'Avg across all agents',
      trend: 'neutral',
    },
    {
      label: 'Avg Duration',
      value: '2.4s',
      subtext: 'Per execution',
      trend: 'down',
    },
    {
      label: 'Active Workflows',
      value: '12',
      subtext: '3 pending completion',
      trend: 'up',
    },
  ]

  const agentStats = [
    { name: 'Research Agent', executions: 456, successRate: 99.2, avgTime: '2.1s' },
    { name: 'Analysis Agent', executions: 389, successRate: 97.8, avgTime: '3.2s' },
    { name: 'Decision Agent', executions: 234, successRate: 96.5, avgTime: '1.9s' },
    { name: 'Execution Agent', executions: 155, successRate: 98.1, avgTime: '2.8s' },
  ]

  return (
    <div className="space-y-6">
      {/* Top Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label} className="p-6">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">{stat.label}</p>
              <div className="flex items-baseline justify-between">
                <p className="text-2xl font-bold text-foreground">{stat.value}</p>
                {stat.trend && (
                  <Badge
                    variant="outline"
                    className={
                      stat.trend === 'up'
                        ? 'bg-green-500/10 text-green-600'
                        : stat.trend === 'down'
                          ? 'bg-blue-500/10 text-blue-600'
                          : 'bg-gray-500/10 text-gray-600'
                    }
                  >
                    {stat.trend === 'up' ? '↑' : stat.trend === 'down' ? '↓' : '→'}
                  </Badge>
                )}
              </div>
              {stat.subtext && <p className="text-xs text-muted-foreground">{stat.subtext}</p>}
            </div>
          </Card>
        ))}
      </div>

      {/* Agent Type Performance */}
      <Card className="p-6">
        <h2 className="mb-4 text-lg font-semibold text-foreground">Agent Type Performance</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="px-4 py-3 text-left text-muted-foreground">Agent Type</th>
                <th className="px-4 py-3 text-right text-muted-foreground">Executions</th>
                <th className="px-4 py-3 text-right text-muted-foreground">Success Rate</th>
                <th className="px-4 py-3 text-right text-muted-foreground">Avg Time</th>
              </tr>
            </thead>
            <tbody>
              {agentStats.map((agent) => (
                <tr
                  key={agent.name}
                  className="border-b border-border transition-colors hover:bg-muted/50"
                >
                  <td className="px-4 py-3 font-medium text-foreground">{agent.name}</td>
                  <td className="px-4 py-3 text-right text-foreground">{agent.executions}</td>
                  <td className="px-4 py-3 text-right">
                    <Badge
                      variant="outline"
                      className="bg-green-500/10 text-green-600"
                    >
                      {agent.successRate}%
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right text-foreground">{agent.avgTime}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Activity Timeline */}
      <Card className="p-6">
        <h2 className="mb-4 text-lg font-semibold text-foreground">Recent Activity</h2>
        <div className="space-y-3">
          {[
            { event: 'Research workflow completed', time: '2 min ago', status: 'success' },
            { event: 'Analysis agent started', time: '5 min ago', status: 'running' },
            { event: 'Decision workflow failed', time: '12 min ago', status: 'failed' },
            { event: 'Execution agent completed', time: '18 min ago', status: 'success' },
          ].map((item, index) => (
            <div key={index} className="flex items-center gap-4 rounded-lg bg-muted/50 p-3">
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
                <p className="text-sm text-foreground">{item.event}</p>
                <p className="text-xs text-muted-foreground">{item.time}</p>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}
