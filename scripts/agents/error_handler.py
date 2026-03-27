"""Error handling and recovery for Nexus-Agent framework."""
import asyncio
import logging
from typing import Callable, TypeVar, Any, Optional
from functools import wraps
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)

T = TypeVar('T')


class AgentError(Exception):
    """Base exception for agent-related errors."""
    pass


class ExecutionError(AgentError):
    """Exception during agent execution."""
    def __init__(self, message: str, execution_id: str, agent_id: str):
        super().__init__(message)
        self.execution_id = execution_id
        self.agent_id = agent_id
        self.timestamp = datetime.utcnow()


class ToolExecutionError(AgentError):
    """Exception during tool execution."""
    def __init__(self, message: str, tool_name: str, retry_count: int = 0):
        super().__init__(message)
        self.tool_name = tool_name
        self.retry_count = retry_count
        self.timestamp = datetime.utcnow()


class TimeoutError(AgentError):
    """Execution timeout error."""
    def __init__(self, message: str, timeout_seconds: int):
        super().__init__(message)
        self.timeout_seconds = timeout_seconds


class CircuitBreakerOpen(AgentError):
    """Circuit breaker is open."""
    def __init__(self, message: str, recovery_at: datetime):
        super().__init__(message)
        self.recovery_at = recovery_at


class RetryConfig:
    """Configuration for retry logic."""
    def __init__(
        self,
        max_retries: int = 3,
        initial_delay: float = 1.0,
        max_delay: float = 60.0,
        exponential_base: float = 2.0,
        jitter: bool = True,
    ):
        self.max_retries = max_retries
        self.initial_delay = initial_delay
        self.max_delay = max_delay
        self.exponential_base = exponential_base
        self.jitter = jitter

    def get_delay(self, attempt: int) -> float:
        """Calculate delay for retry attempt."""
        import random
        
        delay = min(
            self.initial_delay * (self.exponential_base ** attempt),
            self.max_delay
        )
        
        if self.jitter:
            delay = delay * random.uniform(0.5, 1.0)
        
        return delay


class CircuitBreaker:
    """Circuit breaker pattern for fault tolerance."""
    def __init__(
        self,
        failure_threshold: int = 5,
        recovery_timeout: int = 60,
        success_threshold: int = 2,
    ):
        self.failure_threshold = failure_threshold
        self.recovery_timeout = recovery_timeout
        self.success_threshold = success_threshold
        
        self.failure_count = 0
        self.success_count = 0
        self.last_failure_time: Optional[datetime] = None
        self.state = 'closed'  # closed, open, half_open

    def record_success(self) -> None:
        """Record successful operation."""
        if self.state == 'half_open':
            self.success_count += 1
            if self.success_count >= self.success_threshold:
                self.state = 'closed'
                self.failure_count = 0
                self.success_count = 0
                logger.info('Circuit breaker closed')
        elif self.state == 'closed':
            self.failure_count = 0

    def record_failure(self) -> None:
        """Record failed operation."""
        self.failure_count += 1
        self.last_failure_time = datetime.utcnow()
        
        if self.failure_count >= self.failure_threshold:
            self.state = 'open'
            logger.warning(f'Circuit breaker opened after {self.failure_count} failures')

    def call(self, func: Callable[..., T], *args: Any, **kwargs: Any) -> T:
        """Execute function with circuit breaker protection."""
        if self.state == 'open':
            if self.last_failure_time:
                elapsed = (datetime.utcnow() - self.last_failure_time).total_seconds()
                if elapsed > self.recovery_timeout:
                    self.state = 'half_open'
                    self.success_count = 0
                    logger.info('Circuit breaker half-open, attempting recovery')
                else:
                    raise CircuitBreakerOpen(
                        'Circuit breaker is open',
                        self.last_failure_time + timedelta(seconds=self.recovery_timeout)
                    )
        
        try:
            result = func(*args, **kwargs)
            self.record_success()
            return result
        except Exception as e:
            self.record_failure()
            raise


class ErrorHandler:
    """Centralized error handling for agents."""
    
    def __init__(self, retry_config: Optional[RetryConfig] = None):
        self.retry_config = retry_config or RetryConfig()
        self.error_history: list[dict] = []
        self.circuit_breakers: dict[str, CircuitBreaker] = {}

    async def with_retry(
        self,
        func: Callable[..., Any],
        *args: Any,
        operation_name: str = 'operation',
        **kwargs: Any
    ) -> Any:
        """Execute function with retry logic."""
        last_error = None
        
        for attempt in range(self.retry_config.max_retries):
            try:
                logger.info(f'Executing {operation_name} (attempt {attempt + 1})')
                return await func(*args, **kwargs) if asyncio.iscoroutinefunction(func) else func(*args, **kwargs)
            
            except Exception as e:
                last_error = e
                logger.warning(
                    f'{operation_name} failed (attempt {attempt + 1}): {str(e)}'
                )
                
                # Record error
                self.error_history.append({
                    'operation': operation_name,
                    'attempt': attempt + 1,
                    'error': str(e),
                    'timestamp': datetime.utcnow().isoformat(),
                })
                
                # Last attempt, don't retry
                if attempt == self.retry_config.max_retries - 1:
                    break
                
                # Wait before retry
                delay = self.retry_config.get_delay(attempt)
                logger.info(f'Retrying in {delay:.1f} seconds...')
                await asyncio.sleep(delay)
        
        raise last_error or AgentError(
            f'Failed after {self.retry_config.max_retries} attempts'
        )

    def get_circuit_breaker(self, name: str) -> CircuitBreaker:
        """Get or create circuit breaker."""
        if name not in self.circuit_breakers:
            self.circuit_breakers[name] = CircuitBreaker()
        return self.circuit_breakers[name]

    def get_error_summary(self) -> dict[str, Any]:
        """Get summary of errors."""
        if not self.error_history:
            return {'total_errors': 0, 'errors': []}
        
        return {
            'total_errors': len(self.error_history),
            'errors': self.error_history[-10:],  # Last 10 errors
            'operations': list(set(e['operation'] for e in self.error_history)),
        }


def retry_on_error(max_retries: int = 3, delay: float = 1.0):
    """Decorator for automatic retry on error."""
    def decorator(func: Callable[..., T]) -> Callable[..., T]:
        @wraps(func)
        async def async_wrapper(*args: Any, **kwargs: Any) -> T:
            last_error = None
            for attempt in range(max_retries):
                try:
                    return await func(*args, **kwargs)
                except Exception as e:
                    last_error = e
                    if attempt < max_retries - 1:
                        await asyncio.sleep(delay * (2 ** attempt))
            raise last_error
        
        @wraps(func)
        def sync_wrapper(*args: Any, **kwargs: Any) -> T:
            last_error = None
            for attempt in range(max_retries):
                try:
                    return func(*args, **kwargs)
                except Exception as e:
                    last_error = e
                    if attempt < max_retries - 1:
                        import time
                        time.sleep(delay * (2 ** attempt))
            raise last_error
        
        if asyncio.iscoroutinefunction(func):
            return async_wrapper  # type: ignore
        else:
            return sync_wrapper  # type: ignore
    
    return decorator


def handle_timeout(timeout_seconds: int):
    """Decorator for timeout handling."""
    def decorator(func: Callable[..., T]) -> Callable[..., T]:
        @wraps(func)
        async def async_wrapper(*args: Any, **kwargs: Any) -> T:
            try:
                return await asyncio.wait_for(
                    func(*args, **kwargs),
                    timeout=timeout_seconds
                )
            except asyncio.TimeoutError:
                raise TimeoutError(
                    f'Operation timed out after {timeout_seconds} seconds',
                    timeout_seconds
                )
        
        @wraps(func)
        def sync_wrapper(*args: Any, **kwargs: Any) -> T:
            import signal
            
            def timeout_handler(signum: int, frame: Any) -> None:
                raise TimeoutError(
                    f'Operation timed out after {timeout_seconds} seconds',
                    timeout_seconds
                )
            
            # Only works on Unix
            try:
                signal.signal(signal.SIGALRM, timeout_handler)
                signal.alarm(timeout_seconds)
                result = func(*args, **kwargs)
                signal.alarm(0)
                return result
            except Exception:
                signal.alarm(0)
                raise
        
        if asyncio.iscoroutinefunction(func):
            return async_wrapper  # type: ignore
        else:
            return sync_wrapper  # type: ignore
    
    return decorator
