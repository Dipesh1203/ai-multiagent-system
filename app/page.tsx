'use client'

import { useState } from 'react'
import AgentDashboard from '@/components/dashboard/agent-dashboard'
import { ThemeProvider } from '@/components/theme-provider'

export default function Home() {
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
      <div className="min-h-screen bg-background text-foreground">
        <AgentDashboard />
      </div>
    </ThemeProvider>
  )
}
