# Nexus-Agent: Enterprise Autonomous Agent Framework

Nexus-Agent is a sophisticated agentic AI system built for autonomous enterprise workflows. It combines LangGraph for agent orchestration with Next.js API routes executing Python agents, PostgreSQL for audit trails, and Google Gemini for LLM capabilities.

## Architecture Overview

### Core Components

1. **Python Agent Framework** (`scripts/agents/`)
   - `agent_builder.py`: LangGraph-based agent implementation
   - `executor.py`: Execution engine with workflow support
   - `tools.py`: Extensible tool system for agents
   - `database.py`: PostgreSQL integration for persistence
   - `types.py`: Type definitions and enums
   - `error_handler.py`: Error handling, retry logic, and circuit breaker pattern

2. **Next.js API Routes** (`app/api/agents/`)
   - `execute/route.ts`: Single agent execution endpoint
   - `workflow/route.ts`: Multi-agent workflow execution
   - `status/route.ts`: Execution status tracking
   - `audit-logs/route.ts`: Audit trail retrieval

3. **React Dashboard** (`components/dashboard/`)
   - `agent-dashboard.tsx`: Main dashboard UI
   - `execution-list.tsx`: List of executions with filtering
   - `execution-monitor.tsx`: Real-time execution monitoring
   - `workflow-builder.tsx`: Visual workflow creation interface
   - `agent-stats.tsx`: Performance metrics and analytics
   - `audit-log-viewer.tsx`: Detailed audit log inspection
   - `error-monitor.tsx`: Error tracking and resolution

## Database Schema

PostgreSQL tables store all agent execution data:

- **agents**: Agent definitions and metadata
- **workflows**: Workflow definitions and execution history
- **executions**: Individual agent execution records
- **agent_states**: LangGraph state snapshots for resumability
- **audit_logs**: Complete audit trail of all operations
- **tools**: Available tool definitions and usage

## API Endpoints

### Execute Single Agent
```bash
POST /api/agents/execute
{
  "agentType": "research",
  "inputData": { "query": "..." },
  "workflowId": "optional-workflow-id",
  "maxRetries": 3
}
```

Response:
```json
{
  "success": true,
  "executionId": "uuid",
  "status": "pending"
}
```

### Execute Workflow
```bash
POST /api/agents/workflow
{
  "agents": [
    { "type": "research", "input": {...} },
    { "type": "analysis", "input": {...} }
  ],
  "parallel": false,
  "workflowId": "optional-id"
}
```

### Check Execution Status
```bash
GET /api/agents/status?executionId=uuid
```

### Get Audit Logs
```bash
GET /api/agents/audit-logs?executionId=uuid&limit=50
```

## Agent Types

1. **Research Agent**: Gathers and analyzes information
2. **Analysis Agent**: Performs detailed analysis and insights
3. **Decision Agent**: Makes recommendations and decisions
4. **Execution Agent**: Executes actions and completes tasks

## Available Tools

- `web_search`: Search for information
- `data_fetch`: Retrieve data from external sources
- `process_data`: Transform and process datasets
- `generate_report`: Create formatted reports
- `send_notification`: Send notifications through channels
- `store_result`: Persist results for future use
- `retrieve_result`: Access previously stored data

## Key Features

### Error Handling & Recovery
- Automatic retry with exponential backoff
- Circuit breaker pattern for external APIs
- Detailed error logging and recovery information
- Configurable timeout handling

### Audit Trail
- Complete execution history
- Tool usage tracking
- State snapshots at each step
- Compliance-ready audit logs

### Workflow Orchestration
- Sequential or parallel agent execution
- Conditional routing based on results
- Multi-agent coordination
- State persistence for resumability

### Monitoring & Observability
- Real-time execution status
- Performance metrics per agent type
- Audit log visualization
- Error tracking and resolution UI

## Configuration

### Environment Variables
```
DATABASE_URL=postgresql://user:pass@host/nexus_agent
GOOGLE_API_KEY=your-google-api-key
```

### Agent Configuration
```python
from agents import AgentExecutor, AgentType

executor = AgentExecutor()
result = await executor.execute_agent(
    agent_type=AgentType.RESEARCH,
    input_data={"query": "..."},
    max_retries=3
)
```

## Usage Examples

### Single Agent Execution
```bash
curl -X POST http://localhost:3000/api/agents/execute \
  -H "Content-Type: application/json" \
  -d '{
    "agentType": "research",
    "inputData": {"query": "latest AI developments"}
  }'
```

### Workflow Execution
```bash
curl -X POST http://localhost:3000/api/agents/workflow \
  -H "Content-Type: application/json" \
  -d '{
    "agents": [
      {"type": "research", "input": {"query": "topic"}},
      {"type": "analysis", "input": {"context": "previous output"}},
      {"type": "decision", "input": {"analysis": "previous output"}}
    ],
    "parallel": false
  }'
```

## Deployment

### Production Setup
1. Configure PostgreSQL database with proper backups
2. Set up environment variables in Vercel
3. Deploy Python agent framework with all dependencies
4. Configure Google API credentials
5. Monitor audit logs for compliance

### Performance Tuning
- Adjust retry configuration based on workload
- Set appropriate circuit breaker thresholds
- Monitor database query performance
- Consider agent parallelization strategies

## Security Considerations

- All database operations use parameterized queries
- API endpoints validate and sanitize inputs
- Audit logs track all operations for compliance
- Circuit breaker prevents cascading failures
- Timeout protection against hung agents

## Development

### Adding New Agents
1. Create agent subclass of NexusAgent
2. Define agent type in `types.py`
3. Implement execution logic in `agent_builder.py`
4. Register in API routes

### Adding New Tools
```python
registry = ToolRegistry()
registry.register(
    name='my_tool',
    description='Tool description',
    input_schema={...},
    func=my_tool_function
)
```

### Testing Execution
```python
import asyncio
from agents import run_agent, AgentType

result = asyncio.run(run_agent(
    AgentType.RESEARCH,
    {"query": "test"}
))
print(result)
```

## Support & Documentation

- Dashboard accessible at `/` with real-time monitoring
- API documentation in swagger format
- Audit logs available in dashboard for compliance
- Error monitoring tab for issue resolution

## Future Enhancements

- Multi-tenant support with workspace isolation
- Advanced scheduling and cron workflows
- Real-time collaboration features
- Custom metric collection
- Integration with external monitoring systems
- Advanced workflow DAG visualization
