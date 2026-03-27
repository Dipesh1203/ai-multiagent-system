/**
 * GET /api/agents/audit-logs?executionId=xxx&limit=50
 * Get audit logs for an execution
 */
import { NextRequest, NextResponse } from 'next/server'
import { spawn } from 'child_process'

interface AuditLog {
  id: string
  executionId: string
  agentId: string
  action: string
  details: Record<string, unknown>
  createdAt: string
}

interface AuditLogsResponse {
  success: boolean
  executionId?: string
  logs?: AuditLog[]
  error?: string
}

export async function GET(request: NextRequest): Promise<NextResponse<AuditLogsResponse>> {
  try {
    const executionId = request.nextUrl.searchParams.get('executionId')
    const limitParam = request.nextUrl.searchParams.get('limit') || '50'
    const parsedLimit = Number.parseInt(limitParam, 10)
    const limit = Number.isFinite(parsedLimit) && parsedLimit > 0 ? Math.min(parsedLimit, 500) : 50

    if (!executionId) {
      return NextResponse.json(
        { success: false, error: 'executionId is required' },
        { status: 400 }
      )
    }

    // Query database for audit logs
    const logs = await queryAuditLogs(executionId, limit)

    return NextResponse.json({
      success: true,
      executionId,
      logs,
    })
  } catch (error) {
    console.error('[v0] Audit logs API error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

function queryAuditLogs(executionId: string, limit: number): Promise<AuditLog[]> {
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
conn = db.get_connection()
cursor = conn.cursor()
execution_id = json.loads(${JSON.stringify(JSON.stringify(executionId))})

try:
    cursor.execute(
        '''SELECT id, execution_id, agent_id, action, details, created_at 
           FROM audit_logs 
           WHERE execution_id = %s 
           ORDER BY created_at DESC 
           LIMIT %s''',
    (execution_id, ${limit})
    )
    
    logs = []
    for row in cursor.fetchall():
        logs.append({
            'id': str(row[0]),
            'executionId': str(row[1]),
            'agentId': str(row[2]),
            'action': row[3],
            'details': row[4] if row[4] else {},
            'createdAt': row[5].isoformat() if row[5] else None,
        })
    
    print(json.dumps(logs))
finally:
    cursor.close()
    conn.close()
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
          const logs = JSON.parse(stdout)
          resolve(logs)
        } catch (e) {
          reject(new Error(`Failed to parse logs: ${e instanceof Error ? e.message : String(e)}`))
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
    { error: 'Use GET to retrieve audit logs' },
    { status: 405 }
  )
}
