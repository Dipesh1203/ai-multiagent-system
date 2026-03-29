"""LangGraph-based agent builder for Nexus-Agent."""
import os
import json
from datetime import datetime
from typing import Any, Dict, List, Optional, Callable
from functools import wraps

from langgraph.graph import StateGraph, START, END
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.tools import Tool
from langchain_core.messages import AIMessage, HumanMessage, SystemMessage

from .agent_types import AgentState, ExecutionStatus, ExecutionResult, ToolCall, AgentType
from .database import DatabaseManager


class NexusAgent:
    """Base agent class using LangGraph."""

    def __init__(
        self,
        agent_id: str,
        agent_type: AgentType,
        execution_id: str,
        tools: Optional[List[Tool]] = None,
        model_name: str = "gemini-2.5-flash",
    ):
        """Initialize agent."""
        self.agent_id = agent_id
        self.agent_type = agent_type
        self.execution_id = execution_id
        self.tools = tools or []
        self.db = DatabaseManager()
        
        # Initialize LLM
        api_key = os.getenv('GOOGLE_API_KEY')
        if not api_key:
            raise ValueError("GOOGLE_API_KEY environment variable not set")
        
        self.llm = ChatGoogleGenerativeAI(
            model=model_name,
            google_api_key=api_key,
            temperature=0.7,
            max_output_tokens=2048,
        )
        
        # Build LangGraph
        self.graph = self._build_graph()

    def _build_graph(self) -> StateGraph:
        """Build LangGraph workflow."""
        graph = StateGraph(dict)
        
        # Define nodes
        graph.add_node("process", self._process_node)
        graph.add_node("tool_use", self._tool_node)
        graph.add_node("complete", self._complete_node)
        
        # Define edges
        graph.add_edge(START, "process")
        graph.add_conditional_edges(
            "process",
            self._should_use_tool,
            {
                True: "tool_use",
                False: "complete"
            }
        )
        graph.add_edge("tool_use", "process")
        graph.add_edge("complete", END)
        
        return graph

    def _should_use_tool(self, state: Dict[str, Any]) -> bool:
        """Determine if tool use is needed."""
        messages = state.get('messages', [])
        if not messages:
            return False
        
        last_message = messages[-1]
        if isinstance(last_message, dict):
            content = last_message.get('content', '')
        else:
            content = getattr(last_message, 'content', '')
        
        return 'tool_' in str(content).lower()

    def _process_node(self, state: Dict[str, Any]) -> Dict[str, Any]:
        """Process state and generate response."""
        messages = state.get('messages', [])
        
        # Build messages for LLM
        llm_messages = []
        
        # Add system message
        system_prompt = self._get_system_prompt()
        llm_messages.append(SystemMessage(content=system_prompt))
        
        # Add previous messages
        for msg in messages:
            if isinstance(msg, dict):
                role = msg.get('role', 'user')
                content = msg.get('content', '')
                if role == 'assistant':
                    llm_messages.append(AIMessage(content=content))
                else:
                    llm_messages.append(HumanMessage(content=content))
            else:
                llm_messages.append(msg)

        self.db.log_audit_entry(
            self.execution_id,
            self.agent_id,
            'llm_invocation_started',
            {
                'message_count': len(llm_messages),
                'agent_type': self.agent_type.value,
            }
        )
        
        # Get response from LLM
        response = self.llm.invoke(llm_messages)

        response_text = str(response.content)
        self.db.log_audit_entry(
            self.execution_id,
            self.agent_id,
            'llm_response_generated',
            {
                'char_count': len(response_text),
                'response_preview': response_text[:220],
                'tool_hint_detected': 'tool_' in response_text.lower(),
            }
        )
        
        # Add to messages
        new_messages = messages + [{
            'role': 'assistant',
            'content': response.content,
            'timestamp': datetime.utcnow().isoformat()
        }]
        
        state['messages'] = new_messages
        state['last_message'] = response.content
        
        return state

    def _tool_node(self, state: Dict[str, Any]) -> Dict[str, Any]:
        """Execute tool based on last message."""
        messages = state.get('messages', [])
        last_message = messages[-1] if messages else None
        
        if not last_message:
            return state
        
        content = last_message.get('content', '') if isinstance(last_message, dict) else getattr(last_message, 'content', '')
        
        # Parse tool call from message
        tool_name = self._extract_tool_name(content)
        
        if tool_name:
            tool = self._get_tool(tool_name)
            if tool:
                try:
                    # Execute tool
                    result = tool.func(content)
                    
                    # Log tool use
                    self.db.log_audit_entry(
                        self.execution_id,
                        self.agent_id,
                        'tool_executed',
                        {
                            'tool_name': tool_name,
                            'status': 'success',
                            'result_preview': str(result)[:500]
                        }
                    )
                    
                    # Add tool result to messages
                    messages.append({
                        'role': 'tool',
                        'name': tool_name,
                        'content': str(result),
                        'timestamp': datetime.utcnow().isoformat()
                    })
                except Exception as e:
                    self.db.log_audit_entry(
                        self.execution_id,
                        self.agent_id,
                        'tool_error',
                        {'tool_name': tool_name, 'error': str(e)}
                    )
                    messages.append({
                        'role': 'tool',
                        'name': tool_name,
                        'content': f"Error: {str(e)}",
                        'timestamp': datetime.utcnow().isoformat()
                    })
        
        state['messages'] = messages
        return state

    def _complete_node(self, state: Dict[str, Any]) -> Dict[str, Any]:
        """Mark execution as complete."""
        state['status'] = 'completed'
        return state

    def _get_system_prompt(self) -> str:
        """Get system prompt for agent."""
        prompts = {
            AgentType.RESEARCH: "You are a research agent. Your task is to gather and analyze information.",
            AgentType.ANALYSIS: "You are an analysis agent. Your task is to perform detailed analysis and insights.",
            AgentType.DECISION: "You are a decision-making agent. Your task is to make recommendations.",
            AgentType.EXECUTION: "You are an execution agent. Your task is to execute actions.",
        }
        return prompts.get(self.agent_type, "You are a helpful assistant.")

    def _extract_tool_name(self, content: str) -> Optional[str]:
        """Extract tool name from message."""
        for tool in self.tools:
            if f"tool_{tool.name}" in content.lower():
                return tool.name
        return None

    def _get_tool(self, tool_name: str) -> Optional[Tool]:
        """Get tool by name."""
        for tool in self.tools:
            if tool.name == tool_name:
                return tool
        return None

    async def execute(self, input_data: Dict[str, Any]) -> ExecutionResult:
        """Execute agent."""
        start_time = datetime.utcnow()
        
        # Initialize state
        state = {
            'messages': [{
                'role': 'user',
                'content': json.dumps(input_data),
                'timestamp': start_time.isoformat()
            }],
            'status': 'running'
        }
        
        try:
            # Log execution start
            self.db.log_audit_entry(
                self.execution_id,
                self.agent_id,
                'execution_started',
                {'agent_type': self.agent_type.value}
            )

            self.db.log_audit_entry(
                self.execution_id,
                self.agent_id,
                'execution_input_received',
                {
                    'input_keys': list(input_data.keys()),
                    'input_size_bytes': len(json.dumps(input_data)),
                    'has_previous_agent_output': bool(input_data.get('previous_agent_output')),
                }
            )

            if input_data.get('previous_agent_output'):
                self.db.log_audit_entry(
                    self.execution_id,
                    self.agent_id,
                    'collaboration_context_received',
                    {
                        'context_key': 'previous_agent_output',
                        'context_preview': str(input_data.get('previous_agent_output'))[:220],
                    }
                )
            
            # Run graph
            compiled_graph = self.graph.compile()
            final_state = compiled_graph.invoke(state)
            duration = (datetime.utcnow() - start_time).total_seconds()
            
            # Update execution status
            self.db.update_execution(
                self.execution_id,
                'success',
                output={'result': final_state.get('last_message')}
            )
            
            # Log completion
            self.db.log_audit_entry(
                self.execution_id,
                self.agent_id,
                'execution_completed',
                {
                    'status': 'success',
                    'duration_seconds': duration,
                    'message_count': len(final_state.get('messages', [])),
                }
            )
            
            # Save final state
            self.db.save_agent_state(
                self.execution_id,
                self.agent_id,
                final_state
            )

            self.db.log_audit_entry(
                self.execution_id,
                self.agent_id,
                'execution_state_saved',
                {'message_count': len(final_state.get('messages', []))}
            )
            
            return ExecutionResult(
                agent_id=self.agent_id,
                execution_id=self.execution_id,
                status=ExecutionStatus.SUCCESS,
                output={'result': final_state.get('last_message')},
                state=AgentState(
                    agent_id=self.agent_id,
                    messages=final_state.get('messages', []),
                    current_step=len(final_state.get('messages', [])),
                    context=input_data,
                    tools_used=[],
                    errors=[],
                    created_at=start_time,
                    updated_at=datetime.utcnow()
                ),
                duration_seconds=duration
            )
        
        except Exception as e:
            error_msg = str(e)
            duration = (datetime.utcnow() - start_time).total_seconds()
            
            # Update execution with error
            self.db.update_execution(
                self.execution_id,
                'failed',
                error=error_msg
            )
            
            # Log error
            self.db.log_audit_entry(
                self.execution_id,
                self.agent_id,
                'execution_error',
                {
                    'error': error_msg,
                    'duration_seconds': duration,
                }
            )
            
            return ExecutionResult(
                agent_id=self.agent_id,
                execution_id=self.execution_id,
                status=ExecutionStatus.FAILED,
                output={},
                error=error_msg,
                state=AgentState(
                    agent_id=self.agent_id,
                    messages=[],
                    current_step=0,
                    context={},
                    tools_used=[],
                    errors=[error_msg],
                    created_at=start_time,
                    updated_at=datetime.utcnow()
                ),
                duration_seconds=duration
            )
