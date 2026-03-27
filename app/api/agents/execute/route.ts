/**
 * POST /api/agents/execute
 * Execute a single agent with given input
 */
import { NextRequest, NextResponse } from 'next/server'
import { spawn } from 'child_process'
import { v4 as uuidv4 } from 'uuid'

interface ExecuteRequest {
  agentType: string
  inputData: Record<string, unknown>
  workflowId?: string
  maxRetries?: number
}

interface ExecuteResponse {
  success: boolean
  executionId: string
  status: string
  result?: Record<string, unknown>
  error?: string
}

// In-memory execution tracking (replace with persistent storage in production)
const activeExecutions = new Map<string, any>()

export async function POST(request: NextRequest): Promise<NextResponse<ExecuteResponse>> {
  try {
    const body: ExecuteRequest = await request.json()

    const { agentType, inputData, workflowId = uuidv4(), maxRetries = 3 } = body

    // Validate input
    if (!agentType) {
      return NextResponse.json(
        { success: false, executionId: '', status: 'error', error: 'agentType is required' },
        { status: 400 }
      )
    }

    // Create execution ID
    const executionId = uuidv4()

    // Store execution metadata
    activeExecutions.set(executionId, {
      agentType,
      workflowId,
      status: 'starting',
      createdAt: new Date(),
    })

    // Execute Python agent asynchronously
    executeAgentAsync(executionId, agentType, inputData, workflowId, maxRetries).catch(
      (error) => {
        console.error(`[v0] Execution ${executionId} failed:`, error)
        const exec = activeExecutions.get(executionId)
        if (exec) {
          exec.status = 'failed'
          exec.error = error.message
        }
      }
    )

    return NextResponse.json({
      success: true,
      executionId,
      status: 'pending',
    })
  } catch (error) {
    console.error('[v0] API error:', error)
    return NextResponse.json(
      {
        success: false,
        executionId: '',
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

function executeAgentAsync(
  executionId: string,
  agentType: string,
  inputData: Record<string, unknown>,
  workflowId: string,
  maxRetries: number
): Promise<void> {
  return new Promise((resolve, reject) => {
    const pythonExecutable = process.env.PYTHON_EXECUTABLE || 'python'
    const inputJson = JSON.stringify(inputData)
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
    
    agent_type_key = ${JSON.stringify(agentType)}
    agent_type = agent_type_map.get(agent_type_key, AgentType.RESEARCH)
    input_data = json.loads(${JSON.stringify(inputJson)})
    
    result = await executor.execute_agent(
        agent_type=agent_type,
        input_data=input_data,
        workflow_id='${workflowId}',
        max_retries=${maxRetries}
    )
    
    # Output result as JSON
    print(json.dumps({
        'executionId': '${executionId}',
        'status': result.status.value,
        'agentId': result.agent_id,
        'output': result.output,
        'error': result.error,
        'retryCount': result.retry_count,
        'durationSeconds': result.duration_seconds,
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
      const exec = activeExecutions.get(executionId)
      if (!exec) return

      if (code === 0 && stdout) {
        try {
          const result = JSON.parse(stdout)
          exec.status = result.status
          exec.result = result.output
          exec.error = result.error
          exec.completedAt = new Date()
          resolve()
        } catch (e) {
          exec.status = 'failed'
          exec.error = `Failed to parse result: ${e instanceof Error ? e.message : String(e)}`
          reject(e)
        }
      } else {
        exec.status = 'failed'
        exec.error = stderr || `Process exited with code ${code}`
        reject(new Error(exec.error))
      }
    })

    python.on('error', (error: Error) => {
      const exec = activeExecutions.get(executionId)
      if (exec) {
        exec.status = 'failed'
        exec.error = error.message
      }
      reject(error)
    })
  })
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  return NextResponse.json(
    { error: 'Use POST to execute agents' },
    { status: 405 }
  )
}
