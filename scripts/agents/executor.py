"""Agent execution engine."""
import asyncio
import uuid
from typing import Any, Dict, Optional
from datetime import datetime

from .agent_builder import NexusAgent
from .tools import create_default_tool_registry, ToolRegistry
from .agent_types import AgentType, ExecutionResult, AgentState, ExecutionStatus
from .database import DatabaseManager
from langchain_core.tools import Tool


class AgentExecutor:
    """Executes agents with workflow management."""

    def __init__(self, tool_registry: Optional[ToolRegistry] = None):
        """Initialize executor."""
        self.tool_registry = tool_registry or create_default_tool_registry()
        self.db = DatabaseManager()
        self.active_executions: Dict[str, asyncio.Task] = {}

    async def execute_agent(
        self,
        agent_type: AgentType,
        input_data: Dict[str, Any],
        workflow_id: Optional[str] = None,
        execution_id: Optional[str] = None,
        max_retries: int = 3
    ) -> ExecutionResult:
        """Execute a single agent."""
        agent_id = agent_type.value
        workflow_id = workflow_id or str(uuid.uuid4())
        
        # Create execution record
        exec_id = self.db.create_execution(agent_id, workflow_id, input_data, execution_id=execution_id)
        execution_id = execution_id or exec_id
        
        # Convert tools to LangChain format
        tools = self._prepare_tools()
        
        # Create agent
        agent = NexusAgent(
            agent_id=agent_id,
            agent_type=agent_type,
            execution_id=execution_id,
            tools=tools
        )
        
        # Execute with retry logic
        last_error = None
        for attempt in range(max_retries):
            try:
                result = await agent.execute(input_data)
                
                if result.status.value == 'success':
                    if attempt > 0:
                        self.db.log_audit_entry(
                            execution_id,
                            agent_id,
                            "retry_recovered",
                            {"attempt": attempt + 1, "status": "success_after_retry"}
                        )
                    return result
                
                last_error = result.error
                if attempt < max_retries - 1:
                    self.db.log_audit_entry(
                        execution_id,
                        agent_id,
                        "retry_attempt",
                        {
                            "attempt": attempt + 1,
                            "error": last_error or "Agent returned failed status",
                            "reason": "execution_result_failed"
                        }
                    )
                    await asyncio.sleep(2 ** attempt)
            except Exception as e:
                last_error = str(e)
                if attempt < max_retries - 1:
                    # Exponential backoff
                    self.db.log_audit_entry(execution_id, agent_id, "retry_attempt", {"attempt": attempt + 1, "error": str(e)})
                    await asyncio.sleep(2 ** attempt)
        
        # Return failure result after retries
        self.db.log_audit_entry(execution_id, agent_id, "execution_failed", {"error": last_error or "Max retries exceeded"})
        return ExecutionResult(
            agent_id=agent_id,
            execution_id=execution_id,
            status=ExecutionStatus.FAILED,
            output={},
            state=AgentState(
                agent_id=agent_id,
                messages=[],
                current_step=0,
                context=input_data,
                tools_used=[],
                errors=[last_error or "Max retries exceeded"],
                created_at=datetime.now(),
                updated_at=datetime.now()
            ),
            error=last_error or "Max retries exceeded",
            retry_count=max_retries
        )

    async def execute_workflow(
        self,
        agents: list[tuple[AgentType, Dict[str, Any]]],
        workflow_id: Optional[str] = None,
        execution_ids: Optional[list[str]] = None
    ) -> list[ExecutionResult]:
        """Execute multiple agents in sequence."""
        workflow_id = workflow_id or str(uuid.uuid4())
        results = []
        
        for i, (agent_type, input_data) in enumerate(agents):
            exec_id = execution_ids[i] if execution_ids and len(execution_ids) > i else None

            if exec_id:
                self.db.log_audit_entry(
                    exec_id,
                    agent_type.value,
                    'workflow_step_started',
                    {
                        'step_index': i + 1,
                        'total_steps': len(agents),
                        'workflow_id': workflow_id,
                        'execution_mode': 'sequential',
                    }
                )

            # Inject context conditionally for collaboration passing
            if results and results[-1].status.value == 'success':
                input_data["previous_agent_output"] = results[-1].output
                if exec_id:
                    self.db.log_audit_entry(
                        exec_id,
                        agent_type.value,
                        'workflow_handoff_received',
                        {
                            'from_agent': results[-1].agent_id,
                            'from_execution_id': results[-1].execution_id,
                            'output_preview': str(results[-1].output)[:220],
                        }
                    )
                
            result = await self.execute_agent(
                agent_type=agent_type,
                input_data=input_data,
                workflow_id=workflow_id,
                execution_id=exec_id
            )
            results.append(result)

            if exec_id:
                self.db.log_audit_entry(
                    exec_id,
                    agent_type.value,
                    'workflow_step_completed',
                    {
                        'step_index': i + 1,
                        'status': result.status.value,
                        'duration_seconds': result.duration_seconds,
                    }
                )
            
            # If agent fails, stop workflow
            if result.status.value == 'failed':
                break
        
        return results

    async def execute_parallel(
        self,
        agents: list[tuple[AgentType, Dict[str, Any]]],
        workflow_id: Optional[str] = None,
        execution_ids: Optional[list[str]] = None
    ) -> list[ExecutionResult]:
        """Execute multiple agents in parallel."""
        workflow_id = workflow_id or str(uuid.uuid4())
        
        tasks = [
            self.execute_agent(
                agent_type=agent_type,
                input_data=input_data,
                workflow_id=workflow_id,
                execution_id=execution_ids[i] if execution_ids and len(execution_ids) > i else None
            )
            for i, (agent_type, input_data) in enumerate(agents)
        ]
        
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # Convert exceptions to ExecutionResult
        final_results = []
        for result in results:
            if isinstance(result, Exception):
                final_results.append(ExecutionResult(
                    agent_id='unknown',
                    execution_id='unknown',
                    status=ExecutionStatus.FAILED,
                    output={},
                    state=AgentState(
                        agent_id='unknown',
                        messages=[],
                        current_step=0,
                        context={},
                        tools_used=[],
                        errors=[str(result)],
                        created_at=datetime.now(),
                        updated_at=datetime.now()
                    ),
                    error=str(result)
                ))
            else:
                final_results.append(result)
        
        return final_results

    def _prepare_tools(self) -> list[Tool]:
        """Prepare tools for agent use."""
        tools = []
        
        for tool_def in self.tool_registry.list_tools():
            tool = Tool(
                name=tool_def.name,
                func=tool_def.func,
                description=tool_def.description
            )
            tools.append(tool)
        
        return tools

    def get_execution_status(self, execution_id: str) -> Optional[Dict[str, Any]]:
        """Get execution status."""
        return self.db.get_execution(execution_id)

    def get_execution_history(self, workflow_id: str) -> list[Dict[str, Any]]:
        """Get execution history for workflow."""
        conn = self.db.get_connection()
        cursor = conn.cursor()
        
        try:
            cursor.execute(
                "SELECT * FROM executions WHERE workflow_id = %s ORDER BY created_at DESC",
                (workflow_id,)
            )
            return [dict(row) for row in cursor.fetchall()]
        finally:
            cursor.close()
            conn.close()


# Async execution wrapper for sync context
async def run_agent(
    agent_type: AgentType,
    input_data: Dict[str, Any],
    **kwargs
) -> ExecutionResult:
    """Run agent synchronously (wrapper for async)."""
    executor = AgentExecutor()
    return await executor.execute_agent(agent_type, input_data, **kwargs)


async def run_workflow(
    agents: list[tuple[AgentType, Dict[str, Any]]],
    parallel: bool = False,
    execution_ids: Optional[list[str]] = None,
    **kwargs
) -> list[ExecutionResult]:
    """Run workflow synchronously (wrapper for async)."""
    executor = AgentExecutor()
    
    if parallel:
        return await executor.execute_parallel(agents, execution_ids=execution_ids, **kwargs)
    else:
        return await executor.execute_workflow(agents, execution_ids=execution_ids, **kwargs)
