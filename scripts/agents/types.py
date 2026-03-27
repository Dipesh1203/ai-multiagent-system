"""Type definitions for Nexus-Agent framework."""
from typing import Any, Optional, Dict, List
from enum import Enum
from dataclasses import dataclass, asdict
from datetime import datetime
import json


class AgentType(str, Enum):
    """Types of agents in the system."""
    RESEARCH = "research"
    ANALYSIS = "analysis"
    DECISION = "decision"
    EXECUTION = "execution"


class ExecutionStatus(str, Enum):
    """Status of agent execution."""
    PENDING = "pending"
    RUNNING = "running"
    SUCCESS = "success"
    FAILED = "failed"
    RETRY = "retry"


class WorkflowStatus(str, Enum):
    """Status of workflow execution."""
    DRAFT = "draft"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    PAUSED = "paused"


@dataclass
class AgentState:
    """State representation for LangGraph agents."""
    agent_id: str
    messages: List[Dict[str, Any]]
    current_step: int
    context: Dict[str, Any]
    tools_used: List[str]
    errors: List[str]
    created_at: datetime
    updated_at: datetime

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        data = asdict(self)
        data['created_at'] = self.created_at.isoformat()
        data['updated_at'] = self.updated_at.isoformat()
        return data

    @staticmethod
    def from_dict(data: Dict[str, Any]) -> 'AgentState':
        """Create from dictionary."""
        data['created_at'] = datetime.fromisoformat(data['created_at'])
        data['updated_at'] = datetime.fromisoformat(data['updated_at'])
        return AgentState(**data)


@dataclass
class ExecutionResult:
    """Result of agent execution."""
    agent_id: str
    execution_id: str
    status: ExecutionStatus
    output: Dict[str, Any]
    state: AgentState
    error: Optional[str] = None
    retry_count: int = 0
    duration_seconds: float = 0.0


@dataclass
class ToolCall:
    """Tool invocation in an agent."""
    tool_name: str
    input_params: Dict[str, Any]
    timestamp: datetime

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            'tool_name': self.tool_name,
            'input_params': self.input_params,
            'timestamp': self.timestamp.isoformat()
        }
