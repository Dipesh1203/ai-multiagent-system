"""Agent execution engine."""
import asyncio
import uuid
from typing import Any, Dict, Optional
from datetime import datetime

from .agent_builder import NexusAgent
from .tools import create_default_tool_registry, ToolRegistry
from .types import AgentType, ExecutionResult
from .database import DatabaseManager
from langchain.tools import Tool


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
        max_retries: int = 3
    ) -> ExecutionResult:
        """Execute a single agent."""
        agent_id = str(uuid.uuid4())
        workflow_id = workflow_id or str(uuid.uuid4())
        
        # Create execution record
        execution_id = self.db.create_execution(agent_id, workflow_id, input_data)
        
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
                    return result
                
                last_error = result.error
            except Exception as e:
                last_error = str(e)
                if attempt < max_retries - 1:
                    # Exponential backoff
                    await asyncio.sleep(2 ** attempt)
        
        # Return failure result after retries
        return ExecutionResult(
            agent_id=agent_id,
            execution_id=execution_id,
            status='failed',
            output={},
            error=last_error or "Max retries exceeded",
            retry_count=max_retries
        )

    async def execute_workflow(
        self,
        agents: list[tuple[AgentType, Dict[str, Any]]],
        workflow_id: Optional[str] = None
    ) -> list[ExecutionResult]:
        """Execute multiple agents in sequence."""
        workflow_id = workflow_id or str(uuid.uuid4())
        results = []
        
        for agent_type, input_data in agents:
            result = await self.execute_agent(
                agent_type=agent_type,
                input_data=input_data,
                workflow_id=workflow_id
            )
            results.append(result)
            
            # If agent fails, stop workflow
            if result.status.value == 'failed':
                break
        
        return results

    async def execute_parallel(
        self,
        agents: list[tuple[AgentType, Dict[str, Any]]],
        workflow_id: Optional[str] = None
    ) -> list[ExecutionResult]:
        """Execute multiple agents in parallel."""
        workflow_id = workflow_id or str(uuid.uuid4())
        
        tasks = [
            self.execute_agent(
                agent_type=agent_type,
                input_data=input_data,
                workflow_id=workflow_id
            )
            for agent_type, input_data in agents
        ]
        
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # Convert exceptions to ExecutionResult
        final_results = []
        for result in results:
            if isinstance(result, Exception):
                final_results.append(ExecutionResult(
                    agent_id='unknown',
                    execution_id='unknown',
                    status='failed',
                    output={},
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
    **kwargs
) -> list[ExecutionResult]:
    """Run workflow synchronously (wrapper for async)."""
    executor = AgentExecutor()
    
    if parallel:
        return await executor.execute_parallel(agents, **kwargs)
    else:
        return await executor.execute_workflow(agents, **kwargs)
