# Nexus-Agent

Submission-ready multi-agent AI system for autonomous enterprise workflows, with live monitoring and auditability.

## 1. Problem Statement Fit

This project is built for: **Agentic AI for Autonomous Enterprise Workflows**.

It demonstrates:
- Multi-agent orchestration (sequential and parallel)
- Autonomous execution from workflow trigger to completion
- Exception-aware runtime behavior with retries and graceful degradation
- Auditable event trails per execution
- Real-time workflow health monitoring in a web dashboard

## 2. What Is Implemented

### Core capabilities
- Agent execution API for single-agent runs
- Workflow API for multi-agent runs
- Inter-agent handoff for sequential workflows (`previous_agent_output` is passed forward)
- Live executions polling in dashboard
- Execution detail monitor with audit event stream
- Downloadable execution report (JSON)

### Agent types
- Research
- Analysis
- Decision
- Execution

### Reliability behavior
- Retry-oriented Python execution flow (agent runtime)
- DB outage tolerance in API polling endpoints
- Shared Prisma client usage to reduce connection pressure
- Polling controls in UI (Settings)

## 3. Architecture

### Frontend
- Next.js + React dashboard (`/`)
- Workflow builder and execution monitor
- Overview analytics from live execution data

### Backend API
- Next.js route handlers under `app/api/agents/*`
- Python runtime invoked from Node route handlers (`child_process.spawn`)

### Agent runtime
- Python package in `scripts/agents`
- LangGraph/LangChain style execution and tool invocation
- PostgreSQL persistence for executions, states, and audit logs

### Data layer
- PostgreSQL (Neon-compatible)
- Prisma client in Next.js APIs

## 4. Repository Highlights

- `app/api/agents/execute/route.ts` - single-agent execution endpoint
- `app/api/agents/workflow/route.ts` - multi-agent workflow endpoint
- `app/api/agents/executions/route.ts` - polling endpoint for execution list
- `app/api/agents/details/route.ts` - execution details + audit stream
- `components/dashboard/agent-dashboard.tsx` - dashboard shell
- `components/dashboard/workflow-builder.tsx` - workflow creation UI
- `components/dashboard/execution-monitor.tsx` - detail panel + report download
- `components/dashboard/agent-stats.tsx` - live overview metrics
- `scripts/agents/` - Python agent runtime
- `prisma/schema.prisma` - Prisma schema

## 5. Prerequisites

- Node.js 18+
- Python 3.11 or 3.12 recommended
- PostgreSQL database (Neon works)
- Google API key for Gemini integration

Note: Python 3.14 currently shows a LangChain/Pydantic compatibility warning. Use Python 3.11/3.12 for stable submissions.

## 6. Setup

### 6.1 Clone and install Node dependencies

```bash
npm install
```

Windows PowerShell users can use:

```bash
npm.cmd install
```

### 6.2 Configure environment variables

Copy `.env.example` to `.env` (or `.env.local`) and set values:

- `DATABASE_URL` - Prisma runtime database URL
- `PYTHON_DATABASE_URL` - Python runtime DB URL
- `GOOGLE_API_KEY` - Gemini API key
- `PYTHON_EXECUTABLE` - absolute python path if needed

Example (Windows):

```env
PYTHON_EXECUTABLE=C:\\Python311\\python.exe
```

### 6.3 Python environment for agents

```bash
cd scripts/agents
python -m venv .venv
.venv\Scripts\activate
pip install -e .
cd ../..
```

### 6.4 Prisma setup

```bash
npm run prisma:generate
npm run prisma:push
```

Optional: initialize SQL schema manually with `scripts/01-init-schema.sql` if your DB is empty and you prefer SQL-first setup.

## 7. Run Locally

```bash
npm run dev
```

Windows PowerShell alternative:

```bash
npm.cmd run dev
```

Open the local URL printed in terminal (usually `http://localhost:3000`).

## 8. Submission Demo Flow (Recommended)

Use this exact sequence for judging:

1. Go to **Workflows** tab.
2. Create workflow: `Market Research Pipeline`.
3. Set mode: **Sequential**.
4. Add agents in order:
   - Research
   - Analysis
5. Click **Execute Workflow**.
6. Observe automatic switch to **Executions** tab.
7. Confirm status progression in list and right panel.
8. Open **Audit Log** sub-tab and verify event timestamps.
9. Click **Download Report** and show exported JSON evidence.

## 9. API Quick Reference

### POST `/api/agents/execute`
Execute a single agent.

Body:
```json
{
  "agentType": "research",
  "inputData": {"query": "enterprise risk trends"},
  "maxRetries": 3
}
```

### POST `/api/agents/workflow`
Execute multi-agent workflow.

Body:
```json
{
  "agents": [
    {"type": "research", "input": {"query": "supplier risk"}},
    {"type": "analysis", "input": {"focus": "cost"}}
  ],
  "parallel": false
}
```

### GET `/api/agents/executions`
Get latest execution list for dashboard polling.

### GET `/api/agents/details?executionId=<id>`
Get execution details + audit events.

### GET `/api/agents/status?executionId=<id>`
Get status from Python DB query path.

### GET `/api/agents/audit-logs?executionId=<id>&limit=50`
Get raw audit logs for an execution.

## 10. Enterprise Use Cases

### A. Procurement-to-Payment orchestration
- Research agent fetches supplier and pricing context
- Analysis agent compares vendors/risk
- Decision agent recommends compliant option
- Execution agent triggers downstream actions and records trace

### B. Employee onboarding automation
- Collect HR/IT prerequisites
- Validate policy and access rules
- Assign tasks and deadlines
- Log every decision and escalation event

### C. Contract lifecycle acceleration
- Extract obligations and key dates
- Analyze risk clauses
- Route for approvals and reminders
- Track stalls and completion status

### D. Meeting intelligence operations
- Extract decisions and action items
- Assign owner and due date
- Escalate blocked tasks
- Maintain full timeline audit

### E. SLA and process-health monitoring
- Poll active executions
- Detect long-running or failed stages
- Reroute/escalate when needed
- Keep operations dashboard live

## 11. Benefits of Using This System

- **Reduced manual follow-up:** workflows execute autonomously after one trigger
- **Operational visibility:** real-time execution and status monitoring
- **Audit readiness:** timestamped decision trail per execution
- **Extensible agent model:** add domain-specific agents and tools
- **Resilience-minded architecture:** retries and degraded-path handling for transient outages
- **Enterprise relevance:** maps directly to real process automation use cases

## 12. Evaluation Mapping (Rubric Alignment)

### Depth of autonomy
- Multi-agent workflows with sequential/parallel execution
- Inter-agent output handoff in sequential mode

### Quality of error recovery
- Retry behavior in Python agent execution path
- DB outage-aware API degradation for polling endpoints

### Auditability of decisions
- Execution and audit event timeline in UI
- Downloadable report artifact for submission evidence

### Real-world applicability
- Use-case fit for procurement, onboarding, contracts, meeting ops, and SLA monitoring

## 13. Known Limitations and Next Steps

Current:
- Some runs may show minimal audit depth (start/completed only)
- Python 3.14 emits compatibility warning with current LangChain ecosystem

Recommended improvements for stronger judging score:
- Add richer audit events: `tool_executed`, `decision_made`, `retry_attempt`, `fallback_applied`, `escalation_triggered`
- Add explicit failure simulation scenario and self-healing demonstration
- Add role/owner assignment and escalation workflows for business actions
- Add persistent settings and role-based access controls

## 14. Troubleshooting

### Dashboard feels static
- Ensure workflow was executed from Workflows tab
- Use Refresh button in Executions
- Check API responses from `/api/agents/executions`

### DB connectivity (`P1001`/timeouts)
- Verify Neon/Postgres availability
- Validate `DATABASE_URL` and `PYTHON_DATABASE_URL`
- Restart dev server after env changes

### Python warning about Pydantic v1 on 3.14
- Switch to Python 3.11/3.12
- Point `PYTHON_EXECUTABLE` to that interpreter

## 15. Submission Checklist

- App runs locally (`npm run dev`)
- Workflow demo completes in UI
- Audit log visible for completed execution
- Downloaded report attached as evidence
- README included with setup + use cases + benefits (this document)

---

If you are submitting this for evaluation, include at least:
- 1 happy-path workflow recording
- 1 failure-and-recovery workflow recording
- 1 downloaded execution report JSON
