/**
 * POST /api/agents/workflow
 * Execute a workflow with multiple agents
 */
import { NextRequest, NextResponse } from 'next/server'
import { spawn } from 'child_process'
import { v4 as uuidv4 } from 'uuid'

interface WorkflowAgent {
  type: string
  input: Record<string, unknown>
}

interface WorkflowRequest {
  agents: WorkflowAgent[]
  parallel?: boolean
  workflowId?: string
}

interface WorkflowResponse {
  success: boolean
  workflowId: string
  executionIds: string[]
  status: string
  error?: string
}

const activeWorkflows = new Map<string, any>()

export async function POST(request: NextRequest): Promise<NextResponse<WorkflowResponse>> {
  try {
    const body: WorkflowRequest = await request.json()

    const { agents, parallel = false, workflowId = uuidv4() } = body

    // Validate input
    if (!agents || agents.length === 0) {
      return NextResponse.json(
        { success: false, workflowId: '', executionIds: [], status: 'error', error: 'agents array is required' },
        { status: 400 }
      )
    }

    // Create execution IDs for each agent
    const executionIds = agents.map(() => uuidv4())

    // Store workflow metadata
    activeWorkflows.set(workflowId, {
      agents: agents.length,
      parallel,
      status: 'starting',
      createdAt: new Date(),
      executionIds,
    })

    // Execute workflow asynchronously
    executeWorkflowAsync(workflowId, agents, executionIds, parallel).catch((error) => {
      console.error(`[v0] Workflow ${workflowId} failed:`, error)
      const workflow = activeWorkflows.get(workflowId)
      if (workflow) {
        workflow.status = 'failed'
        workflow.error = error.message
      }
    })

    return NextResponse.json({
      success: true,
      workflowId,
      executionIds,
      status: 'pending',
    })
  } catch (error) {
    console.error('[v0] Workflow API error:', error)
    return NextResponse.json(
      {
        success: false,
        workflowId: '',
        executionIds: [],
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

function executeWorkflowAsync(
  workflowId: string,
  agents: WorkflowAgent[],
  executionIds: string[],
  parallel: boolean
): Promise<void> {
  return new Promise((resolve, reject) => {
    const pythonExecutable = process.env.PYTHON_EXECUTABLE || 'python'
    const agentsJson = JSON.stringify(
      agents.map((agent) => ({
        type: agent.type,
        input: agent.input,
      }))
    )

    const pythonScript = `
import asyncio
import sys
import json
import os
from pathlib import Path

# Add scripts directory to path (python -c does not define __file__)
scripts_dir = Path(os.getcwd()) / 'scripts'
sys.path.insert(0, str(scripts_dir))

from agents import AgentExecutor, AgentType

async def main():
    executor = AgentExecutor()
    
    agent_type_map = {
        'research': AgentType.RESEARCH,
        'analysis': AgentType.ANALYSIS,
        'decision': AgentType.DECISION,
        'execution': AgentType.EXECUTION,
    }
    
    agents_config = json.loads(${JSON.stringify(agentsJson)})
    agents = [
        (agent_type_map.get(cfg['type'], AgentType.RESEARCH), cfg['input'])
        for cfg in agents_config
    ]
    
    if ${parallel ? 'True' : 'False'}:
        results = await executor.execute_parallel(
            agents=agents,
            workflow_id='${workflowId}',
            execution_ids=${JSON.stringify(executionIds)}
        )
    else:
        results = await executor.execute_workflow(
            agents=agents,
            workflow_id='${workflowId}',
            execution_ids=${JSON.stringify(executionIds)}
        )
    
    # Output results as JSON
    print(json.dumps({
        'workflowId': '${workflowId}',
        'executionIds': ${JSON.stringify(executionIds)},
        'status': 'completed',
        'results': [
            {
                'agentId': r.agent_id,
                'executionId': r.execution_id,
                'status': r.status.value,
                'output': r.output,
                'error': r.error,
                'durationSeconds': r.duration_seconds,
            }
            for r in results
        ]
    }))

asyncio.run(main())
`

    const python = spawn(pythonExecutable, ['-c', pythonScript], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        PYTHONUNBUFFERED: '1',
      },
    })

    let stdout = ''
    let stderr = ''

    python.stdout?.on('data', (data: Buffer) => {
      stdout += data.toString()
    })

    python.stderr?.on('data', (data: Buffer) => {
      stderr += data.toString()
      console.error('[v0] Python stderr:', data.toString())
    })

    python.on('close', (code: number) => {
      const workflow = activeWorkflows.get(workflowId)
      if (!workflow) return

      if (code === 0 && stdout) {
        try {
          const result = JSON.parse(stdout)
          workflow.status = 'completed'
          workflow.results = result.results
          workflow.completedAt = new Date()
          resolve()
        } catch (e) {
          workflow.status = 'failed'
          workflow.error = `Failed to parse result: ${e instanceof Error ? e.message : String(e)}`
          reject(e)
        }
      } else {
        workflow.status = 'failed'
        workflow.error = stderr || `Process exited with code ${code}`
        reject(new Error(workflow.error))
      }
    })

    python.on('error', (error: Error) => {
      const workflow = activeWorkflows.get(workflowId)
      if (workflow) {
        workflow.status = 'failed'
        workflow.error = error.message
      }
      reject(error)
    })
  })
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  return NextResponse.json(
    { error: 'Use POST to execute workflows' },
    { status: 405 }
  )
}
