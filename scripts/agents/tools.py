"""Tool system for agent execution."""
import json
from typing import Any, Dict, Callable, Optional, List
from dataclasses import dataclass


@dataclass
class ToolDefinition:
    """Definition of a tool that agents can use."""
    name: str
    description: str
    input_schema: Dict[str, Any]
    func: Callable


class ToolRegistry:
    """Registry for managing agent tools."""

    def __init__(self):
        """Initialize tool registry."""
        self.tools: Dict[str, ToolDefinition] = {}

    def register(
        self,
        name: str,
        description: str,
        input_schema: Dict[str, Any],
        func: Callable
    ) -> None:
        """Register a tool."""
        self.tools[name] = ToolDefinition(
            name=name,
            description=description,
            input_schema=input_schema,
            func=func
        )

    def get_tool(self, name: str) -> Optional[ToolDefinition]:
        """Get a tool by name."""
        return self.tools.get(name)

    def list_tools(self) -> List[ToolDefinition]:
        """List all registered tools."""
        return list(self.tools.values())

    def execute_tool(self, name: str, params: Dict[str, Any]) -> Any:
        """Execute a tool with given parameters."""
        tool = self.get_tool(name)
        if not tool:
            raise ValueError(f"Tool '{name}' not found")
        
        try:
            return tool.func(**params)
        except Exception as e:
            raise RuntimeError(f"Tool execution failed: {str(e)}")


class StandardTools:
    """Standard tools available to all agents."""

    @staticmethod
    def web_search(query: str) -> Dict[str, Any]:
        """Simulate web search."""
        return {
            'query': query,
            'results': [
                {
                    'title': f'Result for {query}',
                    'url': 'https://example.com',
                    'snippet': f'Information about {query}'
                }
            ]
        }

    @staticmethod
    def data_fetch(source: str, params: Dict[str, Any]) -> Dict[str, Any]:
        """Fetch data from external source."""
        return {
            'source': source,
            'status': 'success',
            'data': {'sample': 'data'}
        }

    @staticmethod
    def process_data(data: List[Dict[str, Any]], operation: str) -> Dict[str, Any]:
        """Process data with specified operation."""
        return {
            'operation': operation,
            'input_count': len(data),
            'result': f'Processed {len(data)} items'
        }

    @staticmethod
    def generate_report(data: Dict[str, Any], format: str = 'json') -> str:
        """Generate a report from data."""
        if format == 'json':
            return json.dumps(data, indent=2)
        return str(data)

    @staticmethod
    def send_notification(channel: str, message: str) -> Dict[str, Any]:
        """Send notification through a channel."""
        return {
            'channel': channel,
            'message': message,
            'status': 'sent'
        }

    @staticmethod
    def store_result(key: str, value: Any) -> Dict[str, Any]:
        """Store result for future reference."""
        return {
            'key': key,
            'value': value,
            'status': 'stored'
        }

    @staticmethod
    def retrieve_result(key: str) -> Dict[str, Any]:
        """Retrieve previously stored result."""
        return {
            'key': key,
            'value': None,  # Would retrieve from actual storage
            'status': 'retrieved'
        }


def create_default_tool_registry() -> ToolRegistry:
    """Create and populate default tool registry."""
    registry = ToolRegistry()

    # Register standard tools
    registry.register(
        name='web_search',
        description='Search the web for information',
        input_schema={
            'type': 'object',
            'properties': {
                'query': {'type': 'string', 'description': 'Search query'}
            },
            'required': ['query']
        },
        func=StandardTools.web_search
    )

    registry.register(
        name='data_fetch',
        description='Fetch data from external sources',
        input_schema={
            'type': 'object',
            'properties': {
                'source': {'type': 'string', 'description': 'Data source'},
                'params': {'type': 'object', 'description': 'Fetch parameters'}
            },
            'required': ['source']
        },
        func=StandardTools.data_fetch
    )

    registry.register(
        name='process_data',
        description='Process data with various operations',
        input_schema={
            'type': 'object',
            'properties': {
                'data': {'type': 'array', 'description': 'Data to process'},
                'operation': {'type': 'string', 'description': 'Operation type'}
            },
            'required': ['data', 'operation']
        },
        func=StandardTools.process_data
    )

    registry.register(
        name='generate_report',
        description='Generate reports from data',
        input_schema={
            'type': 'object',
            'properties': {
                'data': {'type': 'object', 'description': 'Data for report'},
                'format': {'type': 'string', 'enum': ['json', 'text', 'markdown']}
            },
            'required': ['data']
        },
        func=StandardTools.generate_report
    )

    registry.register(
        name='send_notification',
        description='Send notifications through various channels',
        input_schema={
            'type': 'object',
            'properties': {
                'channel': {'type': 'string', 'description': 'Notification channel'},
                'message': {'type': 'string', 'description': 'Message to send'}
            },
            'required': ['channel', 'message']
        },
        func=StandardTools.send_notification
    )

    registry.register(
        name='store_result',
        description='Store results for future use',
        input_schema={
            'type': 'object',
            'properties': {
                'key': {'type': 'string', 'description': 'Storage key'},
                'value': {'description': 'Value to store'}
            },
            'required': ['key', 'value']
        },
        func=StandardTools.store_result
    )

    registry.register(
        name='retrieve_result',
        description='Retrieve previously stored results',
        input_schema={
            'type': 'object',
            'properties': {
                'key': {'type': 'string', 'description': 'Storage key'}
            },
            'required': ['key']
        },
        func=StandardTools.retrieve_result
    )

    return registry
