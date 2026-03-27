'use client'

import { useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'

interface WorkflowAgent {
  id: string
  type: 'research' | 'analysis' | 'decision' | 'execution'
  config: Record<string, any>
}

export default function WorkflowBuilder() {
  const [workflowName, setWorkflowName] = useState('')
  const [agents, setAgents] = useState<WorkflowAgent[]>([])
  const [parallel, setParallel] = useState(false)
  const [newAgentType, setNewAgentType] = useState<WorkflowAgent['type']>('research')

  const addAgent = () => {
    const newAgent: WorkflowAgent = {
      id: `agent-${agents.length + 1}`,
      type: newAgentType,
      config: {},
    }
    setAgents([...agents, newAgent])
  }

  const removeAgent = (id: string) => {
    setAgents(agents.filter((a) => a.id !== id))
  }

  const handleExecute = async () => {
    if (!workflowName || agents.length === 0) {
      alert('Please provide a workflow name and add at least one agent')
      return
    }

    try {
      const response = await fetch('/api/agents/workflow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agents: agents.map((a) => ({
            type: a.type,
            input: a.config,
          })),
          parallel,
          workflowId: `wf-${Date.now()}`,
        }),
      })

      const result = await response.json()
      if (result.success) {
        alert(`Workflow started! ID: ${result.workflowId}`)
        setWorkflowName('')
        setAgents([])
      } else {
        alert(`Error: ${result.error}`)
      }
    } catch (error) {
      alert(`Failed to execute workflow: ${error}`)
    }
  }

  const agentTypeColors = {
    research: 'bg-blue-500/10 text-blue-600',
    analysis: 'bg-purple-500/10 text-purple-600',
    decision: 'bg-orange-500/10 text-orange-600',
    execution: 'bg-green-500/10 text-green-600',
  }

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {/* Builder Panel */}
      <div className="lg:col-span-2">
        <Card className="p-6">
          <h2 className="mb-6 text-xl font-semibold text-foreground">Create Workflow</h2>

          <div className="space-y-6">
            {/* Workflow Name */}
            <div className="space-y-2">
              <Label htmlFor="name" className="text-sm text-foreground">
                Workflow Name
              </Label>
              <Input
                id="name"
                placeholder="e.g., Research & Analysis Pipeline"
                value={workflowName}
                onChange={(e) => setWorkflowName(e.target.value)}
                className="border-border"
              />
            </div>

            {/* Execution Mode */}
            <div className="space-y-2">
              <Label className="text-sm text-foreground">Execution Mode</Label>
              <div className="flex gap-3">
                <Button
                  variant={parallel ? 'outline' : 'default'}
                  size="sm"
                  onClick={() => setParallel(false)}
                >
                  Sequential
                </Button>
                <Button
                  variant={parallel ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setParallel(true)}
                >
                  Parallel
                </Button>
              </div>
            </div>

            {/* Add Agents */}
            <div className="space-y-3">
              <Label className="text-sm text-foreground">Add Agents</Label>
              <div className="flex gap-2">
                <Select value={newAgentType} onValueChange={(value: any) => setNewAgentType(value)}>
                  <SelectTrigger className="border-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="research">Research Agent</SelectItem>
                    <SelectItem value="analysis">Analysis Agent</SelectItem>
                    <SelectItem value="decision">Decision Agent</SelectItem>
                    <SelectItem value="execution">Execution Agent</SelectItem>
                  </SelectContent>
                </Select>
                <Button onClick={addAgent} className="px-4">
                  + Add
                </Button>
              </div>
            </div>

            {/* Agents List */}
            {agents.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-foreground">Workflow Agents</p>
                <div className="space-y-2">
                  {agents.map((agent, index) => (
                    <div
                      key={agent.id}
                      className="flex items-center justify-between rounded-lg border border-border bg-muted/50 p-3"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-sm text-muted-foreground">{index + 1}.</span>
                        <Badge
                          className={`${agentTypeColors[agent.type]} border-0`}
                          variant="outline"
                        >
                          {agent.type}
                        </Badge>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeAgent(agent.id)}
                        className="text-destructive hover:bg-destructive/10"
                      >
                        Remove
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Execute Button */}
            <Button
              onClick={handleExecute}
              className="w-full"
              disabled={!workflowName || agents.length === 0}
            >
              Execute Workflow
            </Button>
          </div>
        </Card>
      </div>

      {/* Info Panel */}
      <div>
        <Card className="p-6">
          <h3 className="mb-4 font-semibold text-foreground">Workflow Info</h3>
          <div className="space-y-4">
            <div className="rounded-lg bg-muted p-3">
              <p className="text-xs text-muted-foreground">Total Agents</p>
              <p className="text-2xl font-bold text-foreground">{agents.length}</p>
            </div>
            <div className="rounded-lg bg-muted p-3">
              <p className="text-xs text-muted-foreground">Mode</p>
              <p className="text-sm font-medium text-foreground">
                {parallel ? 'Parallel' : 'Sequential'}
              </p>
            </div>
            <div className="rounded-lg bg-muted p-3">
              <p className="text-xs text-muted-foreground">Status</p>
              <p className="text-sm font-medium text-foreground">Ready to execute</p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}
