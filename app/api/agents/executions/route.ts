import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

const DB_RETRY_COOLDOWN_MS = 15000
let dbUnavailableUntil = 0

function isDatabaseUnavailable(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error)
  return (
    message.includes("Can't reach database server") ||
    message.includes('Timed out fetching a new connection from the connection pool') ||
    message.includes('P1001') ||
    message.includes('P2024')
  )
}

export async function GET(request: NextRequest) {
  if (Date.now() < dbUnavailableUntil) {
    const retryAfterSeconds = Math.max(1, Math.ceil((dbUnavailableUntil - Date.now()) / 1000))
    return NextResponse.json(
      {
        success: true,
        executions: [],
        degraded: true,
        error: 'Database temporarily unavailable. Retrying via poll loop.',
      },
      {
        headers: {
          'Cache-Control': 'no-store',
          'Retry-After': String(retryAfterSeconds),
        },
      }
    )
  }

  try {
    const executions = await prisma.execution.findMany({
      orderBy: { createdAt: 'desc' },
      take: 20,
    })

    // Map Prisma schema to Frontend Execution Type
    const mappedExecutions = executions.map((exec) => ({
      id: exec.executionId,
      agentType: 'agent', // Prisma execution model doesn't explicitly store agent_type directly
      status: exec.status || 'failed',
      progress: exec.status === 'success' ? 100 : exec.status === 'pending' ? 10 : 50,
      createdAt: exec.createdAt || new Date(),
      result: exec.outputData || exec.errorMessage || null,
    }))

    return NextResponse.json(
      { success: true, executions: mappedExecutions },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (error) {
    if (isDatabaseUnavailable(error)) {
      dbUnavailableUntil = Date.now() + DB_RETRY_COOLDOWN_MS
      return NextResponse.json(
        {
          success: true,
          executions: [],
          degraded: true,
          error: 'Database temporarily unavailable. Retrying via poll loop.',
        },
        {
          headers: {
            'Cache-Control': 'no-store',
            'Retry-After': String(Math.ceil(DB_RETRY_COOLDOWN_MS / 1000)),
          },
        }
      )
    }

    console.error('[v0] Error fetching executions:', error)

    return NextResponse.json(
      { success: false, error: 'Failed to fetch executions' },
      { status: 500 }
    )
  }
}
