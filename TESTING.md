# Nexus-Agent Testing Guide

## Prerequisites

Ensure the following are configured:
- PostgreSQL database with Nexus-Agent schema initialized
- Environment variables set: `DATABASE_URL`, `GOOGLE_API_KEY`
- Node.js and Python dependencies installed

## Testing the Frontend Dashboard

### 1. Start the Development Server

```bash
npm run dev
```

The application will be available at `http://localhost:3000`

### 2. Dashboard Navigation Tests

**Test Agent Management:**
- Navigate to the dashboard homepage
- Verify agent cards display (Research, Analysis, Decision, Execution)
- Confirm each agent shows correct icon and description
- Check that agent names, descriptions, and tool counts are displayed

**Test Execution History:**
- Scroll to the "Recent Executions" section
- Verify execution entries show status, timestamp, and agent type
- Click on an execution to view details in the ExecutionMonitor
- Confirm real-time updates if execution is ongoing

**Test Workflow Builder:**
- Click "New Workflow" button
- Verify workflow builder modal opens
- Add agents in sequence
- Confirm agent connections are displayed
- Test adding/removing agents from workflow
- Verify workflow execution button is enabled when agents are selected

**Test Audit Logs:**
- Navigate to audit logs section (if available in dashboard)
- Verify logs display user actions and timestamps
- Test filtering by action type
- Confirm log search functionality

### 3. Visual/UX Tests

- Verify dark theme is properly applied
- Check responsive design on mobile/tablet sizes
- Confirm all buttons are clickable and show proper states
- Verify loading states (spinners) appear during operations
- Check error messages display clearly

## Testing the API Endpoints

### 1. Execute Single Agent

```bash
curl -X POST http://localhost:3000/api/agents/execute \
  -H "Content-Type: application/json" \
  -d '{
    "agentType": "research",
    "input": "Search for latest AI trends in 2024",
    "workflowId": "test-workflow-1"
  }'
```

**Expected Response:**
- HTTP 200 status
- `executionId` in response body
- Execution record created in database

### 2. Check Execution Status

```bash
curl -X GET http://localhost:3000/api/agents/status?executionId=<execution_id>
```

**Expected Response:**
- Current execution status (pending, running, completed, failed)
- Progress percentage
- Current step information
- Output data if completed

### 3. Execute Workflow (Multi-Agent)

```bash
curl -X POST http://localhost:3000/api/agents/workflow \
  -H "Content-Type: application/json" \
  -d '{
    "workflowName": "Full Analysis Pipeline",
    "agents": ["research", "analysis", "decision"],
    "initialInput": "Analyze market trends for Q1 2024",
    "executionMode": "sequential"
  }'
```

**Expected Response:**
- HTTP 200 status
- `workflowExecutionId` in response
- First agent starts executing

### 4. Retrieve Audit Logs

```bash
curl -X GET "http://localhost:3000/api/agents/audit-logs?limit=10&offset=0"
```

**Expected Response:**
- Array of audit log entries
- Each entry contains: timestamp, action, user, executionId, details
- Entries sorted by timestamp (newest first)

## Testing Python Agent Framework

### 1. Unit Test Agent Initialization

Create a test file `scripts/agents/test_agents.py`:

```python
import asyncio
from agents.agent_builder import AgentBuilder
from agents.types import AgentType

async def test_agent_creation():
    builder = AgentBuilder()
    
    # Test creating research agent
    research_agent = builder.create_agent(AgentType.RESEARCH)
    assert research_agent is not None
    assert research_agent.agent_type == AgentType.RESEARCH
    print("✓ Research agent created successfully")
    
    # Test creating analysis agent
    analysis_agent = builder.create_agent(AgentType.ANALYSIS)
    assert analysis_agent is not None
    assert analysis_agent.agent_type == AgentType.ANALYSIS
    print("✓ Analysis agent created successfully")

if __name__ == "__main__":
    asyncio.run(test_agent_creation())
```

Run with:
```bash
cd scripts/agents
uv run test_agents.py
```

### 2. Test Agent Execution

```python
import asyncio
from agents.executor import AgentExecutor
from agents.types import AgentType

async def test_agent_execution():
    executor = AgentExecutor()
    
    # Test research agent
    result = await executor.execute(
        agent_type=AgentType.RESEARCH,
        input_data="Find information about renewable energy",
        execution_id="test-exec-001"
    )
    
    assert result is not None
    assert "output" in result
    print(f"✓ Agent execution completed: {result['status']}")
    print(f"Output: {result['output'][:100]}...")

if __name__ == "__main__":
    asyncio.run(test_agent_execution())
```

### 3. Test Tool System

```python
from agents.tools import ToolExecutor
from agents.types import Tool

async def test_tools():
    executor = ToolExecutor()
    
    # Test web search tool
    result = await executor.execute_tool(
        tool_name="web_search",
        parameters={"query": "artificial intelligence 2024"}
    )
    
    assert result is not None
    print(f"✓ Web search tool returned {len(result)} results")

if __name__ == "__main__":
    import asyncio
    asyncio.run(test_tools())
```

### 4. Test Database Operations

```python
import asyncio
from agents.database import DatabaseManager

async def test_database():
    db = DatabaseManager()
    
    # Test saving execution
    execution_id = await db.save_execution(
        agent_type="research",
        status="running",
        input_data="test input",
        workflow_id="test-workflow"
    )
    
    assert execution_id is not None
    print(f"✓ Execution saved with ID: {execution_id}")
    
    # Test retrieving execution
    execution = await db.get_execution(execution_id)
    assert execution is not None
    assert execution['status'] == 'running'
    print(f"✓ Execution retrieved: {execution['agent_type']}")
    
    # Test audit log
    await db.log_audit(
        action="execution_started",
        execution_id=execution_id,
        details={"agent": "research"}
    )
    print("✓ Audit log created")

if __name__ == "__main__":
    asyncio.run(test_database())
```

## Integration Testing

### End-to-End Workflow Test

1. Start the development server
2. Execute the workflow API endpoint
3. Monitor execution status via API
4. Check database for execution record
5. Verify audit logs are created
6. Confirm dashboard shows execution in history
7. Check that all agent states are saved

### Test Retry Logic

1. Simulate a failing tool (modify tool to fail initially)
2. Execute agent
3. Verify retry mechanism activates
4. Confirm execution eventually succeeds or reaches max retries
5. Check audit logs for retry attempts

### Test Error Handling

1. Execute with invalid input
2. Verify graceful error response
3. Confirm error is logged in audit trail
4. Check that agent state remains consistent

## Performance Testing

### Load Test API Endpoints

```bash
# Test concurrent agent executions
for i in {1..10}; do
  curl -X POST http://localhost:3000/api/agents/execute \
    -H "Content-Type: application/json" \
    -d '{"agentType":"research","input":"Test query '$i'"}' &
done
```

**Metrics to Monitor:**
- Response time (should be < 5s for execution start)
- Database query performance
- Memory usage
- Error rate

### Test Workflow Performance

Execute complex multi-agent workflows and monitor:
- Total execution time
- Time between agent handoffs
- Database write operations
- API response times

## Debugging Tips

### Enable Debug Logging

Add `console.log("[v0] ...")` statements in components:
```tsx
console.log("[v0] Execution status:", status);
console.log("[v0] Agent tools:", tools);
```

### Check Network Requests

1. Open Browser DevTools (F12)
2. Go to Network tab
3. Monitor API calls to `/api/agents/*`
4. Check response status and payload

### Monitor Database

Use a PostgreSQL client to inspect tables:
```sql
SELECT * FROM executions ORDER BY created_at DESC LIMIT 10;
SELECT * FROM audit_logs WHERE execution_id = 'test-exec-001';
SELECT * FROM agent_states WHERE execution_id = 'test-exec-001';
```

### Python Debugging

```python
import logging
logging.basicConfig(level=logging.DEBUG)

# Enable debug mode in agent
agent.debug = True
```

## Checklist

- [ ] Dashboard loads without errors
- [ ] Agent cards display correctly
- [ ] Execution list shows recent executions
- [ ] Single agent execution API works
- [ ] Multi-agent workflow API works
- [ ] Execution status API returns correct status
- [ ] Audit logs API returns entries
- [ ] Database operations complete successfully
- [ ] Error handling catches and logs errors
- [ ] Retry logic activates on failure
- [ ] Dashboard updates in real-time
- [ ] All components render without warnings
