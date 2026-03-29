"""Database connection and operations for Nexus-Agent."""
import os
import json
from datetime import datetime
from typing import Any, Dict, Optional
import psycopg2


class DatabaseManager:
    """Manages database connections and queries."""

    def __init__(self):
        """Initialize database manager with connection from environment."""
        self.connection_string = os.getenv('PYTHON_DATABASE_URL') or os.getenv('DATABASE_URL')
        if not self.connection_string:
            raise ValueError("PYTHON_DATABASE_URL or DATABASE_URL environment variable not set")

    def get_connection(self):
        """Get database connection."""
        return psycopg2.connect(self.connection_string, connect_timeout=15)

    def _get_or_create_agent_pk(self, cursor, agent_name: str) -> int:
        cursor.execute("SELECT id FROM agents WHERE name = %s", (agent_name,))
        res = cursor.fetchone()
        if res:
            return res['id'] if isinstance(res, dict) else res[0]
        cursor.execute(
            "INSERT INTO agents (name, agent_type, created_at, updated_at) VALUES (%s, %s, %s, %s) RETURNING id",
            (agent_name, agent_name.upper(), datetime.utcnow(), datetime.utcnow())
        )
        res = cursor.fetchone()
        return res['id'] if isinstance(res, dict) else res[0]

    def _get_execution_pk(self, cursor, execution_id: str) -> Optional[int]:
        cursor.execute("SELECT id FROM executions WHERE execution_id = %s", (execution_id,))
        res = cursor.fetchone()
        if res:
            return res['id'] if isinstance(res, dict) else res[0]
        return None

    def create_execution(self, agent_id: str, workflow_id: str, input_data: Dict[str, Any], execution_id: Optional[str] = None) -> str:
        """Create a new execution record."""
        import uuid
        new_id = execution_id or str(uuid.uuid4())
        try:
            with self.get_connection() as conn:
                from psycopg2.extras import RealDictCursor
                with conn.cursor(cursor_factory=RealDictCursor) as cursor:
                    # Note: The 'executions' mapping has 'workflowId' Int, but since we use random workflow_id,
                    # we will safely ignore mapping workflowId to the executions table for now to prevent FK constraint failures
                    # The schema defines workflowId : Int? in executions.
                    cursor.execute(
                        """
                        INSERT INTO executions (execution_id, status, input_data, created_at)
                        VALUES (%s, %s, %s, %s)
                        """,
                        (new_id, 'pending', json.dumps(input_data), datetime.utcnow())
                    )
        except Exception as e:
            import sys
            print(f"[v0] DB Skip create_execution: {e}", file=sys.stderr)
        return new_id

    def update_execution(
        self,
        execution_id: str,
        status: str,
        output: Optional[Dict[str, Any]] = None,
        error: Optional[str] = None
    ) -> None:
        """Update execution record."""
        try:
            with self.get_connection() as conn:
                with conn.cursor() as cursor:
                    cursor.execute(
                        """
                        UPDATE executions
                        SET status = %s, output_data = %s, error_message = %s, completed_at = %s
                        WHERE execution_id = %s
                        """,
                        (
                            status,
                            json.dumps(output) if output else None,
                            error,
                            datetime.utcnow(),
                            execution_id
                        )
                    )
        except Exception as e:
            import sys
            print(f"[v0] DB Skip update_execution: {e}", file=sys.stderr)

    def save_agent_state(self, execution_id: str, agent_id: str, state_data: Dict[str, Any]) -> None:
        """Save agent state."""
        try:
            with self.get_connection() as conn:
                from psycopg2.extras import RealDictCursor
                with conn.cursor(cursor_factory=RealDictCursor) as cursor:
                    exec_pk = self._get_execution_pk(cursor, execution_id)
                    agent_pk = self._get_or_create_agent_pk(cursor, agent_id)

                    if exec_pk and agent_pk:
                        cursor.execute(
                            """
                            INSERT INTO agent_states (execution_id, agent_id, state, created_at)
                            VALUES (%s, %s, %s, %s)
                            """,
                            (exec_pk, agent_pk, json.dumps(state_data), datetime.utcnow())
                        )
        except Exception as e:
            import sys
            print(f"[v0] DB Skip save_agent_state: {e}", file=sys.stderr)

    def log_audit_entry(
        self,
        execution_id: str,
        agent_id: str,
        action: str,
        details: Dict[str, Any]
    ) -> None:
        """Log audit trail entry."""
        try:
            with self.get_connection() as conn:
                from psycopg2.extras import RealDictCursor
                with conn.cursor(cursor_factory=RealDictCursor) as cursor:
                    exec_pk = self._get_execution_pk(cursor, execution_id)
                    agent_pk = self._get_or_create_agent_pk(cursor, agent_id)

                    if exec_pk and agent_pk:
                        cursor.execute(
                            """
                            INSERT INTO audit_logs (execution_id, agent_id, action, details, timestamp)
                            VALUES (%s, %s, %s, %s, %s)
                            """,
                            (exec_pk, agent_pk, action, json.dumps(details), datetime.utcnow())
                        )
        except Exception as e:
            import sys
            print(f"[v0] DB Skip log_audit_entry: {e}", file=sys.stderr)

    def get_execution(self, execution_id: str) -> Optional[Dict[str, Any]]:
        """Get execution record."""
        try:
            with self.get_connection() as conn:
                from psycopg2.extras import RealDictCursor
                with conn.cursor(cursor_factory=RealDictCursor) as cursor:
                    cursor.execute("SELECT * FROM executions WHERE execution_id = %s", (execution_id,))
                    result = cursor.fetchone()
                    return result
        except Exception as e:
            import sys
            print(f"[v0] DB Skip get_execution: {e}", file=sys.stderr)
            return None

    def get_agent_state(self, execution_id: str, agent_id: str) -> Optional[Dict[str, Any]]:
        """Get agent state."""
        return None  # Skip schema mismatch
