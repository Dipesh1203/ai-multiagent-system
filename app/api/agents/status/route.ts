/**
 * GET /api/agents/status?executionId=xxx
 * Get execution status and results
 */
import { NextRequest, NextResponse } from 'next/server'
import { spawn } from 'child_process'

interface StatusResponse {
  success: boolean
  executionId?: string
  status?: string
  result?: Record<string, unknown>
  error?: string
}

export async function GET(request: NextRequest): Promise<NextResponse<StatusResponse>> {
  try {
    const executionId = request.nextUrl.searchParams.get('executionId')

    if (!executionId) {
      return NextResponse.json(
        { success: false, error: 'executionId is required' },
        { status: 400 }
      )
    }

    // Query database for execution status
    const result = await queryExecutionStatus(executionId)

    return NextResponse.json({
      success: true,
      executionId,
      ...result,
    })
  } catch (error) {
    console.error('[v0] Status API error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

function queryExecutionStatus(executionId: string): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const pythonExecutable = process.env.PYTHON_EXECUTABLE || 'python'
    const pythonScript = `
import sys
import json
import os
from pathlib import Path

# Add scripts directory to path (python -c does not define __file__)
scripts_dir = Path(os.getcwd()) / 'scripts'
sys.path.insert(0, str(scripts_dir))

from agents.database import DatabaseManager

db = DatabaseManager()
execution_id = json.loads(${JSON.stringify(JSON.stringify(executionId))})
execution = db.get_execution(execution_id)

if execution:
    print(json.dumps({
        'status': execution.get('status'),
        'result': execution.get('output_data'),
        'error': execution.get('error'),
        'createdAt': execution.get('created_at').isoformat() if execution.get('created_at') else None,
        'updatedAt': execution.get('updated_at').isoformat() if execution.get('updated_at') else None,
    }))
else:
    print(json.dumps({'status': 'not_found', 'error': 'Execution not found'}))
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
    })

    python.on('close', (code: number) => {
      if (code === 0 && stdout) {
        try {
          const result = JSON.parse(stdout)
          resolve(result)
        } catch (e) {
          reject(new Error(`Failed to parse status: ${e instanceof Error ? e.message : String(e)}`))
        }
      } else {
        reject(new Error(stderr || `Process exited with code ${code}`))
      }
    })

    python.on('error', (error: Error) => {
      reject(error)
    })
  })
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  return NextResponse.json(
    { error: 'Use GET to check execution status' },
    { status: 405 }
  )
}
