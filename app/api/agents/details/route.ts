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
    return NextResponse.json(
      { success: false, error: 'Database temporarily unavailable', code: 'DB_UNAVAILABLE' },
      {
        status: 503,
        headers: {
          'Cache-Control': 'no-store',
          'Retry-After': String(Math.max(1, Math.ceil((dbUnavailableUntil - Date.now()) / 1000))),
        },
      }
    )
  }

  try {
    const executionId = request.nextUrl.searchParams.get('executionId')
    
    if (!executionId) {
      return NextResponse.json({ success: false, error: 'executionId is required' }, { status: 400 })
    }

    const execution = await prisma.execution.findFirst({
      where: { executionId: executionId },
      include: {
        audits: {
          orderBy: { timestamp: 'desc' }
        }
      }
    })

    if (!execution) {
      return NextResponse.json({ success: false, error: 'Execution not found' }, { status: 404 })
    }

    return NextResponse.json(
      {
        success: true,
        execution: {
          id: execution.executionId,
          status: execution.status || 'unknown',
          agentType: 'agent', // Generic map since agentId isn't on table execution directly here
          progress: execution.status === 'success' ? 100 : execution.status === 'pending' ? 10 : 50,
          startTime: execution.startedAt || execution.createdAt,
          error: execution.errorMessage
        },
        audits: execution.audits.map(a => ({
          id: a.id.toString(),
          action: a.action,
          details: a.details,
          createdAt: a.timestamp
        }))
      },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (error) {
    if (isDatabaseUnavailable(error)) {
      dbUnavailableUntil = Date.now() + DB_RETRY_COOLDOWN_MS
      return NextResponse.json(
        { success: false, error: 'Database temporarily unavailable', code: 'DB_UNAVAILABLE' },
        {
          status: 503,
          headers: {
            'Cache-Control': 'no-store',
            'Retry-After': String(Math.ceil(DB_RETRY_COOLDOWN_MS / 1000)),
          },
        }
      )
    }

    console.error('[v0] Error fetching execution details:', error)

    return NextResponse.json(
      { success: false, error: 'Failed to fetch execution details' },
      { status: 500 }
    )
  }
}
